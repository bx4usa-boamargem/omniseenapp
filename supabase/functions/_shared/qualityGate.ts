import { QUALITY_GATE_CONFIG, QualityGateResult, ERROR_CODES, ArticleMode } from './qualityGateConfig.ts';

/**
 * Quality Gate Principal
 * Valida se artigo atende TODOS os critérios mínimos
 * FAIL-FAST: Primeira falha = abort imediato
 */

// deno-lint-ignore no-explicit-any
export function runQualityGate(article: any, mode: ArticleMode): QualityGateResult {
  const config = QUALITY_GATE_CONFIG[mode];
  console.log(`[QualityGate] Running validation for mode: ${mode}`);

  // 1. TITLE
  if (!article.title?.trim()) {
    return {
      passed: false,
      code: ERROR_CODES.MISSING_TITLE,
      details: 'Title está vazio ou ausente'
    };
  }

  // 2. INTRODUCTION
  const introduction = article.introduction || article.intro || '';
  if (introduction.length < config.minIntroductionLength) {
    return {
      passed: false,
      code: ERROR_CODES.MISSING_INTRODUCTION,
      details: `Introduction tem ${introduction.length} chars, mínimo: ${config.minIntroductionLength}`
    };
  }

  // 3. SECTIONS (JSON estruturado, NÃO regex)
  const sections = Array.isArray(article.sections) ? article.sections : [];
  
  if (sections.length < config.minH2Count) {
    return {
      passed: false,
      code: ERROR_CODES.INSUFFICIENT_SECTIONS,
      details: `Sections: ${sections.length}, mínimo: ${config.minH2Count} (modo ${mode})`
    };
  }

  // 4. Validar qualidade de cada seção
  // deno-lint-ignore no-explicit-any
  const invalidSections = sections.filter((s: any) => 
    !s.h2?.trim() || 
    !s.content?.trim() || 
    s.content.length < config.minSectionContentLength
  );

  if (invalidSections.length > 0) {
    return {
      passed: false,
      code: ERROR_CODES.INVALID_SECTIONS,
      details: `${invalidSections.length} seções vazias ou com menos de ${config.minSectionContentLength} chars`
    };
  }

  // 5. FAQ
  const faqCount = Array.isArray(article.faq) ? article.faq.length : 0;
  
  if (faqCount < config.minFaqCount) {
    return {
      passed: false,
      code: ERROR_CODES.INSUFFICIENT_FAQ,
      details: `FAQ: ${faqCount} perguntas, mínimo: ${config.minFaqCount} (modo ${mode})`
    };
  }

  // 6. IMAGES
  const imageCount = Array.isArray(article.image_prompts) ? article.image_prompts.length : 0;
  
  if (imageCount < config.minImagePrompts) {
    return {
      passed: false,
      code: ERROR_CODES.INSUFFICIENT_IMAGES,
      details: `Images: ${imageCount}, mínimo: ${config.minImagePrompts} (modo ${mode})`
    };
  }

  // 7. HERO IMAGE (primeira imagem DEVE ter URL após geração)
  const hasHeroImage = article.featured_image_url || 
                       article.image_prompts?.[0]?.url;
  if (!hasHeroImage) {
    return {
      passed: false,
      code: ERROR_CODES.MISSING_HERO_IMAGE,
      details: 'Hero image URL obrigatória para preview funcionar'
    };
  }

  // 8. WORD COUNT
  let totalWords = 0;
  
  // Contar introduction
  if (introduction) {
    totalWords += introduction.split(/\s+/).filter(Boolean).length;
  }
  
  // Contar sections
  // deno-lint-ignore no-explicit-any
  sections.forEach((s: any) => {
    if (s.content) {
      totalWords += s.content.split(/\s+/).filter(Boolean).length;
    }
    // Contar H3s
    if (Array.isArray(s.h3s)) {
      // deno-lint-ignore no-explicit-any
      s.h3s.forEach((h3: any) => {
        if (h3.content) {
          totalWords += h3.content.split(/\s+/).filter(Boolean).length;
        }
      });
    }
  });
  
  // Contar conclusion
  const conclusion = article.conclusion || '';
  if (conclusion) {
    totalWords += conclusion.split(/\s+/).filter(Boolean).length;
  }

  if (totalWords < config.minWordCount) {
    return {
      passed: false,
      code: ERROR_CODES.INSUFFICIENT_WORD_COUNT,
      details: `Word count: ${totalWords}, mínimo: ${config.minWordCount} (modo ${mode})`
    };
  }

  // 9. CONCLUSION
  if (conclusion.length < config.minConclusionLength) {
    return {
      passed: false,
      code: ERROR_CODES.MISSING_CONCLUSION,
      details: `Conclusion tem ${conclusion.length} chars, mínimo: ${config.minConclusionLength}`
    };
  }

  // ✅ PASSOU EM TUDO
  console.log(`[QualityGate] ✅ PASSED - ${sections.length} H2s, ${faqCount} FAQs, ${imageCount} images, ${totalWords} palavras`);
  
  return {
    passed: true,
    code: 'ok',
    details: `Artigo validado com sucesso`,
    metrics: {
      wordCount: totalWords,
      h2Count: sections.length,
      faqCount,
      imageCount
    }
  };
}
