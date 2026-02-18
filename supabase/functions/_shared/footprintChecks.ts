/**
 * FOOTPRINT CHECKS V2.0
 * Anti-commodity validation for article generation.
 * Detects structural repetition, generic headings, and similarity patterns.
 * Integrates with Quality Gate V2 for auto-mutation.
 */

// deno-lint-ignore-file no-explicit-any

// ============================================================================
// TYPES
// ============================================================================

export interface FootprintResult {
  similarity_score: number; // 0-100
  issues: FootprintIssue[];
  should_mutate: boolean;
  mutation_instructions?: MutationInstruction[];
}

export interface FootprintIssue {
  type: 'generic_heading' | 'repeated_structure' | 'repeated_blocks' | 'high_term_repetition' | 'similar_h2_pattern';
  severity: 'low' | 'medium' | 'high';
  details: string;
  affected_sections?: number[]; // H2 indices
}

export interface MutationInstruction {
  action: 'change_variant' | 'swap_block' | 'change_angle' | 'rewrite_headings';
  target?: string;
  replacement?: string;
  reason: string;
}

// ============================================================================
// HEADING BLACKLIST
// ============================================================================

const GENERIC_HEADING_PATTERNS: RegExp[] = [
  /^introdu[çc][ãa]o$/i,
  /^conclus[ãa]o$/i,
  /^considera[çc][õo]es\s+finais$/i,
  /^benef[íi]cios\s+d[eao]/i,
  /^vantagens\s+d[eao]/i,
  /^desvantagens\s+d[eao]/i,
  /^o\s+que\s+[eé]\s/i,
  /^como\s+funciona\s/i,
  /^por\s+que\s+contratar/i,
  /^quando\s+contratar/i,
  /^dicas\s+importantes?$/i,
  /^dicas\s+para\s/i,
  /^import[âa]ncia\s+d[eao]/i,
  /^principais\s+caracter[íi]sticas/i,
  /^perguntas\s+frequentes$/i,
  /^faq$/i,
  /^saiba\s+mais$/i,
  /^resumo$/i,
  /^vis[ãa]o\s+geral$/i,
  /^sobre\s+[oa]\s/i,
  /^entenda\s+[oa]\s/i,
  /^conhe[çc]a\s+[oa]\s/i,
  /^tipos\s+de\s/i,
  /^etapas\s+d[eao]/i,
];

// Protected headings that should NOT be flagged
const PROTECTED_HEADINGS = [
  /pr[óo]ximo\s+passo/i,
];

// ============================================================================
// HASH HELPERS
// ============================================================================

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

/**
 * Generate structure hash from H2 headings order
 */
export function generateStructureHash(content: string): string {
  const h2s = extractH2Headings(content);
  const normalized = h2s.map(h => 
    h.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 3) // First 3 words of each H2
      .join('_')
  ).join('|');
  return simpleHash(normalized);
}

/**
 * Extract H2 headings from markdown content
 */
