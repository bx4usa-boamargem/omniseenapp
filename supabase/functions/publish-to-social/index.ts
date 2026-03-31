import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SocialPublishRequest {
  article_id: string;
  blog_id: string;
  platforms: ("linkedin" | "instagram")[];
  custom_caption?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { article_id, blog_id, platforms, custom_caption } = await req.json() as SocialPublishRequest;

    if (!article_id || !blog_id || !platforms?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: article_id, blog_id, platforms" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("title, slug, excerpt, featured_image_url, meta_description, keywords")
      .eq("id", article_id)
      .eq("blog_id", blog_id)
      .single();

    if (articleError || !article) {
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: blog } = await supabase
      .from("blogs")
      .select("name, custom_domain, platform_subdomain, slug")
      .eq("id", blog_id)
      .single();

    const domain = blog?.custom_domain || blog?.platform_subdomain || `${blog?.slug}.app.omniseen.app`;
    const articleUrl = `https://${domain}/${article.slug}`;

    const { data: integrations } = await supabase
      .from("social_integrations")
      .select("*")
      .eq("blog_id", blog_id)
      .in("platform", platforms);

    const results: Record<string, { success: boolean; error?: string; post_id?: string }> = {};

    for (const platform of platforms) {
      const integration = integrations?.find((i) => i.platform === platform);

      if (!integration?.access_token) {
        results[platform] = { success: false, error: "Not connected" };
        continue;
      }

      try {
        if (platform === "linkedin") {
          const caption = custom_caption || buildLinkedInCaption(article, articleUrl);
          const postResult = await publishToLinkedIn(
            integration.access_token,
            integration.platform_user_id,
            caption,
            articleUrl,
            article.featured_image_url
          );
          results[platform] = { success: true, post_id: postResult.id };
        } else if (platform === "instagram") {
          const caption = custom_caption || buildInstagramCaption(article, articleUrl);
          if (!article.featured_image_url) {
            results[platform] = { success: false, error: "Image required for Instagram" };
            continue;
          }
          const postResult = await publishToInstagram(
            integration.access_token,
            integration.platform_user_id,
            caption,
            article.featured_image_url
          );
          results[platform] = { success: true, post_id: postResult.id };
        }

        await supabase.from("social_publish_logs").insert({
          blog_id,
          article_id,
          platform,
          status: "published",
          post_url: results[platform]?.post_id || null,
          published_at: new Date().toISOString(),
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        results[platform] = { success: false, error: errorMsg };

        await supabase.from("social_publish_logs").insert({
          blog_id,
          article_id,
          platform,
          status: "failed",
          error_message: errorMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[publish-to-social] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildLinkedInCaption(article: any, url: string): string {
  const hashtags = (article.keywords || [])
    .slice(0, 5)
    .map((k: string) => `#${k.replace(/\s+/g, "")}`)
    .join(" ");

  return [
    article.title,
    "",
    article.excerpt || article.meta_description || "",
    "",
    `📖 Leia o artigo completo: ${url}`,
    "",
    hashtags,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInstagramCaption(article: any, url: string): string {
  const hashtags = (article.keywords || [])
    .slice(0, 15)
    .map((k: string) => `#${k.replace(/\s+/g, "")}`)
    .join(" ");

  return [
    article.title,
    "",
    article.excerpt || article.meta_description || "",
    "",
    "🔗 Link na bio",
    "",
    hashtags,
  ]
    .filter(Boolean)
    .join("\n");
}

async function publishToLinkedIn(
  accessToken: string,
  authorId: string,
  text: string,
  articleUrl: string,
  imageUrl?: string | null
): Promise<{ id: string }> {
  const shareContent: any = {
    author: `urn:li:person:${authorId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "ARTICLE",
        media: [
          {
            status: "READY",
            originalUrl: articleUrl,
            ...(imageUrl ? { thumbnails: [{ url: imageUrl }] } : {}),
          },
        ],
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(shareContent),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return { id: data.id };
}

async function publishToInstagram(
  accessToken: string,
  igUserId: string,
  caption: string,
  imageUrl: string
): Promise<{ id: string }> {
  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    }
  );

  if (!containerRes.ok) {
    throw new Error(`Instagram container error: ${await containerRes.text()}`);
  }

  const { id: containerId } = await containerRes.json();

  await new Promise((r) => setTimeout(r, 5000));

  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );

  if (!publishRes.ok) {
    throw new Error(`Instagram publish error: ${await publishRes.text()}`);
  }

  const { id } = await publishRes.json();
  return { id };
}
