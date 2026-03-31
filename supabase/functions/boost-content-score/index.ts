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
import { generateText } from '../_shared/omniseen-ai.ts';
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
import { 
  validateAndSanitize, 
  canChangeScore, 
  logBlockedAttempt,
  updateLastScoreChangeReason 
} from "../_shared/nicheGuard.ts";
import {
  extractImageBlocks,
  reinjectImageBlocks,
  validateImagePreservation,
  IMAGE_PROTECTION_PROMPT
} from "../_shared/imageProtection.ts";

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
  // Score anterior para validação de não-regressão
  previousScore?: number;
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
      userInitiated = true,  // Default: assumir que veio do usuário
      previousScore = 0      // Score anterior para validação
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

    // Fetch SERP matrix - try exact match first, then fuzzy match (keyword may be enriched with city)
    let serpData = await supabase
      .from("serp_analysis_cache")
      .select("matrix, id, keyword")
      .eq("blog_id", blogId)
      .eq("keyword", keyword)
      .gt("expires_at", new Date().toISOString())
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .single()
      .then(res => res.data);

    // If not found with exact match, try fuzzy match (keyword may have city appended by analyze-serp)
    if (!serpData) {
      console.log(`[BOOST-SCORE] Exact keyword match not found, trying fuzzy search...`);
      const fuzzyResult = await supabase
        .from("serp_analysis_cache")
        .select("matrix, id, keyword")
        .eq("blog_id", blogId)
        .ilike("keyword", `${keyword}%`)
        .gt("expires_at", new Date().toISOString())
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .single();
      
      serpData = fuzzyResult.data;
      if (serpData) {
        console.log(`[BOOST-SCORE] Found SERP with enriched keyword: "${serpData.keyword}"`);
      }
    }

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

        // Refetch the newly created SERP data - use fuzzy match since analyze-serp enriches keyword with city
        const refetch = await supabase
          .from("serp_analysis_cache")
          .select("matrix, id, keyword")
          .eq("blog_id", blogId)
          .ilike("keyword", `${keyword}%`)
          .order("analyzed_at", { ascending: false })
          .limit(1)
          .single();
          
        serpData = refetch.data;
        
        if (!serpData) {
          // Last resort: get the most recent SERP for this blog
          console.log(`[BOOST-SCORE] Fuzzy match failed, fetching most recent SERP for blog...`);
          const latestResult = await supabase
            .from("serp_analysis_cache")
            .select("matrix, id, keyword")
            .eq("blog_id", blogId)
            .order("analyzed_at", { ascending: false })
            .limit(1)
            .single();
          
          serpData = latestResult.data;
        }
        
        if (!serpData) {
          return new Response(
            JSON.stringify({ 
              error: "SERP analysis completed but no data found. Please try again.",
              code: "SERP_DATA_MISSING"
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log(`[BOOST-SCORE] Auto-SERP analysis complete, using keyword: "${serpData.keyword}"`);
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

    // =========================================================================
    // IMAGE PROTECTION: Extrair imagens antes de enviar para IA
    // =========================================================================
    const { cleanContent: contentWithoutImages, imageBlocks } = extractImageBlocks(content);
    console.log(`[BOOST-SCORE] Extracted ${imageBlocks.length} image blocks for protection`);

    // =========================================================================
    // PROMPT INCREMENTAL: Micro-ajustes em vez de reescrita completa
    // REGRA: Máximo 10% do texto pode ser alterado
    // =========================================================================
    const optimizePrompt = `Você é um editor SEO de PRECISÃO CIRÚRGICA.

## ⚠️ REGRA ABSOLUTA - NÃO VIOLAR
Você NÃO PODE reescrever o artigo. Você APENAS:
1. INSERE termos faltantes nas frases JÁ EXISTENTES
2. EXPANDE parágrafos fracos com +1-2 sentenças SE necessário
3. AJUSTA H2 existentes ou adiciona 1 novo H2 SE faltando
4. MELHORA o CTA existente SE necessário

LIMITE MÁXIMO: 10% do texto pode ser alterado. 90% DEVE permanecer IDÊNTICO.
${IMAGE_PROTECTION_PROMPT}

## ${nicheInstructions}

## ARTIGO ATUAL (95% deve permanecer IDÊNTICO)
Título: ${title}
Palavras: ${currentMetrics.wordCount}
H2s: ${currentMetrics.h2Count}
Score atual: ${currentScore.total}/100

${contentWithoutImages}

## MÉTRICAS DO MERCADO (SERP)
- Média de palavras: ${serpMatrix.averages.avgWords}
- Média de H2s: ${serpMatrix.averages.avgH2}
- Termos dominantes: ${serpMatrix.commonTerms.slice(0, 10).join(', ')}

## MICRO-AJUSTES PERMITIDOS (escolha apenas o necessário)
${optimizations.map((o, i) => `${i + 1}. ${o}`).join('\n')}

## TERMOS A INSERIR (nas frases JÁ existentes, não criar parágrafos novos)
${filteredMissingTerms.slice(0, 5).join(', ')}

## INSTRUÇÕES CRÍTICAS
1. NÃO reescreva parágrafos inteiros
2. NÃO mude o tom ou estilo do autor
3. NÃO adicione conteúdo genérico de marketing
4. APENAS faça ajustes cirúrgicos mínimos
5. Se não conseguir melhorar sem reescrever, retorne o artigo ORIGINAL
6. Priorize inserir os termos faltantes nas frases existentes

Retorne APENAS o artigo com as mínimas alterações em HTML/Markdown.
Se a mudança necessária for muito grande, retorne o artigo ORIGINAL sem alterações.`;

    // Call AI for optimization via omniseen-ai.ts
    console.log(`[BOOST-SCORE] Calling AI for optimization...`);

    const aiResult = await generateText('boost_score', [
      {
        role: 'system',
        content: 'Você é um editor SEO especialista. Retorne APENAS o conteúdo otimizado em formato HTML/Markdown, sem explicações ou comentários. Mantenha TODA a estrutura HTML. NÃO converta HTML para Markdown ou texto plano. Mantenha todos os marcadores <!--IMG_PLACEHOLDER_N--> nas suas posições.'
      },
      { role: 'user', content: optimizePrompt }
    ], { maxTokens: 8000, temperature: 0.3 });

    if (!aiResult.success) {
      throw new Error(`AI optimization failed: ${aiResult.error}`);
    }

    let optimizedContent = aiResult.content || content;

    // =========================================================================
    // IMAGE RE-INJECTION: Restaurar imagens após IA
    // =========================================================================
    if (imageBlocks.length > 0) {
      optimizedContent = reinjectImageBlocks(optimizedContent, imageBlocks);
      const validation = validateImagePreservation(content, optimizedContent);
      console.log(`[BOOST-SCORE] Image validation: ${validation.preserved ? '✅' : '⚠️'} ${validation.beforeCount} before, ${validation.afterCount} after, ${validation.lostCount} lost`);
    }

    // =========================================================================
    // NICHE GUARD: Validar e sanitizar conteúdo otimizado
    // =========================================================================
    const guardResult = await validateAndSanitize(supabase, optimizedContent, blogId, 'boost-content-score');
    
    if (!guardResult.allowed) {
      console.log(`[BOOST-SCORE] Niche Guard blocked ${guardResult.blockedTerms.length} terms: ${guardResult.blockedTerms.join(', ')}`);
      
      // Registrar bloqueio
      await logBlockedAttempt(supabase, articleId, blogId, 'term_blocked', 'boost-content-score', {
        blockedTerms: guardResult.blockedTerms,
        blockedReason: guardResult.reason,
        nicheProfileId: guardResult.nicheProfile?.id
      });
      
      // Usar conteúdo sanitizado
      if (guardResult.sanitizedContent) {
        optimizedContent = guardResult.sanitizedContent;
      }
    }

    // Calculate new score with niche floor
    const newMetrics = extractArticleMetrics(optimizedContent);
    const rawNewScore = calculateContentScore({ title, content: optimizedContent, ...newMetrics }, serpMatrix);
    const { score: newScoreValue, floorApplied: newFloorApplied, reason: floorReason } = applyScoreFloor(rawNewScore.total, nicheProfile);
    const newScore = { ...rawNewScore, total: newScoreValue };

    console.log(`[BOOST-SCORE] New score: ${newScore.total}/100 (raw: ${rawNewScore.total}, floor: ${newFloorApplied}, was ${currentScore.total})`);

    // =========================================================================
    // PROTEÇÃO ABSOLUTA: BLOQUEAR REGRESSÃO DE SCORE
    // REGRA: Se newScore < currentScore, REJEITAR a mudança completamente
    // =========================================================================
    if (newScore.total < currentScore.total) {
      console.error(`[BOOST-SCORE] ❌ SCORE REGRESSION BLOCKED: ${currentScore.total} → ${newScore.total}`);
      
      await logBlockedAttempt(supabase, articleId, blogId, 'score_regression', 'boost-content-score', {
        blockedReason: 'Score regression not allowed',
        originalValue: { proposedScore: newScore.total, currentScore: currentScore.total, scoreDrop: currentScore.total - newScore.total }
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          optimized: false,
          rejected: true,
          reason: 'score_regression_blocked',
          content: content, // Retornar conteúdo ORIGINAL, não o otimizado
          previousScore: currentScore.total,
          newScore: currentScore.total, // Manter score anterior
          message: `Otimização rejeitada: score cairia de ${currentScore.total} para ${newScore.total}. Nenhuma mudança aplicada.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // VALIDAÇÃO DE NICHO: Verificar se o conteúdo otimizado não foi contaminado
    // =========================================================================
    const validationResult = validateContentForNiche(optimizedContent, nicheProfile);
    if (!validationResult.valid) {
      console.warn(`[BOOST-SCORE] Niche violations detected: ${validationResult.violations.join(', ')}`);
    }

    // =========================================================================
    // SCORE GUARD: Verificar se o score pode ser alterado (regras adicionais)
    // =========================================================================
    const triggeredBy = userInitiated ? 'user' : 'system';
    const scoreGuard = await canChangeScore(supabase, articleId, triggeredBy, newScore.total, currentScore.total);
    
    if (!scoreGuard.allowed) {
      console.log(`[BOOST-SCORE] Score change blocked: ${scoreGuard.reason}`);
      
      await logBlockedAttempt(supabase, articleId, blogId, 'score_blocked', 'boost-content-score', {
        blockedReason: scoreGuard.reason,
        originalValue: { proposedScore: newScore.total, currentScore: currentScore.total }
      });
      
      // Retornar conteúdo original (não aplicar mudanças destrutivas)
      return new Response(
        JSON.stringify({
          success: false,
          optimized: false,
          rejected: true,
          reason: 'score_guard_blocked',
          content: content, // ORIGINAL, não otimizado
          previousScore: currentScore.total,
          newScore: currentScore.total,
          scoreBlocked: true,
          scoreBlockedReason: scoreGuard.reason,
          message: "Alteração bloqueada pelo Score Guard"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save updated score if articleId provided
    if (articleId) {
      // Registrar motivo da mudança de score
      const changeReason = userInitiated 
        ? `Usuário clicou em "Aumentar Score" (${optimizationType})` 
        : `Sistema otimizou automaticamente (${optimizationType})`;
      await updateLastScoreChangeReason(supabase, articleId, changeReason);

      // Se versionamento ativo, registrar log de score
      if (versionedContentEnabled) {
        const floorReasonFinal = newFloorApplied ? floorReason : `boost_${optimizationType}`;
        await logScoreChange(
          supabase,
          articleId,
          currentScore.total,
          newScore.total,
          floorReasonFinal || `boost_${optimizationType}`,
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
      provider: "gemini",
      endpoint: "boost-content-score",
      cost_usd: 0.03,
      tokens_used: 8000,
      success: true,
      metadata: {
        phase: "optimization",
        model: 'gemini-2.5-flash',
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
