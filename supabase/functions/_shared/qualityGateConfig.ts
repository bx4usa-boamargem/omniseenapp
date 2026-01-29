/**
 * Quality Gate Configuration
 * Define os thresholds exatos para cada modo de artigo
 * 
 * REGRA: Zero retry - fail-fast - abort imediato
 */

export const QUALITY_GATE_CONFIG = {
  entry: {
    minWordCount: 800,
    maxWordCount: 1200,
    minH2Count: 5,
    maxH2Count: 8,
    minFaqCount: 5,
    maxFaqCount: 8,
    minImagePrompts: 3,
    maxImagePrompts: 5,
    minIntroductionLength: 100,
    minConclusionLength: 50,
    minSectionContentLength: 100,
    maxRetries: 0  // Zero retry - fail-fast
  },
  authority: {
    minWordCount: 1500,
    maxWordCount: 3000,
    minH2Count: 8,
    maxH2Count: 12,
    minFaqCount: 8,
    maxFaqCount: 12,
    minImagePrompts: 6,
    maxImagePrompts: 10,
    minIntroductionLength: 100,
    minConclusionLength: 50,
    minSectionContentLength: 100,
    maxRetries: 0  // Zero retry - fail-fast
  }
} as const;

export type ArticleMode = 'entry' | 'authority';

export interface QualityGateResult {
  passed: boolean;
  code: string;
  details: string;
  metrics?: {
    wordCount: number;
    h2Count: number;
    faqCount: number;
    imageCount: number;
  };
}

export const ERROR_CODES = {
  // Request validation
  MISSING_CITY: 'missing_city',
  MISSING_NICHE: 'missing_niche',
  
  // JSON parsing
  INVALID_JSON: 'invalid_json',
  
  // Content validation
  MISSING_TITLE: 'missing_title',
  INSUFFICIENT_SECTIONS: 'insufficient_sections',
  INVALID_SECTIONS: 'invalid_sections',
  INSUFFICIENT_FAQ: 'insufficient_faq',
  INSUFFICIENT_IMAGES: 'insufficient_images',
  MISSING_HERO_IMAGE: 'missing_hero_image',
  INSUFFICIENT_WORD_COUNT: 'insufficient_word_count',
  MISSING_INTRODUCTION: 'missing_introduction',
  MISSING_CONCLUSION: 'missing_conclusion'
} as const;

export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.MISSING_CITY]: 'Cidade é obrigatória para gerar artigo de autoridade local',
  [ERROR_CODES.MISSING_NICHE]: 'Nicho é obrigatório para gerar artigo',
  [ERROR_CODES.INVALID_JSON]: 'Resposta da IA não é um JSON válido',
  [ERROR_CODES.MISSING_TITLE]: 'Artigo sem título',
  [ERROR_CODES.INSUFFICIENT_SECTIONS]: 'Artigo com estrutura incompleta (H2s insuficientes)',
  [ERROR_CODES.INVALID_SECTIONS]: 'Artigo contém seções vazias ou muito curtas',
  [ERROR_CODES.INSUFFICIENT_FAQ]: 'FAQ insuficiente',
  [ERROR_CODES.INSUFFICIENT_IMAGES]: 'Imagens insuficientes',
  [ERROR_CODES.MISSING_HERO_IMAGE]: 'Hero image obrigatória não encontrada',
  [ERROR_CODES.INSUFFICIENT_WORD_COUNT]: 'Artigo muito curto',
  [ERROR_CODES.MISSING_INTRODUCTION]: 'Artigo sem introdução adequada',
  [ERROR_CODES.MISSING_CONCLUSION]: 'Artigo sem conclusão'
};
