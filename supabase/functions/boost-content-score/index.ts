// ═══════════════════════════════════════════════════════════════════
// BOOST-CONTENT-SCORE: Otimização Automática de Conteúdo
// Combina: optimize-for-serp + adjust-structure + semantic-enrichment
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateContentScore, extractArticleMetrics } from "../_shared/contentScoring.ts";
import { SERPMatrix, ContentScore } from "../_shared/serpTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BoostRequest {
  articleId: string;
  content: string;
  title: string;
  keyword: string;
  blogId: string;
  targetScore?: number;
  optimizationType?: 'full' | 'terms' | 'structure' | 'expansion';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request = await req.json() as BoostRequest;
    const { 
      articleId, 
      content, 
      title, 
      keyword, 
      blogId,
      targetScore = 80,
      optimizationType = 'full'
    } = request;

    if (!content || !keyword || !blogId) {
      return new Response(
        JSON.stringify({ error: "content, keyword, and blogId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BOOST-SCORE] Starting optimization for "${keyword}" | Target: ${targetScore} | Type: ${optimizationType}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    // Fetch SERP matrix
    const { data: serpData } = await supabase
      .from("serp_analysis_cache")
      .select("matrix, id")
      .eq("blog_id", blogId)
      .eq("keyword", keyword)
      .gt("expires_at", new Date().toISOString())
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .single();

    if (!serpData) {
      return new Response(
        JSON.stringify({ 
          error: "No SERP analysis found. Run analyze-serp first.",
          code: "SERP_NOT_FOUND"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serpMatrix = serpData.matrix as SERPMatrix;
    
    // Calculate current score
    const currentMetrics = extractArticleMetrics(content);
    const currentScore = calculateContentScore({ title, content, ...currentMetrics }, serpMatrix);
    
    console.log(`[BOOST-SCORE] Current score: ${currentScore.total}/100`);

    // Determine what optimizations are needed
    const optimizations: string[] = [];
    
    if (currentScore.breakdown.wordProximity.status === 'below') {
      const wordsNeeded = serpMatrix.averages.avgWords - currentMetrics.wordCount;
      optimizations.push(`EXPANSION: Add ${wordsNeeded} words to match market average of ${serpMatrix.averages.avgWords}`);
    }
    
    if (currentScore.breakdown.h2Coverage.status === 'below') {
      const h2Needed = serpMatrix.averages.avgH2 - currentMetrics.h2Count;
      optimizations.push(`STRUCTURE: Add ${h2Needed} H2 sections`);
    }
    
    if (currentScore.breakdown.semanticCoverage.missing.length > 0) {
      const missingTerms = currentScore.breakdown.semanticCoverage.missing.slice(0, 10);
      optimizations.push(`TERMS: Include these missing terms: ${missingTerms.join(', ')}`);
    }
    
    if (!currentScore.breakdown.propositionClarity.hasCTA) {
      optimizations.push(`CTA: Add a clear call-to-action`);
    }
    
    if (!currentScore.breakdown.introQuality.hasAnswerFirst) {
      optimizations.push(`INTRO: Rewrite intro with Answer-First pattern`);
    }

    // If already at target, return early
    if (currentScore.total >= targetScore && optimizations.length === 0) {
      console.log(`[BOOST-SCORE] Already at target score, no optimization needed`);
      return new Response(
        JSON.stringify({
          success: true,
          optimized: false,
          content,
          currentScore: currentScore.total,
          targetScore,
          message: "Article already meets target score"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build optimization prompt
    const optimizePrompt = `Você é um editor SEO especialista. Otimize este artigo para melhorar seu Content Score.

## ARTIGO ATUAL
Título: ${title}
Palavras: ${currentMetrics.wordCount}
H2s: ${currentMetrics.h2Count}
Score atual: ${currentScore.total}/100

## CONTEÚDO
${content}

## MÉTRICAS DO MERCADO (SERP)
- Média de palavras: ${serpMatrix.averages.avgWords}
- Média de H2s: ${serpMatrix.averages.avgH2}
- Termos dominantes: ${serpMatrix.commonTerms.slice(0, 15).join(', ')}
- Gaps de conteúdo: ${serpMatrix.contentGaps.slice(0, 5).join(', ')}

## OTIMIZAÇÕES NECESSÁRIAS
${optimizations.map((o, i) => `${i + 1}. ${o}`).join('\n')}

## TERMOS FALTANTES (INCLUIR OBRIGATORIAMENTE)
${currentScore.breakdown.semanticCoverage.missing.slice(0, 10).join(', ')}

## INSTRUÇÕES
1. Mantenha a estrutura geral do artigo
2. Adicione conteúdo para atingir a média de palavras do mercado
3. Inclua TODOS os termos faltantes de forma natural
4. Adicione seções H2 se necessário
5. Garanta um CTA claro no final
6. Use o padrão Answer-First na introdução se não tiver
7. Mantenha o tom e estilo originais

Retorne APENAS o artigo otimizado em HTML/Markdown, sem explicações.`;

    // Call AI for optimization
    console.log(`[BOOST-SCORE] Calling OpenAI for optimization...`);
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          {
            role: "system",
            content: "Você é um editor SEO especialista. Retorne APENAS o conteúdo otimizado, sem explicações ou comentários."
          },
          { role: "user", content: optimizePrompt }
        ],
        max_tokens: 8000,
        temperature: 0.3
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI optimization failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const optimizedContent = aiData.choices?.[0]?.message?.content || content;

    // Calculate new score
    const newMetrics = extractArticleMetrics(optimizedContent);
    const newScore = calculateContentScore({ title, content: optimizedContent, ...newMetrics }, serpMatrix);

    console.log(`[BOOST-SCORE] New score: ${newScore.total}/100 (was ${currentScore.total})`);

    // Save updated score if articleId provided
    if (articleId) {
      await supabase
        .from("article_content_scores")
        .upsert({
          article_id: articleId,
          serp_analysis_id: serpData.id,
          total_score: newScore.total,
          breakdown: newScore.breakdown,
          comparison: newScore.comparison,
          recommendations: newScore.recommendations,
          word_count: newMetrics.wordCount,
          h2_count: newMetrics.h2Count,
          paragraph_count: newMetrics.paragraphCount,
          image_count: newMetrics.imageCount,
          semantic_coverage: newScore.breakdown.semanticCoverage.percentage,
          meets_market_standards: newScore.meetsMarketStandards,
          calculated_at: new Date().toISOString()
        }, {
          onConflict: 'article_id'
        });
    }

    // Log AI usage
    const durationMs = Date.now() - startTime;
    await supabase.from("ai_usage_logs").insert({
      blog_id: blogId,
      provider: "openai",
      endpoint: "boost-content-score",
      cost_usd: 0.05,
      tokens_used: 8000,
      success: true,
      metadata: {
        phase: "optimization",
        model: "openai/gpt-5",
        source: "PromptPy",
        optimization_type: optimizationType,
        score_before: currentScore.total,
        score_after: newScore.total,
        score_increase: newScore.total - currentScore.total,
        duration_ms: durationMs
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        optimized: true,
        content: optimizedContent,
        previousScore: currentScore.total,
        newScore: newScore.total,
        scoreIncrease: newScore.total - currentScore.total,
        optimizationsApplied: optimizations,
        metrics: {
          before: currentMetrics,
          after: newMetrics
        },
        durationMs
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[BOOST-SCORE] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Optimization failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
