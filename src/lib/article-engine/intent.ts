/**
 * Article Engine - Intent Classification
 * 
 * Referência: docs/ARTICLE_ENGINE_MASTER.md
 * 
 * Este arquivo implementa a classificação de intenção de busca.
 * Determina automaticamente o template mais adequado para cada keyword.
 */

import type { Intent, IntentType, KeywordAnalysis, TemplateType, UrgencyLevel } from './types';

// =============================================================================
// PADRÕES DE CLASSIFICAÇÃO
// =============================================================================

/**
 * Padrões regex para identificar intenção transacional
 * Indicam urgência, desejo de contratar agora
 */
const TRANSACTIONAL_PATTERNS = [
  /urgente/i,
  /emergência/i,
  /24\s*h(oras)?/i,
  /agora/i,
  /hoje/i,
  /imediato/i,
  /rápido/i,
  /socorro/i,
  /preciso/i,
  /ajuda/i,
  /atendimento/i
];

/**
 * Padrões regex para identificar intenção comercial
 * Indicam pesquisa de preço, comparação, decisão de compra
 */
const COMMERCIAL_PATTERNS = [
  /preço/i,
  /custo/i,
  /valor/i,
  /quanto/i,
  /barato/i,
  /caro/i,
  /melhor/i,
  /perto de mim/i,
  /próximo/i,
  /comparar/i,
  /vs/i,
  /versus/i,
  /diferença entre/i,
  /qual escolher/i,
  /orçamento/i,
  /tabela de preço/i
];

/**
 * Padrões regex para identificar intenção informacional do tipo "como"
 * Indicam busca por tutorial, passo a passo
 */
const HOW_TO_PATTERNS = [
  /como fazer/i,
  /como funciona/i,
  /como resolver/i,
  /como evitar/i,
  /como escolher/i,
  /como saber/i,
  /passo a passo/i,
  /tutorial/i,
  /aprenda a/i,
  /dicas para/i,
  /guia de/i
];

/**
 * Padrões regex para identificar intenção informacional genérica
 * Indicam busca por informação, definição, explicação
 */
const INFORMATIONAL_PATTERNS = [
  /o que é/i,
  /o que são/i,
  /por que/i,
  /porque/i,
  /quando/i,
  /onde/i,
  /quem/i,
  /qual/i,
  /vale a pena/i,
  /funciona/i,
  /serve para/i,
  /benefícios/i,
  /vantagens/i,
  /desvantagens/i,
  /riscos/i,
  /sintomas/i,
  /causas/i
];

// =============================================================================
// CLASSIFICADOR PRINCIPAL
// =============================================================================

/**
 * Classifica a intenção de busca de uma keyword
 * 
 * @param keyword - A keyword a ser classificada
 * @returns Intent com tipo, urgência e template recomendado
 * 
 * @example
 * classifyIntent('desentupidora urgente 24h')
 * // { type: 'transactional', urgency: 'high', recommendedTemplate: 'problem_solution' }
 * 
 * @example
 * classifyIntent('quanto custa dedetização')
 * // { type: 'commercial', urgency: 'medium', recommendedTemplate: 'comparative' }
 */
