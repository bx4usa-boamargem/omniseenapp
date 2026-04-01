import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * serve-llms-txt — OmniSeen AI Crawler Sitemap
 *
 * Serves /llms.txt for each tenant blog, following the llms.txt spec
 * (https://llmstxt.org) so AI systems (ChatGPT, Perplexity, Claude) can
 * discover and understand published content.
 *
 * Route: GET ?blog_id=<uuid>  OR  ?subdomain=<slug>
 * Auth:  None — public by design
 * Content-Type: text/plain; charset=utf-8
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function truncate(str: string, maxLen: number): string {
  if (!str) return "";
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + "…";
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const blogId = url.searchParams.get("blog_id");
    const subdomain = url.searchParams.get("subdomain");

    if (!blogId && !subdomain) {
      return new Response(
        "Missing required parameter: blog_id or subdomain",
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // ── 1. Fetch blog metadata ─────────────────────────────────────
    let blogQuery = supabase
      .from("blogs")
      .select("id, name, description, niche, city, language, url, subdomain, business_name");

    if (blogId) {
      blogQuery = blogQuery.eq("id", blogId);
    } else {
      blogQuery = blogQuery.eq("subdomain", subdomain!);
    }

    const { data: blog, error: blogError } = await blogQuery.maybeSingle();

    if (blogError || !blog) {
      return new Response(
        `Blog not found${blogError ? `: ${blogError.message}` : ""}`,
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" } },
      );
    }

    // ── 2. Fetch last 20 published articles ────────────────────────
    const { data: articles } = await supabase
      .from("articles")
      .select("title, slug, excerpt, meta_description, published_at, keywords")
      .eq("blog_id", blog.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(20);

    // ── 3. Resolve blog public URL ─────────────────────────────────
    const blogUrl = blog.url
      || (blog.subdomain ? `https://${blog.subdomain}.omniseen.app` : "https://omniseen.app");

    // ── 4. Build llms.txt content ──────────────────────────────────
    const lines: string[] = [];

    // Header block (llms.txt spec)
    lines.push(`# ${blog.name || "Blog"}`);
    if (blog.description) lines.push(`# ${truncate(blog.description, 200)}`);
    lines.push("");

    // Context block
    const contextParts: string[] = [];
    if (blog.niche) contextParts.push(blog.niche);
    if (blog.city) contextParts.push(blog.city);
    if (blog.language) contextParts.push(blog.language);
    if (contextParts.length > 0) {
      lines.push(`> ${contextParts.join(" | ")}`);
      lines.push("");
    }

    // Optional business identity
    if (blog.business_name) {
      lines.push(`> Produzido por: ${blog.business_name}`);
      lines.push("");
    }

    // Published articles section
    if (articles && articles.length > 0) {
      lines.push("## Artigos publicados");
      lines.push("");

      for (const article of articles) {
        if (!article.slug || !article.title) continue;
        const articleUrl = `${blogUrl}/post/${article.slug}`;
        const description = truncate(
          article.excerpt || article.meta_description || "",
          150,
        );
        if (description) {
          lines.push(`- [${article.title}]: ${description} (${articleUrl})`);
        } else {
          lines.push(`- [${article.title}]: ${articleUrl}`);
        }
      }
    } else {
      lines.push("## Artigos publicados");
      lines.push("");
      lines.push("Nenhum artigo publicado ainda.");
    }

    lines.push("");
    lines.push(`> Gerado automaticamente em ${new Date().toISOString().split("T")[0]}`);

    const body = lines.join("\n");

    return new Response(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
        // Cache for 1 hour — AI crawlers respect this
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Robots-Tag": "noindex", // don't index the llms.txt itself
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[serve-llms-txt] Unhandled error:", msg);
    return new Response(`Internal Server Error: ${msg}`, {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
