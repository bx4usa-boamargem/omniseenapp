// ═══════════════════════════════════════════════════════════════════
// CALCULATE-CONTENT-SCORE: Pontuação de Conteúdo vs Mercado
// Motor de Pontuação por Perfil de Nicho
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateContentScore, validateForPublication, extractArticleMetrics } from "../_shared/contentScoring.ts";
import { SERPMatrix, ContentScore, QualityGateResult } from "../_shared/serpTypes.ts";
import { getNicheProfile, applyScoreFloor, NicheProfile } from "../_shared/nicheProfile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalculateScoreRequest {
  articleId?: string;
  title: string;
  content: string;
  keyword: string;
  blogId: string;
  serpAnalysisId?: string;
  saveScore?: boolean;
  validateForPublish?: boolean;
  minimumScore?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request = await req.json() as CalculateScoreRequest;
    const { 
      articleId, 
      title, 
      content, 
      keyword, 
      blogId, 
      serpAnalysisId,
      saveScore = true,
      validateForPublish = false,
      minimumScore = 70
    } = request;

    if (!content || !keyword || !blogId) {
      return new Response(
        JSON.stringify({ error: "content, keyword, and blogId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CONTENT-SCORE] Calculating for keyword: "${keyword}"`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch SERP matrix
    let serpMatrix: SERPMatrix | null = null;
    let serpId: string | null = serpAnalysisId || null;

    if (serpAnalysisId) {
      const { data: serpData } = await supabase
        .from("serp_analysis_cache")
        .select("matrix, id")
        .eq("id", serpAnalysisId)
        .single();
      
      if (serpData) {
        serpMatrix = serpData.matrix as SERPMatrix;
        serpId = serpData.id;
      }
    } else {
      // Try to find cached SERP analysis
      const { data: cachedSerp } = await supabase
        .from("serp_analysis_cache")
        .select("matrix, id")
        .eq("blog_id", blogId)
        .eq("keyword", keyword)
        .gt("expires_at", new Date().toISOString())
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .single();

      if (cachedSerp) {
        serpMatrix = cachedSerp.matrix as SERPMatrix;
        serpId = cachedSerp.id;
        console.log(`[CONTENT-SCORE] Using cached SERP analysis: ${serpId}`);
      }
    }

    // Extract article metrics
    const metrics = extractArticleMetrics(content);

    // Get niche profile for this blog
    const nicheProfile: NicheProfile = await getNicheProfile(supabase, blogId);
    console.log(`[CONTENT-SCORE] Niche: ${nicheProfile.displayName} (min_score: ${nicheProfile.minScore})`);

    // Calculate content score
    const articleData = {
      id: articleId,
      title,
      content,
      ...metrics
    };

    const rawScore: ContentScore = calculateContentScore(articleData, serpMatrix);
    
    // Apply niche floor - score never drops below niche's min_score
    const { score: finalScore, floorApplied, reason: floorReason } = applyScoreFloor(rawScore.total, nicheProfile);
    const contentScore: ContentScore = { ...rawScore, total: finalScore };
    
    console.log(`[CONTENT-SCORE] Score: ${contentScore.total}/100 (raw: ${rawScore.total}, floor: ${floorApplied}), SERP: ${!!serpMatrix}`);

    // Validate for publication if requested
    let qualityGateResult: QualityGateResult | null = null;
    if (validateForPublish) {
      qualityGateResult = validateForPublication(articleData, contentScore, serpMatrix, minimumScore);
      console.log(`[CONTENT-SCORE] Quality gate: ${qualityGateResult.approved ? 'APPROVED' : 'BLOCKED'}`);
    }

    // Save score to database if articleId provided
    if (saveScore && articleId) {
      const { error: saveError } = await supabase
        .from("article_content_scores")
        .upsert({
          article_id: articleId,
          serp_analysis_id: serpId,
          total_score: contentScore.total,
          breakdown: contentScore.breakdown,
          comparison: contentScore.comparison,
          recommendations: contentScore.recommendations,
          word_count: metrics.wordCount,
          h2_count: metrics.h2Count,
          paragraph_count: metrics.paragraphCount,
          image_count: metrics.imageCount,
          semantic_coverage: contentScore.breakdown.semanticCoverage.percentage,
          meets_market_standards: contentScore.meetsMarketStandards,
          calculated_at: new Date().toISOString()
        }, {
          onConflict: 'article_id'
        });

      if (saveError) {
        console.error("[CONTENT-SCORE] Save error:", saveError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: contentScore,
        rawScore: rawScore.total,
        metrics,
        serpAnalyzed: !!serpMatrix,
        serpAnalysisId: serpId,
        qualityGate: qualityGateResult,
        nicheProfile: {
          id: nicheProfile.id,
          name: nicheProfile.displayName,
          minScore: nicheProfile.minScore,
          floorApplied,
          floorReason
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[CONTENT-SCORE] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Score calculation failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
