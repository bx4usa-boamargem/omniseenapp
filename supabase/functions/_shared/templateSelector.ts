/**
 * TEMPLATE SELECTOR MODULE
 * Motor de Artigos de Autoridade Local - Sprint 2
 * 
 * Referência: docs/ARTICLE_ENGINE_MASTER.md
 * 
 * Responsável por:
 * 1. Classificar intenção de busca da keyword
 * 2. Selecionar template estrutural adequado
 * 3. Aplicar lógica anti-padrão (evitar repetição)
 * 4. Escolher variante diferente da última usada
 * 
 * NÃO MODIFICAR: structureRotation.ts, editorialRotation.ts
 */

// deno-lint-ignore-file no-explicit-any

// =============================================================================
// TIPOS DO TEMPLATE SELECTOR
// =============================================================================

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
 * Resultado da classificação de intenção
 */
export interface Intent {
  type: IntentType;
  urgency: UrgencyLevel;
  recommendedTemplate: TemplateType;
}

/**
 * Resultado da seleção de template
 */
export interface TemplateSelectionResult {
  template: TemplateType;
  variant: TemplateVariant;
  intent: Intent;
  reason: string;
  antiPatternApplied: boolean;
}

/**
 * Registro de histórico de artigo (para anti-padrão)
 */
export interface ArticleHistoryRecord {
  template: TemplateType | null;
  variant: string | null;
  createdAt: string;
}

// =============================================================================
// VARIANTES POR TEMPLATE
// =============================================================================

const TEMPLATE_VARIANTS: Record<TemplateType, TemplateVariant[]> = {
  complete_guide: ['chronological', 'importance_based', 'problem_first'],
  qa_format: ['simple_to_complex', 'most_common_first', 'cost_first'],
  comparative: ['pros_cons', 'cost_benefit', 'feature_matrix'],
  problem_solution: ['urgent_first', 'severity_based', 'cost_based'],
  educational_steps: ['beginner_to_advanced', 'linear_process', 'modular_learning']
};

// =============================================================================
// TEMPLATES ALTERNATIVOS (para quando anti-padrão é aplicado)
// =============================================================================

const ALTERNATIVE_TEMPLATES: Record<IntentType, TemplateType[]> = {
  transactional: ['problem_solution', 'complete_guide', 'educational_steps'],
  commercial: ['comparative', 'complete_guide', 'qa_format'],
  informational: ['complete_guide', 'qa_format', 'educational_steps']
};

// =============================================================================
// PADRÕES DE CLASSIFICAÇÃO DE INTENÇÃO
// =============================================================================

/**
 * Padrões para intenção transacional (urgência alta)
 * Exemplos: "desentupidora urgente", "24h", "emergência"
 */
const TRANSACTIONAL_PATTERNS: RegExp[] = [
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
  /atendimento/i,
  /plantão/i,
  /emergencial/i
];

/**
 * Padrões para intenção comercial (comparação/preço)
 * Exemplos: "quanto custa", "melhor", "comparar"
 */
const COMMERCIAL_PATTERNS: RegExp[] = [
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
  /tabela de preços/i,
  /mais barato/i,
  /mais caro/i
];

/**
 * Padrões para intenção informacional "how-to"
 * Exemplos: "como fazer", "passo a passo", "tutorial"
 */
const HOW_TO_PATTERNS: RegExp[] = [
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
  /guia de/i,
  /etapas para/i,
  /maneiras de/i,
  /formas de/i
];

/**
 * Padrões para intenção informacional geral
 * Exemplos: "o que é", "vale a pena", "funciona"
 */
const INFORMATIONAL_PATTERNS: RegExp[] = [
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
  /tipos de/i,
  /causas de/i,
  /sintomas de/i
];

// =============================================================================
// FUNÇÕES DE CLASSIFICAÇÃO
// =============================================================================

/**
 * Verifica se o texto corresponde a algum padrão da lista
 */
function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

/**
 * Classifica a intenção de busca com base na keyword
 * 
 * @param keyword - Palavra-chave a classificar
 * @returns Intent com type, urgency e recommendedTemplate
 * 
 * @example
 * classifyIntent("desentupidora urgente 24h")
 * // { type: 'transactional', urgency: 'high', recommendedTemplate: 'problem_solution' }
 */
