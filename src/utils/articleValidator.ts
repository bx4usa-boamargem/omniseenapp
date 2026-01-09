// Article Validation Utilities

export interface ValidationIssue {
  type: 'critical' | 'warning' | 'suggestion';
  code: string;
  field: string;
  message: string;
  canAutoFix: boolean;
  currentValue?: string | number;
  expectedValue?: string | number;
  weight: number;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestions: string[];
  autoFixApplied: string[];
}

// Validation criteria weights
const CRITERIA_WEIGHTS = {
  H2_COUNT_MIN: 15,
  H2_COUNT_MAX: 5,
  SUMMARY_SECTION: 10,
  CTA_SECTION: 10,
  PARAGRAPH_LENGTH: 15,
  VISUAL_BLOCKS: 10,
  BLOCKQUOTE: 5,
  BULLET_LISTS: 5,
  WORD_COUNT: 10,
  KEYWORD_IN_TITLE: 5,
  META_DESCRIPTION: 5,
  FEATURED_IMAGE: 5,
};

// Generic introductions to BLOCK (Quality Gate)
const GENERIC_INTRODUCTIONS = [
  /^no mundo de hoje/i,
  /^atualmente/i,
  /^é comum que/i,
  /^nos dias atuais/i,
  /^em um mundo cada vez/i,
  /^vivemos em uma era/i,
  /^com o avanço da tecnologia/i,
  /^na sociedade moderna/i,
];

export function hasGenericIntroduction(content: string): boolean {
  const firstParagraph = content.split('\n\n').find(p => {
    const t = p.trim();
    return t && !t.startsWith('#') && !t.startsWith('-') && !t.startsWith('*') && !t.startsWith('>');
  });
  
  if (!firstParagraph) return false;
  
  return GENERIC_INTRODUCTIONS.some(pattern => pattern.test(firstParagraph.trim()));
}

export function countH2Sections(content: string): number {
  const h2Matches = content.match(/^## /gm);
  return h2Matches?.length || 0;
}

export function hasSummarySection(content: string): boolean {
  return /##\s*(Resumo|O que você aprendeu|O que vimos)/i.test(content);
}

export function hasCTASection(content: string): boolean {
  return /##\s*(Direto ao ponto|Por onde começar|Próximos passos|Seu próximo passo)/i.test(content);
}

export function findLongParagraphs(content: string): { index: number; wordCount: number; text: string }[] {
  const paragraphs = content.split('\n\n');
  const longParagraphs: { index: number; wordCount: number; text: string }[] = [];
  
  paragraphs.forEach((p, i) => {
    const trimmed = p.trim();
    // Skip headers, lists, blockquotes, and visual blocks
    if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('*') || 
        trimmed.startsWith('>') || trimmed.startsWith('💡') || trimmed.startsWith('⚠️') || 
        trimmed.startsWith('📌') || !trimmed) {
      return;
    }
    
    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > 150) {
      longParagraphs.push({ index: i, wordCount, text: trimmed.substring(0, 100) + '...' });
    }
  });
  
  return longParagraphs;
}

export function countVisualBlocks(content: string): number {
  const matches = content.match(/^(💡|⚠️|📌) /gm);
  return matches?.length || 0;
}

export function countBlockquotes(content: string): number {
  const matches = content.match(/^> /gm);
  return matches?.length || 0;
}

export function countBulletLists(content: string): number {
  const matches = content.match(/^[-*] /gm);
  return matches?.length || 0;
}

export function countWords(content: string): number {
  return content.split(/\s+/).filter(w => w.length > 0).length;
}

export function hasKeywordInTitle(title: string, keywords: string[]): boolean {
  const titleLower = title.toLowerCase();
  return keywords.some(kw => titleLower.includes(kw.toLowerCase()));
}

export function isMetaDescriptionValid(meta: string): { valid: boolean; length: number } {
  const length = meta.length;
  return { valid: length >= 140 && length <= 160, length };
}

