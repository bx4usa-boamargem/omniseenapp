/**
 * Article Engine - Barrel Export
 * 
 * Referência: docs/ARTICLE_ENGINE_MASTER.md
 * 
 * Este arquivo exporta todos os módulos do Motor de Artigos.
 * Importação centralizada: import { ... } from '@/lib/article-engine'
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Tipos base
  NicheType,
  TemplateType,
  TemplateVariant,
  IntentType,
  UrgencyLevel,
  ArticleMode,
  ToneType,
  CtaType,
  
  // Estruturas de nicho
  NicheRuleset,
  
  // Estruturas de subconta
  SubaccountProfile,
  
  // Estruturas de intenção
  Intent,
  KeywordAnalysis,
  
  // Estruturas de template
  TemplateSection,
  ArticleTemplate,
  
  // Estruturas do pipeline
  ArticleBrief,
  ArticleOutline,
  OutlineSection,
  ArticleImage,
  InternalLink,
  FaqItem,
  TldrSummary,
  
  // Estruturas de validação
  ValidationCheck,
  ValidationResult,
  
  // Artigo completo
  GeneratedArticle,
  
  // Histórico
  ArticleHistoryRecord
} from './types';

// =============================================================================
// TEMPLATES
// =============================================================================

export {
  TEMPLATE_VARIANTS,
  ARTICLE_TEMPLATES,
  getTemplate,
  getVariants,
  getWordCountRange,
  listTemplates,
  isValidTemplate
} from './templates';

// =============================================================================
// NICHES
// =============================================================================

export {
  NICHE_RULESETS,
  getNiche,
  listNiches,
  isValidNiche,
  getLsiKeywords,
  getTypicalCtas,
  getComplianceAlerts
} from './niches';

// =============================================================================
// INTENT
// =============================================================================

export {
  classifyIntent,
  analyzeKeyword,
  getIntentDescription,
  getUrgencyDescription,
  getUrgencyColor
} from './intent';

// =============================================================================
// VERSION
// =============================================================================

/**
 * Versão do Motor de Artigos
 * Sincronizado com docs/ARTICLE_ENGINE_CHANGELOG.md
 */
export const ARTICLE_ENGINE_VERSION = '1.0.0';

/**
 * Data da última atualização
 */
export const ARTICLE_ENGINE_UPDATED = '2026-01-29';
