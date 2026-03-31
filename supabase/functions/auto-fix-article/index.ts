import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  isVersionedContentEnabled, 
  logContentVersion, 
  logScoreChange,
  createSuggestionResponse,
  type ChangeSource 
} from "../_shared/contentGuard.ts";
import { 
  validateAndSanitize, 
  logBlockedAttempt,
  updateLastScoreChangeReason
} from "../_shared/nicheGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AUTO-FIX ARTICLE
 * 
 * Uses LLM to automatically fix quality issues detected by the Quality Gate.
 * Preserves author voice and style while addressing structural/compliance issues.
 * 
 * ARQUITETURA DETERMINÍSTICA:
 * - Se FEATURE_VERSIONED_CONTENT ativo: retorna sugestão para aprovação
 * - Se inativo: comportamento legado (UPDATE direto)
 */

interface AutoFixRequest {
  articleId: string;
  blogId: string;
  fix_suggestions: string[];
  current_content: string;
  attempt_number: number;
  // Novo: indica se o usuário clicou em "Corrigir"
  user_initiated?: boolean;
}

const FIX_PROMPT = `Você é um editor profissional de conteúdo. Sua tarefa é corrigir problemas específicos em um artigo SEM alterar o tom, a voz ou o estilo do autor.

REGRAS ABSOLUTAS:
1. NÃO altere o significado ou a mensagem do texto
2. NÃO adicione informações não presentes no original
3. NÃO remova conteúdo relevante
4. MANTENHA a personalidade e o tom de voz
5. FAÇA apenas as correções solicitadas

PROBLEMAS A CORRIGIR:
{FIX_SUGGESTIONS}

ARTIGO ORIGINAL:
{CONTENT}

INSTRUÇÕES:
1. Analise cada problema listado
2. Aplique correções cirúrgicas e mínimas
3. Retorne APENAS o artigo corrigido em Markdown
4. NÃO inclua explicações, apenas o conteúdo corrigido`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { articleId, blogId, fix_suggestions, current_content, attempt_number, user_initiated }: AutoFixRequest = await req.json();
    
    // Verificar se o novo sistema de versionamento está ativo
    const versionedContentEnabled = await isVersionedContentEnabled(supabase, blogId);
    console.log(`[AUTO-FIX] Versioned content enabled: ${versionedContentEnabled}, user_initiated: ${user_initiated}`);

    if (!articleId || !fix_suggestions || fix_suggestions.length === 0) {
      return new Response(
        JSON.stringify({ error: "articleId and fix_suggestions are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AUTO-FIX] Starting auto-fix for article ${articleId}, attempt ${attempt_number}`);

    // Fetch automation settings
    const { data: automation } = await supabase
      .from("blog_automation")
      .select("auto_fix_enabled, max_auto_fix_attempts")
      .eq("blog_id", blogId)
      .single();

    if (!automation?.auto_fix_enabled) {
      console.log(`[AUTO-FIX] Auto-fix disabled for blog ${blogId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: "Auto-fix disabled for this blog",
          fixed_content: null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxAttempts = automation?.max_auto_fix_attempts || 3;
    if (attempt_number > maxAttempts) {
      console.log(`[AUTO-FIX] Max attempts (${maxAttempts}) reached for article ${articleId}`);
      
      // Mark article as blocked
      await supabase
        .from("articles")
        .update({ 
          quality_gate_status: 'blocked',
          quality_gate_attempts: attempt_number 
        })
        .eq("id", articleId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: "Max auto-fix attempts reached",
          fixed_content: null,
          status: 'blocked'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare the fix prompt
    const prompt = FIX_PROMPT
      .replace("{FIX_SUGGESTIONS}", fix_suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n"))
      .replace("{CONTENT}", current_content);

    // Call LLM via omniseen-ai.ts (Direct API)
    const { generateText } = await import('../_shared/omniseen-ai.ts');

    const aiResult = await generateText('auto_fix', [
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 8000 });

    if (!aiResult.success) {
      throw new Error(`AI error: ${aiResult.error}`);
    }

    let fixedContent = aiResult.content;

    if (!fixedContent) {
      throw new Error("AI did not return fixed content");
    }

    // =========================================================================
    // NICHE GUARD: Validar e sanitizar conteúdo corrigido
    // =========================================================================
    const guardResult = await validateAndSanitize(supabase, fixedContent, blogId, 'auto-fix-article');
    
    if (!guardResult.allowed) {
      console.log(`[AUTO-FIX] Niche Guard blocked ${guardResult.blockedTerms.length} terms`);
      
      // Registrar bloqueio
      await logBlockedAttempt(supabase, articleId, blogId, 'term_blocked', 'auto-fix-article', {
        blockedTerms: guardResult.blockedTerms,
        blockedReason: guardResult.reason,
        nicheProfileId: guardResult.nicheProfile?.id
      });
      
      // Usar conteúdo sanitizado
      if (guardResult.sanitizedContent) {
        fixedContent = guardResult.sanitizedContent;
        console.log(`[AUTO-FIX] Using sanitized content (removed ${guardResult.blockedTerms.length} marketing terms)`);
      }
    }

    // Validate fix didn't reduce content too much (max 15% reduction)
    const originalWords = current_content.split(/\s+/).length;
    const fixedWords = fixedContent.split(/\s+/).length;
    const reduction = (originalWords - fixedWords) / originalWords;

    if (reduction > 0.15) {
      console.warn(`[AUTO-FIX] Content reduced by ${(reduction * 100).toFixed(1)}% - rejecting fix`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: `Fix reduced content by ${(reduction * 100).toFixed(1)}% (max 15%)`,
          fixed_content: null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // ARQUITETURA DETERMINÍSTICA: Decisão baseada em feature flag
    // =========================================================================
    
    if (versionedContentEnabled && !user_initiated) {
      // NOVO COMPORTAMENTO: Retornar sugestão para aprovação do usuário
      console.log(`[AUTO-FIX] Returning suggestion for user approval (versioned content enabled)`);
      
      return new Response(
        JSON.stringify(createSuggestionResponse(
          fixedContent,
          'quality_gate_auto_fix',
          current_content,
          {
            suggestions_applied: fix_suggestions.length,
            attempt_number
          }
        )),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // COMPORTAMENTO: UPDATE direto (legado OU user_initiated)
    const changeSource: ChangeSource = user_initiated ? 'user_fix' : 'auto_fix';
    
    // Se versionamento ativo e user_initiated, registrar versão
    if (versionedContentEnabled && user_initiated) {
      await logContentVersion(
        supabase,
        articleId,
        fixedContent,
        changeSource,
        `Auto-fix aplicado pelo usuário: ${fix_suggestions.length} correções`
      );
    }

    // Update article with fixed content
    await supabase
      .from("articles")
      .update({ 
        content: fixedContent,
        updated_at: new Date().toISOString()
      })
      .eq("id", articleId);

    // Update audit log
    await supabase
      .from("quality_gate_audits")
      .update({
        auto_fix_applied: true,
        auto_fix_changes: {
          original_word_count: originalWords,
          fixed_word_count: fixedWords,
          suggestions_applied: fix_suggestions,
        },
      })
      .eq("article_id", articleId)
      .order("validated_at", { ascending: false })
      .limit(1);

    console.log(`[AUTO-FIX] Successfully fixed article ${articleId} (${changeSource})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        fixed_content: fixedContent,
        changes: {
          word_count_before: originalWords,
          word_count_after: fixedWords,
          suggestions_applied: fix_suggestions.length,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AUTO-FIX] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
