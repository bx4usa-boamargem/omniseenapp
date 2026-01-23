// ═══════════════════════════════════════════════════════════════════
// BOOST-CONTENT-SCORE: Otimização Automática de Conteúdo
// Combina: optimize-for-serp + adjust-structure + semantic-enrichment
// 
// ARQUITETURA DETERMINÍSTICA:
// - Perfil de Nicho dinâmico via banco de dados
// - Piso de score por nicho
// - Feature flag para controle de versionamento
// - Log de alterações de score
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateContentScore, extractArticleMetrics } from "../_shared/contentScoring.ts";
import { SERPMatrix } from "../_shared/serpTypes.ts";
import { 
  isVersionedContentEnabled, 
  logScoreChange, 
  getCurrentVersion 
} from "../_shared/contentGuard.ts";
import { 
  getNicheProfile, 
  filterTermsByProfile, 
  validateContentForNiche,
  applyScoreFloor,
  getNichePromptInstructions,
  NicheProfile
} from "../_shared/nicheProfile.ts";

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
  optimizationType?: 'full' | 'terms' | 'structure' | 'expansion' | 'words' | 'h2' | 'rewrite';
  // Novo: indica que o usuário iniciou a ação
  userInitiated?: boolean;
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
      optimizationType = 'full',
      userInitiated = true  // Default: assumir que veio do usuário
    } = request;

    if (!content || !keyword || !blogId) {
      return new Response(
        JSON.stringify({ error: "content, keyword, and blogId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BOOST-SCORE] Starting optimization for "${keyword}" | Target: ${targetScore} | Type: ${optimizationType} | User: ${userInitiated}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    // Verificar feature flag
    const versionedContentEnabled = await isVersionedContentEnabled(supabase, blogId);
    console.log(`[BOOST-SCORE] Versioned content enabled: ${versionedContentEnabled}`);

    // =========================================================================
    // PERFIL DE NICHO: Buscar perfil do banco
    // =========================================================================
    const nicheProfile: NicheProfile = await getNicheProfile(supabase, blogId);
    console.log(`[BOOST-SCORE] Using niche profile: ${nicheProfile.displayName} (min_score: ${nicheProfile.minScore}, target: ${nicheProfile.targetScore})`);

    // Usar target do nicho se não especificado
    const effectiveTarget = targetScore || nicheProfile.targetScore;

    // Fetch SERP matrix
    let serpData = await supabase
      .from("serp_analysis_cache")
      .select("matrix, id")
      .eq("blog_id", blogId)
      .eq("keyword", keyword)
      .gt("expires_at", new Date().toISOString())
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .single()
      .then(res => res.data);

    // Auto-trigger SERP analysis if not found or expired
    if (!serpData) {
      console.log(`[BOOST-SCORE] No valid SERP cache found, auto-triggering analyze-serp for "${keyword}"...`);
      
      try {
        const serpResponse = await supabase.functions.invoke('analyze-serp', {
          body: { keyword, blogId, forceRefresh: false, articleId }
        });
        
        if (serpResponse.error) {
          console.error('[BOOST-SCORE] analyze-serp failed:', serpResponse.error);
          return new Response(
            JSON.stringify({ 
              error: "Failed to analyze SERP automatically. Please try again.",
              code: "SERP_ANALYSIS_FAILED",
              details: serpResponse.error
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Refetch the newly created SERP data
        const refetch = await supabase
          .from("serp_analysis_cache")
          .select("matrix, id")
          .eq("blog_id", blogId)
          .eq("keyword", keyword)
          .order("analyzed_at", { ascending: false })
          .limit(1)
          .single();
          
        serpData = refetch.data;
        
        if (!serpData) {
          return new Response(
            JSON.stringify({ 
              error: "SERP analysis completed but no data found. Please try again.",
              code: "SERP_DATA_MISSING"
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log(`[BOOST-SCORE] Auto-SERP analysis complete, proceeding with optimization`);
      } catch (serpError) {
        console.error('[BOOST-SCORE] Auto-SERP error:', serpError);
        return new Response(
          JSON.stringify({ 
            error: "No SERP analysis found and auto-analysis failed.",
            code: "SERP_NOT_FOUND"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const serpMatrix = serpData.matrix as SERPMatrix;
    
    // =========================================================================
    // FILTRO DE NICHO: Remover termos genéricos que não pertencem ao nicho
    // =========================================================================
    const originalTermsCount = serpMatrix.commonTerms?.length || 0;
    serpMatrix.commonTerms = filterTermsByProfile(
      serpMatrix.commonTerms || [], 
      nicheProfile
    );
    console.log(`[BOOST-SCORE] Terms filtered: ${originalTermsCount} → ${serpMatrix.commonTerms.length} (niche: ${nicheProfile.name})`);
    
    // Calculate current score with niche floor
    const currentMetrics = extractArticleMetrics(content);
    const rawScore = calculateContentScore({ title, content, ...currentMetrics }, serpMatrix);
    const { score: currentScoreValue, floorApplied: currentFloorApplied } = applyScoreFloor(rawScore.total, nicheProfile);
    const currentScore = { ...rawScore, total: currentScoreValue };
    
    console.log(`[BOOST-SCORE] Current score: ${currentScore.total}/100 (raw: ${rawScore.total}, floor applied: ${currentFloorApplied})`);

    // Buscar versão atual do artigo se versionamento ativo
    let currentVersion: number | undefined;
    if (versionedContentEnabled && articleId) {
      currentVersion = await getCurrentVersion(supabase, articleId);
      console.log(`[BOOST-SCORE] Current article version: ${currentVersion}`);
    }

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
    
    // Filtrar termos faltantes pelo nicho também
    const filteredMissingTerms = filterTermsByProfile(
      currentScore.breakdown.semanticCoverage.missing || [],
      nicheProfile
    );
    
    if (filteredMissingTerms.length > 0) {
      const missingTerms = filteredMissingTerms.slice(0, 10);
      optimizations.push(`TERMS: Include these missing terms: ${missingTerms.join(', ')}`);
    }
    
    if (!currentScore.breakdown.propositionClarity.hasCTA) {
      optimizations.push(`CTA: Add a clear call-to-action`);
    }
    
    if (!currentScore.breakdown.introQuality.hasAnswerFirst) {
      optimizations.push(`INTRO: Rewrite intro with Answer-First pattern`);
    }

    // If already at target, return early
    if (currentScore.total >= effectiveTarget && optimizations.length === 0) {
      console.log(`[BOOST-SCORE] Already at target score (${effectiveTarget}), no optimization needed`);
      return new Response(
        JSON.stringify({
          success: true,
          optimized: false,
          content,
          currentScore: currentScore.total,
          targetScore: effectiveTarget,
          message: "Article already meets target score",
          content_version: currentVersion,
          nicheProfile: {
            name: nicheProfile.displayName,
            minScore: nicheProfile.minScore,
            floorApplied: currentFloorApplied
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build optimization prompt with niche instructions
    const nicheInstructions = getNichePromptInstructions(nicheProfile);

    const optimizePrompt = `Você é um editor SEO especialista. Otimize este artigo para melhorar seu Content Score.

## ARTIGO ATUAL
Título: ${title}
Palavras: ${currentMetrics.wordCount}
H2s: ${currentMetrics.h2Count}
Score atual: ${currentScore.total}/100

## ${nicheInstructions}

## CONTEÚDO
${content}

## MÉTRICAS DO MERCADO (SERP)
- Média de palavras: ${serpMatrix.averages.avgWords}
- Média de H2s: ${serpMatrix.averages.avgH2}
- Termos dominantes (JÁ FILTRADOS PARA O NICHO): ${serpMatrix.commonTerms.slice(0, 15).join(', ')}
- Gaps de conteúdo: ${serpMatrix.contentGaps.slice(0, 5).join(', ')}

## OTIMIZAÇÕES NECESSÁRIAS
${optimizations.map((o, i) => `${i + 1}. ${o}`).join('\n')}

## TERMOS FALTANTES (INCLUIR OBRIGATORIAMENTE)
${filteredMissingTerms.slice(0, 10).join(', ')}

## INSTRUÇÕES
1. Mantenha a estrutura geral do artigo
2. Adicione conteúdo para atingir a média de palavras do mercado
3. Inclua TODOS os termos faltantes de forma natural
4. Adicione seções H2 se necessário
5. Garanta um CTA claro no final
6. Use o padrão Answer-First na introdução se não tiver
7. Mantenha o tom e estilo originais
8. NÃO insira termos de marketing genérico se o nicho não for marketing

Retorne APENAS o artigo otimizado em HTML/Markdown, sem explicações.`;

    // Call AI for optimization with retry logic
    console.log(`[BOOST-SCORE] Calling AI for optimization...`);
    
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 5000, 10000];
    let aiResponse: Response | null = null;
    let lastError: string = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "Você é um editor SEO especialista. Retorne APENAS o conteúdo otimizado em formato HTML/Markdown, sem explicações ou comentários."
              },
              { role: "user", content: optimizePrompt }
            ],
            max_tokens: 8000,
            temperature: 0.3
          }),
        });

        if (aiResponse.ok) {
          console.log(`[BOOST-SCORE] AI call successful on attempt ${attempt + 1}`);
          break;
        }

        // Log error details
        const errorBody = await aiResponse.text();
        lastError = `Status ${aiResponse.status}: ${errorBody}`;
        console.error(`[BOOST-SCORE] AI attempt ${attempt + 1} failed: ${lastError}`);

        // Don't retry for client errors (4xx except 429)
        if (aiResponse.status >= 400 && aiResponse.status < 500 && aiResponse.status !== 429) {
          throw new Error(`AI optimization failed: ${lastError}`);
        }

        // Retry for 5xx or 429
        if (attempt < MAX_RETRIES) {
          console.log(`[BOOST-SCORE] Retrying in ${RETRY_DELAYS[attempt]}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        }
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
        console.error(`[BOOST-SCORE] Fetch error on attempt ${attempt + 1}: ${lastError}`);
        
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        }
      }
    }

    if (!aiResponse || !aiResponse.ok) {
      throw new Error(`AI optimization failed after ${MAX_RETRIES + 1} attempts: ${lastError}`);
    }

    const aiData = await aiResponse.json();
    const optimizedContent = aiData.choices?.[0]?.message?.content || content;

    // Calculate new score with niche floor
    const newMetrics = extractArticleMetrics(optimizedContent);
    const rawNewScore = calculateContentScore({ title, content: optimizedContent, ...newMetrics }, serpMatrix);
    const { score: newScoreValue, floorApplied: newFloorApplied, reason: floorReason } = applyScoreFloor(rawNewScore.total, nicheProfile);
    const newScore = { ...rawNewScore, total: newScoreValue };

    console.log(`[BOOST-SCORE] New score: ${newScore.total}/100 (raw: ${rawNewScore.total}, floor: ${newFloorApplied}, was ${currentScore.total})`);

    // =========================================================================
    // VALIDAÇÃO DE NICHO: Verificar se o conteúdo otimizado não foi contaminado
    // =========================================================================
    const validationResult = validateContentForNiche(optimizedContent, nicheProfile);
    if (!validationResult.valid) {
      console.warn(`[BOOST-SCORE] Niche violations detected: ${validationResult.violations.join(', ')}`);
      // Log mas não bloqueia - apenas avisa
    }

    // Save updated score if articleId provided
    if (articleId) {
      // Se versionamento ativo, registrar log de score
      if (versionedContentEnabled) {
        const changeReason = newFloorApplied ? floorReason : `boost_${optimizationType}`;
        await logScoreChange(
          supabase,
          articleId,
          currentScore.total,
          newScore.total,
          changeReason || `boost_${optimizationType}`,
          userInitiated ? 'user' : 'system',
          currentVersion
        );
      }

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
          calculated_at: new Date().toISOString(),
          content_version: currentVersion  // Vincular score à versão
        }, {
          onConflict: 'article_id'
        });
    }

    // Log AI usage
    const durationMs = Date.now() - startTime;
    await supabase.from("ai_usage_logs").insert({
      blog_id: blogId,
      provider: "lovable",
      endpoint: "boost-content-score",
      cost_usd: 0.03,
      tokens_used: 8000,
      success: true,
      metadata: {
        phase: "optimization",
        model: "google/gemini-2.5-flash",
        source: "PromptPy",
        optimization_type: optimizationType,
        score_before: currentScore.total,
        score_after: newScore.total,
        score_increase: newScore.total - currentScore.total,
        raw_score_before: rawScore.total,
        raw_score_after: rawNewScore.total,
        floor_applied: newFloorApplied,
        duration_ms: durationMs,
        niche_profile: nicheProfile.name,
        niche_min_score: nicheProfile.minScore,
        niche_violations: validationResult.violations.length > 0 ? validationResult.violations : null,
        user_initiated: userInitiated,
        content_version: currentVersion
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
        durationMs,
        content_version: currentVersion,
        nicheProfile: {
          name: nicheProfile.displayName,
          minScore: nicheProfile.minScore,
          floorApplied: newFloorApplied
        },
        niche_violations: validationResult.violations.length > 0 ? validationResult.violations : undefined
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
