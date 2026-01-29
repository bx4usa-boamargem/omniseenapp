/**
 * PIPELINE STAGES MODULE
 * Motor de Artigos de Autoridade Local - Sprint 2
 * 
 * Referência: docs/ARTICLE_ENGINE_MASTER.md
 * 
 * Helpers para as 12 etapas do pipeline de geração:
 * - Etapa 1: Brief Validation
 * - Etapa 2: Intent Classification
 * - Etapa 3: Template Selection
 * - Etapa 4: Web Research (existente em geoWriterCore)
 * - Etapa 5: Outline Building
 * - Etapas 6-12: Generation stages (futuro)
 * 
 * NÃO MODIFICAR: generate-article-structured/index.ts
 */

// deno-lint-ignore-file no-explicit-any

import { 
  selectTemplate, 
  classifyIntent,
  type TemplateType, 
  type TemplateVariant,
  type Intent 
} from './templateSelector.ts';

// =============================================================================
// TIPOS DO PIPELINE
// =============================================================================

/**
 * Modos de profundidade editorial
 */
export type ArticleMode = 'entry' | 'authority';

/**
 * Tipo de nicho (string para flexibilidade)
 */
export type NicheType = string;

/**
 * Brief inicial do artigo (input do pipeline)
 */
export interface ArticleBrief {
  keyword: string;
  city: string;
  state?: string;
  blogId: string;
  niche: NicheType;
  mode: ArticleMode;
  webResearch: boolean;
  templateOverride?: TemplateType;
  businessName?: string;
  businessPhone?: string;
  businessWhatsapp?: string;
}

/**
 * Resultado da validação do brief
 */
export interface BriefValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Seção do outline estruturado
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
 * Estrutura completa do outline
 */
export interface OutlineStructure {
  h1: string;
  urlSlug: string;
  metaTitle: string;
  metaDescription: string;
  sections: OutlineSection[];
  totalTargetWords: number;
  h2Count: number;
}

/**
 * Resultado da seleção de template para o brief
 */
export interface TemplateSelectionForBrief {
  template: TemplateType;
  variant: TemplateVariant;
  intent: Intent;
  wordCountRange: { min: number; max: number };
  h2Range: [number, number];
}

// =============================================================================
// ESPECIFICAÇÕES DOS TEMPLATES
// =============================================================================

/**
 * Word count e H2 ranges por template e modo
 */
const TEMPLATE_SPECS: Record<TemplateType, {
  h2Range: [number, number];
  wordCountAuthority: [number, number];
  wordCountEntry: [number, number];
}> = {
  complete_guide: { 
    h2Range: [8, 12], 
    wordCountAuthority: [1800, 3000], 
    wordCountEntry: [800, 1200] 
  },
  qa_format: { 
    h2Range: [7, 10], 
    wordCountAuthority: [1500, 2500], 
    wordCountEntry: [800, 1200] 
  },
  comparative: { 
    h2Range: [7, 10], 
    wordCountAuthority: [1500, 2800], 
    wordCountEntry: [900, 1300] 
  },
  problem_solution: { 
    h2Range: [8, 12], 
    wordCountAuthority: [1600, 2800], 
    wordCountEntry: [900, 1400] 
  },
  educational_steps: { 
    h2Range: [9, 13], 
    wordCountAuthority: [1700, 3000], 
    wordCountEntry: [1000, 1500] 
  }
};

// =============================================================================
// ETAPA 1: VALIDAÇÃO DO BRIEF
// =============================================================================

/**
 * Valida campos obrigatórios do ArticleBrief
 * 
 * @param brief - Brief a validar
 * @returns Resultado com valid, errors e warnings
 * 
 * @example
 * validateBrief({ keyword: '', city: 'SP', blogId: '123', niche: 'plumbing', mode: 'authority', webResearch: true })
 * // { valid: false, errors: ['Keyword é obrigatória...'], warnings: [] }
 */
