/**
 * Content Quality Checker
 * Detects missing H1/H2, overly long blocks, and bad markdown before publishing
 */

export interface ContentQualityIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ContentQualityResult {
  score: number; // 0-100
  issues: ContentQualityIssue[];
  canPublish: boolean;
}

/**
 * Analyze article content for quality issues before publishing
 */
export function checkContentQuality(content: string, title?: string): ContentQualityResult {
  const issues: ContentQualityIssue[] = [];
  let score = 100;

  if (!content || content.trim().length < 50) {
    issues.push({ type: 'error', code: 'EMPTY_CONTENT', message: 'Conteúdo muito curto (mínimo 50 caracteres)' });
    return { score: 0, issues, canPublish: false };
  }

  // --- H1 / H2 checks ---
  const hasHtmlH1 = /<h1[\s>]/i.test(content);
  const hasHtmlH2 = /<h2[\s>]/i.test(content);
  const hasMdH1 = /^#\s+/m.test(content);
  const hasMdH2 = /^##\s+/m.test(content);
  const hasH1 = hasHtmlH1 || hasMdH1;
  const hasH2 = hasHtmlH2 || hasMdH2;

  if (!hasH1 && !hasH2) {
    issues.push({ type: 'warning', code: 'NO_HEADINGS', message: 'Artigo sem H1 ou H2. Adicione títulos para melhorar SEO e leitura.' });
    score -= 20;
  } else if (!hasH2) {
    issues.push({ type: 'warning', code: 'NO_H2', message: 'Artigo sem subtítulos (H2). Recomendamos pelo menos 2 subtítulos.' });
    score -= 10;
  }

  // Count H2s
  const h2Count = (content.match(/<h2[\s>]/gi) || []).length + (content.match(/^##\s+/gm) || []).length;
  if (h2Count === 1) {
    issues.push({ type: 'warning', code: 'FEW_H2', message: 'Apenas 1 subtítulo (H2). Recomendamos pelo menos 2 para melhor estrutura.' });
    score -= 5;
  }

  // --- Long paragraph check ---
  // Split by <p>, </p>, or double newlines
  const paragraphs = content
    .replace(/<\/?(p|div|section|article|header|footer|aside|main|nav|blockquote)[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '') // strip remaining HTML
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const longParagraphs = paragraphs.filter(p => p.length > 800);
  if (longParagraphs.length > 0) {
    issues.push({
      type: 'warning',
      code: 'LONG_PARAGRAPHS',
      message: `${longParagraphs.length} parágrafo(s) com mais de 800 caracteres. Quebre em blocos menores para melhorar a leitura.`
    });
    score -= Math.min(longParagraphs.length * 5, 15);
  }

  // --- Broken markdown detection ---
  // Headings without space after # 
  const brokenHeadings = (content.match(/^#{1,3}[^\s#]/gm) || []).length;
  if (brokenHeadings > 0) {
    issues.push({
      type: 'warning',
      code: 'BROKEN_MARKDOWN',
      message: `${brokenHeadings} cabeçalho(s) markdown sem espaço após #. Ex: "## Título" ao invés de "##Título".`
    });
    score -= 5;
  }

  // Unclosed markdown bold/italic
  const unclosedBold = content.match(/\*\*[^*]{10,}$/gm);
  if (unclosedBold && unclosedBold.length > 0) {
    issues.push({ type: 'warning', code: 'UNCLOSED_BOLD', message: 'Texto em negrito (** **) possivelmente não fechado.' });
    score -= 5;
  }

  // --- Word count check ---
  const plainText = content.replace(/<[^>]+>/g, '').replace(/[#*_~`]/g, '');
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 300) {
    issues.push({ type: 'warning', code: 'SHORT_CONTENT', message: `Artigo com apenas ${wordCount} palavras. Recomendamos pelo menos 300 para SEO.` });
    score -= 10;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues,
    canPublish: !issues.some(i => i.type === 'error'),
  };
}