export function classifyIntent(keyword: string): Intent {
  const lower = keyword.toLowerCase().trim();
  
  // ─────────────────────────────────────────────────────────────────────────
  // 1. TRANSACIONAL (urgência, contratar agora)
  // ─────────────────────────────────────────────────────────────────────────
  if (matchesAnyPattern(lower, TRANSACTIONAL_PATTERNS)) {
    return {
      type: 'transactional',
      urgency: 'high',
      recommendedTemplate: 'problem_solution'
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 2. COMERCIAL (comparar, preço, melhor)
  // ─────────────────────────────────────────────────────────────────────────
  if (matchesAnyPattern(lower, COMMERCIAL_PATTERNS)) {
    return {
      type: 'commercial',
      urgency: 'medium',
      recommendedTemplate: 'comparative'
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 3. INFORMACIONAL - HOW TO (como fazer, tutorial)
  // ─────────────────────────────────────────────────────────────────────────
  if (matchesAnyPattern(lower, HOW_TO_PATTERNS)) {
    return {
      type: 'informational',
      urgency: 'low',
      recommendedTemplate: 'educational_steps'
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 4. INFORMACIONAL - Q&A (o que é, por que)
  // ─────────────────────────────────────────────────────────────────────────
  if (matchesAnyPattern(lower, INFORMATIONAL_PATTERNS)) {
    return {
      type: 'informational',
      urgency: 'low',
      recommendedTemplate: 'qa_format'
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 5. DEFAULT: Guia Completo
  // ─────────────────────────────────────────────────────────────────────────
  return {
    type: 'informational',
    urgency: 'low',
    recommendedTemplate: 'complete_guide'
  };
}

// =============================================================================
// ANÁLISE EXPANDIDA
// =============================================================================

/**
 * Analisa uma keyword e retorna análise completa
 * Inclui intenção, LSI keywords e perguntas relacionadas
 * 
 * @param keyword - A keyword principal
 * @param city - Cidade para contextualização (opcional)
 * @param niche - Nicho para vocabulário específico (opcional)
 * @returns KeywordAnalysis completa
 */
export function analyzeKeyword(
  keyword: string,
  city?: string,
  niche?: string
): KeywordAnalysis {
  const intent = classifyIntent(keyword);
  
  // Gerar LSI keywords baseadas na keyword + contexto
  const lsiKeywords = generateLsiKeywords(keyword, city, niche);
  
  // Gerar perguntas relacionadas
  const relatedQuestions = generateRelatedQuestions(keyword, city, intent.type);
  
  return {
    intent,
    lsiKeywords,
    relatedQuestions
  };
}

// =============================================================================
// GERAÇÃO DE LSI KEYWORDS
// =============================================================================

/**
 * Gera LSI keywords baseadas na keyword principal
 * 
 * @param keyword - Keyword principal
 * @param city - Cidade para localização
 * @param niche - Nicho para vocabulário
 * @returns Array de LSI keywords
 */
function generateLsiKeywords(
  keyword: string,
  city?: string,
  niche?: string
): string[] {
  const base = keyword.toLowerCase();
  const lsi: string[] = [];
  
  // Variações com cidade
  if (city) {
    lsi.push(`${base} em ${city}`);
    lsi.push(`${base} ${city}`);
  }
  
  // Variações temporais
  lsi.push(`${base} 24h`);
  lsi.push(`${base} urgente`);
  
  // Variações de tipo
  lsi.push(`${base} residencial`);
  lsi.push(`${base} comercial`);
  lsi.push(`${base} profissional`);
  
  // Variações de preço
  lsi.push(`preço ${base}`);
  lsi.push(`quanto custa ${base}`);
  lsi.push(`orçamento ${base}`);
  
  // Variações de qualidade
  lsi.push(`melhor ${base}`);
  lsi.push(`${base} confiável`);
  lsi.push(`${base} garantia`);
  
  return lsi.slice(0, 10); // Limitar a 10 LSI
}

// =============================================================================
// GERAÇÃO DE PERGUNTAS RELACIONADAS
// =============================================================================

/**
 * Gera perguntas relacionadas para FAQ
 * 
 * @param keyword - Keyword principal
 * @param city - Cidade para localização
 * @param intentType - Tipo de intenção identificada
 * @returns Array de perguntas relacionadas
 */
function generateRelatedQuestions(
  keyword: string,
  city?: string,
  intentType?: IntentType
): string[] {
  const questions: string[] = [];
  const base = keyword;
  const location = city ? ` em ${city}` : '';
  
  // Perguntas de preço
  questions.push(`Quanto custa ${base}${location}?`);
  questions.push(`Qual o preço médio de ${base}?`);
  
  // Perguntas de funcionamento
  questions.push(`Como funciona ${base}?`);
  questions.push(`Como escolher ${base}${location}?`);
  
  // Perguntas de tempo
  questions.push(`Quanto tempo demora ${base}?`);
  questions.push(`${base.charAt(0).toUpperCase() + base.slice(1)} 24 horas${location}?`);
  
  // Perguntas de qualidade
  questions.push(`Qual a melhor ${base}${location}?`);
  questions.push(`${base.charAt(0).toUpperCase() + base.slice(1)} confiável${location}?`);
  
  // Perguntas condicionais
  questions.push(`Vale a pena contratar ${base}?`);
  questions.push(`Quando devo procurar ${base}?`);
  
  return questions.slice(0, 10); // Limitar a 10 perguntas
}

// =============================================================================
// UTILITÁRIOS
// =============================================================================

/**
 * Verifica se string corresponde a algum padrão
 */
function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

/**
 * Obtém descrição legível do tipo de intenção
 */
export function getIntentDescription(type: IntentType): string {
  const descriptions: Record<IntentType, string> = {
    transactional: 'Intenção de contratar/comprar imediatamente',
    commercial: 'Pesquisando preços e comparando opções',
    informational: 'Buscando informação e conhecimento'
  };
  return descriptions[type];
}

/**
 * Obtém descrição legível do nível de urgência
 */
export function getUrgencyDescription(level: UrgencyLevel): string {
  const descriptions: Record<UrgencyLevel, string> = {
    high: 'Alta urgência - precisa de solução imediata',
    medium: 'Média urgência - pesquisando ativamente',
    low: 'Baixa urgência - fase de aprendizado'
  };
  return descriptions[level];
}

/**
 * Obtém cor para visualização de urgência
 */
export function getUrgencyColor(level: UrgencyLevel): string {
  const colors: Record<UrgencyLevel, string> = {
    high: 'red',
    medium: 'yellow',
    low: 'green'
  };
  return colors[level];
}