export function validateBrief(brief: ArticleBrief): BriefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log(`[pipelineStages] Validando brief...`);
  
  // ========== CAMPOS OBRIGATÓRIOS ==========
  
  if (!brief.keyword || brief.keyword.trim().length < 3) {
    errors.push('Keyword é obrigatória (mínimo 3 caracteres)');
  }
  
  if (!brief.city || brief.city.trim().length < 2) {
    errors.push('Cidade é obrigatória (mínimo 2 caracteres)');
  }
  
  if (!brief.blogId || brief.blogId.trim().length === 0) {
    errors.push('Blog ID é obrigatório');
  }
  
  if (!brief.niche || brief.niche.trim().length === 0) {
    errors.push('Nicho é obrigatório');
  }
  
  // ========== VALIDAÇÕES DE WARNING ==========
  
  if (!brief.businessName || brief.businessName.trim().length === 0) {
    warnings.push('Nome do negócio não informado - será usado nome genérico');
  }
  
  if (!brief.businessPhone && !brief.businessWhatsapp) {
    warnings.push('Nenhum contato informado - CTA pode ficar incompleto');
  }
  
  if (brief.mode !== 'entry' && brief.mode !== 'authority') {
    warnings.push(`Modo "${brief.mode}" não reconhecido - usando "authority" como padrão`);
  }
  
  if (brief.templateOverride && !isValidTemplateType(brief.templateOverride)) {
    warnings.push(`Template override "${brief.templateOverride}" não reconhecido - será ignorado`);
  }
  
  // ========== RESULTADO ==========
  
  const result: BriefValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings
  };
  
  if (result.valid) {
    console.log(`[pipelineStages] Brief válido! Warnings: ${warnings.length}`);
  } else {
    console.log(`[pipelineStages] Brief INVÁLIDO! Erros: ${errors.length}`);
  }
  
  return result;
}

/**
 * Helper: verifica se string é TemplateType válido
 */
function isValidTemplateType(t: string): t is TemplateType {
  return ['complete_guide', 'qa_format', 'comparative', 'problem_solution', 'educational_steps'].includes(t);
}

// =============================================================================
// ETAPA 2: CLASSIFICAÇÃO DE INTENÇÃO
// =============================================================================

/**
 * Wrapper para classificação de intenção
 * Re-exporta do templateSelector para uso no pipeline
 * 
 * @param keyword - Palavra-chave a classificar
 * @returns Intent object
 */
export function classifyKeywordIntent(keyword: string): Intent {
  return classifyIntent(keyword);
}

// =============================================================================
// ETAPA 3: SELEÇÃO DE TEMPLATE
// =============================================================================

/**
 * Seleciona template para o brief com anti-padrão e word count
 * 
 * @param supabase - Cliente Supabase
 * @param brief - Brief do artigo
 * @returns Template selecionado com specs completas
 */
export async function selectTemplateForBrief(
  supabase: any,
  brief: ArticleBrief
): Promise<TemplateSelectionForBrief> {
  console.log(`[pipelineStages] Selecionando template para brief...`);
  
  // Se override fornecido e válido, usar diretamente
  if (brief.templateOverride && isValidTemplateType(brief.templateOverride)) {
    console.log(`[pipelineStages] Usando template override: ${brief.templateOverride}`);
    
    const specs = TEMPLATE_SPECS[brief.templateOverride];
    const intent = classifyIntent(brief.keyword);
    
    return {
      template: brief.templateOverride,
      variant: 'chronological', // Default para override
      intent,
      wordCountRange: getWordCountRange(brief.templateOverride, brief.mode),
      h2Range: specs.h2Range
    };
  }
  
  // Seleção automática com anti-padrão
  const result = await selectTemplate(supabase, brief.keyword, brief.blogId, brief.niche);
  const specs = TEMPLATE_SPECS[result.template];
  
  return {
    template: result.template,
    variant: result.variant,
    intent: result.intent,
    wordCountRange: getWordCountRange(result.template, brief.mode),
    h2Range: specs.h2Range
  };
}

// =============================================================================
// ETAPA 5: CONSTRUÇÃO DO OUTLINE
// =============================================================================

/**
 * Constrói estrutura completa do outline
 * 
 * @param template - Template selecionado
 * @param variant - Variante do template
 * @param mode - Modo (entry/authority)
 * @param keyword - Palavra-chave principal
 * @param city - Cidade alvo
 * @param businessName - Nome do negócio (opcional)
 * @returns Estrutura completa do outline
 * 
 * @example
 * buildOutlineStructure('complete_guide', 'chronological', 'authority', 'desentupidora', 'São Paulo', 'Desentup Rápido')
 * // { h1: 'Desentupidora em São Paulo: Guia Completo 2026', sections: [...], ... }
 */