export function classifyIntent(keyword: string): Intent {
  const lower = keyword.toLowerCase().trim();
  
  console.log(`[templateSelector] Classificando intenção: "${keyword}"`);
  
  // Prioridade 1: Transacional (urgência alta)
  if (matchesAnyPattern(lower, TRANSACTIONAL_PATTERNS)) {
    console.log(`[templateSelector] → Intenção TRANSACIONAL detectada`);
    return { 
      type: 'transactional', 
      urgency: 'high', 
      recommendedTemplate: 'problem_solution' 
    };
  }
  
  // Prioridade 2: Comercial (comparação/preço)
  if (matchesAnyPattern(lower, COMMERCIAL_PATTERNS)) {
    console.log(`[templateSelector] → Intenção COMERCIAL detectada`);
    return { 
      type: 'commercial', 
      urgency: 'medium', 
      recommendedTemplate: 'comparative' 
    };
  }
  
  // Prioridade 3: Informacional how-to
  if (matchesAnyPattern(lower, HOW_TO_PATTERNS)) {
    console.log(`[templateSelector] → Intenção INFORMACIONAL (how-to) detectada`);
    return { 
      type: 'informational', 
      urgency: 'low', 
      recommendedTemplate: 'educational_steps' 
    };
  }
  
  // Prioridade 4: Informacional geral
  if (matchesAnyPattern(lower, INFORMATIONAL_PATTERNS)) {
    console.log(`[templateSelector] → Intenção INFORMACIONAL (geral) detectada`);
    return { 
      type: 'informational', 
      urgency: 'low', 
      recommendedTemplate: 'qa_format' 
    };
  }
  
  // Default: Guia completo (cobre a maioria das keywords)
  console.log(`[templateSelector] → Intenção DEFAULT (guia completo)`);
  return { 
    type: 'informational', 
    urgency: 'low', 
    recommendedTemplate: 'complete_guide' 
  };
}

// =============================================================================
// FUNÇÕES DE HISTÓRICO
// =============================================================================

/**
 * Mapeamento: article_structure_type (existente) → TemplateType (novo)
 * Compatibilidade com structureRotation.ts
 */
function mapStructureTypeToTemplate(structureType: string | null): TemplateType | null {
  if (!structureType) return null;
  
  const mapping: Record<string, TemplateType> = {
    // Mapeamento do structureRotation.ts existente
    'guide': 'complete_guide',
    'educational': 'qa_format',
    'comparison': 'comparative',
    'problem_solution': 'problem_solution',
    // Mapeamento direto (novos templates)
    'complete_guide': 'complete_guide',
    'qa_format': 'qa_format',
    'comparative': 'comparative',
    'educational_steps': 'educational_steps',
    // Mapeamento do editorialRotation.ts
    'traditional': 'complete_guide',
    'strategic': 'problem_solution',
    'visual_guided': 'educational_steps'
  };
  
  return mapping[structureType.toLowerCase()] || 'complete_guide';
}

/**
 * Busca últimos templates usados pelo blog (para anti-padrão)
 * 
 * @param supabase - Cliente Supabase
 * @param blogId - ID do blog
 * @param limit - Quantidade de artigos a buscar
 * @returns Array de registros de histórico
 */
export async function getRecentTemplates(
  supabase: any,
  blogId: string,
  limit: number = 10
): Promise<ArticleHistoryRecord[]> {
  try {
    console.log(`[templateSelector] Buscando histórico (${limit} artigos) para blog: ${blogId}`);
    
    const { data, error } = await supabase
      .from('articles')
      .select('article_structure_type, created_at')
      .eq('blog_id', blogId)
      .not('article_structure_type', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[templateSelector] Erro ao buscar histórico:', error);
      return [];
    }

    const history = (data || []).map((row: any) => ({
      template: mapStructureTypeToTemplate(row.article_structure_type),
      variant: null,  // Campo para futura implementação
      createdAt: row.created_at
    }));
    
    console.log(`[templateSelector] Histórico encontrado: ${history.length} artigos`);
    return history;
  } catch (err) {
    console.error('[templateSelector] Exceção ao buscar histórico:', err);
    return [];
  }
}

// =============================================================================
// LÓGICA ANTI-PADRÃO
// =============================================================================

/**
 * Aplica lógica anti-padrão para evitar repetição de templates
 * 
 * Regra: Se o template recomendado foi usado 2+ vezes nas últimas 3, troca para alternativa
 * 
 * @param recommended - Template recomendado pela classificação
 * @param history - Histórico de templates usados
 * @param intent - Intenção classificada
 * @returns Template final com informações de aplicação do anti-padrão
 */
export function applyAntiPattern(
  recommended: TemplateType,
  history: ArticleHistoryRecord[],
  intent: Intent
): { template: TemplateType; applied: boolean; reason: string } {
  
  // Histórico insuficiente: não aplicar anti-padrão
  if (history.length < 3) {
    console.log(`[templateSelector] Anti-padrão: histórico insuficiente (${history.length}/3)`);
    return { 
      template: recommended, 
      applied: false, 
      reason: 'Histórico insuficiente para aplicar anti-padrão' 
    };
  }
  
  // Verificar últimos 3 templates
  const lastThree = history.slice(0, 3).map(h => h.template);
  const recommendedCount = lastThree.filter(t => t === recommended).length;
  
  console.log(`[templateSelector] Anti-padrão: "${recommended}" usado ${recommendedCount}x nas últimas 3`);
  
  // Se template usado 2+ vezes nas últimas 3, trocar
  if (recommendedCount >= 2) {
    const alternatives = ALTERNATIVE_TEMPLATES[intent.type];
    const available = alternatives.find(alt => 
      !lastThree.includes(alt) && alt !== recommended
    );
    
    if (available) {
      console.log(`[templateSelector] Anti-padrão APLICADO: trocando para "${available}"`);
      return {
        template: available,
        applied: true,
        reason: `Anti-padrão: "${recommended}" usado ${recommendedCount}x nas últimas 3, trocando para "${available}"`
      };
    }
    
    console.log(`[templateSelector] Anti-padrão: sem alternativa disponível`);
  }
  
  return { 
    template: recommended, 
    applied: false, 
    reason: 'Template recomendado aprovado (sem repetição excessiva)' 
  };
}

