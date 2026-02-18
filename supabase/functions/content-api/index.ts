import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supported routes for the Content API
type ContentRoute = 
  | "blog.home"
  | "blog.article"
  | "blog.category"
  | "blog.tag"
  | "blog.search"
  | "page.landing"
  | "page.landing.direct"
  | "sitemap.urls"
  | "agent.config";

interface ContentRequest {
  host?: string;              // Hostname for resolution
  blog_id?: string;           // Direct blog_id (bypasses hostname resolution)
  blog_slug?: string;         // Blog slug for resolution (NEW)
  route: ContentRoute;
  params?: Record<string, unknown>;
}

interface TenantResolution {
  blog_id: string;
  tenant_id: string | null;
  domain: string;
  domain_type: "subdomain" | "custom";
  status: string;
}

// Fields allowed to be returned (whitelist approach)
const BLOG_PUBLIC_FIELDS = [
  "id", "name", "slug", "description", "logo_url", "favicon_url",
  "primary_color", "secondary_color", "dark_primary_color", "dark_secondary_color",
  "author_name", "author_bio", "author_photo_url", "author_linkedin",
  "banner_enabled", "banner_title", "banner_description", "banner_image_url",
  "header_cta_text", "header_cta_url", "footer_text", "show_powered_by",
  "layout_template", "theme_mode", "custom_domain", "platform_subdomain"
] as const;

const ARTICLE_PUBLIC_FIELDS = [
  "id", "title", "slug", "excerpt", "content", "featured_image_url", "featured_image_alt",
  "meta_description", "keywords", "category", "tags", "reading_time", "view_count",
  "published_at", "updated_at", "faq", "highlights", "content_images", "cta"
] as const;

const LANDING_PAGE_PUBLIC_FIELDS = [
  "id", "title", "slug", "page_data", "seo_title", "seo_description",
  "featured_image_url", "published_at", "updated_at"
] as const;

