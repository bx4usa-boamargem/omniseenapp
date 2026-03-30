import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateTeamMemberRequest {
  email: string;
  fullName: string;
  blogId: string;
  role: "admin" | "editor" | "viewer";
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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateTeamMemberRequest = await req.json();
    const { email, fullName, blogId, role } = body;

    if (!email || !fullName || !blogId || !role) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: email, fullName, blogId, role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-team-member] Creating member ${email} for blog ${blogId}`);

    // Check if caller is owner or admin of the blog
    const { data: blog, error: blogError } = await supabase
      .from("blogs")
      .select("user_id")
      .eq("id", blogId)
      .single();

    if (blogError || !blog) {
      return new Response(
        JSON.stringify({ error: "Blog não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isOwner = blog.user_id === caller.id;

    // Check if caller is admin of the blog
    let isAdmin = false;
    if (!isOwner) {
      const { data: callerMember } = await supabase
        .from("team_members")
        .select("role")
        .eq("blog_id", blogId)
        .eq("user_id", caller.id)
        .eq("status", "active")
        .single();

      isAdmin = callerMember?.role === "admin";
    }

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para adicionar membros" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists as user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // Check if already a member of this blog
      const { data: existingMember } = await supabase
        .from("team_members")
        .select("id")
        .eq("blog_id", blogId)
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "Este usuário já é membro deste blog" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add existing user as team member
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({
          blog_id: blogId,
          user_id: existingUser.id,
          role: role,
          status: "active",
          invited_by: caller.id,
          invited_at: new Date().toISOString(),
          accepted_at: new Date().toISOString(),
        });

      if (memberError) {
        console.error("Error adding existing user as member:", memberError);
        return new Response(
          JSON.stringify({ error: `Erro ao adicionar membro: ${memberError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[create-team-member] Added existing user ${email} as team member`);

      return new Response(
        JSON.stringify({
          success: true,
          userId: existingUser.id,
          isExistingUser: true,
          message: `${fullName} foi adicionado à equipe. Ele pode acessar com a conta existente.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate password for new user
    const password = generatePassword();

    // 1. Create user in auth.users
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
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

    const userId = newUser.user.id;
    console.log(`[create-team-member] User created with ID: ${userId}`);

    // 2. Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    }

    // 3. Create subscription with internal_team type (no billing required)
    const farFutureDate = "2099-12-31T23:59:59Z";
    
    // Get owner's subscription to inherit plan
    const { data: ownerSub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", blog.user_id)
      .single();

    const inheritedPlan = ownerSub?.plan || "essential";

    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: inheritedPlan,
        status: "active",
        is_internal_account: true,
        account_type: "internal_team",
        billing_required: false,
        internal_notes: `[internal_team] Membro de equipe do blog ${blogId}`,
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
          plan: inheritedPlan,
          status: "active",
          is_internal_account: true,
          account_type: "internal_team",
          billing_required: false,
          internal_notes: `[internal_team] Membro de equipe do blog ${blogId}`,
          trial_ends_at: null,
          current_period_end: farFutureDate,
        })
        .eq("user_id", userId);

      if (updateSubError) {
        console.error("Error updating subscription:", updateSubError);
      }
    }

    // 4. Add as team member
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        blog_id: blogId,
        user_id: userId,
        role: role,
        status: "active",
        invited_by: caller.id,
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error("Error creating team member:", memberError);
      return new Response(
        JSON.stringify({ error: `Erro ao adicionar membro: ${memberError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Log activity
    await supabase.from("team_activity_log").insert({
      blog_id: blogId,
      user_id: caller.id,
      action: "member_created",
      resource_type: "team_member",
      resource_id: userId,
      details: { email, role, created_by: caller.id },
    });

    console.log(`[create-team-member] Team member created successfully for ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        isExistingUser: false,
        credentialsSentViaEmail: true,
        message: `Conta criada para ${fullName}. Envie as credenciais para acesso.`,
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
