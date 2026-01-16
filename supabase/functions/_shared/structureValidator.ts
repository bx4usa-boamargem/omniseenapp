/**
 * STRUCTURE VALIDATOR MODULE
 * 
 * Valida se um artigo segue a estrutura definida pelo seu modelo editorial.
 * Cada modelo (educational, problem_solution, guide, comparison) tem regras específicas.
 */

export type StructureType = 'educational' | 'problem_solution' | 'guide' | 'comparison';

export interface StructureValidationResult {
  valid: boolean;
  structureType: StructureType;
  score: number; // 0-100
  passed: string[];
  failed: string[];
  fixSuggestions: string[];
}

interface ValidationRule {
  name: string;
  description: string;
  check: (content: string, title: string) => boolean;
  fixSuggestion: string;
  weight: number; // Peso para cálculo de score
}

// ============================================================================
// REGRAS DE VALIDAÇÃO POR MODELO
// ============================================================================

const EDUCATIONAL_RULES: ValidationRule[] = [
  {
    name: 'title_is_question',
    description: 'Título termina com interrogação',
    check: (_, title) => title.trim().endsWith('?'),
    fixSuggestion: 'Reformule o título como pergunta, terminando com "?"',
    weight: 25
  },
  {
    name: 'has_direct_answer',
    description: 'Resposta direta nos primeiros parágrafos',
    check: (content) => {
      // Verificar se há conteúdo substancial antes do primeiro H2
      const firstH2 = content.indexOf('## ');
      if (firstH2 === -1) return false;
      const intro = content.substring(0, firstH2);
      const words = intro.split(/\s+/).filter(Boolean).length;
      return words >= 30; // Mínimo 30 palavras de resposta direta
    },
    fixSuggestion: 'Adicione uma resposta direta e objetiva (mínimo 30 palavras) antes da primeira seção H2',
    weight: 25
  },
  {
    name: 'has_didactic_blocks',
    description: 'Possui blocos didáticos (💡, 📌, ⚠️)',
    check: (content) => {
      const blockPatterns = ['💡', '📌', '⚠️', '> **', '> 💡', '> 📌', '> ⚠️'];
      let count = 0;
      for (const pattern of blockPatterns) {
        const matches = content.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
        count += matches?.length || 0;
      }
      return count >= 2;
    },
    fixSuggestion: 'Adicione pelo menos 2 blocos didáticos com 💡, 📌 ou ⚠️ para destacar informações importantes',
    weight: 20
  },
  {
    name: 'has_local_mention',
    description: 'Menciona contexto local/regional',
    check: (content) => {
      const localPatterns = /\b(em\s+[A-Z][a-záàâãéêíóôõúç]+|na\s+região|no\s+bairro|na\s+cidade|localmente|local)\b/i;
      return localPatterns.test(content);
    },
    fixSuggestion: 'Adicione menções à região/cidade do cliente para contextualizar o conteúdo',
    weight: 15
  },
  {
    name: 'ends_with_cta',
    description: 'Termina com seção "Próximo passo"',
    check: (content) => /##\s*Próximo\s+passo/i.test(content),
    fixSuggestion: 'Adicione a seção "## Próximo passo" ao final do artigo com CTA personalizado',
    weight: 15
  }
];

const PROBLEM_SOLUTION_RULES: ValidationRule[] = [
  {
    name: 'describes_pain',
    description: 'Descreve uma dor/problema real',
    check: (content) => {
      const painPatterns = /\b(problema|dor|risco|prejuízo|custa|difícil|complicado|frustrante|preocup|sofr|perd)\b/i;
      return painPatterns.test(content);
    },
    fixSuggestion: 'Comece descrevendo uma dor ou problema real que o público enfrenta',
    weight: 20
  },
  {
    name: 'shows_consequence',
    description: 'Mostra consequências de não agir',
    check: (content) => {
      const consequencePatterns = /\b(se\s+não|ignorar|deixar|pode\s+causar|resultar\s+em|consequência|agrava|piora)\b/i;
      return consequencePatterns.test(content);
    },
    fixSuggestion: 'Adicione uma seção mostrando as consequências de ignorar o problema',
    weight: 20
  },
  {
    name: 'has_local_context',
    description: 'Contextualiza para região local',
    check: (content) => {
      const localPatterns = /\b(em\s+[A-Z][a-záàâãéêíóôõúç]+|região|bairro|cidade|aqui\s+em)\b/i;
      return localPatterns.test(content);
    },
    fixSuggestion: 'Contextualize o problema para a região/cidade do cliente',
    weight: 15
  },
  {
    name: 'presents_solution',
    description: 'Apresenta caminho de solução',
    check: (content) => {
      const solutionPatterns = /\b(solução|resolver|corrigir|evitar|tratar|sanar|eliminar|acabar\s+com)\b/i;
      return solutionPatterns.test(content);
    },
    fixSuggestion: 'Apresente claramente o caminho para solução do problema',
    weight: 20
  },
  {
    name: 'has_direct_cta',
    description: 'CTA direto e urgente',
    check: (content) => {
      const ctaPatterns = /\*\*(solicite|agende|ligue|contrate|fale|chame|peça)\*\*/i;
      const ctaSection = /##\s*Próximo\s+passo/i.test(content);
      return ctaPatterns.test(content) || ctaSection;
    },
    fixSuggestion: 'Adicione um CTA direto em negrito (ex: **Solicite uma avaliação**) e a seção "## Próximo passo"',
    weight: 25
  }
];