// Use any for Supabase client to avoid complex type issues in edge functions
// deno-lint-ignore no-explicit-any
type SupabaseClientAny = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, blog_id, blog_slug, route, params = {} } = await req.json() as ContentRequest;

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: SupabaseClientAny = createClient(supabaseUrl, serviceRoleKey);

    // ============================================================
    // SPECIAL ROUTE: page.landing.direct - bypasses tenant resolution entirely
    // Fetches landing page by slug directly, resolving blog from the page
    // ============================================================
    if (route === "page.landing.direct") {
      const slug = String(params.slug || "");
      
      if (!slug) {
        return new Response(
          JSON.stringify({ error: "Missing slug parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[content-api] page.landing.direct: slug=${slug}`);

      // Fetch landing page with blog join
      const { data: pageData, error: pageError } = await supabase
        .from("landing_pages")
        .select(`
          ${LANDING_PAGE_PUBLIC_FIELDS.join(", ")},
          blog:blogs!inner(${BLOG_PUBLIC_FIELDS.join(", ")})
        `)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (pageError) {
        console.error("[content-api] Error fetching landing page direct:", pageError);
        return new Response(
          JSON.stringify({ error: "Database error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!pageData) {
        return new Response(
          JSON.stringify({ error: "Page not found", slug }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse page_data if needed
      // deno-lint-ignore no-explicit-any
      const page = pageData as any;
      if (page.page_data && typeof page.page_data === "string") {
        try {
          page.page_data = JSON.parse(page.page_data);
        } catch {
          console.error("[content-api] Failed to parse page_data JSON");
        }
      }

      // Extract blog from join
      const blogData = page.blog;
      delete page.blog; // Remove from page object

      return new Response(
        JSON.stringify({
          tenant: {
            blog_id: blogData?.id || null,
            tenant_id: null,
            domain: "direct",
            domain_type: "subdomain",
          },
          blog: blogData,
          data: { page },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard routes require host, blog_id, or blog_slug
    if (!route || (!host && !blog_id && !blog_slug)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: route and (host or blog_id or blog_slug)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[content-api] Request: host=${host}, blog_id=${blog_id}, blog_slug=${blog_slug}, route=${route}, params=${JSON.stringify(params)}`);

    // Step 1: Resolve tenant - priority: blog_id > blog_slug > host
    let tenant: TenantResolution | null = null;
    
    if (blog_id) {
      // Direct blog_id provided - bypass hostname resolution
      console.log(`[content-api] Using direct blog_id: ${blog_id}`);
      tenant = {
        blog_id: blog_id,
        tenant_id: null,
        domain: "direct",
        domain_type: "subdomain",
        status: "active",
      };
    } else if (blog_slug) {
      // Resolve by blog slug
      console.log(`[content-api] Resolving by blog_slug: ${blog_slug}`);
      const { data: blogBySlug } = await supabase
        .from("blogs")
        .select("id, tenant_id")
        .eq("slug", blog_slug)
        .maybeSingle();
      
      if (blogBySlug?.id) {
        tenant = {
          blog_id: String(blogBySlug.id),
          tenant_id: blogBySlug.tenant_id ? String(blogBySlug.tenant_id) : null,
          domain: `${blog_slug}.app.omniseen.app`,
          domain_type: "subdomain",
          status: "active",
        };
      }
    } else if (host) {
      tenant = await resolveTenant(supabase, host);
    }
    
    if (!tenant) {
      console.log(`[content-api] Tenant not found for host: ${host}, blog_id: ${blog_id}, blog_slug: ${blog_slug}`);
      return new Response(
        JSON.stringify({ error: "Tenant not found", host, blog_id, blog_slug }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[content-api] Tenant resolved: blog_id=${tenant.blog_id}, tenant_id=${tenant.tenant_id}`);

    // Step 2: Fetch blog metadata (always needed for branding)
    const blogMeta = await fetchBlogMeta(supabase, tenant.blog_id);

    // Step 3: Route to appropriate handler
    let data: unknown;
    
    switch (route) {
      case "blog.home":
        data = await handleBlogHome(supabase, tenant.blog_id, params);
        break;
      case "blog.article":
        data = await handleBlogArticle(supabase, tenant.blog_id, params);
        break;
      case "blog.category":
        data = await handleBlogCategory(supabase, tenant.blog_id, params);
        break;
      case "blog.tag":
        data = await handleBlogTag(supabase, tenant.blog_id, params);
        break;
      case "blog.search":
        data = await handleBlogSearch(supabase, tenant.blog_id, params);
        break;
      case "page.landing":
        data = await handleLandingPage(supabase, tenant.blog_id, params);
        break;
      case "sitemap.urls":
        data = await handleSitemapUrls(supabase, tenant.blog_id);
        break;
      case "agent.config":
        data = await handleAgentConfig(supabase, tenant.blog_id);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Unknown route", route }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
    
    // Special case: page.landing.direct is handled before tenant resolution
    // But we should NEVER reach here for page.landing.direct - see special handling above

    return new Response(
      JSON.stringify({
        tenant: {
          blog_id: tenant.blog_id,
          tenant_id: tenant.tenant_id,
          domain: tenant.domain,
          domain_type: tenant.domain_type,
        },
        blog: blogMeta,
        data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[content-api] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// TENANT RESOLUTION
// ============================================================

async function resolveTenant(supabase: SupabaseClientAny, host: string): Promise<TenantResolution | null> {
  // Try RPC first (uses tenant_domains table)
  const { data: rpcResult, error: rpcError } = await supabase.rpc("resolve_domain", {
    p_hostname: host,
  });

  if (!rpcError && rpcResult && Array.isArray(rpcResult) && rpcResult.length > 0) {
    const r = rpcResult[0];
    return {
      blog_id: r.blog_id as string,
      tenant_id: r.tenant_id as string | null,
      domain: r.domain as string,
      domain_type: r.domain_type as "subdomain" | "custom",
      status: r.status as string,
    };
  }

  console.log(`[content-api] RPC resolve_domain failed or empty, trying fallback. Error: ${rpcError?.message}`);

  // Fallback: check if it's a subdomain pattern
  const subdomainMatch = host.match(/^([a-z0-9-]+)\.app\.omniseen\.app$/i);
  if (subdomainMatch) {
    const slug = subdomainMatch[1];
    
    // Try platform_subdomain first
    const { data: blogBySubdomain } = await supabase
      .from("blogs")
      .select("id, tenant_id")
      .eq("platform_subdomain", host)
      .maybeSingle();

    if (blogBySubdomain?.id) {
      return {
        blog_id: String(blogBySubdomain.id),
        tenant_id: blogBySubdomain.tenant_id ? String(blogBySubdomain.tenant_id) : null,
        domain: host,
        domain_type: "subdomain",
        status: "active",
      };
    }

    // Try by slug
    const { data: blogBySlug } = await supabase
      .from("blogs")
      .select("id, tenant_id")
      .eq("slug", slug)
      .maybeSingle();

    if (blogBySlug?.id) {
      return {
        blog_id: String(blogBySlug.id),
        tenant_id: blogBySlug.tenant_id ? String(blogBySlug.tenant_id) : null,
        domain: host,
        domain_type: "subdomain",
        status: "active",
      };
    }
  }

  // Fallback: try custom_domain
  const { data: blogByDomain } = await supabase
    .from("blogs")
    .select("id, tenant_id")
    .eq("custom_domain", host.toLowerCase())
    .maybeSingle();

  if (blogByDomain?.id) {
    return {
      blog_id: String(blogByDomain.id),
      tenant_id: blogByDomain.tenant_id ? String(blogByDomain.tenant_id) : null,
      domain: host.toLowerCase(),
      domain_type: "custom",
      status: "active",
    };
  }

  return null;
}

// ============================================================
// BLOG METADATA
// ============================================================

async function fetchBlogMeta(supabase: SupabaseClientAny, blogId: string) {
  const { data, error } = await supabase
    .from("blogs")
    .select(BLOG_PUBLIC_FIELDS.join(", "))
    .eq("id", blogId)
    .single();

  if (error) {
    console.error("[content-api] Error fetching blog meta:", error);
    return null;
  }

  return data;
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

async function handleBlogHome(
  supabase: SupabaseClientAny,
  blogId: string,
  params: Record<string, unknown>
) {
  const limit = Math.min(Number(params.limit) || 12, 50);
  const offset = Number(params.offset) || 0;

  const { data: articles, error, count } = await supabase
    .from("articles")
    .select(ARTICLE_PUBLIC_FIELDS.join(", "), { count: "exact" })
    .eq("blog_id", blogId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[content-api] Error fetching articles:", error);
    return { articles: [], total: 0 };
  }

  return { articles: articles || [], total: count || 0, limit, offset };
}

async function handleBlogArticle(
  supabase: SupabaseClientAny,
  blogId: string,
  params: Record<string, unknown>
) {
  const slug = String(params.slug || "");
  
  if (!slug) {
    return { article: null, error: "Missing slug parameter" };
  }

  const { data: articleData, error } = await supabase
    .from("articles")
    .select(ARTICLE_PUBLIC_FIELDS.join(", "))
    .eq("blog_id", blogId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("[content-api] Error fetching article:", error);
    return { article: null, error: "Database error" };
  }

  if (!articleData) {
    return { article: null, error: "Article not found" };
  }

  // Cast to any to access properties safely
  // deno-lint-ignore no-explicit-any
  const article = articleData as any;

  // Increment view count (fire and forget)
  supabase.rpc("increment_view_count", { article_id: article.id }).then(() => {
    console.log(`[content-api] View count incremented for article ${article.id}`);
  });

  // Fetch related articles
  const { data: related } = await supabase
    .from("articles")
    .select("id, title, slug, excerpt, featured_image_url, published_at")
    .eq("blog_id", blogId)
    .eq("status", "published")
    .neq("id", article.id)
    .order("published_at", { ascending: false })
    .limit(3);

  return { article, related: related || [] };
}

async function handleBlogCategory(
  supabase: SupabaseClientAny,
  blogId: string,
  params: Record<string, unknown>
) {
  const category = String(params.category || "");
  const limit = Math.min(Number(params.limit) || 12, 50);
  const offset = Number(params.offset) || 0;

  if (!category) {
    return { articles: [], total: 0, error: "Missing category parameter" };
  }

  const { data: articles, error, count } = await supabase
    .from("articles")
    .select(ARTICLE_PUBLIC_FIELDS.join(", "), { count: "exact" })
    .eq("blog_id", blogId)
    .eq("status", "published")
    .eq("category", category)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[content-api] Error fetching category articles:", error);
    return { articles: [], total: 0, category };
  }

  return { articles: articles || [], total: count || 0, category, limit, offset };
}

async function handleBlogTag(
  supabase: SupabaseClientAny,
  blogId: string,
  params: Record<string, unknown>
) {
  const tag = String(params.tag || "");
  const limit = Math.min(Number(params.limit) || 12, 50);
  const offset = Number(params.offset) || 0;

  if (!tag) {
    return { articles: [], total: 0, error: "Missing tag parameter" };
  }

  const { data: articles, error, count } = await supabase
    .from("articles")
    .select(ARTICLE_PUBLIC_FIELDS.join(", "), { count: "exact" })
    .eq("blog_id", blogId)
    .eq("status", "published")
    .contains("tags", [tag])
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[content-api] Error fetching tag articles:", error);
    return { articles: [], total: 0, tag };
  }

  return { articles: articles || [], total: count || 0, tag, limit, offset };
}

async function handleBlogSearch(
  supabase: SupabaseClientAny,
  blogId: string,
  params: Record<string, unknown>
) {
  const query = String(params.q || "").trim();
  const limit = Math.min(Number(params.limit) || 12, 50);
  const offset = Number(params.offset) || 0;

  if (!query || query.length < 2) {
    return { articles: [], total: 0, error: "Query must be at least 2 characters" };
  }

  // Simple search using ilike on title and excerpt
  const searchPattern = `%${query}%`;
  
  const { data: articles, error, count } = await supabase
    .from("articles")
    .select(ARTICLE_PUBLIC_FIELDS.join(", "), { count: "exact" })
    .eq("blog_id", blogId)
    .eq("status", "published")
    .or(`title.ilike.${searchPattern},excerpt.ilike.${searchPattern}`)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[content-api] Error searching articles:", error);
    return { articles: [], total: 0, query };
  }

  return { articles: articles || [], total: count || 0, query, limit, offset };
}

async function handleLandingPage(
  supabase: SupabaseClientAny,
  blogId: string,
  params: Record<string, unknown>
) {
  const slug = String(params.slug || "");

  if (!slug) {
    return { page: null, error: "Missing slug parameter" };
  }

  const { data: pageData, error } = await supabase
    .from("landing_pages")
    .select(LANDING_PAGE_PUBLIC_FIELDS.join(", "))
    .eq("blog_id", blogId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("[content-api] Error fetching landing page:", error);
    return { page: null, error: "Database error" };
  }

  if (!pageData) {
    return { page: null, error: "Page not found" };
  }

  // Cast to any to access properties safely
  // deno-lint-ignore no-explicit-any
  const page = pageData as any;

  // Normalize page_data if it's a string
  if (page && typeof page.page_data === "string") {
    try {
      page.page_data = JSON.parse(page.page_data);
    } catch {
      console.error("[content-api] Failed to parse page_data JSON");
    }
  }

  return { page };
}

async function handleSitemapUrls(
  supabase: SupabaseClientAny,
  blogId: string
) {
  // Fetch all published articles
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, published_at, updated_at")
    .eq("blog_id", blogId)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  // Fetch all published landing pages
  const { data: landingPages } = await supabase
    .from("landing_pages")
    .select("slug, published_at, updated_at")
    .eq("blog_id", blogId)
    .eq("status", "published");

  const urls: Array<{ loc: string; lastmod: string; priority: number }> = [];

  // Home page
  urls.push({ loc: "/", lastmod: new Date().toISOString(), priority: 1.0 });

  // Articles
  if (Array.isArray(articles)) {
    for (const article of articles) {
      urls.push({
        loc: `/${article.slug}`,
        lastmod: String(article.updated_at || article.published_at || new Date().toISOString()),
        priority: 0.8,
      });
    }
  }

  // Landing pages
  if (Array.isArray(landingPages)) {
    for (const page of landingPages) {
      urls.push({
        loc: `/p/${page.slug}`,
        lastmod: String(page.updated_at || page.published_at || new Date().toISOString()),
        priority: 0.9,
      });
    }
  }

  return { urls };
}

async function handleAgentConfig(
  supabase: SupabaseClientAny,
  blogId: string
) {
  const { data: agentConfig } = await supabase
    .from("brand_agent_config")
    .select("is_enabled, agent_name, agent_avatar_url, welcome_message, proactive_delay_seconds")
    .eq("blog_id", blogId)
    .maybeSingle();

  const { data: businessProfile } = await supabase
    .from("business_profile")
    .select("company_name, logo_url, services, niche, city")
    .eq("blog_id", blogId)
    .maybeSingle();

  return {
    agent: agentConfig,
    business: businessProfile,
  };
}
