// ============================================================================
// QUALITY VALIDATOR V2.1 - CONTRATO EDITORIAL ABSOLUTO + GEO AUTHORITY + TITLE
// ============================================================================
// Nenhum artigo pode ser salvo sem passar por TODAS as validações
// Violação de regras críticas = REJEIÇÃO AUTOMÁTICA
// V2.0: Adiciona validações GEO para OmniCore GEO Writer
// V2.1: Adiciona validação de prefixos proibidos em títulos
// ============================================================================

import type { FunnelMode } from './promptTypeCore.ts';
import { 
  GEO_WRITER_RULES, 
  GEO_PHRASE_PATTERNS, 
  FORBIDDEN_PATTERNS,
  countGeoWords,
  hasAnswerFirstPattern,
  hasTerritorialMentions
} from './geoWriterCore.ts';
import { hasForbiddenPrefix } from './titleValidator.ts';

export interface ValidationResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
  score: number; // 0-100
  canRetry: boolean;
}

interface QualityCheck {
  name: string;
  check: (content: string, funnelMode: FunnelMode, options?: ValidationOptions) => boolean;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationOptions {
  allowedBlocks?: string[];
  geoMode?: boolean;           // Enable GEO checks
  territories?: string[];      // Neighborhood names for territorial validation
}

// REGRA GLOBAL: Título exato da última seção
const MANDATORY_FINAL_SECTION = '## Próximo passo';

// Frases genéricas que indicam texto de IA de baixa qualidade
const GENERIC_INTRO_PATTERNS = [
  /^(no mundo|atualmente|nos dias|em um cenário|é comum que|com o avanço|diante de|quando falamos|não é segredo)/i,
  /^(é inegável|é fundamental|é importante|é essencial|é crucial|sabemos que|todos sabemos)/i,
  /^(vivemos em|estamos em|em uma era|em tempos|em um mercado|no contexto|no cenário)/i
];

// Adjetivos vazios sem prova ou contexto
const EMPTY_ADJECTIVES = [
  'incrível', 'fantástico', 'revolucionário', 'inovador', 'transformador',
  'extraordinário', 'excepcional', 'impressionante', 'espetacular', 'maravilhoso',
  'melhor do mercado', 'líder do setor', 'único no mercado', 'incomparável'
];

// CTAs esperados por modo de funil
const FUNNEL_CTA_PATTERNS: Record<FunnelMode, RegExp> = {
  top: /(saiba mais|descubra|leia mais|continue lendo|aprenda|entenda)/i,
  middle: /(compare|avalie|conheça|veja como|fale com|entre em contato)/i,
  bottom: /(solicite|agende|comece|contrate|peça|faça seu)/i
};

// Blocos visuais autorizados por padrão (modelo clássico)
const DEFAULT_ALLOWED_BLOCKS = ['💡', '⚠️', '📌'];

const QUALITY_CHECKS: QualityCheck[] = [
  // =========================================================================
  // REGRA 0: Título sem prefixos proibidos (REGRA ABSOLUTA)
  // =========================================================================
  {
    name: 'no_forbidden_title_prefix',
    check: (content: string) => {
      // Extrair H1 do conteúdo
      const h1Match = content.match(/^# (.+)$/m);
      if (!h1Match) return true; // Se não tem H1, deixa outras regras pegarem
      
      const title = h1Match[1].trim();
      return !hasForbiddenPrefix(title).has;
    },
    message: 'TÍTULO INVÁLIDO: Prefixos como "Artigo:", "Post:", "Guia:" são PROIBIDOS. O título deve ser direto, pronto para Google e WordPress.',
    severity: 'error'
  },

  // =========================================================================
  // REGRA 3: Estrutura H1 obrigatória (H1 → linha em branco → parágrafo)
  // =========================================================================
  {
    name: 'has_valid_h1_structure',
    check: (content: string) => {
      const lines = content.split('\n');
      if (lines.length < 3) return false;
      
      // Linha 1: deve ser H1 (apenas 1 #)
      const line1 = lines[0];
      if (!line1.startsWith('# ') || line1.startsWith('## ')) return false;
      
      // Linha 2: deve ser vazia
      if (lines[1].trim() !== '') return false;
      
      // Linha 3: deve ser parágrafo (não vazio, não heading)
      const line3 = lines[2].trim();
      if (line3 === '' || line3.startsWith('#')) return false;
      
      return true;
    },
    message: 'O artigo DEVE começar com: H1 (título) → linha em branco → primeiro parágrafo. É proibido colar texto junto ao H1.',
    severity: 'error'
  },

  // =========================================================================
  // REGRA 1: Sem introduções genéricas
  // =========================================================================
  {
    name: 'no_generic_intro',
    check: (content: string) => {
      const firstParagraph = content.split('\n').find(line => line.trim().length > 50) || '';
      return !GENERIC_INTRO_PATTERNS.some(pattern => pattern.test(firstParagraph));
    },
    message: 'Introdução genérica detectada (padrão de IA). O artigo deve começar com o problema real do leitor.',
    severity: 'error'
  },

  // =========================================================================
  // REGRA 2: Problema primeiro
  // =========================================================================
  {
    name: 'has_problem_first',
    check: (content: string) => {
      const firstH2Match = content.match(/##\s*(.+?)[\n\r]/);
      const firstH2 = firstH2Match?.[1]?.toLowerCase() || '';
      const first500 = content.slice(0, 500).toLowerCase();
      
      const problemIndicators = /problema|dor|desafio|dificuldade|preocupa|sofre|enfrenta|luta|custa|perde|erro|risco/i;
      return problemIndicators.test(firstH2) || problemIndicators.test(first500);
    },
    message: 'O artigo deve começar abordando um problema ou dor real do leitor.',
    severity: 'error'
  },

  // =========================================================================
  // REGRA 4: Hierarquia fixa (5-10 H2s)
  // =========================================================================
  {
    name: 'has_valid_h2_count',
    check: (content: string) => {
      const h2Count = (content.match(/^##\s+[^#]/gm) || []).length;
      return h2Count >= 3 && h2Count <= 10;
    },
    message: 'O artigo deve ter entre 3 e 10 seções H2 conforme estrutura obrigatória.',
    severity: 'warning'
  },

  // =========================================================================
  // CTA alinhado ao funil
  // =========================================================================
  {
    name: 'has_cta_aligned',
    check: (content: string, funnelMode: FunnelMode) => {
      const boldTextMatches = content.match(/\*\*[^*]+\*\*/g) || [];
      const ctaPattern = FUNNEL_CTA_PATTERNS[funnelMode];
      return boldTextMatches.some(bold => ctaPattern.test(bold));
    },
    message: 'CTA em negrito alinhado ao funil não encontrado. O artigo deve ter call-to-action adequado ao estágio.',
    severity: 'error'
  },

  // =========================================================================
  // REGRA 4: Parágrafos curtos (1-3 linhas) - ERRO, não warning
  // =========================================================================
  {
    name: 'paragraphs_short',
    check: (content: string) => {
      const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 80);
      const longParagraphs = paragraphs.filter(p => {
        const lines = p.split('\n').filter(l => l.trim().length > 0);
        return lines.length > 4;
      });
      
      // Não permite mais de 10% de parágrafos longos
      return paragraphs.length === 0 || longParagraphs.length / paragraphs.length < 0.1;
    },
    message: 'Parágrafos excedem 3-4 linhas. É proibido criar "paredões" de texto. O texto DEVE ser escaneável.',
    severity: 'error'
  },

  // =========================================================================
  // Sem adjetivos vazios
  // =========================================================================
  {
    name: 'no_empty_adjectives',
    check: (content: string) => {
      const contentLower = content.toLowerCase();
      const foundAdjectives = EMPTY_ADJECTIVES.filter(adj => contentLower.includes(adj));
      return foundAdjectives.length <= 1;
    },
    message: 'Adjetivos vazios detectados (ex: incrível, fantástico). Use prova ou remova.',
    severity: 'warning'
  },

  // =========================================================================
  // REGRA 7: Mínimo de palavras (400 fast, 800 deep)
  // =========================================================================
  {
    name: 'has_minimum_word_count',
    check: (content: string) => {
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      return wordCount >= 400; // Mínimo absoluto para qualquer artigo
    },
    message: 'Artigo muito curto. Mínimo de 400 palavras para conteúdo de qualidade.',
    severity: 'error'
  },

  // =========================================================================
  // Sem conclusões genéricas
  // =========================================================================
  {
    name: 'no_conclusion_heading',
    check: (content: string) => {
      const conclusionPatterns = /##\s*(conclusão|considerações finais|para finalizar|concluindo|direto ao ponto)/i;
      return !conclusionPatterns.test(content);
    },
    message: 'Evite H2 de "Conclusão" ou "Direto ao ponto". O último H2 deve ser exatamente "## Próximo passo".',
    severity: 'error'
  },

  // =========================================================================
  // REGRA 2: Última seção DEVE ser "## Próximo passo" (CRÍTICO)
  // =========================================================================
  {
    name: 'has_final_cta_proximo_passo',
    check: (content: string) => {
      const h2Matches = content.match(/^## .+$/gm) || [];
      if (h2Matches.length === 0) return false;
      
      const lastH2 = h2Matches[h2Matches.length - 1].trim();
      return lastH2 === MANDATORY_FINAL_SECTION;
    },
    message: 'A última seção DEVE ser exatamente "## Próximo passo". Artigo sem CTA final padronizado é inválido.',
    severity: 'error'
  },

  // =========================================================================
  // REGRA 5: Blocos visuais autorizados (sem emojis não permitidos)
  // =========================================================================
  {
    name: 'no_unauthorized_visual_blocks',
    check: (content: string, _funnelMode: FunnelMode, options?: ValidationOptions) => {
      const allowedBlocks = options?.allowedBlocks || DEFAULT_ALLOWED_BLOCKS;
      
      // Encontrar todos os emojis no início de linhas (blocos visuais)
      const blockEmojis = content.match(/^[💡⚠️📌✅❝🎯📐📝🖼️🧱🚨🎙️🧠🏷️📐🧱]/gm) || [];
      
      for (const emoji of blockEmojis) {
        if (!allowedBlocks.includes(emoji)) {
          console.log(`Bloco visual não autorizado: ${emoji} (permitidos: ${allowedBlocks.join(', ')})`);
          return false;
        }
      }
      return true;
    },
    message: 'Blocos visuais ou emojis não autorizados pelo modelo editorial detectados.',
    severity: 'warning'
  },

  // =========================================================================
  // REGRA 8: Blocos de destaque obrigatórios (frases de impacto)
  // =========================================================================
  {
    name: 'has_highlight_blocks',
    check: (content: string) => {
      // Procura por blockquotes com texto em itálico (formato: > *frase*)
      const highlightBlocks = content.match(/^>\s*\*.+\*.*$/gm) || [];
      return highlightBlocks.length >= 2;
    },
    message: 'O artigo deve ter pelo menos 2 blocos de destaque (> *frase de impacto*) para melhorar escaneabilidade.',
    severity: 'warning'
  },

  // =========================================================================
  // REGRA 9: Ritmo visual - alternância de elementos
  // =========================================================================
  {
    name: 'has_visual_rhythm',
    check: (content: string) => {
      // Verifica se há variação: listas, blockquotes, headings distribuídos
      const hasList = /^[-*]\s+.+$/m.test(content);
      const hasBlockquote = /^>\s*.+$/m.test(content);
      const h2Count = (content.match(/^##\s+[^#]/gm) || []).length;
      
      // Precisa ter pelo menos listas OU blockquotes, e múltiplos H2s
      return (hasList || hasBlockquote) && h2Count >= 3;
    },
    message: 'O artigo precisa de mais variação visual: use listas, blocos de destaque e subtítulos para quebrar o texto.',
    severity: 'warning'
  }
];

// =========================================================================
// GEO QUALITY CHECKS - Validações específicas para OmniCore GEO Writer
// =========================================================================
const GEO_QUALITY_CHECKS: QualityCheck[] = [
  // GEO RULE 1: Frases de autoridade temporal (mínimo 2)
  {
    name: 'has_geo_authority_phrases',
    check: (content: string) => {
      let count = 0;
      for (const pattern of GEO_PHRASE_PATTERNS) {
        if (pattern.test(content)) {
          count++;
        }
      }
      return count >= 2;
    },
    message: 'Artigo GEO deve conter pelo menos 2 frases de autoridade temporal (ex: "Segundo as atualizações de 2026...", "Motores generativos priorizam...")',
    severity: 'error'
  },

  // GEO RULE 2: Answer-first pattern
  {
    name: 'has_answer_first_pattern',
    check: (content: string) => {
      return hasAnswerFirstPattern(content);
    },
    message: 'O artigo GEO deve começar com a resposta principal (answer-first pattern). Evite introduções genéricas como "No mundo de hoje..." ou "É inegável que..."',
    severity: 'error'
  },

  // GEO RULE 3: Menções territoriais (quando aplicável)
  {
    name: 'has_territorial_mentions',
    check: (content: string, _funnelMode: FunnelMode, options?: ValidationOptions) => {
      if (!options?.territories?.length) return true; // Sem território = passa
      return hasTerritorialMentions(content, options.territories);
    },
    message: 'Artigo territorial deve mencionar pelo menos 1 bairro/localidade real especificada no contexto.',
    severity: 'warning'
  },

  // GEO RULE 4: Word count no range GEO (1200-3000)
  {
    name: 'geo_word_count_range',
    check: (content: string) => {
      const count = countGeoWords(content);
      return count >= GEO_WRITER_RULES.word_count.min && count <= GEO_WRITER_RULES.word_count.max;
    },
    message: `Artigo GEO deve ter entre ${GEO_WRITER_RULES.word_count.min} e ${GEO_WRITER_RULES.word_count.max} palavras.`,
    severity: 'error'
  },

  // GEO RULE 5: Sem padrões de IA genérica
  {
    name: 'no_forbidden_intro_patterns',
    check: (content: string) => {
      const lines = content.split('\n');
      for (const line of lines.slice(0, 10)) { // Check first 10 lines
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line.trim())) {
            return false;
          }
        }
      }
      return true;
    },
    message: 'Artigo GEO não pode conter introduções genéricas de IA (ex: "No mundo de hoje...", "É fundamental que...")',
    severity: 'error'
  },

  // GEO RULE 6: H2 ultra-específicos (não genéricos)
  {
    name: 'has_specific_h2_titles',
    check: (content: string) => {
      const h2Matches = content.match(/^## .+$/gm) || [];
      const genericPatterns = [
        /^## (Introdução|Conclusão|O que é|Definição|Contexto|Visão Geral|Overview)$/i,
        /^## (Considerações|Resumo|Sumário|Índice)$/i
      ];
      
      const genericCount = h2Matches.filter(h2 => 
        genericPatterns.some(pattern => pattern.test(h2))
      ).length;
      
      // Allow max 1 generic H2 (like "Próximo passo")
      return genericCount <= 1;
    },
    message: 'Artigo GEO deve ter H2s ultra-específicos. Evite títulos genéricos como "O que é", "Introdução", "Contexto".',
    severity: 'warning'
  }
];

/**
 * Valida a qualidade do artigo gerado conforme CONTRATO EDITORIAL ABSOLUTO
 * 
 * @param content - Conteúdo do artigo em Markdown
 * @param funnelMode - Modo de funil para validação de CTA
 * @param options - Opções de validação (blocos permitidos, etc.)
 * @returns ValidationResult com status, falhas e score
 */
export function validateArticleQuality(
  content: string,
  funnelMode: FunnelMode = 'middle',
  options?: ValidationOptions
): ValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  let passedChecks = 0;
  let criticalFailed = false;

  console.log('[QUALITY V1.0] Starting validation with Absolute Editorial Contract...');

  for (const check of QUALITY_CHECKS) {
    const passed = check.check(content, funnelMode, options);
    
    if (!passed) {
      if (check.severity === 'error') {
        failures.push(check.message);
        criticalFailed = true;
        console.log(`[QUALITY V1.0] ❌ FAILED (error): ${check.name}`);
      } else {
        warnings.push(check.message);
        console.log(`[QUALITY V1.0] ⚠️ WARNING: ${check.name}`);
      }
    } else {
      passedChecks++;
      console.log(`[QUALITY V1.0] ✅ PASSED: ${check.name}`);
    }
  }

  const totalChecks = QUALITY_CHECKS.length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  console.log(`[QUALITY V1.0] Final Score: ${score}/100 - Errors: ${failures.length}, Warnings: ${warnings.length}`);

  return {
    passed: !criticalFailed,
    failures,
    warnings,
    score,
    canRetry: failures.length <= 2 // Retry apenas se poucos erros críticos
  };
}

/**
 * Gera instruções de correção específicas para retry baseado nas falhas
 */
export function generateCorrectionInstructions(failures: string[]): string {
  if (failures.length === 0) return '';

  return `
⛔ O ARTIGO ANTERIOR FOI REJEITADO POR VIOLAÇÕES DO CONTRATO EDITORIAL ABSOLUTO.

## CORREÇÕES OBRIGATÓRIAS ANTES DE REESCREVER:

${failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## REGRAS ABSOLUTAS PARA ESTA TENTATIVA:

### ESTRUTURA OBRIGATÓRIA:
- Linha 1: H1 (apenas o título)
- Linha 2: linha em branco
- Linha 3: primeiro parágrafo
- NÃO cole texto junto ao H1

### SEÇÃO FINAL OBRIGATÓRIA:
- A ÚLTIMA seção H2 DEVE ser EXATAMENTE: ## Próximo passo
- NÃO use variações: "Conclusão", "Direto ao ponto", "Saiba mais", etc.

### PARÁGRAFOS:
- Máximo 3 linhas por parágrafo
- Sem "paredões" de texto
- Frases curtas e diretas

### CTA EM NEGRITO:
- Inclua pelo menos 1 CTA em **negrito** na última seção

⚠️ SE ESTAS CORREÇÕES NÃO FOREM APLICADAS, O ARTIGO SERÁ REJEITADO NOVAMENTE.
`;
}

/**
 * Valida se o conteúdo pode ser salvo (passou nos checks críticos)
 */
export function canSaveArticle(content: string, funnelMode: FunnelMode = 'middle'): boolean {
  const result = validateArticleQuality(content, funnelMode);
  return result.passed;
}

/**
 * Valida a qualidade do artigo GEO conforme OmniCore GEO Writer rules
 * 
 * @param content - Conteúdo do artigo em Markdown
 * @param funnelMode - Modo de funil para validação de CTA
 * @param options - Opções de validação (territórios, etc.)
 * @returns ValidationResult com status, falhas e score
 */
export function validateGeoArticleQuality(
  content: string,
  funnelMode: FunnelMode = 'middle',
  options?: ValidationOptions
): ValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  let passedChecks = 0;
  let criticalFailed = false;

  console.log('[GEO QUALITY] Starting GEO validation with OmniCore GEO Writer rules...');

  // Run standard quality checks first
  for (const check of QUALITY_CHECKS) {
    const passed = check.check(content, funnelMode, options);
    
    if (!passed) {
      if (check.severity === 'error') {
        failures.push(check.message);
        criticalFailed = true;
        console.log(`[GEO QUALITY] ❌ FAILED (error): ${check.name}`);
      } else {
        warnings.push(check.message);
        console.log(`[GEO QUALITY] ⚠️ WARNING: ${check.name}`);
      }
    } else {
      passedChecks++;
      console.log(`[GEO QUALITY] ✅ PASSED: ${check.name}`);
    }
  }

  // Run GEO-specific checks
  for (const check of GEO_QUALITY_CHECKS) {
    const passed = check.check(content, funnelMode, options);
    
    if (!passed) {
      if (check.severity === 'error') {
        failures.push(check.message);
        criticalFailed = true;
        console.log(`[GEO QUALITY] ❌ GEO FAILED (error): ${check.name}`);
      } else {
        warnings.push(check.message);
        console.log(`[GEO QUALITY] ⚠️ GEO WARNING: ${check.name}`);
      }
    } else {
      passedChecks++;
      console.log(`[GEO QUALITY] ✅ GEO PASSED: ${check.name}`);
    }
  }

  const totalChecks = QUALITY_CHECKS.length + GEO_QUALITY_CHECKS.length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  console.log(`[GEO QUALITY] Final Score: ${score}/100 - Errors: ${failures.length}, Warnings: ${warnings.length}`);

  return {
    passed: !criticalFailed,
    failures,
    warnings,
    score,
    canRetry: failures.length <= 3 // GEO allows more retries due to complexity
  };
}

/**
 * Gera instruções de correção GEO específicas para retry baseado nas falhas
 */
export function generateGeoCorrectionInstructions(failures: string[]): string {
  if (failures.length === 0) return '';

  return `
⛔ O ARTIGO ANTERIOR FOI REJEITADO PELO OMNICORE GEO QUALITY GATE.

## CORREÇÕES OBRIGATÓRIAS (GEO AUTHORITY):

${failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## REGRAS GEO ABSOLUTAS:

### WORD COUNT (1.200 - 3.000 palavras):
- Se o artigo tem menos de 1.200 palavras, EXPANDA cada seção
- Se tem mais de 3.000 palavras, CONDENSE mantendo autoridade

### FRASES DE AUTORIDADE TEMPORAL (mínimo 2):
Use naturalmente ao longo do texto:
- "Segundo as atualizações de 2026..."
- "Motores generativos priorizam..."
- "O consenso técnico atual aponta que..."
- "Dados recentes indicam que..."

### ANSWER-FIRST PATTERN:
- O primeiro parágrafo após o H1 DEVE entregar a resposta principal
- NUNCA comece com: "No mundo de hoje...", "É inegável...", "Quando falamos..."

### H2 ULTRA-ESPECÍFICOS:
- Evite títulos genéricos como "O que é", "Introdução", "Contexto"
- Use títulos que respondam perguntas específicas

### TERRITORIALIZAÇÃO (quando aplicável):
- Mencione a localidade/bairros especificados naturalmente no texto

⚠️ SE ESTAS CORREÇÕES NÃO FOREM APLICADAS, O ARTIGO SERÁ REJEITADO NOVAMENTE.
`;
}
