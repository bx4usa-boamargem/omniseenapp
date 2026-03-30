import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateAccountRequest {
  email: string;
  fullName: string;
  phone?: string;
  plan: "essential" | "plus" | "scale" | "internal";
  accountType: "internal_team" | "client_free" | "client_paid" | "cliente_manual" | "teste_interno" | "demo";
  notes?: string;
  createBlog?: boolean;
  blogName?: string;
  password?: string;
  preferredLanguage?: string;
  // For associating with existing blog as team member
  addToBlogId?: string;
  teamRole?: "admin" | "editor" | "viewer";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get caller's auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin/platform_admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller has admin/platform_admin role
    const { data: callerRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (rolesError) {
      console.error("Error checking roles:", rolesError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedRoles = ["admin", "platform_admin"];
    const hasPermission = callerRoles?.some(r => allowedRoles.includes(r.role));

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para criar subcontas" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateAccountRequest = await req.json();
    const { 
      email, 
      fullName, 
      phone, 
      plan, 
      accountType, 
      notes, 
      createBlog, 
      blogName,
      password,
      preferredLanguage = "pt-BR",
      addToBlogId,
      teamRole
    } = body;

    if (!email || !fullName || !plan || !accountType) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: email, fullName, plan, accountType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido. Use o formato: usuario@dominio.com" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing customer account for ${email} with plan ${plan}`);

    // Check if user already exists
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    let isExistingUser = false;
    let finalPassword: string | null = null;

    if (existingUser) {
      // User already exists - use existing ID
      userId = existingUser.id;
      isExistingUser = true;
      console.log(`Found existing user with ID: ${userId}`);
    } else {
      // Create new user
      finalPassword = password || generatePassword();
      
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        }
      });

      if (createUserError) {
        console.error("Error creating user:", createUserError);
        return new Response(
          JSON.stringify({ error: `Erro ao criar usuário: ${createUserError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
      console.log(`New user created with ID: ${userId}`);
    }

    // 2. Update profile with additional info
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
        preferred_language: preferredLanguage,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Don't fail, profile might be created by trigger
    }

    // Map legacy account types to new enum
    const mappedAccountType = 
      accountType === "cliente_manual" ? "client_free" :
      accountType === "teste_interno" ? "internal_team" :
      accountType === "demo" ? "client_free" :
      accountType;
    
    // Determine billing_required based on account type
    const billingRequired = accountType === "client_paid";

    // 3. CREATE TENANT (the core multi-tenant entity)
    const tenantSlug = generateSlug(blogName || fullName);
    
    const { data: newTenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: blogName || fullName,
        slug: tenantSlug,
        owner_user_id: userId,
        plan: plan,
        status: "active",
        account_type: mappedAccountType,
        billing_required: billingRequired,
        created_by: caller.id,
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Error creating tenant:", tenantError);
      // If tenant already exists (e.g., user already has a tenant), try to get it
      const { data: existingTenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_user_id", userId)
        .single();
      
      if (!existingTenant) {
        return new Response(
          JSON.stringify({ error: `Erro ao criar tenant: ${tenantError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const tenantId = newTenant?.id;
    console.log(`Tenant created with ID: ${tenantId}`);

    // 4. Add user as tenant owner member
    if (tenantId) {
      const { error: memberError } = await supabase
        .from("tenant_members")
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          role: "owner",
          invited_by: caller.id,
          invited_at: new Date().toISOString(),
        });

      if (memberError) {
        console.error("Error adding tenant member:", memberError);
        // Ignore if already exists
      }
    }

    // 5. Create subscription linked to tenant
    const farFutureDate = "2099-12-31T23:59:59Z";
    
    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        plan: plan,
        status: "active",
        is_internal_account: true,
        account_type: mappedAccountType,
        billing_required: billingRequired,
        created_by_admin: caller.id,
        internal_notes: notes ? `[${accountType}] ${notes}` : `[${accountType}]`,
        trial_ends_at: null,
        current_period_start: new Date().toISOString(),
        current_period_end: farFutureDate,
      });

    if (subscriptionError) {
      console.error("Error creating subscription:", subscriptionError);
      // Try to update existing subscription (created by trigger)
      const { error: updateSubError } = await supabase
        .from("subscriptions")
        .update({
          tenant_id: tenantId,
          plan: plan,
          status: "active",
          is_internal_account: true,
          account_type: mappedAccountType,
          billing_required: billingRequired,
          created_by_admin: caller.id,
          internal_notes: notes ? `[${accountType}] ${notes}` : `[${accountType}]`,
          trial_ends_at: null,
          current_period_end: farFutureDate,
        })
        .eq("user_id", userId);

      if (updateSubError) {
        console.error("Error updating subscription:", updateSubError);
      }
    }

    let blogId = null;

    // 6. Optionally create blog linked to tenant
    if (createBlog && tenantId) {
      const { data: newBlog, error: blogError } = await supabase
        .from("blogs")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          name: blogName || `Blog de ${fullName}`,
          slug: tenantSlug,
          // NOVO PADRÃO: {slug}.app.omniseen.app
          platform_subdomain: `${tenantSlug}.app.omniseen.app`,
          onboarding_completed: true, // Skip onboarding for admin-created accounts
        })
        .select()
        .single();

      if (blogError) {
        console.error("Error creating blog:", blogError);
      } else {
        blogId = newBlog.id;
        console.log(`Blog created with ID: ${blogId}`);
      }
    }

    // 7. Optionally add as team member to existing blog
    if (addToBlogId && teamRole) {
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({
          blog_id: addToBlogId,
          user_id: userId,
          role: teamRole,
          status: "active",
          invited_by: caller.id,
          invited_at: new Date().toISOString(),
          accepted_at: new Date().toISOString(),
        });

      if (memberError) {
        console.error("Error adding team member:", memberError);
      } else {
        console.log(`User added as ${teamRole} to blog ${addToBlogId}`);
      }
    }

    console.log(`Customer account ${isExistingUser ? 'updated' : 'created'} successfully for ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        tenantId,
        blogId,
        isExistingUser,
        credentialsSentViaEmail: !isExistingUser,
        message: isExistingUser 
          ? `Usuário existente "${fullName}" atualizado com sucesso`
          : `Conta criada com sucesso para ${fullName}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: `Erro interno: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}