const GUIDE_RULES: ValidationRule[] = [
  {
    name: 'title_has_guide',
    description: 'Título indica guia/tutorial',
    check: (_, title) => {
      const guidePatterns = /\b(guia|como|passo\s+a\s+passo|tutorial|aprenda|descubra)\b/i;
      return guidePatterns.test(title);
    },
    fixSuggestion: 'Reformule o título incluindo palavras como "Guia", "Como" ou "Passo a passo"',
    weight: 20
  },
  {
    name: 'has_numbered_steps',
    description: 'Possui passos numerados',
    check: (content) => {
      // Verificar listas numeradas ou títulos com números
      const numberedPatterns = /^(\d+[\.\)]\s+|###?\s+\d+[\.\)]?\s+|###?\s+Passo\s+\d+)/m;
      const matches = content.match(/^\d+[\.\)]/gm);
      return numberedPatterns.test(content) || (matches !== null && matches.length >= 3);
    },
    fixSuggestion: 'Estruture o conteúdo com passos numerados (1. Primeiro passo, 2. Segundo passo, etc.)',
    weight: 25
  },
  {
    name: 'has_error_alerts',
    description: 'Inclui alertas de erros comuns',
    check: (content) => {
      const alertPatterns = /(⚠️|erro|evite|não\s+faça|cuidado|atenção|importante)/i;
      return alertPatterns.test(content);
    },
    fixSuggestion: 'Adicione alertas de erros comuns usando ⚠️ ou seções de "Evite esses erros"',
    weight: 20
  },
  {
    name: 'has_pro_mention',
    description: 'Menciona quando chamar profissional',
    check: (content) => {
      const proPatterns = /\b(quando\s+chamar|profissional|especialista|técnico|contratar|buscar\s+ajuda)\b/i;
      return proPatterns.test(content);
    },
    fixSuggestion: 'Adicione uma seção sobre "Quando chamar um profissional"',
    weight: 15
  },
  {
    name: 'ends_with_cta',
    description: 'Termina com seção "Próximo passo"',
    check: (content) => /##\s*Próximo\s+passo/i.test(content),
    fixSuggestion: 'Adicione a seção "## Próximo passo" ao final do artigo',
    weight: 20
  }
];

