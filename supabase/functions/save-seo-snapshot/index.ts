import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeSeoScore, stripHtml, type SEOResult } from "../_shared/seoScoring.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { blog_id, article_id } = body;

    if (!blog_id && !article_id) {
      throw new Error("blog_id or article_id is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mode 1: Single article score
    if (article_id) {
      const { data: article, error: articleError } = await supabase
        .from("articles")
        .select("id, title, meta_description, content, keywords, featured_image_url")
        .eq("id", article_id)
        .single();

      if (articleError || !article) {
        throw new Error(`Article not found: ${articleError?.message}`);
      }

      const cleanContent = stripHtml(article.content || '');
      const seoResult = computeSeoScore({
        title: article.title || '',
        meta_description: article.meta_description || '',
        content_text: cleanContent,
        keywords: article.keywords || [],
        has_featured_image: !!article.featured_image_url
      });

      return new Response(
        JSON.stringify({
          success: true,
          article_id,
          score_total: seoResult.score_total,
          breakdown: seoResult.breakdown,
          diagnostics: seoResult.diagnostics
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 2: Blog aggregate snapshot (original behavior)
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

    // Calculate SEO scores using the shared module
    const scores = articles.map((article) => {
      const cleanContent = stripHtml(article.content || '');
      const result = computeSeoScore({
        title: article.title || '',
        meta_description: article.meta_description || '',
        content_text: cleanContent,
        keywords: article.keywords || [],
        has_featured_image: !!article.featured_image_url
      });
      return result.score_total;
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