// Auto-fix functions
export function breakLongParagraphs(content: string): string {
  const paragraphs = content.split('\n\n');
  
  const fixedParagraphs = paragraphs.map(p => {
    const trimmed = p.trim();
    // Skip non-paragraphs
    if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('*') || 
        trimmed.startsWith('>') || trimmed.startsWith('💡') || trimmed.startsWith('⚠️') || 
        trimmed.startsWith('📌') || !trimmed) {
      return p;
    }
    
    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount <= 150) {
      return p;
    }
    
    // Find natural break points (periods followed by space)
    const sentences = trimmed.split(/(?<=\.)\s+/);
    const result: string[] = [];
    let currentParagraph = '';
    let currentWordCount = 0;
    
    sentences.forEach(sentence => {
      const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0).length;
      if (currentWordCount + sentenceWords > 80 && currentParagraph) {
        result.push(currentParagraph.trim());
        currentParagraph = sentence;
        currentWordCount = sentenceWords;
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + sentence;
        currentWordCount += sentenceWords;
      }
    });
    
    if (currentParagraph) {
      result.push(currentParagraph.trim());
    }
    
    return result.join('\n\n');
  });
  
  return fixedParagraphs.join('\n\n');
}

export function ensureVisualBlocks(content: string): string {
  const currentCount = countVisualBlocks(content);
  if (currentCount >= 2) return content;
  
  // Find good places to insert visual blocks (after H2 sections)
  const h2Indices: number[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, i) => {
    if (line.startsWith('## ') && i < lines.length - 3) {
      h2Indices.push(i);
    }
  });
  
  const blocksToAdd = 2 - currentCount;
  const blockTypes = ['💡 **Dica Prática:** ', '⚠️ **Atenção:** '];
  
  let insertedCount = 0;
  for (let i = 0; i < h2Indices.length && insertedCount < blocksToAdd; i++) {
    const idx = h2Indices[i];
    // Find the first paragraph after this H2
    for (let j = idx + 1; j < lines.length && j < idx + 5; j++) {
      const line = lines[j].trim();
      if (line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
        // Insert block after this paragraph
        lines.splice(j + 1, 0, '', blockTypes[insertedCount % 2] + 'Aplique isso no seu negócio hoje.');
        insertedCount++;
        break;
      }
    }
  }
  
  return lines.join('\n');
}

export function ensureBlockquote(content: string): string {
  const currentCount = countBlockquotes(content);
  if (currentCount >= 1) return content;
  
  // Find a good place to insert a blockquote (after middle H2)
  const h2Indices: number[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      h2Indices.push(i);
    }
  });
  
  if (h2Indices.length >= 3) {
    const middleIdx = h2Indices[Math.floor(h2Indices.length / 2)];
    // Insert blockquote after this H2's first paragraph
    for (let j = middleIdx + 1; j < lines.length && j < middleIdx + 5; j++) {
      const line = lines[j].trim();
      if (line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
        lines.splice(j + 1, 0, '', '> "Quem age rápido, colhe primeiro."');
        break;
      }
    }
  }
  
  return lines.join('\n');
}

export function fixMetaDescription(meta: string, content: string): string {
  const { valid, length } = isMetaDescriptionValid(meta);
  if (valid) return meta;
  
  if (length < 140) {
    // Extract first paragraph content to extend
    const firstParagraph = content.split('\n\n').find(p => {
      const t = p.trim();
      return t && !t.startsWith('#') && !t.startsWith('-') && !t.startsWith('*') && !t.startsWith('>');
    });
    
    if (firstParagraph) {
      const combined = meta + ' ' + firstParagraph.substring(0, 160 - meta.length - 1);
      return combined.substring(0, 160);
    }
    return meta;
  }
  
  // Too long, truncate at last complete word before 160
  const truncated = meta.substring(0, 157);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace) + '...';
}