// =============================================================================
// SELEÇÃO DE VARIANTE
// =============================================================================

/**
 * Seleciona variante diferente da última usada
 * 
 * @param template - Template selecionado
 * @param history - Histórico de artigos
 * @returns Variante a usar
 */
export function selectVariant(
  template: TemplateType,
  history: ArticleHistoryRecord[]
): TemplateVariant {
  const variants = TEMPLATE_VARIANTS[template];
  
  if (!variants || variants.length === 0) {
    console.log(`[templateSelector] Variante: usando default "chronological"`);
    return 'chronological';
  }
  
  // Encontrar última variante usada para este template
  const lastWithSameTemplate = history.find(h => h.template === template);
  const lastVariant = lastWithSameTemplate?.variant as TemplateVariant | null;
  
  if (!lastVariant) {
    // Primeira vez usando este template: usar primeira variante
    console.log(`[templateSelector] Variante: primeira vez usando "${template}", usando "${variants[0]}"`);
    return variants[0];
  }
  
  // Rotacionar para próxima variante
  const lastIndex = variants.indexOf(lastVariant);
  const nextIndex = (lastIndex + 1) % variants.length;
  
  console.log(`[templateSelector] Variante: rotacionando de "${lastVariant}" para "${variants[nextIndex]}"`);
  return variants[nextIndex];
}

// =============================================================================
// FUNÇÃO PRINCIPAL: SELECT TEMPLATE
// =============================================================================

/**
 * Função principal de seleção de template
 * 
 * Orquestra todas as etapas:
 * 1. Classificar intenção
 * 2. Obter template recomendado
 * 3. Consultar histórico
 * 4. Aplicar anti-padrão
 * 5. Selecionar variante
 * 
 * @param supabase - Cliente Supabase
 * @param keyword - Palavra-chave do artigo
 * @param blogId - ID do blog
 * @param _niche - Nicho (para futura expansão)
 * @returns Resultado completo da seleção
 * 
 * @example
 * const result = await selectTemplate(supabase, "desentupidora urgente", blogId);
 * // { template: 'problem_solution', variant: 'urgent_first', intent: {...}, reason: '...', antiPatternApplied: false }
 */
export async function selectTemplate(
  supabase: any,
  keyword: string,
  blogId: string,
  _niche?: string
): Promise<TemplateSelectionResult> {
  console.log(`\n[templateSelector] ========================================`);
  console.log(`[templateSelector] Selecionando template para: "${keyword}"`);
  console.log(`[templateSelector] Blog ID: ${blogId}`);
  console.log(`[templateSelector] ========================================`);
  
  // 1. Classificar intenção
  const intent = classifyIntent(keyword);
  console.log(`[templateSelector] Intenção: ${intent.type} (urgência: ${intent.urgency})`);
  
  // 2. Obter template recomendado
  const recommended = intent.recommendedTemplate;
  console.log(`[templateSelector] Template recomendado: ${recommended}`);
  
  // 3. Buscar histórico
  const history = await getRecentTemplates(supabase, blogId, 10);
  console.log(`[templateSelector] Histórico: ${history.length} artigos encontrados`);
  
  // 4. Aplicar anti-padrão
  const antiPattern = applyAntiPattern(recommended, history, intent);
  const finalTemplate = antiPattern.template;
  console.log(`[templateSelector] Template final: ${finalTemplate} (anti-padrão: ${antiPattern.applied})`);
  
  // 5. Selecionar variante
  const variant = selectVariant(finalTemplate, history);
  console.log(`[templateSelector] Variante: ${variant}`);
  
  console.log(`[templateSelector] ========================================\n`);
  
  return {
    template: finalTemplate,
    variant,
    intent,
    reason: antiPattern.reason,
    antiPatternApplied: antiPattern.applied
  };
}

// =============================================================================
// HELPERS PÚBLICOS
// =============================================================================

/**
 * Retorna variantes disponíveis para um template
 */
export function getTemplateVariants(template: TemplateType): TemplateVariant[] {
  return TEMPLATE_VARIANTS[template] || [];
}

/**
 * Verifica se ID é um TemplateType válido
 */
export function isValidTemplate(id: string): id is TemplateType {
  return ['complete_guide', 'qa_format', 'comparative', 'problem_solution', 'educational_steps'].includes(id);
}

/**
 * Mapeia TemplateType novo para structure_type existente
 * Útil para salvar no banco mantendo compatibilidade
 */
export function mapTemplateToStructureType(template: TemplateType): string {
  const mapping: Record<TemplateType, string> = {
    'complete_guide': 'guide',
    'qa_format': 'educational',
    'comparative': 'comparison',
    'problem_solution': 'problem_solution',
    'educational_steps': 'educational'
  };
  
  return mapping[template] || 'guide';
}
