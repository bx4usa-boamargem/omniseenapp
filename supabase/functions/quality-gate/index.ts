import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectSensitiveNiche, validateCompliance, hasRequiredDisclaimer, injectDisclaimer } from "../_shared/complianceValidator.ts";
import { checkSimilarity, checkTitleSimilarity } from "../_shared/similarityChecker.ts";
import { validateStructure, generateStructureFixInstructions, isValidStructureType, type StructureType } from "../_shared/structureValidator.ts";
import { validateTitleForPublication, sanitizeTitleInContent } from "../_shared/titleValidator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * QUALITY GATE
 * 
 * Validates articles before automatic publication.
 * Runs checks: Content Quality, Duplicity, SEO, Compliance, Visual Rhythm, CTA/WhatsApp
 * Returns approval status with detailed feedback.
 * 
 * REGRA ABSOLUTA: Bloqueia publicação se subconta não tiver WhatsApp configurado
 * ou se artigo não tiver CTA válido com link wa.me
 */

interface QualityGateResult {
  approved: boolean;
  reasons: string[];
  fix_suggestions: string[];
  risk_level: 'low' | 'medium' | 'high';
  details: {
    word_count: number;
    structure: { passed: boolean; issues: string[] };
    similarity: { passed: boolean; score: number; similar_to?: string };
    seo: { passed: boolean; issues: string[] };
    compliance: { passed: boolean; niche: string; violations: string[] };
    visual_rhythm: { passed: boolean; issues: string[] };
    cta_whatsapp: { passed: boolean; issues: string[] };
  };
  auto_fixable: boolean;
  fixed_content?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { articleId, blogId } = await req.json();

