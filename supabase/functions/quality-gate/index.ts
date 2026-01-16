import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectSensitiveNiche, validateCompliance, hasRequiredDisclaimer, injectDisclaimer } from "../_shared/complianceValidator.ts";
import { checkSimilarity, checkTitleSimilarity } from "../_shared/similarityChecker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * QUALITY GATE
 * 
 * Validates articles before automatic publication.
 * Runs 5 checks: Content Quality, Duplicity, SEO, Compliance, Visual Rhythm
 * Returns approval status with detailed feedback.
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

    // Fetch business profile for compliance check
    const { data: businessProfile } = await supabase
      .from("business_profile")
      .select("niche, services")
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

    const content = article.content || "";
    const title = article.title || "";
    const reasons: string[] = [];
    const fix_suggestions: string[] = [];

    // ===== 1. CONTENT QUALITY =====
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
    const structureIssues: string[] = [];

    if (wordCount < minWordCount) {
      structureIssues.push(`Artigo tem apenas ${wordCount} palavras (mínimo: ${minWordCount})`);
      fix_suggestions.push(`Expandir conteúdo para pelo menos ${minWordCount} palavras`);
    }

    // Check for territory in title
    const { data: profile } = await supabase
      .from("business_profile")
      .select("city")
      .eq("blog_id", blogId)
      .single();

    const hasTerritory = profile?.city && 
      (title.toLowerCase().includes(profile.city.toLowerCase()) || 
       content.toLowerCase().includes(profile.city.toLowerCase()));
    
    if (!hasTerritory && profile?.city) {
      structureIssues.push("Território (cidade) não mencionado no conteúdo");
      fix_suggestions.push(`Incluir referência a ${profile.city} no título ou introdução`);
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

    // Check for CTA section
    const hasCTA = /##\s*Próximo passo/i.test(content) || 
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
      fix_suggestions.push("Criar meta description de 140-160 caracteres");
    } else if (article.meta_description.length > 160) {
      seoIssues.push(`Meta description muito longa (${article.meta_description.length} chars)`);
      fix_suggestions.push("Reduzir meta description para máximo 160 caracteres");
    }

    // Keyword stuffing check
    const keywords = article.keywords || [];
    for (const keyword of keywords) {
      const keywordRegex = new RegExp(keyword, 'gi');
      const occurrences = (content.match(keywordRegex) || []).length;
      const density = occurrences / (wordCount / 100);
      if (density > 3) {
        seoIssues.push(`Keyword stuffing detectado: "${keyword}" (${density.toFixed(1)}%)`);
        fix_suggestions.push(`Reduzir uso de "${keyword}" para densidade natural (<3%)`);
      }
    }

    // ===== 4. COMPLIANCE CHECK =====
    const detectedNiche = detectSensitiveNiche(
      businessProfile?.niche,
      businessProfile?.services,
      content
    );
    
    const complianceResult = validateCompliance(content, detectedNiche);
    
    let fixedContent = content;
    if (!complianceResult.passed) {
      reasons.push(...complianceResult.violations);
      fix_suggestions.push("Remover frases proibidas para nicho sensível");
    } else if (detectedNiche !== 'general' && !hasRequiredDisclaimer(content, detectedNiche)) {
      fixedContent = injectDisclaimer(content, detectedNiche);
      fix_suggestions.push(`Disclaimer de ${detectedNiche} será adicionado automaticamente`);
    }

    // ===== 5. VISUAL RHYTHM =====
    const visualIssues: string[] = [];
    
    // Check paragraph length
    const paragraphs = content.split(/\n\n+/);
    const longParagraphs = paragraphs.filter((p: string) => p.length > 500 && !p.startsWith('#'));
    if (longParagraphs.length > 0) {
      visualIssues.push(`${longParagraphs.length} parágrafos muito longos (>500 chars)`);
      fix_suggestions.push("Quebrar parágrafos longos em blocos menores");
    }

    // Check for lists
    const hasLists = /^[-*]\s/m.test(content) || /^\d+\.\s/m.test(content);
    if (!hasLists && wordCount > 500) {
      visualIssues.push("Nenhuma lista detectada (bullet points ou numerada)");
      fix_suggestions.push("Adicionar listas para melhorar escaneabilidade");
    }

    // Check for visual blocks (blockquotes, highlights)
    const hasVisualBlocks = /^>/m.test(content) || /\*\*[^*]+\*\*/m.test(content);
    if (!hasVisualBlocks && wordCount > 800) {
      visualIssues.push("Sem blocos visuais de destaque");
      fix_suggestions.push("Adicionar citações ou destaques em negrito");
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
      r.includes("stuffing")
    ).length;

    const riskLevel: 'low' | 'medium' | 'high' = 
      criticalIssues > 0 ? 'high' :
      reasons.length > 3 ? 'medium' : 'low';

    // Approval logic
    const approved = 
      wordCount >= minWordCount &&
      !similarityResult.isSimilar &&
      !titleSimilarityResult.isSimilar &&
      complianceResult.passed &&
      h1Matches.length === 1 &&
      hasCTA;

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
      validator_version: 'v1.0',
    });

    // Update article quality gate status
    await supabase
      .from("articles")
      .update({
        quality_gate_status: approved ? 'approved' : 'pending',
        quality_gate_attempts: (article.quality_gate_attempts || 0) + 1,
      })
      .eq("id", articleId);

    console.log(`[QUALITY-GATE] Article ${articleId}: ${approved ? 'APPROVED' : 'BLOCKED'} (${reasons.length} issues)`);

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