// Main validation function
export function validateArticle(
  content: string,
  title: string,
  metaDescription: string,
  keywords: string[],
  featuredImageUrl: string | null
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];
  const autoFixApplied: string[] = [];
  let score = 100;
  
  // 0. QUALITY GATE: Generic introduction check (BLOCKING)
  if (hasGenericIntroduction(content)) {
    issues.push({
      type: 'critical',
      code: 'GENERIC_INTRODUCTION',
      field: 'content',
      message: 'Introdução genérica detectada (ex: "No mundo de hoje...", "Atualmente..."). Reescreva com abertura específica.',
      canAutoFix: false,
      weight: 20,
    });
    score -= 20;
  }

  // 1. H2 Count validation
  const h2Count = countH2Sections(content);
  if (h2Count < 7) {
    issues.push({
      type: 'critical',
      code: 'H2_COUNT_LOW',
      field: 'content',
      message: `Artigo tem apenas ${h2Count} seções H2. Mínimo recomendado: 7`,
      canAutoFix: false,
      currentValue: h2Count,
      expectedValue: 7,
      weight: CRITERIA_WEIGHTS.H2_COUNT_MIN,
    });
    score -= CRITERIA_WEIGHTS.H2_COUNT_MIN;
  }
  
  if (h2Count > 12) {
    issues.push({
      type: 'warning',
      code: 'H2_COUNT_HIGH',
      field: 'content',
      message: `Artigo tem ${h2Count} seções H2. Máximo recomendado: 12`,
      canAutoFix: false,
      currentValue: h2Count,
      expectedValue: 12,
      weight: CRITERIA_WEIGHTS.H2_COUNT_MAX,
    });
    score -= CRITERIA_WEIGHTS.H2_COUNT_MAX;
  }
  
  // 2. Summary section
  if (!hasSummarySection(content)) {
    issues.push({
      type: 'critical',
      code: 'MISSING_SUMMARY',
      field: 'content',
      message: 'Falta seção "Resumo" com checklist visual dos pontos principais',
      canAutoFix: false,
      weight: CRITERIA_WEIGHTS.SUMMARY_SECTION,
    });
    score -= CRITERIA_WEIGHTS.SUMMARY_SECTION;
  }
  
  // 3. CTA section
  if (!hasCTASection(content)) {
    issues.push({
      type: 'critical',
      code: 'MISSING_CTA',
      field: 'content',
      message: 'Falta seção "Direto ao ponto" com CTA natural',
      canAutoFix: false,
      weight: CRITERIA_WEIGHTS.CTA_SECTION,
    });
    score -= CRITERIA_WEIGHTS.CTA_SECTION;
  }
  
  // 4. Paragraph length
  const longParagraphs = findLongParagraphs(content);
  if (longParagraphs.length > 0) {
    issues.push({
      type: 'warning',
      code: 'LONG_PARAGRAPHS',
      field: 'content',
      message: `${longParagraphs.length} parágrafo(s) com mais de 150 palavras`,
      canAutoFix: true,
      currentValue: longParagraphs.length,
      expectedValue: 0,
      weight: CRITERIA_WEIGHTS.PARAGRAPH_LENGTH,
    });
    score -= Math.min(CRITERIA_WEIGHTS.PARAGRAPH_LENGTH, longParagraphs.length * 3);
  }
  
  // 5. Visual blocks
  const visualBlockCount = countVisualBlocks(content);
  if (visualBlockCount < 2) {
    issues.push({
      type: 'warning',
      code: 'LOW_VISUAL_BLOCKS',
      field: 'content',
      message: `Apenas ${visualBlockCount} bloco(s) visual(is). Mínimo: 2`,
      canAutoFix: true,
      currentValue: visualBlockCount,
      expectedValue: 2,
      weight: CRITERIA_WEIGHTS.VISUAL_BLOCKS,
    });
    score -= CRITERIA_WEIGHTS.VISUAL_BLOCKS - (visualBlockCount * 5);
  }
  
  // 6. Blockquotes
  const blockquoteCount = countBlockquotes(content);
  if (blockquoteCount < 1) {
    issues.push({
      type: 'warning',
      code: 'NO_BLOCKQUOTE',
      field: 'content',
      message: 'Nenhum blockquote encontrado. Adicione ao menos 1',
      canAutoFix: true,
      currentValue: 0,
      expectedValue: 1,
      weight: CRITERIA_WEIGHTS.BLOCKQUOTE,
    });
    score -= CRITERIA_WEIGHTS.BLOCKQUOTE;
  }
  
  // 7. Bullet lists
  const bulletCount = countBulletLists(content);
  if (bulletCount < 3) {
    issues.push({
      type: 'suggestion',
      code: 'LOW_BULLETS',
      field: 'content',
      message: `Apenas ${bulletCount} item(ns) de lista. Recomendado: 3+`,
      canAutoFix: false,
      currentValue: bulletCount,
      expectedValue: 3,
      weight: CRITERIA_WEIGHTS.BULLET_LISTS,
    });
    suggestions.push('Adicione mais listas em bullet para facilitar a leitura');
    score -= Math.max(0, CRITERIA_WEIGHTS.BULLET_LISTS - bulletCount);
  }
  
  // 8. Word count
  const wordCount = countWords(content);
  if (wordCount < 1000) {
    issues.push({
      type: 'critical',
      code: 'LOW_WORD_COUNT',
      field: 'content',
      message: `Artigo tem ${wordCount} palavras. Mínimo: 1000`,
      canAutoFix: false,
      currentValue: wordCount,
      expectedValue: 1000,
      weight: CRITERIA_WEIGHTS.WORD_COUNT,
    });
    score -= CRITERIA_WEIGHTS.WORD_COUNT;
  }
  
  // 9. Keyword in title
  if (!hasKeywordInTitle(title, keywords)) {
    issues.push({
      type: 'warning',
      code: 'NO_KEYWORD_IN_TITLE',
      field: 'title',
      message: 'Nenhuma palavra-chave encontrada no título',
      canAutoFix: false,
      weight: CRITERIA_WEIGHTS.KEYWORD_IN_TITLE,
    });
    score -= CRITERIA_WEIGHTS.KEYWORD_IN_TITLE;
  }
  
  // 10. Meta description
  const { valid: metaValid, length: metaLength } = isMetaDescriptionValid(metaDescription);
  if (!metaValid) {
    issues.push({
      type: 'warning',
      code: 'INVALID_META_DESCRIPTION',
      field: 'meta_description',
      message: `Meta description tem ${metaLength} caracteres. Ideal: 140-160`,
      canAutoFix: true,
      currentValue: metaLength,
      expectedValue: 150,
      weight: CRITERIA_WEIGHTS.META_DESCRIPTION,
    });
    score -= CRITERIA_WEIGHTS.META_DESCRIPTION;
  }
  
  // 11. Featured image
  if (!featuredImageUrl) {
    issues.push({
      type: 'warning',
      code: 'NO_FEATURED_IMAGE',
      field: 'featured_image',
      message: 'Artigo não tem imagem destacada',
      canAutoFix: false,
      weight: CRITERIA_WEIGHTS.FEATURED_IMAGE,
    });
    score -= CRITERIA_WEIGHTS.FEATURED_IMAGE;
  }
  
  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));
  
  return {
    isValid: score >= 70,
    score,
    issues,
    suggestions,
    autoFixApplied,
  };
}

