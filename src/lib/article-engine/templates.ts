/**
 * Article Engine - Templates
 * 
 * Referência: docs/ARTICLE_ENGINE_MASTER.md
 * 
 * Este arquivo define os 5 templates estruturais do Motor de Artigos.
 * Cada template possui variantes internas para evitar padrão.
 */

import type { ArticleTemplate, TemplateType, TemplateVariant } from './types';

// =============================================================================
// VARIANTES POR TEMPLATE
// =============================================================================

export const TEMPLATE_VARIANTS: Record<TemplateType, TemplateVariant[]> = {
  complete_guide: ['chronological', 'importance_based', 'problem_first'],
  qa_format: ['simple_to_complex', 'most_common_first', 'cost_first'],
  comparative: ['pros_cons', 'cost_benefit', 'feature_matrix'],
  problem_solution: ['urgent_first', 'severity_based', 'cost_based'],
  educational_steps: ['beginner_to_advanced', 'linear_process', 'modular_learning']
};

// =============================================================================
// TEMPLATES ESTRUTURAIS
// =============================================================================

export const ARTICLE_TEMPLATES: Record<TemplateType, ArticleTemplate> = {
  
  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATE 1: Guia Completo
  // Uso: Conteúdo evergreen, artigos de posicionamento
  // ─────────────────────────────────────────────────────────────────────────
  complete_guide: {
    id: 'complete_guide',
    name: 'Guia Completo',
    description: 'Artigo abrangente cobrindo todos os aspectos de um tema',
    variants: ['chronological', 'importance_based', 'problem_first'],
    baseStructure: [
      { type: 'intro', h2Count: 0, targetWords: 150, includeKeyword: true, injectEat: true },
      { type: 'what_is', h2Count: 1, targetWords: 300, variants: ['definition', 'overview', 'context'] },
      { type: 'why_matters', h2Count: 1, targetWords: 250, variants: ['benefits', 'risks', 'importance'] },
      { type: 'how_works', h2Count: 1, targetWords: 350, includeTable: true },
      { type: 'step_by_step', h2Count: 1, targetWords: 400, forceList: true },
      { type: 'common_mistakes', h2Count: 1, targetWords: 250, forceList: true },
      { type: 'expert_tips', h2Count: 1, targetWords: 300, injectEat: true },
      { type: 'local_context', h2Count: 1, targetWords: 250, geoSpecific: true },
      { type: 'faq', h2Count: 1, targetWords: 400 },
      { type: 'cta', h2Count: 1, targetWords: 150 }
    ],
    h2Range: [8, 12],
    wordCountAuthority: [1800, 3000],
    wordCountEntry: [800, 1200]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATE 2: Perguntas & Respostas
  // Uso: FAQ expandido, captura de featured snippets
  // ─────────────────────────────────────────────────────────────────────────
  qa_format: {
    id: 'qa_format',
    name: 'Perguntas & Respostas',
    description: 'Formato de FAQ expandido respondendo dúvidas comuns',
    variants: ['simple_to_complex', 'most_common_first', 'cost_first'],
    baseStructure: [
      { type: 'intro', h2Count: 0, targetWords: 120, includeKeyword: true },
      { type: 'tldr', h2Count: 0, targetWords: 80 },
      { type: 'main_question_1', h2Count: 1, targetWords: 250, questionBased: true },
      { type: 'main_question_2', h2Count: 1, targetWords: 250, questionBased: true },
      { type: 'main_question_3', h2Count: 1, targetWords: 250, questionBased: true },
      { type: 'main_question_4', h2Count: 1, targetWords: 250, questionBased: true },
      { type: 'main_question_5', h2Count: 1, targetWords: 250, questionBased: true },
      { type: 'main_question_6', h2Count: 1, targetWords: 250, questionBased: true },
      { type: 'related_questions', h2Count: 1, targetWords: 200 },
      { type: 'faq', h2Count: 1, targetWords: 300 },
      { type: 'cta', h2Count: 1, targetWords: 150 }
    ],
    h2Range: [7, 10],
    wordCountAuthority: [1500, 2500],
    wordCountEntry: [800, 1200]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATE 3: Comparativo Técnico
  // Uso: Decisão de compra, escolha entre opções
  // ─────────────────────────────────────────────────────────────────────────
  comparative: {
    id: 'comparative',
    name: 'Comparativo Técnico',
    description: 'Comparação detalhada entre opções para tomada de decisão',
    variants: ['pros_cons', 'cost_benefit', 'feature_matrix'],
    baseStructure: [
      { type: 'intro', h2Count: 0, targetWords: 150, includeKeyword: true },
      { type: 'comparison_overview', h2Count: 1, targetWords: 300, includeTable: true, forceTable: true },
      { type: 'option_a_detail', h2Count: 1, targetWords: 350, includeProscons: true },
      { type: 'option_b_detail', h2Count: 1, targetWords: 350, includeProscons: true },
      { type: 'option_c_detail', h2Count: 1, targetWords: 350, includeProscons: true },
      { type: 'decision_factors', h2Count: 1, targetWords: 250, includeChecklist: true },
      { type: 'expert_recommendation', h2Count: 1, targetWords: 200, injectEat: true },
      { type: 'local_considerations', h2Count: 1, targetWords: 200, geoSpecific: true },
      { type: 'faq', h2Count: 1, targetWords: 300 },
      { type: 'cta', h2Count: 1, targetWords: 150 }
    ],
    h2Range: [7, 10],
    wordCountAuthority: [1500, 2800],
    wordCountEntry: [900, 1300]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATE 4: Problema → Solução
  // Uso: Urgência, emergências, resolução rápida
  // ─────────────────────────────────────────────────────────────────────────
  problem_solution: {
    id: 'problem_solution',
    name: 'Problema → Solução',
    description: 'Foco em resolver um problema específico com urgência',
    variants: ['urgent_first', 'severity_based', 'cost_based'],
    baseStructure: [
      { type: 'intro_problem', h2Count: 0, targetWords: 150, urgencyTone: true, includeKeyword: true },
      { type: 'symptoms', h2Count: 1, targetWords: 200, forceList: true },
      { type: 'why_happens', h2Count: 1, targetWords: 250 },
      { type: 'consequences', h2Count: 1, targetWords: 200, severityEmphasis: true },
      { type: 'solution_overview', h2Count: 1, targetWords: 250 },
      { type: 'diy_vs_professional', h2Count: 1, targetWords: 300, includeTable: true },
      { type: 'step_by_step_fix', h2Count: 1, targetWords: 350, forceList: true },
      { type: 'prevention', h2Count: 1, targetWords: 250, forceList: true },
      { type: 'when_call_pro', h2Count: 1, targetWords: 200, injectEat: true },
      { type: 'local_services', h2Count: 1, targetWords: 200, geoSpecific: true },
      { type: 'faq', h2Count: 1, targetWords: 300 },
      { type: 'cta_urgent', h2Count: 1, targetWords: 150, ctaEmphasis: 'high' }
    ],
    h2Range: [8, 12],
    wordCountAuthority: [1600, 2800],
    wordCountEntry: [900, 1400]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATE 5: Educacional em Etapas
  // Uso: How-to, tutoriais, processos
  // ─────────────────────────────────────────────────────────────────────────
  educational_steps: {
    id: 'educational_steps',
    name: 'Educacional em Etapas',
    description: 'Tutorial passo a passo para ensinar um processo',
    variants: ['beginner_to_advanced', 'linear_process', 'modular_learning'],
    baseStructure: [
      { type: 'intro', h2Count: 0, targetWords: 150, includeKeyword: true },
      { type: 'what_you_will_learn', h2Count: 1, targetWords: 150, forceList: true },
      { type: 'prerequisites', h2Count: 1, targetWords: 150 },
      { type: 'step_1', h2Count: 1, targetWords: 250, stepFormat: true },
      { type: 'step_2', h2Count: 1, targetWords: 250, stepFormat: true },
      { type: 'step_3', h2Count: 1, targetWords: 250, stepFormat: true },
      { type: 'step_4', h2Count: 1, targetWords: 250, stepFormat: true },
      { type: 'step_5', h2Count: 1, targetWords: 250, stepFormat: true },
      { type: 'common_pitfalls', h2Count: 1, targetWords: 200, forceList: true },
      { type: 'next_steps', h2Count: 1, targetWords: 150 },
      { type: 'expert_insight', h2Count: 1, targetWords: 200, injectEat: true },
      { type: 'faq', h2Count: 1, targetWords: 300 },
      { type: 'cta', h2Count: 1, targetWords: 150 }
    ],
    h2Range: [9, 13],
    wordCountAuthority: [1700, 3000],
    wordCountEntry: [1000, 1500]
  }
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Obtém template por ID
 */
export function getTemplate(id: TemplateType): ArticleTemplate {
  return ARTICLE_TEMPLATES[id];
}

/**
 * Obtém variantes de um template
 */
export function getVariants(id: TemplateType): TemplateVariant[] {
  return TEMPLATE_VARIANTS[id];
}

/**
 * Obtém word count range por modo
 */
export function getWordCountRange(
  template: ArticleTemplate,
  mode: 'entry' | 'authority'
): [number, number] {
  return mode === 'authority' 
    ? template.wordCountAuthority 
    : template.wordCountEntry;
}

/**
 * Lista todos os templates disponíveis
 */
export function listTemplates(): ArticleTemplate[] {
  return Object.values(ARTICLE_TEMPLATES);
}

/**
 * Verifica se template existe
 */
export function isValidTemplate(id: string): id is TemplateType {
  return id in ARTICLE_TEMPLATES;
}
