import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
};

interface ApiRequest {
  endpoint: string;
  params?: Record<string, unknown>;
}

const ENDPOINTS = [
  "articles.list",
  "articles.get",
  "articles.create",
  "blog.info",
  "seo.score",
  "calendar.list",
  "calendar.create",
  "webhooks.list",
  "webhooks.create",
  "webhooks.delete",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return jsonResponse({ error: "Missing x-api-key header", docs: "https://docs.omniseen.app/api" }, 401);
    }

    const keyHash = await hashKey(apiKey);
    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("id, tenant_id, scopes, expires_at, is_active")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .maybeSingle();

    if (keyError || !keyRecord) {
      return jsonResponse({ error: "Invalid API key" }, 401);
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return jsonResponse({ error: "API key expired" }, 401);
    }

    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id);

    const { data: blogs } = await supabase
      .from("blogs")
      .select("id")
      .eq("tenant_id", keyRecord.tenant_id);

    const blogIds = (blogs || []).map((b: any) => b.id);
    if (blogIds.length === 0) {
      return jsonResponse({ error: "No blogs found for this tenant" }, 404);
    }

    const { endpoint, params = {} } = await req.json() as ApiRequest;

    if (!endpoint) {
      return jsonResponse({
        error: "Missing endpoint",
        available_endpoints: ENDPOINTS,
        docs: "https://docs.omniseen.app/api",
      }, 400);
    }

    const scopes = keyRecord.scopes as string[];

    switch (endpoint) {
      case "articles.list": {
        requireScope(scopes, "read");
        const blogId = String(params.blog_id || blogIds[0]);
        const limit = Math.min(Number(params.limit) || 20, 100);
        const offset = Number(params.offset) || 0;

        const { data, error, count } = await supabase
          .from("articles")
          .select("id, title, slug, status, excerpt, category, published_at, created_at", { count: "exact" })
          .eq("blog_id", blogId)
          .in("blog_id", blogIds)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ articles: data, total: count, limit, offset });
      }

      case "articles.get": {
        requireScope(scopes, "read");
        const articleId = String(params.id || "");
        if (!articleId) return jsonResponse({ error: "Missing id param" }, 400);

        const { data, error } = await supabase
          .from("articles")
          .select("id, title, slug, content, excerpt, status, category, keywords, meta_description, featured_image_url, published_at, created_at, updated_at")
          .eq("id", articleId)
          .in("blog_id", blogIds)
          .single();

        if (error) return jsonResponse({ error: "Article not found" }, 404);
        return jsonResponse({ article: data });
      }

      case "blog.info": {
        requireScope(scopes, "read");
        const blogId = String(params.blog_id || blogIds[0]);

        const { data, error } = await supabase
          .from("blogs")
          .select("id, name, slug, description, custom_domain, platform_subdomain")
          .eq("id", blogId)
          .in("id", blogIds)
          .single();

        if (error) return jsonResponse({ error: "Blog not found" }, 404);
        return jsonResponse({ blog: data });
      }

      case "calendar.list": {
        requireScope(scopes, "read");
        const blogId = String(params.blog_id || blogIds[0]);
        const startDate = String(params.start_date || new Date().toISOString().slice(0, 10));
        const endDate = String(params.end_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));

        const { data, error } = await supabase
          .from("content_calendar")
          .select("*")
          .eq("blog_id", blogId)
          .in("blog_id", blogIds)
          .gte("scheduled_date", startDate)
          .lte("scheduled_date", endDate)
          .order("scheduled_date");

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ entries: data });
      }

      case "calendar.create": {
        requireScope(scopes, "write");
        const blogId = String(params.blog_id || blogIds[0]);
        if (!blogIds.includes(blogId)) return jsonResponse({ error: "Unauthorized blog_id" }, 403);

        const { data, error } = await supabase
          .from("content_calendar")
          .insert({
            blog_id: blogId,
            title: String(params.title || ""),
            description: params.description ? String(params.description) : null,
            scheduled_date: String(params.scheduled_date || ""),
            priority: String(params.priority || "medium"),
            category: params.category ? String(params.category) : null,
          })
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ entry: data }, 201);
      }

      default:
        return jsonResponse({
          error: `Unknown endpoint: ${endpoint}`,
          available_endpoints: ENDPOINTS,
        }, 400);
    }
  } catch (error) {
    console.error("[public-api] Error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireScope(scopes: string[], required: string) {
  if (!scopes.includes(required) && !scopes.includes("admin")) {
    throw new ScopeError(`Missing required scope: ${required}`);
  }
}

class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeError";
  }
}

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