// Auto-fix all fixable issues
export function autoFixArticle(content: string, metaDescription: string): { 
  content: string; 
  metaDescription: string; 
  appliedFixes: string[] 
} {
  const appliedFixes: string[] = [];
  let fixedContent = content;
  let fixedMeta = metaDescription;
  
  // Fix long paragraphs
  const longParagraphs = findLongParagraphs(fixedContent);
  if (longParagraphs.length > 0) {
    fixedContent = breakLongParagraphs(fixedContent);
    appliedFixes.push(`Quebrados ${longParagraphs.length} parágrafos longos`);
  }
  
  // Fix visual blocks
  const visualBlocks = countVisualBlocks(fixedContent);
  if (visualBlocks < 2) {
    fixedContent = ensureVisualBlocks(fixedContent);
    appliedFixes.push(`Adicionados ${2 - visualBlocks} blocos visuais`);
  }
  
  // Fix blockquotes
  const blockquotes = countBlockquotes(fixedContent);
  if (blockquotes < 1) {
    fixedContent = ensureBlockquote(fixedContent);
    appliedFixes.push('Adicionado blockquote');
  }
  
  // Fix meta description
  const { valid } = isMetaDescriptionValid(fixedMeta);
  if (!valid && fixedMeta.length > 0) {
    fixedMeta = fixMetaDescription(fixedMeta, fixedContent);
    appliedFixes.push('Meta description ajustada para 140-160 caracteres');
  }
  
  return { content: fixedContent, metaDescription: fixedMeta, appliedFixes };
}
