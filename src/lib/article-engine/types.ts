/**
 * Article Engine - Core Types
 * 
 * Referência: docs/ARTICLE_ENGINE_MASTER.md
 * 
 * Este arquivo define todas as interfaces e tipos do Motor de Artigos.
 * NÃO modifica código existente - apenas define estruturas de dados.
 */

// =============================================================================
// TIPOS BASE
// =============================================================================

/**
 * Tipos de nicho suportados pelo motor
 */
export type NicheType = 
  | 'pest_control'
  | 'plumbing'
  | 'roofing'
  | 'image_consulting'
  | 'dental'
  | 'legal'
  | 'accounting'
  | 'real_estate'
  | 'automotive'
  | 'construction'
  | 'beauty'
  | 'education'
  | 'technology'
  | 'default';

/**
 * Templates estruturais disponíveis
 */
export type TemplateType = 
  | 'complete_guide'
  | 'qa_format'
  | 'comparative'
  | 'problem_solution'
  | 'educational_steps';

/**
 * Variantes de template para evitar padrão
 */
export type TemplateVariant = 
  // complete_guide
  | 'chronological'
  | 'importance_based'
  | 'problem_first'
  // qa_format
  | 'simple_to_complex'
  | 'most_common_first'
  | 'cost_first'
  // comparative
  | 'pros_cons'
  | 'cost_benefit'
  | 'feature_matrix'
  // problem_solution
  | 'urgent_first'
  | 'severity_based'
  | 'cost_based'
  // educational_steps
  | 'beginner_to_advanced'
  | 'linear_process'
  | 'modular_learning';

/**
 * Tipos de intenção de busca
 */
export type IntentType = 'transactional' | 'commercial' | 'informational';

/**
 * Níveis de urgência
 */
export type UrgencyLevel = 'low' | 'medium' | 'high';

/**
 * Modos de profundidade editorial
 */
export type ArticleMode = 'entry' | 'authority';

/**
 * Tom de voz da subconta
 */
export type ToneType = 'formal' | 'casual' | 'premium' | 'popular';

/**
 * CTA preferencial
 */
export type CtaType = 'phone' | 'whatsapp' | 'form' | 'schedule';

// =============================================================================
// ESTRUTURAS DE NICHO
// =============================================================================

/**
 * Regras de um nicho específico
 */
export interface NicheRuleset {
  id: NicheType;
  name: string;
  displayName: string;
  
  // Vocabulário
  lsiKeywords: string[];
  seedKeywords: string[];
  
  // Estrutura obrigatória
  mandatoryBlocks: string[];
  
  // Compliance
  complianceAlerts: string[];
  
  // Conversão
  typicalCtas: string[];
  
  // Visual
  imageKeywords: string[];
}

// =============================================================================
// ESTRUTURAS DE SUBCONTA
// =============================================================================

/**
 * Perfil completo de uma subconta (empresa cliente)
 */
export interface SubaccountProfile {
  // Identificação
  businessName: string;
  businessCity: string;
  businessState: string;
  businessPhone: string;
  businessWhatsapp?: string;
  businessWebsite?: string;
  
  // Posicionamento
  primaryService: string;
  secondaryServices: string[];
  niche: NicheType;
  
  // Diferencial
  yearsInBusiness?: number;
  uniqueSellingPoint: string;
  certifications?: string[];
  
  // Tom de voz
  tone: ToneType;
  
  // Ofertas
  offers: string[];
  
  // CTA preferencial
  preferredCta: CtaType;
}

// =============================================================================
// ESTRUTURAS DE INTENÇÃO
// =============================================================================

/**
 * Resultado da classificação de intenção
 */
export interface Intent {
  type: IntentType;
  urgency: UrgencyLevel;
  recommendedTemplate: TemplateType;
}

/**
 * Análise completa de keyword
 */
export interface KeywordAnalysis {
  intent: Intent;
  lsiKeywords: string[];
  relatedQuestions: string[];
}