export function buildOutlineStructure(
  template: TemplateType,
  variant: TemplateVariant,
  mode: ArticleMode,
  keyword: string,
  city: string,
  businessName?: string
): OutlineStructure {
  console.log(`[pipelineStages] Construindo outline: ${template}/${variant} (${mode})`);
  
  const specs = TEMPLATE_SPECS[template];
  const wordRange = getWordCountRange(template, mode);
  const targetWords = Math.floor((wordRange.min + wordRange.max) / 2);
  
  // Gerar H1 baseado no template
  const h1 = generateH1(template, keyword, city);
  
  // Gerar URL slug
  const urlSlug = generateSlug(keyword, city);
  
  // Gerar meta title e description
  const metaTitle = generateMetaTitle(template, keyword, city);
  const metaDescription = generateMetaDescription(template, keyword, city, businessName);
  
  // Gerar seções baseado no template
  const sections = generateSections(template, variant, mode, keyword, city);
  
  // Calcular word count por seção
  const h2Count = sections.filter(s => s.h2 !== null).length;
  const wordsPerSection = Math.floor(targetWords / sections.length);
  
  // Distribuir words pelas seções
  const sectionsWithWords = sections.map(section => ({
    ...section,
    targetWords: section.targetWords || wordsPerSection
  }));
  
  const outline: OutlineStructure = {
    h1,
    urlSlug,
    metaTitle,
    metaDescription,
    sections: sectionsWithWords,
    totalTargetWords: targetWords,
    h2Count
  };
  
  console.log(`[pipelineStages] Outline gerado: ${h2Count} H2s, ${targetWords} palavras alvo`);
  
  return outline;
}

// =============================================================================
// HELPERS DE CÁLCULO
// =============================================================================

/**
 * Calcula range de word count esperado
 */
export function calculateTargetWordCount(
  template: TemplateType,
  mode: ArticleMode
): { min: number; max: number } {
  return getWordCountRange(template, mode);
}

/**
 * Retorna word count range baseado em template e modo
 */
function getWordCountRange(
  template: TemplateType,
  mode: ArticleMode
): { min: number; max: number } {
  const specs = TEMPLATE_SPECS[template];
  const range = mode === 'authority' ? specs.wordCountAuthority : specs.wordCountEntry;
  return { min: range[0], max: range[1] };
}

/**
 * Calcula range de H2s para o template
 */
export function calculateH2Range(template: TemplateType): [number, number] {
  return TEMPLATE_SPECS[template].h2Range;
}

// =============================================================================
// GERADORES DE CONTEÚDO ESTRUTURAL
// =============================================================================

/**
 * Capitaliza primeira letra
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Gera H1 baseado no template
 */
function generateH1(template: TemplateType, keyword: string, city: string): string {
  const year = new Date().getFullYear();
  const keywordCapitalized = capitalizeFirst(keyword);
  
  const patterns: Record<TemplateType, string> = {
    complete_guide: `${keywordCapitalized} em ${city}: Guia Completo ${year}`,
    qa_format: `${keywordCapitalized} em ${city}: Perguntas e Respostas`,
    comparative: `${keywordCapitalized} em ${city}: Comparativo Completo`,
    problem_solution: `${keywordCapitalized} em ${city}: Solução Definitiva`,
    educational_steps: `Como Escolher ${keywordCapitalized} em ${city}`
  };
  
  return patterns[template];
}

/**
 * Gera URL slug SEO-friendly
 */
