import { QUALITY_GATE_CONFIG, QualityGateResult, ERROR_CODES, ArticleMode } from './qualityGateConfig.ts';

/**
 * Quality Gate Principal
 * Valida se artigo atende TODOS os critérios mínimos
 * FAIL-FAST: Primeira falha = abort imediato
 * 
 * V3.4: Suporte a allowWarnings para degradação controlada em mode=entry ou fast
 */

export interface QualityGateOptions {
  allowWarnings?: boolean;
  generationMode?: string;
  requestId?: string;
}

// deno-lint-ignore no-explicit-any
export function runQualityGate(article: any, mode: ArticleMode, options?: QualityGateOptions): QualityGateResult {
  const config = QUALITY_GATE_CONFIG[mode];
  const warnings: string[] = [];
  // V4.4: ALWAYS allow warnings (never abort) - articles are saved as draft with quality issues
  // The frontend and publication flow will handle quality enforcement
  const allowWarnings = true;
  const logPrefix = options?.requestId ? `[${options.requestId}]` : '';
  
  // V4.3: Functional minimums - articles can pass with warnings if these are met
  const FUNCTIONAL_MIN_SECTIONS = mode === 'authority' ? 5 : 3;
  const FUNCTIONAL_MIN_FAQ = 2;  // V4.4: Minimum functional FAQ
  
  console.log(`${logPrefix}[QualityGate] Running validation for mode: ${mode}, allowWarnings: ${allowWarnings}, functionalMinSections: ${FUNCTIONAL_MIN_SECTIONS}`);

  // 1. TITLE - SEMPRE HARD GATE
  if (!article.title?.trim()) {
    return {
      passed: false,
      code: ERROR_CODES.MISSING_TITLE,
      details: 'Title está vazio ou ausente'
    };
  }

  // 2. INTRODUCTION - SEMPRE HARD GATE
  const introduction = article.introduction || article.intro || '';
  if (introduction.length < config.minIntroductionLength) {
    return {
      passed: false,
      code: ERROR_CODES.MISSING_INTRODUCTION,
      details: `Introduction tem ${introduction.length} chars, mínimo: ${config.minIntroductionLength}`
    };
  }

  // 3. SECTIONS - DEGRADAÇÃO CONTROLADA V4.3
  // Authority mode: if >= 5 sections, allow as warning (not hard fail)
  // Entry mode: if >= 3 sections, allow as warning
  const sections = Array.isArray(article.sections) ? article.sections : [];
  
  if (sections.length < config.minH2Count) {
    // V4.3: Allow degradation if functional minimum is met
    if (sections.length >= FUNCTIONAL_MIN_SECTIONS) {
      warnings.push(`insufficient_sections: ${sections.length}/${config.minH2Count}`);
      console.warn(`${logPrefix}[QualityGate] WARNING: Sections ${sections.length} < ${config.minH2Count} (functional min ${FUNCTIONAL_MIN_SECTIONS} met)`);
    } else {
      return {
        passed: false,
        code: ERROR_CODES.INSUFFICIENT_SECTIONS,
        details: `Sections: ${sections.length}, mínimo funcional: ${FUNCTIONAL_MIN_SECTIONS} (modo ${mode})`
      };
    }
  }

  // 4. SEÇÕES INVÁLIDAS - SEMPRE HARD GATE
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

  // 5. FAQ - DEGRADAÇÃO CONTROLADA V4.4
  const faqCount = Array.isArray(article.faq) ? article.faq.length : 0;
  
  if (faqCount < config.minFaqCount) {
    // V4.4: Always allow warning if functional minimum is met (never abort)
    if (faqCount >= FUNCTIONAL_MIN_FAQ) {
      warnings.push(`insufficient_faq: ${faqCount}/${config.minFaqCount}`);
      console.warn(`${logPrefix}[QualityGate] WARNING: FAQ ${faqCount} < ${config.minFaqCount} (functional min ${FUNCTIONAL_MIN_FAQ} met)`);
    } else {
      warnings.push(`critical_faq: ${faqCount}/${FUNCTIONAL_MIN_FAQ}`);
      console.warn(`${logPrefix}[QualityGate] CRITICAL WARNING: FAQ ${faqCount} < functional min ${FUNCTIONAL_MIN_FAQ}`);
    }
  }

  // 6. IMAGES - DEGRADAÇÃO CONTROLADA V4.4 (never abort)
  const imageCount = Array.isArray(article.image_prompts) ? article.image_prompts.length : 0;
  
  if (imageCount < config.minImagePrompts) {
    if (imageCount >= 1) {
      warnings.push(`insufficient_images: ${imageCount}/${config.minImagePrompts}`);
      console.warn(`${logPrefix}[QualityGate] WARNING: Images ${imageCount} < ${config.minImagePrompts}`);
    } else {
      warnings.push(`critical_images: ${imageCount}/${config.minImagePrompts}`);
      console.warn(`${logPrefix}[QualityGate] CRITICAL WARNING: No images available`);
    }
  }

  // 7. HERO IMAGE - SEMPRE HARD GATE
  const hasHeroImage = article.featured_image_url || 
                       article.image_prompts?.[0]?.url;
  if (!hasHeroImage) {
    return {
      passed: false,
      code: ERROR_CODES.MISSING_HERO_IMAGE,
      details: 'Hero image URL obrigatória para preview funcionar'
    };
  }

  // 8. WORD COUNT - DEGRADAÇÃO CONTROLADA
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
    // V4.4: Never abort - use warnings
    if (totalWords >= 500) {
      warnings.push(`insufficient_word_count: ${totalWords}/${config.minWordCount}`);
      console.warn(`${logPrefix}[QualityGate] WARNING: Words ${totalWords} < ${config.minWordCount}`);
    } else {
      warnings.push(`critical_word_count: ${totalWords}/500`);
      console.warn(`${logPrefix}[QualityGate] CRITICAL WARNING: Word count ${totalWords} < 500`);
    }
  }

  // 9. CONCLUSION - V4.4: Convert to critical warning (not hard gate)
  if (conclusion.length < config.minConclusionLength) {
    warnings.push(`critical_conclusion: ${conclusion.length}/${config.minConclusionLength}`);
    console.warn(`${logPrefix}[QualityGate] CRITICAL WARNING: Conclusion ${conclusion.length} < ${config.minConclusionLength}`);
  }

  // ✅ PASSOU EM TUDO
  console.log(`${logPrefix}[QualityGate] ✅ PASSED - ${sections.length} H2s, ${faqCount} FAQs, ${imageCount} images, ${totalWords} palavras`);
  
  if (warnings.length > 0) {
    console.warn(`${logPrefix}[QualityGate] Passed with ${warnings.length} warnings:`, warnings);
  }
  
  return {
    passed: true,
    code: 'ok',
    details: warnings.length > 0 ? `Validado com ${warnings.length} avisos` : 'Artigo validado com sucesso',
    warnings: warnings.length > 0 ? warnings : undefined,
    metrics: {
      wordCount: totalWords,
      h2Count: sections.length,
      faqCount,
      imageCount
    }
  };
}
