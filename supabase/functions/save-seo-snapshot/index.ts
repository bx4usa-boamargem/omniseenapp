import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blog_id } = await req.json();

    if (!blog_id) {
      throw new Error("blog_id is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all published articles
    const { data: articles, error: articlesError } = await supabase
      .from("articles")
      .select("id, title, meta_description, content, keywords, featured_image_url")
      .eq("blog_id", blog_id)
      .eq("status", "published");

    if (articlesError) {
      throw articlesError;
    }

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No published articles to analyze" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate SEO scores for each article
    const scores = articles.map((article) => {
      let score = 0;
      const maxScore = 100;

      // Title score (max 25)
      const titleLen = article.title?.length || 0;
      if (titleLen >= 50 && titleLen <= 60) score += 25;
      else if (titleLen >= 30 && titleLen <= 70) score += 15;
      else if (titleLen > 0) score += 5;

      // Meta description score (max 25)
      const metaLen = article.meta_description?.length || 0;
      if (metaLen >= 140 && metaLen <= 160) score += 25;
      else if (metaLen >= 100 && metaLen <= 180) score += 15;
      else if (metaLen > 50) score += 5;

      // Content score (max 25)
      const wordCount = (article.content || "").split(/\s+/).filter((w: string) => w.length > 0).length;
      if (wordCount >= 1500) score += 25;
      else if (wordCount >= 800) score += 15;
      else if (wordCount >= 300) score += 10;

      // Keywords score (max 15)
      const keywordCount = (article.keywords || []).length;
      if (keywordCount >= 3 && keywordCount <= 7) score += 15;
      else if (keywordCount >= 1) score += 8;

      // Image score (max 10)
      if (article.featured_image_url) score += 10;

      return Math.min(score, maxScore);
    });

    // Calculate aggregated stats
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const articlesBelow60 = scores.filter((s) => s < 60).length;
    const articlesAbove80 = scores.filter((s) => s >= 80).length;

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Upsert the snapshot (update if exists, insert if not)
    const { data: snapshot, error: upsertError } = await supabase
      .from("seo_daily_snapshots")
      .upsert(
        {
          blog_id,
          snapshot_date: today,
          avg_score: avgScore,
          total_articles: articles.length,
          articles_below_60: articlesBelow60,
          articles_above_80: articlesAbove80,
        },
        { onConflict: "blog_id,snapshot_date" }
      )
      .select()
      .single();

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshot: {
          date: today,
          avgScore,
          totalArticles: articles.length,
          articlesBelow60,
          articlesAbove80,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error saving SEO snapshot:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