// =============================================================================
// ESTRUTURAS DE TEMPLATE
// =============================================================================

/**
 * Definição de uma seção do template
 */
export interface TemplateSection {
  type: string;
  h2Count: number;
  targetWords?: number;
  includeKeyword?: boolean;
  injectEat?: boolean;
  geoSpecific?: boolean;
  includeTable?: boolean;
  forceTable?: boolean;
  forceList?: boolean;
  includeProscons?: boolean;
  includeChecklist?: boolean;
  questionBased?: boolean;
  stepFormat?: boolean;
  urgencyTone?: boolean;
  severityEmphasis?: boolean;
  ctaEmphasis?: 'low' | 'medium' | 'high';
  variants?: string[];
}

/**
 * Definição completa de um template
 */
export interface ArticleTemplate {
  id: TemplateType;
  name: string;
  description: string;
  variants: TemplateVariant[];
  baseStructure: TemplateSection[];
  h2Range: [number, number];
  wordCountAuthority: [number, number];
  wordCountEntry: [number, number];
}

// =============================================================================
// ESTRUTURAS DO PIPELINE
// =============================================================================

/**
 * Brief inicial do artigo
 */
export interface ArticleBrief {
  keyword: string;
  city: string;
  state: string;
  subaccount: SubaccountProfile;
  niche: NicheType;
  mode: ArticleMode;
  webResearch: boolean;
  templateOverride?: TemplateType;
}

/**
 * Outline estruturado do artigo
 */
export interface ArticleOutline {
  h1: string;
  urlSlug: string;
  metaTitle: string;
  metaDescription: string;
  sections: OutlineSection[];
}

/**
 * Seção do outline
 */
export interface OutlineSection {
  type: string;
  h2: string | null;
  h3s?: string[];
  targetWords: number;
  includeTable?: boolean;
  forceList?: boolean;
  injectEat?: boolean;
  geoSpecific?: boolean;
}

/**
 * Imagem com ALT local
 */
export interface ArticleImage {
  position: string;
  filename: string;
  alt: string;
  caption?: string;
  url?: string;
}

/**
 * Link interno
 */
export interface InternalLink {
  anchor: string;
  url: string;
  position: string;
  context: string;
}

/**
 * FAQ item
 */
export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * TL;DR
 */
export interface TldrSummary {
  bullets: [string, string, string];
}

// =============================================================================
// ESTRUTURAS DE VALIDAÇÃO
// =============================================================================

/**
 * Check individual de validação
 */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  expected: string | number | [number, number];
  actual: string | number;
  message?: string;
}

/**
 * Resultado completo da validação
 */
export interface ValidationResult {
  allPassed: boolean;
  score: number;
  checks: ValidationCheck[];
  failedChecks: ValidationCheck[];
}

// =============================================================================
// ARTIGO COMPLETO
// =============================================================================

/**
 * Artigo gerado completo
 */
export interface GeneratedArticle {
  // Metadata
  h1: string;
  urlSlug: string;
  metaTitle: string;
  metaDescription: string;
  
  // Conteúdo
  tldr: TldrSummary;
  content: string;
  faq: FaqItem[];
  
  // Estrutura
  template: TemplateType;
  variant: TemplateVariant;
  h2Count: number;
  wordCount: number;
  
  // Visual
  images: ArticleImage[];
  internalLinks: InternalLink[];
  
  // Contexto
  brief: ArticleBrief;
  niche: NicheType;
  mode: ArticleMode;
  
  // Validação
  validation: ValidationResult;
}

// =============================================================================
// HISTÓRICO (Anti-Padrão)
// =============================================================================

/**
 * Registro de artigo gerado (para anti-padrão)
 */
export interface ArticleHistoryRecord {
  articleId: string;
  subaccountId: string;
  template: TemplateType;
  variant: TemplateVariant;
  createdAt: Date;
}
