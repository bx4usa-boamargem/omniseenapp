import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const action = body.action || "migrate";

    if (action === "check") {
      // Check for missing costs
      const { count: totalArticles } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true });

      const { data: loggedArticles } = await supabase
        .from("consumption_logs")
        .select("id")
        .eq("action_type", "article_generation");

      const { data: articlesWithImages } = await supabase
        .from("articles")
        .select("id, featured_image_url, content_images")
        .not("featured_image_url", "is", null);

      const { data: loggedImages } = await supabase
        .from("consumption_logs")
        .select("images_generated")
        .eq("action_type", "image_generation");

      const totalLoggedImages = loggedImages?.reduce((sum, l) => sum + (l.images_generated || 0), 0) || 0;

      let estimatedTotalImages = 0;
      articlesWithImages?.forEach((article) => {
        estimatedTotalImages += 1;
        if (article.content_images && Array.isArray(article.content_images)) {
          estimatedTotalImages += article.content_images.length;
        }
      });

      return new Response(
        JSON.stringify({
          totalArticles: totalArticles || 0,
          loggedArticles: loggedArticles?.length || 0,
          estimatedTotalImages,
          loggedImages: totalLoggedImages,
          articlesWithoutLogs: Math.max(0, (totalArticles || 0) - (loggedArticles?.length || 0)),
          imagesWithoutLogs: Math.max(0, estimatedTotalImages - totalLoggedImages),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "migrate") {
      console.log("Starting retroactive cost migration...");

      // Fetch articles in paginated batches to avoid statement timeout
      const PAGE_SIZE = 500;
      let allArticles: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from("articles")
          .select(`
            id,
            blog_id,
            title,
            created_at,
            featured_image_url,
            content_images,
            blogs!inner (
              user_id
            )
          `)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
          .order("created_at", { ascending: true });

        if (batchError) {
          console.error("Error fetching articles batch:", batchError);
          throw batchError;
        }

        if (!batch || batch.length === 0) {
          hasMore = false;
        } else {
          allArticles = allArticles.concat(batch);
          hasMore = batch.length === PAGE_SIZE;
          page++;
        }
      }

      console.log(`Fetched ${allArticles.length} articles in ${page} pages`);

      // Get existing article generation logs to avoid duplicates
      const { data: existingArticleLogs } = await supabase
        .from("consumption_logs")
        .select("blog_id, created_at")
        .eq("action_type", "article_generation")
        .limit(10000);

      const existingArticleSet = new Set(
        existingArticleLogs?.map((l) => `${l.blog_id}_${l.created_at?.split("T")[0]}`) || []
      );

      // Get existing image generation logs
      const { data: existingImageLogs } = await supabase
        .from("consumption_logs")
        .select("blog_id, created_at")
        .eq("action_type", "image_generation")
        .limit(10000);

      const existingImageSet = new Set(
        existingImageLogs?.map((l) => `${l.blog_id}_${l.created_at?.split("T")[0]}`) || []
      );

      const articleLogsToInsert: any[] = [];
      const imageLogsToInsert: any[] = [];

      for (const article of allArticles) {
        const userId = (article.blogs as any)?.user_id;
        if (!userId) continue;

        const dateKey = article.created_at?.split("T")[0];
        const articleKey = `${article.blog_id}_${dateKey}`;

        // Insert article generation cost if not exists
        if (!existingArticleSet.has(articleKey)) {
          articleLogsToInsert.push({
            user_id: userId,
            blog_id: article.blog_id,
            action_type: "article_generation",
            action_description: `Artigo gerado (retroativo): ${article.title?.substring(0, 50)}`,
            model_used: "google/gemini-2.5-flash",
            input_tokens: 2000,
            output_tokens: 3000,
            images_generated: 0,
            estimated_cost_usd: 0.002, // Estimated average article cost
            created_at: article.created_at,
            metadata: { retroactive: true },
          });
          existingArticleSet.add(articleKey);
        }

        // Count images for this article
        let imageCount = 0;
        if (article.featured_image_url) imageCount++;
        if (article.content_images && Array.isArray(article.content_images)) {
          imageCount += article.content_images.length;
        }

        // Insert image generation cost if not exists and has images
        if (imageCount > 0 && !existingImageSet.has(articleKey)) {
          imageLogsToInsert.push({
            user_id: userId,
            blog_id: article.blog_id,
            action_type: "image_generation",
            action_description: `Imagens geradas (retroativo): ${imageCount} imagem(ns)`,
            model_used: "google/gemini-2.0-flash-exp",
            input_tokens: 0,
            output_tokens: 0,
            images_generated: imageCount,
            estimated_cost_usd: imageCount * 0.03, // $0.03 per image
            created_at: article.created_at,
            metadata: { retroactive: true, image_count: imageCount },
          });
          existingImageSet.add(articleKey);
        }
      }

      // Insert article logs in batches
      let articlesInserted = 0;
      if (articleLogsToInsert.length > 0) {
        for (let i = 0; i < articleLogsToInsert.length; i += 50) {
          const batch = articleLogsToInsert.slice(i, i + 50);
          const { error } = await supabase.from("consumption_logs").insert(batch);
          if (error) {
            console.error("Error inserting article logs batch:", error);
          } else {
            articlesInserted += batch.length;
          }
        }
      }

      // Insert image logs in batches
      let imagesInserted = 0;
      if (imageLogsToInsert.length > 0) {
        for (let i = 0; i < imageLogsToInsert.length; i += 50) {
          const batch = imageLogsToInsert.slice(i, i + 50);
          const { error } = await supabase.from("consumption_logs").insert(batch);
          if (error) {
            console.error("Error inserting image logs batch:", error);
          } else {
            imagesInserted += batch.length;
          }
        }
      }

      const totalCostInserted =
        articlesInserted * 0.002 +
        imageLogsToInsert.reduce((sum, l) => sum + l.estimated_cost_usd, 0);

      console.log(
        `Migration complete: ${articlesInserted} articles, ${imagesInserted} image batches, $${totalCostInserted.toFixed(4)} total`
      );

      return new Response(
        JSON.stringify({
          success: true,
          articlesInserted,
          imagesInserted,
          totalCostInserted,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in migrate-retroactive-costs:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