function generateSlug(keyword: string, city: string): string {
  return `${keyword}-${city}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-')     // Substitui não-alfanuméricos por hífen
    .replace(/(^-|-$)/g, '');         // Remove hífens no início/fim
}

/**
 * Gera meta title (max 60 chars)
 */
function generateMetaTitle(template: TemplateType, keyword: string, city: string): string {
  const keywordCap = capitalizeFirst(keyword);
  
  const patterns: Record<TemplateType, string> = {
    complete_guide: `${keywordCap} em ${city} | Guia Completo`,
    qa_format: `${keywordCap} ${city} | FAQ Respondido`,
    comparative: `Melhor ${keywordCap} em ${city} | Compare Aqui`,
    problem_solution: `${keywordCap} ${city} | Atendimento 24h`,
    educational_steps: `Como Escolher ${keywordCap} em ${city}`
  };
  
  const title = patterns[template];
  
  // Limitar a 60 caracteres
  return title.length <= 60 ? title : title.substring(0, 57) + '...';
}

/**
 * Gera meta description (max 155 chars)
 */
function generateMetaDescription(
  template: TemplateType,
  keyword: string,
  city: string,
  businessName?: string
): string {
  const business = businessName || `empresa de ${keyword}`;
  
  const patterns: Record<TemplateType, string> = {
    complete_guide: `${capitalizeFirst(keyword)} em ${city}: tudo que você precisa saber. ${capitalizeFirst(business)} com atendimento especializado. Orçamento grátis!`,
    qa_format: `Dúvidas sobre ${keyword} em ${city}? Respondemos as principais perguntas. ${capitalizeFirst(business)}.`,
    comparative: `Compare opções de ${keyword} em ${city}. Preços, qualidade e atendimento. ${capitalizeFirst(business)}.`,
    problem_solution: `Problema com ${keyword} em ${city}? Atendimento emergencial. ${capitalizeFirst(business)} resolve rápido!`,
    educational_steps: `Aprenda a escolher ${keyword} em ${city}. Guia passo a passo por ${business}.`
  };
  
  const desc = patterns[template];
  
  // Limitar a 155 caracteres
  return desc.length <= 155 ? desc : desc.substring(0, 152) + '...';
}

/**
 * Gera array de seções baseado no template
 */
function generateSections(
  template: TemplateType,
  _variant: TemplateVariant,
  mode: ArticleMode,
  keyword: string,
  city: string
): OutlineSection[] {
  
  // Estruturas base por template
  const structures: Record<TemplateType, OutlineSection[]> = {
    
    // ========== COMPLETE GUIDE ==========
    complete_guide: [
      { type: 'intro', h2: null, targetWords: 150, injectEat: true },
      { type: 'what_is', h2: `O que é ${keyword}?`, targetWords: 300 },
      { type: 'why_matters', h2: `Por que contratar ${keyword} em ${city}?`, targetWords: 250, geoSpecific: true },
      { type: 'how_works', h2: `Como funciona o serviço de ${keyword}`, targetWords: 350, includeTable: true },
      { type: 'step_by_step', h2: `Passo a passo para contratar ${keyword}`, targetWords: 400, forceList: true },
      { type: 'common_mistakes', h2: `Erros comuns ao contratar ${keyword}`, targetWords: 250, forceList: true },
      { type: 'expert_tips', h2: `Dicas de especialistas em ${keyword}`, targetWords: 300, injectEat: true },
      { type: 'local_context', h2: `${capitalizeFirst(keyword)} em ${city}: fatores locais`, targetWords: 250, geoSpecific: true },
      { type: 'faq', h2: `Perguntas frequentes sobre ${keyword}`, targetWords: 400 },
      { type: 'cta', h2: `Próximo passo: solicite orçamento`, targetWords: 150 }
    ],
    
    // ========== QA FORMAT ==========
    qa_format: [
      { type: 'intro', h2: null, targetWords: 120 },
      { type: 'tldr', h2: null, targetWords: 80 },
      { type: 'question_1', h2: `Quanto custa ${keyword} em ${city}?`, targetWords: 250, geoSpecific: true },
      { type: 'question_2', h2: `Como escolher ${keyword} confiável?`, targetWords: 250 },
      { type: 'question_3', h2: `${capitalizeFirst(keyword)} funciona mesmo?`, targetWords: 250 },
      { type: 'question_4', h2: `Qual o prazo para ${keyword}?`, targetWords: 250 },
      { type: 'question_5', h2: `${capitalizeFirst(keyword)} tem garantia?`, targetWords: 250 },
      { type: 'faq', h2: `Mais perguntas sobre ${keyword}`, targetWords: 300 },
      { type: 'cta', h2: `Tire suas dúvidas agora`, targetWords: 150 }
    ],
    
    // ========== COMPARATIVE ==========
    comparative: [
      { type: 'intro', h2: null, targetWords: 150 },
      { type: 'overview', h2: `Comparativo: opções de ${keyword} em ${city}`, targetWords: 300, includeTable: true, geoSpecific: true },
      { type: 'option_a', h2: `Opção 1: ${keyword} tradicional`, targetWords: 350 },
      { type: 'option_b', h2: `Opção 2: ${keyword} moderno`, targetWords: 350 },
      { type: 'option_c', h2: `Opção 3: ${keyword} premium`, targetWords: 350 },
      { type: 'decision', h2: `Como decidir qual ${keyword} escolher`, targetWords: 250 },
      { type: 'recommendation', h2: `Nossa recomendação`, targetWords: 200, injectEat: true },
      { type: 'faq', h2: `Dúvidas sobre ${keyword}`, targetWords: 300 },
      { type: 'cta', h2: `Compare e solicite orçamento`, targetWords: 150 }
    ],
    
    // ========== PROBLEM SOLUTION ==========
    problem_solution: [
      { type: 'intro_problem', h2: null, targetWords: 150 },
      { type: 'symptoms', h2: `Sinais de que você precisa de ${keyword}`, targetWords: 200, forceList: true },
      { type: 'causes', h2: `Por que isso acontece?`, targetWords: 250 },
      { type: 'consequences', h2: `Riscos de não resolver o problema`, targetWords: 200 },
      { type: 'solution', h2: `A solução: ${keyword} profissional`, targetWords: 250, injectEat: true },
      { type: 'diy_vs_pro', h2: `Fazer sozinho ou contratar profissional?`, targetWords: 300, includeTable: true },
      { type: 'steps', h2: `Como resolver passo a passo`, targetWords: 350, forceList: true },
      { type: 'prevention', h2: `Como prevenir no futuro`, targetWords: 250, forceList: true },
      { type: 'when_call', h2: `Quando chamar um profissional`, targetWords: 200, injectEat: true },
      { type: 'local', h2: `${capitalizeFirst(keyword)} em ${city}`, targetWords: 200, geoSpecific: true },
      { type: 'faq', h2: `Perguntas frequentes`, targetWords: 300 },
      { type: 'cta_urgent', h2: `Precisa de ajuda urgente?`, targetWords: 150 }
    ],
    
    // ========== EDUCATIONAL STEPS ==========
    educational_steps: [
      { type: 'intro', h2: null, targetWords: 150 },
      { type: 'learn', h2: `O que você vai aprender`, targetWords: 150, forceList: true },
      { type: 'prereqs', h2: `Antes de começar`, targetWords: 150 },
      { type: 'step_1', h2: `Passo 1: Entenda suas necessidades`, targetWords: 250 },
      { type: 'step_2', h2: `Passo 2: Pesquise opções de ${keyword}`, targetWords: 250 },
      { type: 'step_3', h2: `Passo 3: Compare orçamentos`, targetWords: 250 },
      { type: 'step_4', h2: `Passo 4: Verifique referências`, targetWords: 250 },
      { type: 'step_5', h2: `Passo 5: Feche o contrato`, targetWords: 250 },
      { type: 'pitfalls', h2: `Erros comuns a evitar`, targetWords: 200, forceList: true },
      { type: 'next', h2: `Próximos passos`, targetWords: 150 },
      { type: 'expert', h2: `Dica do especialista`, targetWords: 200, injectEat: true },
      { type: 'faq', h2: `Perguntas frequentes sobre ${keyword}`, targetWords: 300 },
      { type: 'cta', h2: `Pronto para começar?`, targetWords: 150 }
    ]
  };
  
  // Obter estrutura do template
  const sections = structures[template];
  
  // Para modo entry, reduzir quantidade de seções e word count
  if (mode === 'entry') {
    const reducedSections = sections.slice(0, Math.min(sections.length, 7));
    return reducedSections.map(s => ({
      ...s,
      targetWords: Math.floor(s.targetWords * 0.6) // 60% do word count para entry
    }));
  }
  
  return sections;
}

// =============================================================================
// RE-EXPORTS PARA INTEGRAÇÃO
// =============================================================================

export { selectTemplate, classifyIntent };
export type { TemplateType, TemplateVariant, Intent };
