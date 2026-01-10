// Quality Validator - Validação pós-geração obrigatória
// Nenhum artigo pode ser salvo sem passar por esta validação

import type { FunnelMode } from './promptTypeCore.ts';

export interface ValidationResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
  score: number; // 0-100
  canRetry: boolean;
}

interface QualityCheck {
  name: string;
  check: (content: string, funnelMode: FunnelMode) => boolean;
  message: string;
  severity: 'error' | 'warning';
}

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

const QUALITY_CHECKS: QualityCheck[] = [
  {
    name: 'no_generic_intro',
    check: (content: string) => {
      const firstParagraph = content.split('\n').find(line => line.trim().length > 50) || '';
      return !GENERIC_INTRO_PATTERNS.some(pattern => pattern.test(firstParagraph));
    },
    message: 'Introdução genérica detectada (padrão de IA). O artigo deve começar com o problema real do leitor.',
    severity: 'error'
  },
  {
    name: 'has_problem_first',
    check: (content: string) => {
      // Extrai o primeiro H2 ou primeiros 500 caracteres
      const firstH2Match = content.match(/##\s*(.+?)[\n\r]/);
      const firstH2 = firstH2Match?.[1]?.toLowerCase() || '';
      const first500 = content.slice(0, 500).toLowerCase();
      
      const problemIndicators = /problema|dor|desafio|dificuldade|preocupa|sofre|enfrenta|luta|custa|perde|erro|risco/i;
      return problemIndicators.test(firstH2) || problemIndicators.test(first500);
    },
    message: 'O artigo deve começar abordando um problema ou dor real do leitor.',
    severity: 'error'
  },
  {
    name: 'has_6_blocks_structure',
    check: (content: string) => {
      const h2Count = (content.match(/^##\s+[^#]/gm) || []).length;
      return h2Count >= 5 && h2Count <= 10; // Flexível entre 5-10 H2s
    },
    message: 'O artigo deve ter entre 5 e 10 seções H2 conforme estrutura obrigatória.',
    severity: 'warning'
  },
  {
    name: 'has_cta_aligned',
    check: (content: string, funnelMode: FunnelMode) => {
      // Verifica se existe CTA em negrito que corresponde ao funil
      const boldTextMatches = content.match(/\*\*[^*]+\*\*/g) || [];
      const ctaPattern = FUNNEL_CTA_PATTERNS[funnelMode];
      
      return boldTextMatches.some(bold => ctaPattern.test(bold));
    },
    message: 'CTA em negrito alinhado ao funil não encontrado. O artigo deve ter call-to-action adequado ao estágio.',
    severity: 'error'
  },
  {
    name: 'paragraphs_short',
    check: (content: string) => {
      // Divide em parágrafos e verifica se nenhum excede 4 linhas
      const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 80);
      const longParagraphs = paragraphs.filter(p => {
        const lines = p.split('\n').filter(l => l.trim().length > 0);
        return lines.length > 4;
      });
      
      // Permite até 20% de parágrafos longos
      return longParagraphs.length / paragraphs.length < 0.2;
    },
    message: 'Muitos parágrafos excedem 3-4 linhas. O texto deve ser escaneável e mobile-first.',
    severity: 'warning'
  },
  {
    name: 'no_empty_adjectives',
    check: (content: string) => {
      const contentLower = content.toLowerCase();
      const foundAdjectives = EMPTY_ADJECTIVES.filter(adj => contentLower.includes(adj));
      return foundAdjectives.length <= 1; // Permite no máximo 1
    },
    message: 'Adjetivos vazios detectados (ex: incrível, fantástico). Use prova ou remova.',
    severity: 'warning'
  },
  {
    name: 'has_minimum_word_count',
    check: (content: string) => {
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      return wordCount >= 800; // Mínimo para qualquer artigo
    },
    message: 'Artigo muito curto. Mínimo de 800 palavras para conteúdo de qualidade.',
    severity: 'error'
  },
  {
    name: 'no_conclusion_heading',
    check: (content: string) => {
      // Verifica se não tem H2 de conclusão genérica
      const conclusionPatterns = /##\s*(conclusão|considerações finais|para finalizar|concluindo)/i;
      return !conclusionPatterns.test(content);
    },
    message: 'Evite H2 de "Conclusão". O último H2 deve conter o CTA natural.',
    severity: 'warning'
  }
];

/**
 * Valida a qualidade do artigo gerado
 * 
 * @param content - Conteúdo do artigo em Markdown
 * @param funnelMode - Modo de funil para validação de CTA
 * @returns ValidationResult com status, falhas e score
 */
export function validateArticleQuality(
  content: string,
  funnelMode: FunnelMode = 'middle'
): ValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  let passedChecks = 0;
  let criticalFailed = false;

  for (const check of QUALITY_CHECKS) {
    const passed = check.check(content, funnelMode);
    
    if (!passed) {
      if (check.severity === 'error') {
        failures.push(check.message);
        criticalFailed = true;
      } else {
        warnings.push(check.message);
      }
    } else {
      passedChecks++;
    }
  }

  const totalChecks = QUALITY_CHECKS.length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  console.log(`[QualityValidator] Score: ${score}/100 - Errors: ${failures.length}, Warnings: ${warnings.length}`);

  return {
    passed: !criticalFailed,
    failures,
    warnings,
    score,
    canRetry: failures.length <= 2 // Retry apenas se poucos erros críticos
  };
}

/**
 * Gera instruções de correção para retry baseado nas falhas
 */
export function generateCorrectionInstructions(failures: string[]): string {
  if (failures.length === 0) return '';

  return `
⚠️ O ARTIGO ANTERIOR FOI REJEITADO POR PROBLEMAS DE QUALIDADE.

CORREÇÕES OBRIGATÓRIAS ANTES DE REESCREVER:

${failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

REGRAS PARA ESTA TENTATIVA:
- NÃO comece com introduções genéricas ("No mundo de hoje...", "É comum que...")
- COMECE com uma cena real do dia a dia do leitor
- TODOS os parágrafos devem ter no máximo 3 linhas
- INCLUA um CTA em negrito alinhado ao funil
- USE frases curtas e diretas

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
