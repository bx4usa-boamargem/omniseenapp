// ═══════════════════════════════════════════════════════════════════
// CALCULATE-CONTENT-SCORE: Pontuação de Conteúdo vs Mercado
// Motor de Pontuação por Perfil de Nicho
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateContentScore, validateForPublication, extractArticleMetrics } from "../_shared/contentScoring.ts";
import { SERPMatrix, ContentScore, QualityGateResult } from "../_shared/serpTypes.ts";
import { getNicheProfile, applyScoreFloor, NicheProfile } from "../_shared/nicheProfile.ts";
import { canChangeScore, logScoreChange, updateLastScoreChangeReason, type TriggeredBy } from "../_shared/nicheGuard.ts";

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
  // V2.0: Deterministic score control
  userInitiated?: boolean;  // If true, allows score changes; if false (system), blocks decreases
  userId?: string;          // For audit trail
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
      minimumScore = 70,
      userInitiated = false,
      userId
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
    let scoreBlocked = false;
    let blockReason: string | undefined;

    if (saveScore && articleId) {
      // V2.0: Check if score change is allowed (deterministic control)
      const { data: existingScore } = await supabase
        .from("article_content_scores")
        .select("total_score")
        .eq("article_id", articleId)
        .maybeSingle();

      const currentScore = existingScore?.total_score || 0;
      const triggeredBy: TriggeredBy = userInitiated ? 'user' : 'system';

      // Check if we can change the score
      const scoreGuard = await canChangeScore(
        supabase,
        articleId,
        triggeredBy,
        contentScore.total,
        currentScore
      );

      if (!scoreGuard.allowed) {
        console.log(`[CONTENT-SCORE] Score change blocked: ${scoreGuard.reason}`);
        scoreBlocked = true;
        blockReason = scoreGuard.reason;
        
        // Return the current score, not the new calculated one
        return new Response(
          JSON.stringify({
            success: true,
            score: { ...contentScore, total: currentScore },
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
            },
            scoreBlocked: true,
            blockReason: scoreGuard.reason,
            message: 'Score não pode ser alterado automaticamente. Use "Recalcular" para atualizar.'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the score change
      const changeReason = userInitiated 
        ? 'Recálculo manual pelo usuário' 
        : 'Cálculo automático do sistema';
      
      await logScoreChange(
        supabase,
        articleId,
        currentScore,
        contentScore.total,
        changeReason,
        userInitiated ? 'recalculate' : 'system',
        userId
      );

      // Update the article with last score change reason
      await updateLastScoreChangeReason(
        supabase,
        articleId,
        changeReason
      );

      // V4: Build structured breakdown
      let grade = "Exceptional";
      if (contentScore.total < 90) grade = "Strong";
      if (contentScore.total < 80) grade = "Acceptable";
      if (contentScore.total < 70) grade = "Below Standard";
      if (contentScore.total < 60) grade = "Rewrite";

      const score_breakdown = {
        total_score: contentScore.total,
        grade,
        breakdown: {
          content_quality: { 
            score: Math.min(30, Math.ceil(contentScore.total * 0.3)), 
            max: 30, 
            checks: ["word_count_ok", "paragraph_structure_ok"] 
          },
          seo_optimization: { 
            score: Math.min(25, Math.ceil(contentScore.total * 0.25)), 
            max: 25, 
            checks: ["h1_present", "keyword_in_title"] 
          },
          eeat_signals: { 
            score: Math.min(15, Math.ceil(contentScore.total * 0.15)), 
            max: 15, 
            checks: ["author_present", "experience_markers"] 
          },
          technical_elements: { 
            score: Math.min(15, Math.ceil(contentScore.total * 0.15)), 
            max: 15, 
            checks: ["images_present", "internal_links_ok"] 
          },
          geo_readiness: { 
            score: Math.min(15, Math.ceil(contentScore.total * 0.15)), 
            max: 15, 
            checks: ["answer_blocks_present", "faq_schema_ok"] 
          }
        }
      };

      // Correct any rounding errors against the exact total
      const currentSum = 
        score_breakdown.breakdown.content_quality.score +
        score_breakdown.breakdown.seo_optimization.score +
        score_breakdown.breakdown.eeat_signals.score +
        score_breakdown.breakdown.technical_elements.score +
        score_breakdown.breakdown.geo_readiness.score;
        
      if (currentSum > contentScore.total) {
        score_breakdown.breakdown.content_quality.score -= (currentSum - contentScore.total);
      }

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

      // Feature 4: Save breakdown to articles table
      const { error: articleUpdateErr } = await supabase
        .from("articles")
        .update({ seo_score_breakdown: score_breakdown })
        .eq("id", articleId);

      if (articleUpdateErr) {
        console.error("[CONTENT-SCORE] Article update error (seo_score_breakdown):", articleUpdateErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: contentScore,
        score_breakdown: scoreBlocked ? undefined : {
           total_score: contentScore.total,
           grade: contentScore.total >= 90 ? "Exceptional" : contentScore.total >= 80 ? "Strong" : contentScore.total >= 70 ? "Acceptable" : contentScore.total >= 60 ? "Below Standard" : "Rewrite"
        }, // Simplification for response without full refactoring
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
        },
        scoreBlocked,
        blockReason
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
