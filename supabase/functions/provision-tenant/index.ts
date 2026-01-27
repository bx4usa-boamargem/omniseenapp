import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate slug from email
function generateSlugFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  return localPart
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
}

// Generate random suffix for collision handling
function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 8);
}

serve(async (req) => {
  console.log('[provision-tenant] Request received');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create admin client with service role (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create regular client to verify user JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: req.headers.get('Authorization')! }
      }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('[provision-tenant] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[provision-tenant] User authenticated:', user.email);

    // Check if user already has a membership
    const { data: existingMembership } = await supabaseAdmin
      .from('tenant_members')
      .select('tenant_id, tenants(id, slug)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMembership?.tenant_id) {
      console.log('[provision-tenant] User already has membership:', existingMembership.tenant_id);
      
      // Get blog info
      const { data: blog } = await supabaseAdmin
        .from('blogs')
        .select('id, slug, platform_subdomain')
        .eq('tenant_id', existingMembership.tenant_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          status: 'already_provisioned', 
          tenant_id: existingMembership.tenant_id,
          blog_id: blog?.id,
          subdomain: blog?.platform_subdomain
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique slug with collision handling
    const baseSlug = generateSlugFromEmail(user.email || 'user');
    let slug = baseSlug;
    let slugAttempt = 0;
    const MAX_SLUG_ATTEMPTS = 5;

    while (slugAttempt < MAX_SLUG_ATTEMPTS) {
      const { data: existingTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      const { data: existingBlog } = await supabaseAdmin
        .from('blogs')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!existingTenant && !existingBlog) {
        console.log('[provision-tenant] Found unique slug:', slug);
        break;
      }

      slugAttempt++;
      slug = `${baseSlug}-${randomSuffix()}`;
      console.log('[provision-tenant] Slug collision, trying:', slug);
    }

    if (slugAttempt >= MAX_SLUG_ATTEMPTS) {
      console.error('[provision-tenant] Failed to generate unique slug');
      return new Response(
        JSON.stringify({ error: 'Failed to generate unique slug' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformSubdomain = `${slug}.app.omniseen.app`;
    const tenantName = user.email?.split('@')[0] || 'Minha Empresa';

    console.log('[provision-tenant] Creating tenant with slug:', slug);

    // Create tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: tenantName,
        slug: slug,
        owner_user_id: user.id
      })
      .select()
      .single();

    if (tenantError) {
      console.error('[provision-tenant] Tenant creation error:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Failed to create tenant', details: tenantError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[provision-tenant] Tenant created:', tenant.id);

    // Create tenant member (owner)
    const { error: memberError } = await supabaseAdmin
      .from('tenant_members')
      .insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: 'owner'
      });

    if (memberError) {
      console.error('[provision-tenant] Member creation error:', memberError);
      // Rollback tenant
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create membership', details: memberError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[provision-tenant] Member created');

    // Create blog
    const { data: blog, error: blogError } = await supabaseAdmin
      .from('blogs')
      .insert({
        tenant_id: tenant.id,
        user_id: user.id,
        name: tenantName,
        slug: slug,
        platform_subdomain: platformSubdomain,
        is_active: true,
        public_blog_enabled: true
      })
      .select()
      .single();

    if (blogError) {
      console.error('[provision-tenant] Blog creation error:', blogError);
      // Rollback
      await supabaseAdmin.from('tenant_members').delete().eq('tenant_id', tenant.id);
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create blog', details: blogError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[provision-tenant] Blog created:', blog.id);

    // Create tenant domain
    const { error: domainError } = await supabaseAdmin
      .from('tenant_domains')
      .insert({
        tenant_id: tenant.id,
        blog_id: blog.id,
        domain: platformSubdomain,
        domain_type: 'subdomain',
        status: 'active'
      });

    if (domainError) {
      console.error('[provision-tenant] Domain creation error:', domainError);
      // Not critical, continue
    } else {
      console.log('[provision-tenant] Domain created');
    }

    // =============================================
    // MVP-1: AUTO-CREATE AUXILIARY RECORDS
    // =============================================

    // 1. Create brand_agent_config (Sales Agent)
    const { error: agentError } = await supabaseAdmin
      .from('brand_agent_config')
      .insert({
        blog_id: blog.id,
        is_enabled: true,
        agent_name: 'Consultor',
        welcome_message: `Olá! Sou o consultor da ${tenantName}. Como posso ajudar?`,
        proactive_delay_seconds: 5,
        max_tokens_per_day: 50000,
        agent_subscription_status: 'trial'
      });

    if (agentError) {
      console.error('[provision-tenant] Agent config error:', agentError);
      // Not critical, continue
    } else {
      console.log('[provision-tenant] Brand agent config created');
    }

    // 2. Create business_profile
    const { error: businessError } = await supabaseAdmin
      .from('business_profile')
      .insert({
        blog_id: blog.id,
        company_name: tenantName
      });

    if (businessError) {
      console.error('[provision-tenant] Business profile error:', businessError);
      // Not critical, continue
    } else {
      console.log('[provision-tenant] Business profile created');
    }

    // 3. Create blog_automation (manual mode by default)
    const { error: autoError } = await supabaseAdmin
      .from('blog_automation')
      .insert({
        blog_id: blog.id,
        mode: 'manual',
        is_active: false,
        frequency: 'weekly',
        articles_per_period: 1,
        preferred_time: '09:00'
      });

    if (autoError) {
      console.error('[provision-tenant] Automation config error:', autoError);
      // Not critical, continue
    } else {
      console.log('[provision-tenant] Blog automation config created');
    }

    // =============================================
    // UPDATE PROFILE ONBOARDING STATUS
    // =============================================

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('user_id', user.id);

    if (profileError) {
      console.error('[provision-tenant] Profile update error:', profileError);
      // Not critical, continue
    } else {
      console.log('[provision-tenant] Profile updated');
    }

    console.log('[provision-tenant] Provisioning complete!');

    return new Response(
      JSON.stringify({
        status: 'provisioned',
        tenant_id: tenant.id,
        blog_id: blog.id,
        subdomain: platformSubdomain
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[provision-tenant] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