    if (!articleId || !blogId) {
      return new Response(
        JSON.stringify({ error: "articleId and blogId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[QUALITY-GATE] Starting validation for article ${articleId}`);

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      throw new Error(`Article not found: ${articleError?.message}`);
    }

    // Fetch automation settings
    const { data: automation } = await supabase
      .from("blog_automation")
      .select("min_word_count, quality_gate_enabled")
      .eq("blog_id", blogId)
      .single();

    const minWordCount = automation?.min_word_count || 800;

    // Fetch business profile for compliance check AND CTA/WhatsApp validation
    const { data: businessProfile } = await supabase
      .from("business_profile")
      .select("niche, services, company_name, whatsapp, city")
      .eq("blog_id", blogId)
      .single();

    // Fetch existing articles for similarity check
    const { data: existingArticles } = await supabase
      .from("articles")
      .select("id, title, content")
      .eq("blog_id", blogId)
      .neq("id", articleId)
      .in("status", ["published", "draft", "ready_for_publish"])
      .limit(50);

    let content = article.content || "";
    let title = article.title || "";
    const reasons: string[] = [];
    const fix_suggestions: string[] = [];
    const ctaIssues: string[] = [];

    // ===== VALIDAÇÃO OBRIGATÓRIA: WHATSAPP E CTA (REGRA ABSOLUTA) =====
    
    // REGRA 1: WhatsApp da subconta DEVE estar configurado
    const cleanWhatsApp = businessProfile?.whatsapp?.replace(/\D/g, '') || '';
    if (!cleanWhatsApp || cleanWhatsApp.length < 10) {
      reasons.push('BLOQUEADO: WhatsApp da subconta não configurado');
      fix_suggestions.push('Acesse "Minha Empresa" e configure o WhatsApp antes de publicar');
      ctaIssues.push('WhatsApp não configurado na subconta');
    }

    // REGRA 2: Nome da empresa DEVE estar configurado
    if (!businessProfile?.company_name || businessProfile.company_name.trim() === '') {
      reasons.push('BLOQUEADO: Nome da empresa não configurado');
      fix_suggestions.push('Acesse "Minha Empresa" e configure o nome da empresa');
      ctaIssues.push('Nome da empresa não configurado');
    }

    // REGRA 3: Artigo DEVE ter seção "## Próximo passo"
    const hasProximoPasso = /##\s*Próximo\s*passo/i.test(content);
    if (!hasProximoPasso) {
      reasons.push('BLOQUEADO: Seção "Próximo passo" obrigatória ausente');
      fix_suggestions.push('Adicione uma seção "## Próximo passo" com CTA para WhatsApp');
      ctaIssues.push('Seção "## Próximo passo" ausente');
    }

    // REGRA 4: Artigo DEVE ter link wa.me válido (NUNCA api.whatsapp.com)
    const hasWaMeLink = /https:\/\/wa\.me\/\d{10,}/i.test(content);
    const hasApiWhatsApp = /api\.whatsapp\.com/i.test(content);
    
    if (hasApiWhatsApp) {
      reasons.push('BLOQUEADO: Artigo usa api.whatsapp.com (proibido)');
      fix_suggestions.push('Substitua todos os links api.whatsapp.com por wa.me');
      ctaIssues.push('Uso proibido de api.whatsapp.com');
    }
    
    if (!hasWaMeLink && cleanWhatsApp.length >= 10) {
      reasons.push('BLOQUEADO: Link WhatsApp (wa.me) não encontrado no CTA');
      fix_suggestions.push('A seção "Próximo passo" deve conter botão com link wa.me');
      ctaIssues.push('Link wa.me ausente no conteúdo');
    }

    // REGRA 5: Verificar se o botão "Fale com..." existe
    const hasFaleComButton = /Fale\s+com\s+.+\s+agora/i.test(content);
    if (!hasFaleComButton && hasProximoPasso) {
      fix_suggestions.push('Adicione um botão "Fale com {EMPRESA} agora" na seção "Próximo passo"');
      ctaIssues.push('Botão "Fale com..." ausente');
    }

    const ctaWhatsAppValid = ctaIssues.length === 0;

    // ===== 0. TITLE VALIDATION (REGRA ABSOLUTA) =====
    const titleValidation = validateTitleForPublication(title);
    
    if (titleValidation.wasAutoCorrected) {
      console.log(`[QUALITY-GATE] Title auto-corrected: "${title}" → "${titleValidation.title}"`);
      title = titleValidation.title;
      
      // Also sanitize H1 in content
      const contentSanitization = sanitizeTitleInContent(content);
      if (contentSanitization.wasModified) {
        content = contentSanitization.content;
        console.log(`[QUALITY-GATE] H1 in content also corrected`);
      }
      
      // Update article in database with corrected title
      await supabase
        .from("articles")
        .update({ 
          title: titleValidation.title,
          content: content,
          updated_at: new Date().toISOString()
        })
        .eq("id", articleId);
      
      fix_suggestions.push(`Título corrigido automaticamente (removido prefixo proibido)`);
    }
    
    if (!titleValidation.canPublish) {
      reasons.push(`Título inválido: ${titleValidation.error}`);
      fix_suggestions.push("Criar título sem prefixos como 'Artigo:', 'Post:', 'Guia:'");
    }

    // ===== CONTENT SCORE INFO (OPCIONAL - NÃO BLOQUEIA) =====
    const { data: scoreData } = await supabase
      .from('article_content_scores')
      .select('total_score, serp_analysis_id, meets_market_standards')
      .eq('article_id', articleId)
      .maybeSingle();

    // Buscar configuração do blog (se existir tabela blog_config)
    const { data: blogConfig } = await supabase
      .from('blog_config')
      .select('minimum_score_to_publish')
      .eq('blog_id', blogId)
      .maybeSingle();

    const minimumScore = blogConfig?.minimum_score_to_publish || 70;

    // INFO (não bloqueia): Sugestão de análise SERP
    if (!scoreData?.serp_analysis_id) {
      fix_suggestions.push('Sugestão: Execute "Analisar Concorrência" para otimizar SEO');
    }

    // INFO (não bloqueia): Sugestão de score
    if (scoreData && scoreData.total_score < minimumScore) {
      fix_suggestions.push(`Sugestão: Content Score ${scoreData.total_score}/100 - use "Aumentar Score" para melhorar`);
    }

    // ===== 1. CONTENT QUALITY =====
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
    const structureIssues: string[] = [];

    if (wordCount < minWordCount) {
      structureIssues.push(`Artigo tem apenas ${wordCount} palavras (mínimo: ${minWordCount})`);
      fix_suggestions.push(`Expandir conteúdo para pelo menos ${minWordCount} palavras`);
    }

    // Check for territory in title
    const hasTerritory = businessProfile?.city && 
      (title.toLowerCase().includes(businessProfile.city.toLowerCase()) || 
       content.toLowerCase().includes(businessProfile.city.toLowerCase()));
    
    if (!hasTerritory && businessProfile?.city) {
      structureIssues.push("Território (cidade) não mencionado no conteúdo");
      fix_suggestions.push(`Incluir referência a ${businessProfile.city} no título ou introdução`);
    }

    // Check for direct answer in intro (first 200 chars should have key info)
    const intro = content.slice(0, 500);
    const hasDirectAnswer = intro.includes("?") || 
      /^#+\s/.test(content) ||
      intro.split(/[.!]/).some((s: string) => s.length > 50);
    
    if (!hasDirectAnswer) {
      structureIssues.push("Introdução sem resposta direta ao tema");
      fix_suggestions.push("Adicionar resposta clara na introdução antes de desenvolver o tema");
    }

    // Check for CTA section (already checked above, but keep for structure details)
    const hasCTA = hasProximoPasso || 
      /##\s*Entre em contato/i.test(content) ||
      /##\s*Fale conosco/i.test(content);
    
    if (!hasCTA) {
      structureIssues.push("Seção de CTA (Próximo passo) ausente");
      fix_suggestions.push("Adicionar seção '## Próximo passo' com CTA contextual");
    }

    // ===== 2. DUPLICITY CHECK =====
    const similarityResult = checkSimilarity(
      content,
      existingArticles || [],
      0.85
    );

    const titleSimilarityResult = checkTitleSimilarity(
      title,
      (existingArticles || []).map(a => ({ id: a.id, title: a.title })),
      0.7
    );

    if (similarityResult.isSimilar) {
      reasons.push(`Conteúdo ${similarityResult.similarityScore}% similar a artigo existente`);
      fix_suggestions.push("Reescrever conteúdo com abordagem diferente");
    }

    if (titleSimilarityResult.isSimilar) {
      reasons.push(`Título muito similar a: "${titleSimilarityResult.mostSimilarArticle?.title}"`);
      fix_suggestions.push("Criar título único com ângulo diferente");
    }

    // ===== 3. SEO CHECK =====
    const seoIssues: string[] = [];
    
    // H1 check
    const h1Matches = content.match(/^#\s+.+$/gm) || [];
    if (h1Matches.length === 0) {
      seoIssues.push("H1 ausente no conteúdo");
      fix_suggestions.push("Adicionar título H1 no início do artigo");
    } else if (h1Matches.length > 1) {
      seoIssues.push(`Múltiplos H1 detectados (${h1Matches.length})`);
      fix_suggestions.push("Manter apenas um H1 e converter demais para H2");
    }

    // H2/H3 check
    const h2Matches = content.match(/^##\s+.+$/gm) || [];
    if (h2Matches.length < 3) {
      seoIssues.push(`Apenas ${h2Matches.length} subtítulos H2 (recomendado: 3+)`);
      fix_suggestions.push("Adicionar mais subtítulos H2 para estruturar conteúdo");
    }

    // Meta description check
    if (!article.meta_description || article.meta_description.length < 50) {
      seoIssues.push("Meta description ausente ou muito curta");
      fix_suggestions.push("Adicionar meta description entre 140-160 caracteres");
    }

    // Keywords check
    const keywords = article.keywords || [];
    if (keywords.length < 3) {
      seoIssues.push(`Apenas ${keywords.length} palavras-chave (recomendado: 3+)`);
      fix_suggestions.push("Adicionar mais palavras-chave relevantes");
    }

    // Keyword stuffing check
    const primaryKeyword = keywords[0]?.toLowerCase();
    if (primaryKeyword) {
      const keywordCount = (content.toLowerCase().match(new RegExp(primaryKeyword, 'g')) || []).length;
      const keywordDensity = (keywordCount / wordCount) * 100;
      if (keywordDensity > 3) {
        seoIssues.push(`Keyword stuffing detectado (${keywordDensity.toFixed(1)}% para "${keywords[0]}")`);
        fix_suggestions.push("Reduzir frequência da palavra-chave principal para < 3%");
      }
    }

    // ===== 4. COMPLIANCE CHECK =====
    const detectedNiche = detectSensitiveNiche(businessProfile?.niche || '', businessProfile?.services || []);
    const complianceResult = validateCompliance(content, detectedNiche);
    
    let fixedContent = content;
    if (!complianceResult.passed) {
      for (const violation of complianceResult.violations) {
        reasons.push(`Violação de compliance: ${violation}`);
      }
      fix_suggestions.push("Remover claims proibidos ou adicionar disclaimers necessários");
    }

    // Check for required disclaimers
    if (detectedNiche !== 'general') {
      if (!hasRequiredDisclaimer(content, detectedNiche)) {
        seoIssues.push(`Disclaimer obrigatório para nicho ${detectedNiche} ausente`);
        fix_suggestions.push(`Adicionar disclaimer padrão para conteúdo de ${detectedNiche}`);
        
        // Auto-inject disclaimer
        fixedContent = injectDisclaimer(content, detectedNiche);
      }
    }

    // ===== 5. STRUCTURE VALIDATION =====
    let structureValidationResult = null;
    const articleStructureType = article.article_structure_type;
    
    if (articleStructureType && isValidStructureType(articleStructureType)) {
      structureValidationResult = validateStructure(content, title, articleStructureType as StructureType);
      
      if (!structureValidationResult.valid) {
        const validationErrors = (structureValidationResult as { valid: boolean; issues?: string[] }).issues || [];
        for (const error of validationErrors) {
          structureIssues.push(`Estrutura: ${error}`);
        }
        
        // Generate fix instructions based on structure type
        if (validationErrors.length > 0) {
          fix_suggestions.push(`Corrigir estrutura do artigo (tipo: ${articleStructureType})`);
        }
      }
    }

    // ===== 6. VISUAL RHYTHM CHECK =====
    const visualIssues: string[] = [];
    
    // Check paragraph length
    const paragraphs = content.split(/\n\n+/).filter((p: string) => p.trim().length > 0);
    const longParagraphs = paragraphs.filter((p: string) => p.split(/\s+/).length > 150);
    if (longParagraphs.length > 0) {
      visualIssues.push(`${longParagraphs.length} parágrafos muito longos (>150 palavras)`);
      fix_suggestions.push("Quebrar parágrafos longos para melhor legibilidade");
    }

    // Check for lists
    const hasLists = /^[-*]\s+.+$/m.test(content) || /^\d+\.\s+.+$/m.test(content);
    if (wordCount > 800 && !hasLists) {
      visualIssues.push("Artigo longo sem listas de tópicos");
      fix_suggestions.push("Adicionar listas com bullets para facilitar escaneabilidade");
    }

    // Check for visual blocks (quotes, callouts)
    const hasVisualBlocks = /^>\s+.+$/m.test(content) || 
      /💡/.test(content) || 
      /⚠️/.test(content) ||
      /📌/.test(content);
    if (wordCount > 1000 && !hasVisualBlocks) {
      visualIssues.push("Artigo longo sem elementos visuais (citações, callouts)");
      fix_suggestions.push("Adicionar blocos destacados (💡, ⚠️, >) para quebrar monotonia");
    }

    // ===== FINAL DECISION =====
    const allIssues = [
      ...structureIssues,
      ...seoIssues,
      ...visualIssues,
    ];

    reasons.push(...allIssues);

    // Determine risk level
    const criticalIssues = reasons.filter(r => 
      r.includes("similar") ||
      r.includes("proibid") ||
      r.includes("stuffing") ||
      r.includes("BLOQUEADO")
    ).length;

    const riskLevel: 'low' | 'medium' | 'high' = 
      criticalIssues > 0 ? 'high' :
      reasons.length > 3 ? 'medium' : 'low';

    // Approval logic - inclui validação de CTA/WhatsApp como OBRIGATÓRIA
    const structureValid = !structureValidationResult || structureValidationResult.valid;
    
    const approved = 
      wordCount >= minWordCount &&
      !similarityResult.isSimilar &&
      !titleSimilarityResult.isSimilar &&
      complianceResult.passed &&
      h1Matches.length === 1 &&
      hasCTA &&
      structureValid &&
      ctaWhatsAppValid; // OBRIGATÓRIO: CTA e WhatsApp válidos

    const result: QualityGateResult = {
      approved,
      reasons,
      fix_suggestions,
      risk_level: riskLevel,
      details: {
        word_count: wordCount,
        structure: {
          passed: structureIssues.length === 0,
          issues: structureIssues,
        },
        similarity: {
          passed: !similarityResult.isSimilar && !titleSimilarityResult.isSimilar,
          score: similarityResult.similarityScore,
          similar_to: similarityResult.mostSimilarArticle?.title,
        },
        seo: {
          passed: seoIssues.length === 0,
          issues: seoIssues,
        },
        compliance: {
          passed: complianceResult.passed,
          niche: detectedNiche,
          violations: complianceResult.violations,
        },
        visual_rhythm: {
          passed: visualIssues.length === 0,
          issues: visualIssues,
        },
        cta_whatsapp: {
          passed: ctaWhatsAppValid,
          issues: ctaIssues,
        },
      },
      auto_fixable: fix_suggestions.length > 0 && !similarityResult.isSimilar,
      fixed_content: fixedContent !== content ? fixedContent : undefined,
    };

    // Log audit
    await supabase.from("quality_gate_audits").insert({
      article_id: articleId,
      blog_id: blogId,
      attempt_number: (article.quality_gate_attempts || 0) + 1,
      approved,
      risk_level: riskLevel,
      failures: reasons,
      warnings: allIssues.filter(i => !reasons.includes(i)),
      fix_suggestions,
      word_count: wordCount,
      similarity_score: similarityResult.similarityScore,
      seo_score: Math.max(0, 100 - seoIssues.length * 15),
      compliance_passed: complianceResult.passed,
      validator_version: 'v1.1', // Bumped version for CTA/WhatsApp validation
    });

    // Update article quality gate status
    await supabase
      .from("articles")
      .update({
        quality_gate_status: approved ? 'approved' : 'pending',
        quality_gate_attempts: (article.quality_gate_attempts || 0) + 1,
      })
      .eq("id", articleId);

    console.log(`[QUALITY-GATE] Article ${articleId}: ${approved ? 'APPROVED' : 'BLOCKED'} (${reasons.length} issues, CTA valid: ${ctaWhatsAppValid})`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[QUALITY-GATE] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
