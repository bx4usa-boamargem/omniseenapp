import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * AUTO-PUBLISH-READY-ARTICLES
 * 
 * CRON job that runs daily at 8h UTC (5h Brasília).
 * Publishes articles that have passed the Quality Gate and
 * have been in ready_for_publish status for the configured delay period.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET");

    // Validate cron secret for scheduled runs
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization");
    
    const isValidCron = CRON_SECRET && cronSecret === CRON_SECRET;
    const isValidAuth = authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY);
    
    if (!isValidCron && !isValidAuth) {
      console.log("[AUTO-PUBLISH] Unauthorized request");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[AUTO-PUBLISH] Starting auto-publish run...");

    // Fetch articles ready for publishing
    const { data: readyArticles, error: fetchError } = await supabase
      .from("articles")
      .select(`
        id,
        blog_id,
        title,
        slug,
        ready_for_publish_at,
        quality_gate_status,
        blogs!inner(
          user_id,
          platform_subdomain,
          custom_domain
        )
      `)
      .eq("status", "ready_for_publish")
      .eq("quality_gate_status", "approved")
      .lte("ready_for_publish_at", new Date().toISOString())
      .order("ready_for_publish_at", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch ready articles: ${fetchError.message}`);
    }

    if (!readyArticles || readyArticles.length === 0) {
      console.log("[AUTO-PUBLISH] No articles ready for publishing");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No articles ready for publishing",
          published_count: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AUTO-PUBLISH] Found ${readyArticles.length} articles ready for publishing`);

    let publishedCount = 0;
    const results: Array<{ article_id: string; success: boolean; error?: string }> = [];

    for (const article of readyArticles) {
      try {
        // Check if auto-publish is enabled for this blog
        const { data: automation } = await supabase
          .from("blog_automation")
          .select("auto_publish_enabled")
          .eq("blog_id", article.blog_id)
          .single();

        if (!automation?.auto_publish_enabled) {
          console.log(`[AUTO-PUBLISH] Auto-publish disabled for blog ${article.blog_id}, skipping article ${article.id}`);
          results.push({ article_id: article.id, success: false, error: "Auto-publish disabled" });
          continue;
        }

        // Publish the article
        const { error: updateError } = await supabase
          .from("articles")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Update article_queue if exists
        await supabase
          .from("article_queue")
          .update({ status: "published" })
          .eq("article_id", article.id);

        // Create notification for user
        const blog = article.blogs as any;
        if (blog?.user_id) {
          await supabase.from("automation_notifications").insert({
            blog_id: article.blog_id,
            user_id: blog.user_id,
            notification_type: "auto_published",
            title: "Artigo publicado automaticamente",
            message: `O artigo "${article.title}" foi publicado automaticamente pela OmniSIM após passar pelo Quality Gate.`,
            article_id: article.id,
          });
        }

        // Trigger IndexNow notification
        try {
          const articleUrl = blog?.custom_domain
            ? `https://${blog.custom_domain.replace(/^https?:\/\//, '')}/${article.slug}`
            : `https://${blog?.platform_subdomain || 'blog'}.omniseen.app/${article.slug}`;

          await fetch(`${SUPABASE_URL}/functions/v1/notify-indexnow`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              articleId: article.id,
              blogId: article.blog_id,
              url: articleUrl,
            }),
          });
        } catch (indexError) {
          console.warn(`[AUTO-PUBLISH] Failed to notify IndexNow for article ${article.id}:`, indexError);
        }

        publishedCount++;
        results.push({ article_id: article.id, success: true });
        console.log(`[AUTO-PUBLISH] ✅ Published article: ${article.title}`);

      } catch (articleError) {
        console.error(`[AUTO-PUBLISH] Failed to publish article ${article.id}:`, articleError);
        results.push({ 
          article_id: article.id, 
          success: false, 
          error: articleError instanceof Error ? articleError.message : "Unknown error" 
        });
      }
    }

    console.log(`[AUTO-PUBLISH] ✅ Run complete. Published ${publishedCount}/${readyArticles.length} articles`);

    return new Response(
      JSON.stringify({
        success: true,
        published_count: publishedCount,
        total_ready: readyArticles.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AUTO-PUBLISH] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