function extractH2Headings(content: string): string[] {
  if (!content) return [];
  const matches = content.match(/^##\s+(.+)$/gm);
  return (matches || []).map(m => m.replace(/^##\s+/, '').trim());
}

// ============================================================================
// FOOTPRINT ANALYSIS
// ============================================================================

/**
 * Run footprint checks on article content against history
 */
export function runFootprintChecks(params: {
  content: string;
  structureHash: string;
  blocksHash: string;
  historyStructureHashes: string[];
  historyBlocksHashes: string[];
  historyH2Patterns: string[][]; // H2 headings from last N articles
  threshold?: number;
}): FootprintResult {
  const {
    content,
    structureHash,
    blocksHash,
    historyStructureHashes,
    historyBlocksHashes,
    historyH2Patterns,
    threshold = 70,
  } = params;

  const issues: FootprintIssue[] = [];
  let totalScore = 0;

  // 1. Check generic headings
  const h2s = extractH2Headings(content);
  const genericHeadings: number[] = [];
  
  for (let i = 0; i < h2s.length; i++) {
    const heading = h2s[i];
    const isProtected = PROTECTED_HEADINGS.some(p => p.test(heading));
    if (isProtected) continue;
    
    const isGeneric = GENERIC_HEADING_PATTERNS.some(p => p.test(heading));
    if (isGeneric) {
      genericHeadings.push(i);
    }
  }

  if (genericHeadings.length > 0) {
    const severity = genericHeadings.length >= 3 ? 'high' : genericHeadings.length >= 2 ? 'medium' : 'low';
    issues.push({
      type: 'generic_heading',
      severity,
      details: `${genericHeadings.length} headings genéricos detectados: ${genericHeadings.map(i => `"${h2s[i]}"`).join(', ')}`,
      affected_sections: genericHeadings,
    });
    totalScore += genericHeadings.length * 12;
  }

  // 2. Check structure hash repetition
  const structureRepeatCount = historyStructureHashes.filter(h => h === structureHash).length;
  if (structureRepeatCount > 0) {
    issues.push({
      type: 'repeated_structure',
      severity: structureRepeatCount >= 2 ? 'high' : 'medium',
      details: `Structure hash "${structureHash}" repeated ${structureRepeatCount}x in window`,
    });
    totalScore += structureRepeatCount * 15;
  }

  // 3. Check blocks hash repetition
  const blocksRepeatCount = historyBlocksHashes.filter(h => h === blocksHash).length;
  if (blocksRepeatCount > 0) {
    issues.push({
      type: 'repeated_blocks',
      severity: blocksRepeatCount >= 2 ? 'high' : 'medium',
      details: `Blocks combination "${blocksHash}" repeated ${blocksRepeatCount}x in window`,
    });
    totalScore += blocksRepeatCount * 10;
  }

  // 4. Check H2 pattern similarity with history
  if (h2s.length > 0 && historyH2Patterns.length > 0) {
    for (const historyH2s of historyH2Patterns) {
      const similarity = calculateH2Similarity(h2s, historyH2s);
      if (similarity > 0.6) {
        issues.push({
          type: 'similar_h2_pattern',
          severity: similarity > 0.8 ? 'high' : 'medium',
          details: `H2 pattern similarity: ${Math.round(similarity * 100)}% with a recent article`,
        });
        totalScore += Math.round(similarity * 25);
        break; // Only report worst match
      }
    }
  }

  // 5. Check high term repetition in content
  const repeatedTerms = findRepeatedTerms(content);
  if (repeatedTerms.length > 0) {
    issues.push({
      type: 'high_term_repetition',
      severity: repeatedTerms.length >= 5 ? 'high' : 'medium',
      details: `${repeatedTerms.length} termos com repetição excessiva: ${repeatedTerms.slice(0, 5).join(', ')}`,
    });
    totalScore += repeatedTerms.length * 5;
  }

  // Cap at 100
  const finalScore = Math.min(totalScore, 100);
  const shouldMutate = finalScore >= threshold;

  // Build mutation instructions if needed
  let mutationInstructions: MutationInstruction[] | undefined;
  if (shouldMutate) {
    mutationInstructions = buildMutationInstructions(issues);
  }

  return {
    similarity_score: finalScore,
    issues,
    should_mutate: shouldMutate,
    mutation_instructions: mutationInstructions,
  };
}

// ============================================================================
// SIMILARITY HELPERS
// ============================================================================

function calculateH2Similarity(h2sA: string[], h2sB: string[]): number {
  if (h2sA.length === 0 || h2sB.length === 0) return 0;
  
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();
  const setA = new Set(h2sA.map(normalize));
  const setB = new Set(h2sB.map(normalize));
  
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  
  return union > 0 ? intersection / union : 0;
}

function findRepeatedTerms(content: string, threshold: number = 10): string[] {
  if (!content) return [];
  
  const words = content.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);
  
  const counts: Record<string, number> = {};
  for (const w of words) {
    counts[w] = (counts[w] || 0) + 1;
  }
  
  // Common Portuguese stopwords to ignore
  const ignore = new Set(['sobre', 'quando', 'como', 'mais', 'muito', 'tambem', 'ainda', 'pode', 'podem', 'deve', 'devem', 'fazer', 'forma', 'sendo', 'entre', 'outros', 'outras', 'nosso', 'nossa', 'nossos', 'nossas', 'depois', 'antes', 'mesmo', 'mesma', 'sempre', 'ainda', 'apenas', 'melhor', 'maior', 'menor', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'empresa', 'servico', 'cliente', 'artigo', 'texto']);
  
  return Object.entries(counts)
    .filter(([word, count]) => count >= threshold && !ignore.has(word))
    .map(([word]) => word);
}

// ============================================================================
// MUTATION INSTRUCTIONS BUILDER
// ============================================================================

function buildMutationInstructions(issues: FootprintIssue[]): MutationInstruction[] {
  const instructions: MutationInstruction[] = [];

  for (const issue of issues) {
    switch (issue.type) {
      case 'generic_heading':
        instructions.push({
          action: 'rewrite_headings',
          target: issue.affected_sections?.join(','),
          reason: `Reescrever headings genéricos: ${issue.details}`,
        });
        break;
      case 'repeated_structure':
        instructions.push({
          action: 'change_variant',
          reason: `Estrutura repetida: ${issue.details}`,
        });
        break;
      case 'repeated_blocks':
        instructions.push({
          action: 'swap_block',
          reason: `Combinação de blocos repetida: ${issue.details}`,
        });
        break;
      case 'similar_h2_pattern':
        instructions.push({
          action: 'change_angle',
          reason: `Padrão H2 muito similar: ${issue.details}`,
        });
        break;
    }
  }

  return instructions;
}

/**
 * Build auto-fix prompt for sections that need rewriting
 */
export function buildAutoFixPrompt(
  mutationInstructions: MutationInstruction[],
  content: string
): string {
  const headingIssues = mutationInstructions.filter(m => m.action === 'rewrite_headings');
  
  if (headingIssues.length === 0) return '';

  const h2s = extractH2Headings(content);
  const affectedIndices = headingIssues
    .flatMap(h => (h.target || '').split(',').map(Number))
    .filter(n => !isNaN(n));

  let prompt = '\n\n## AUTO-FIX OBRIGATÓRIO: Reescrever headings genéricos\n\n';
  prompt += 'Os seguintes headings são GENÉRICOS e devem ser reescritos para serem ESPECÍFICOS à intenção do leitor:\n\n';
  
  for (const idx of affectedIndices) {
    if (h2s[idx]) {
      prompt += `- ❌ "${h2s[idx]}" → Reescrever com intenção específica\n`;
    }
  }
  
  prompt += '\nCada heading reescrito deve conter termos específicos do serviço, localidade ou situação do leitor.\n';
  
  return prompt;
}