const COMPARISON_RULES: ValidationRule[] = [
  {
    name: 'title_has_vs',
    description: 'Título indica comparação',
    check: (_, title) => {
      const vsPatterns = /\b(vs\.?|versus|ou|qual|comparar|diferença|melhor)\b/i;
      return vsPatterns.test(title);
    },
    fixSuggestion: 'Reformule o título para indicar comparação (ex: "X vs Y: qual escolher?")',
    weight: 20
  },
  {
    name: 'has_comparison',
    description: 'Compara opções de forma clara',
    check: (content) => {
      const comparisonPatterns = /\b(por\s+um\s+lado|já\s+o|enquanto|diferente\s+de|comparado|em\s+contrapartida)\b/i;
      // Também verificar se há múltiplas menções a "opção A" e "opção B"
      const h2Count = (content.match(/^##\s+/gm) || []).length;
      return comparisonPatterns.test(content) || h2Count >= 3;
    },
    fixSuggestion: 'Adicione comparações claras entre as opções usando expressões como "Por um lado... já o outro..."',
    weight: 20
  },
  {
    name: 'has_pros_cons',
    description: 'Lista prós e contras',
    check: (content) => {
      const prosConsPatterns = /\b(vantagem|desvantagem|prós?|contras?|benefício|malefício|ponto\s+positivo|ponto\s+negativo)\b/i;
      return prosConsPatterns.test(content);
    },
    fixSuggestion: 'Adicione seções de "Vantagens" e "Desvantagens" para cada opção comparada',
    weight: 25
  },
  {
    name: 'has_recommendation',
    description: 'Dá recomendação final',
    check: (content) => {
      const recPatterns = /\b(recomend|melhor\s+opção|ideal\s+para|escolha|nossa\s+sugestão|indicamos)\b/i;
      return recPatterns.test(content);
    },
    fixSuggestion: 'Adicione uma recomendação final baseada no perfil do cliente',
    weight: 15
  },
  {
    name: 'ends_with_cta',
    description: 'Termina com seção "Próximo passo"',
    check: (content) => /##\s*Próximo\s+passo/i.test(content),
    fixSuggestion: 'Adicione a seção "## Próximo passo" oferecendo consultoria personalizada',
    weight: 20
  }
];

// Mapa de regras por tipo de estrutura
const RULES_BY_TYPE: Record<StructureType, ValidationRule[]> = {
  educational: EDUCATIONAL_RULES,
  problem_solution: PROBLEM_SOLUTION_RULES,
  guide: GUIDE_RULES,
  comparison: COMPARISON_RULES
};

// ============================================================================
// FUNÇÃO PRINCIPAL DE VALIDAÇÃO
// ============================================================================

/**
 * Valida se um artigo segue a estrutura do modelo especificado
 */
export function validateStructure(
  content: string,
  title: string,
  structureType: StructureType
): StructureValidationResult {
  const rules = RULES_BY_TYPE[structureType];
  
  if (!rules) {
    console.warn(`[STRUCTURE] Unknown structure type: ${structureType}`);
    return {
      valid: true,
      structureType,
      score: 100,
      passed: [],
      failed: [],
      fixSuggestions: []
    };
  }
  
  const passed: string[] = [];
  const failed: string[] = [];
  const fixSuggestions: string[] = [];
  let totalWeight = 0;
  let earnedWeight = 0;
  
  for (const rule of rules) {
    totalWeight += rule.weight;
    
    try {
      if (rule.check(content, title)) {
        passed.push(rule.name);
        earnedWeight += rule.weight;
      } else {
        failed.push(rule.name);
        fixSuggestions.push(`[${rule.name}] ${rule.fixSuggestion}`);
      }
    } catch (e) {
      console.error(`[STRUCTURE] Error checking rule ${rule.name}:`, e);
      // Em caso de erro, considerar como passou para não bloquear
      passed.push(rule.name);
      earnedWeight += rule.weight;
    }
  }
  
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
  
  // Considera válido se score >= 60% (permite 1-2 falhas menores)
  const valid = score >= 60;
  
  console.log(`[STRUCTURE] Validation for ${structureType}: Score=${score}%, Valid=${valid}, Passed=${passed.length}/${rules.length}`);
  
  return {
    valid,
    structureType,
    score,
    passed,
    failed,
    fixSuggestions
  };
}

/**
 * Gera instruções de correção formatadas para o LLM
 */
export function generateStructureFixInstructions(
  result: StructureValidationResult
): string {
  if (result.valid) {
    return '';
  }
  
  const structureNames: Record<StructureType, string> = {
    educational: 'EDUCATIVO (Pergunta-Resposta)',
    problem_solution: 'PROBLEMA-SOLUÇÃO',
    guide: 'GUIA COMPLETO',
    comparison: 'COMPARATIVO'
  };
  
  return `
# ⚠️ CORREÇÃO DE ESTRUTURA OBRIGATÓRIA

Este artigo deveria seguir o modelo **${structureNames[result.structureType]}**, mas falhou nas seguintes validações:

${result.fixSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Score atual: ${result.score}% (mínimo: 60%)

### REGRAS DO MODELO ${structureNames[result.structureType].toUpperCase()}:

${result.structureType === 'educational' ? `
- Título DEVE terminar com interrogação (?)
- Resposta direta nos primeiros parágrafos (mínimo 30 palavras antes do primeiro H2)
- Blocos didáticos com 💡, 📌 ou ⚠️
- Menção a contexto local/regional
- Seção "## Próximo passo" ao final
` : ''}

${result.structureType === 'problem_solution' ? `
- Descrever uma dor/problema real do público
- Mostrar consequências de não agir
- Contextualizar para a região local
- Apresentar caminho claro de solução
- CTA direto em negrito e seção "## Próximo passo"
` : ''}

${result.structureType === 'guide' ? `
- Título com "Guia", "Como" ou "Passo a passo"
- Passos numerados (1, 2, 3...)
- Alertas de erros comuns com ⚠️
- Seção "Quando chamar um profissional"
- Seção "## Próximo passo" ao final
` : ''}

${result.structureType === 'comparison' ? `
- Título indicando comparação (vs, ou, qual escolher)
- Comparação clara entre opções
- Prós e contras de cada opção
- Recomendação final
- Seção "## Próximo passo" ao final
` : ''}

CORRIJA O ARTIGO para atender a TODAS as regras do modelo.
`;
}

/**
 * Verifica se uma estrutura é conhecida/válida
 */
export function isValidStructureType(type: string): type is StructureType {
  return ['educational', 'problem_solution', 'guide', 'comparison'].includes(type);
}
