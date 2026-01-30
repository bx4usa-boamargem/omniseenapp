import { QUALITY_GATE_CONFIG, QualityGateResult, ArticleMode } from './qualityGateConfig.ts';

/**
 * Quality Gate Principal
 * V4.5: NUNCA ABORTA - Todos os gates são convertidos em warnings
 * O caller decide se força status 'draft' baseado nos warnings críticos
 * 
 * Pipeline 100% Non-Blocking - Artigos sempre são salvos
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
  const logPrefix = options?.requestId ? `[${options.requestId}]` : '';
  
  // V4.5: LOG OBRIGATÓRIO - Pipeline NUNCA aborta
  console.log(`${logPrefix}[PIPELINE] Never aborting on quality gate - draft fallback active`);
  console.log(`${logPrefix}[QualityGate] Running validation for mode: ${mode}`);

  // ============================================================================
  // V4.5: MÉTRICAS CALCULADAS PRIMEIRO (sempre retorna métricas)
  // ============================================================================
  const sections = Array.isArray(article.sections) ? article.sections : [];
  const faqCount = Array.isArray(article.faq) ? article.faq.length : 0;
  const imageCount = Array.isArray(article.image_prompts) ? article.image_prompts.length : 0;
  const introduction = article.introduction || article.intro || '';
  const conclusion = article.conclusion || '';
  
  // Word count calculation
  let totalWords = 0;
  if (introduction) {
    totalWords += introduction.split(/\s+/).filter(Boolean).length;
  }
  // deno-lint-ignore no-explicit-any
  sections.forEach((s: any) => {
    if (s.content) {
      totalWords += s.content.split(/\s+/).filter(Boolean).length;
    }
    if (Array.isArray(s.h3s)) {
      // deno-lint-ignore no-explicit-any
      s.h3s.forEach((h3: any) => {
        if (h3.content) {
          totalWords += h3.content.split(/\s+/).filter(Boolean).length;
        }
      });
    }
  });
  if (conclusion) {
    totalWords += conclusion.split(/\s+/).filter(Boolean).length;
  }

  // ============================================================================
  // V4.5: VALIDAÇÕES - Todas viram WARNINGS (nunca abort)
  // ============================================================================

  // 1. TITLE - Warning crítico (não abort)
  if (!article.title?.trim()) {
    warnings.push('critical_missing_title');
    console.warn(`${logPrefix}[QualityGate] CRITICAL: Title missing - will force draft`);
  }

  // 2. INTRODUCTION - Warning crítico (não abort)
  if (introduction.length < config.minIntroductionLength) {
    warnings.push(`critical_introduction: ${introduction.length}/${config.minIntroductionLength}`);
    console.warn(`${logPrefix}[QualityGate] CRITICAL: Introduction too short (${introduction.length}/${config.minIntroductionLength})`);
  }

  // 3. SECTIONS COUNT - Warning (não abort)
  if (sections.length < config.minH2Count) {
    warnings.push(`insufficient_sections: ${sections.length}/${config.minH2Count}`);
    console.warn(`${logPrefix}[QualityGate] WARNING: Sections ${sections.length} < ${config.minH2Count}`);
  }

  // 4. INVALID SECTIONS - Warning (não abort)
  // deno-lint-ignore no-explicit-any
  const invalidSections = sections.filter((s: any) => 
    !s.h2?.trim() || 
    !s.content?.trim() || 
    s.content.length < config.minSectionContentLength
  );
  if (invalidSections.length > 0) {
    warnings.push(`invalid_sections: ${invalidSections.length}`);
    console.warn(`${logPrefix}[QualityGate] WARNING: ${invalidSections.length} sections are empty or too short`);
  }

  // 5. FAQ - Warning (não abort)
  if (faqCount < config.minFaqCount) {
    warnings.push(`insufficient_faq: ${faqCount}/${config.minFaqCount}`);
    console.warn(`${logPrefix}[QualityGate] WARNING: FAQ ${faqCount} < ${config.minFaqCount}`);
  }

  // 6. IMAGES - Warning (não abort)
  if (imageCount < config.minImagePrompts) {
    warnings.push(`insufficient_images: ${imageCount}/${config.minImagePrompts}`);
    console.warn(`${logPrefix}[QualityGate] WARNING: Images ${imageCount} < ${config.minImagePrompts}`);
  }

  // 7. HERO IMAGE - Warning (não abort)
  const hasHeroImage = article.featured_image_url || article.image_prompts?.[0]?.url;
  if (!hasHeroImage) {
    warnings.push('missing_hero_image');
    console.warn(`${logPrefix}[QualityGate] WARNING: No hero image - frontend will show placeholder`);
  }

  // 8. WORD COUNT - Warning (não abort)
  if (totalWords < config.minWordCount) {
    warnings.push(`insufficient_word_count: ${totalWords}/${config.minWordCount}`);
    console.warn(`${logPrefix}[QualityGate] WARNING: Word count ${totalWords} < ${config.minWordCount}`);
  }

  // 9. CONCLUSION - Warning (não abort)
  if (conclusion.length < config.minConclusionLength) {
    warnings.push(`insufficient_conclusion: ${conclusion.length}/${config.minConclusionLength}`);
    console.warn(`${logPrefix}[QualityGate] WARNING: Conclusion too short (${conclusion.length}/${config.minConclusionLength})`);
  }

  // ============================================================================
  // V4.5: SEMPRE RETORNA passed: true (caller decide draft baseado em warnings)
  // ============================================================================
  const hasCriticalWarnings = warnings.some(w => w.startsWith('critical_'));
  
  console.log(`${logPrefix}[QualityGate] ✅ PASSED (${warnings.length} warnings${hasCriticalWarnings ? ', HAS CRITICAL' : ''})`);
  console.log(`${logPrefix}[QualityGate] Metrics: ${sections.length} H2s, ${faqCount} FAQs, ${imageCount} images, ${totalWords} words`);
  
  return {
    passed: true, // V4.5: SEMPRE true - caller decide se força draft
    code: 'ok',
    details: warnings.length > 0 
      ? `Validado com ${warnings.length} avisos${hasCriticalWarnings ? ' (críticos presentes)' : ''}`
      : 'Artigo validado com sucesso',
    warnings: warnings.length > 0 ? warnings : undefined,
    metrics: {
      wordCount: totalWords,
      h2Count: sections.length,
      faqCount,
      imageCount
    }
  };
}
