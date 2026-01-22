// ═══════════════════════════════════════════════════════════════════
// CONTENT SCORING ENGINE - Pontuação vs Mercado Real (SERP)
// ═══════════════════════════════════════════════════════════════════

import {
  SERPMatrix,
  ContentScore,
  ScoreBreakdown,
  MarketComparison,
  ArticleData,
  QualityGateResult
} from './serpTypes.ts';

/**
 * Extract article metrics from raw content
 */
export function extractArticleMetrics(content: string): {
  wordCount: number;
  h2Count: number;
  h3Count: number;
  paragraphCount: number;
  imageCount: number;
  listCount: number;
} {
  // Word count (strip HTML tags)
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
  
  // H2 count
  const h2Matches = content.match(/<h2[^>]*>|^##\s|^## /gim) || [];
  const h2Count = h2Matches.length;
  
  // H3 count
  const h3Matches = content.match(/<h3[^>]*>|^###\s|^### /gim) || [];
  const h3Count = h3Matches.length;
  
  // Paragraph count
  const paragraphMatches = content.match(/<p[^>]*>|^\n\n|\r\n\r\n/gm) || [];
  const paragraphCount = Math.max(paragraphMatches.length, Math.ceil(wordCount / 100));
  
  // Image count
  const imageMatches = content.match(/<img[^>]*>|!\[.*?\]\(.*?\)/g) || [];
  const imageCount = imageMatches.length;
  
  // List count
  const listMatches = content.match(/<ul[^>]*>|<ol[^>]*>|^[-*]\s|^\d+\.\s/gm) || [];
  const listCount = listMatches.length;
  
  return { wordCount, h2Count, h3Count, paragraphCount, imageCount, listCount };
}

/**
 * Determine status based on value vs target
 */
function getStatus(value: number, target: number, threshold: number = 0.15): 'below' | 'within' | 'above' {
  const ratio = value / target;
  if (ratio < (1 - threshold)) return 'below';
  if (ratio > (1 + threshold)) return 'above';
  return 'within';
}

/**
 * Calculate word proximity score (0-20 points)
 */
function calculateWordProximityScore(articleWords: number, marketAvg: number): { score: number; status: 'below' | 'within' | 'above' } {
  if (marketAvg === 0) return { score: 20, status: 'within' };
  
  const diff = Math.abs(articleWords - marketAvg);
  const ratio = diff / marketAvg;
  
  // Full points if within 10%, decreasing penalty up to 50% deviation
  let score = 20;
  if (ratio > 0.1) {
    score = Math.max(0, 20 - (ratio - 0.1) * 40);
  }
  
  // Bonus if above market average
  if (articleWords > marketAvg * 1.1) {
    score = Math.min(20, score + 2);
  }
  
  return { 
    score: Math.round(score * 10) / 10, 
    status: getStatus(articleWords, marketAvg, 0.1) 
  };
}

/**
 * Calculate H2 coverage score (0-15 points)
 */
function calculateH2CoverageScore(articleH2: number, marketAvg: number): { score: number; status: 'below' | 'within' | 'above' } {
  if (marketAvg === 0) return { score: 15, status: 'within' };
  
  const ratio = articleH2 / marketAvg;
  let score = Math.min(15, ratio * 15);
  
  // Cap at market average ratio of 1.2 for full points
  if (ratio >= 1.0) score = 15;
  if (ratio >= 1.2) score = 15; // Bonus already built in
  
  return { 
    score: Math.round(score * 10) / 10, 
    status: getStatus(articleH2, marketAvg, 0.2) 
  };
}

/**
 * Calculate semantic coverage score (0-20 points)
 */
function calculateSemanticCoverageScore(
  content: string, 
  commonTerms: string[]
): { score: number; percentage: number; covered: string[]; missing: string[] } {
  if (commonTerms.length === 0) {
    return { score: 20, percentage: 100, covered: [], missing: [] };
  }
  
  const contentLower = content.toLowerCase();
  const covered: string[] = [];
  const missing: string[] = [];
  
  for (const term of commonTerms) {
    if (contentLower.includes(term.toLowerCase())) {
      covered.push(term);
    } else {
      missing.push(term);
    }
  }
  
  const percentage = (covered.length / commonTerms.length) * 100;
  const score = (covered.length / commonTerms.length) * 20;
  
  return { 
    score: Math.round(score * 10) / 10, 
    percentage: Math.round(percentage), 
    covered, 
    missing 
  };
}

/**
 * Calculate intro quality score (0-10 points)
 * Checks for Answer-First pattern in first 200 words
 */
function calculateIntroQualityScore(content: string): { score: number; hasAnswerFirst: boolean } {
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plainText.split(/\s+/).slice(0, 200).join(' ');
  
  // Check for answer-first indicators
  const answerFirstPatterns = [
    /^(sim|não|a resposta|resumidamente|em resumo|de forma direta)/i,
    /é\s+(uma|um|o|a|porque|quando|como|onde)/i,
    /significa\s+/i,
    /define-se\s+como/i,
    /consiste\s+em/i
  ];
  
  const hasAnswerFirst = answerFirstPatterns.some(pattern => pattern.test(words));
  
  // Check for question hooks
  const hasQuestionHook = /\?/.test(words.substring(0, 150));
  
  let score = 5; // Base score
  if (hasAnswerFirst) score += 3;
  if (hasQuestionHook) score += 2;
  
  return { 
    score: Math.min(10, score), 
    hasAnswerFirst: hasAnswerFirst || hasQuestionHook 
  };
}

/**
 * Calculate proposition clarity score (0-10 points)
 * Checks for clear CTA and value proposition
 */
function calculatePropositionClarityScore(content: string): { score: number; hasCTA: boolean } {
  const contentLower = content.toLowerCase();
  
  // CTA patterns
  const ctaPatterns = [
    /entre em contato/i,
    /solicite (um |uma |seu )?orçamento/i,
    /agende (uma |sua )?consulta/i,
    /fale (conosco|com a gente|com nossa equipe)/i,
    /whatsapp/i,
    /ligue (agora|para)/i,
    /saiba mais/i,
    /conheça (nossos|nossas)/i,
    /peça (seu|sua|um|uma)/i
  ];
  
  const hasCTA = ctaPatterns.some(pattern => pattern.test(contentLower));
  
  // Value proposition patterns
  const valuePatterns = [
    /anos de experiência/i,
    /profissionais qualificados/i,
    /garantia/i,
    /melhor (custo|preço|qualidade)/i,
    /especialistas/i,
    /atendimento/i
  ];
  
  const hasValue = valuePatterns.some(pattern => pattern.test(contentLower));
  
  let score = 4; // Base
  if (hasCTA) score += 4;
  if (hasValue) score += 2;
  
  return { 
    score: Math.min(10, score), 
    hasCTA 
  };
}

/**
 * Calculate thematic depth score (0-15 points)
 */
function calculateThematicDepthScore(
  content: string, 
  contentGaps: string[]
): { score: number; coveredTopics: string[] } {
  const contentLower = content.toLowerCase();
  const coveredTopics: string[] = [];
  
  // Check coverage of content gaps identified in SERP
  for (const gap of contentGaps) {
    if (contentLower.includes(gap.toLowerCase())) {
      coveredTopics.push(gap);
    }
  }
  
  // Base thematic indicators
  const depthIndicators = [
    /por exemplo/i,
    /estudos mostram/i,
    /de acordo com/i,
    /segundo especialistas/i,
    /na prática/i,
    /passo a passo/i,
    /veja como/i,
    /dica importante/i
  ];
  
  const depthMatches = depthIndicators.filter(p => p.test(content)).length;
  
  let score = 5; // Base
  score += Math.min(5, coveredTopics.length * 1.5);
  score += Math.min(5, depthMatches * 1);
  
  return { 
    score: Math.min(15, Math.round(score * 10) / 10), 
    coveredTopics 
  };
}

/**
 * Calculate visual organization score (0-10 points)
 */
function calculateVisualOrganizationScore(
  imageCount: number, 
  listCount: number,
  marketAvgImages: number
): { score: number; images: number; lists: number } {
  let score = 2; // Base
  
  // Images: up to 4 points
  if (marketAvgImages > 0) {
    const imageRatio = imageCount / marketAvgImages;
    score += Math.min(4, imageRatio * 4);
  } else {
    score += Math.min(4, imageCount * 1);
  }
  
  // Lists: up to 4 points
  score += Math.min(4, listCount * 0.8);
  
  return { 
    score: Math.min(10, Math.round(score * 10) / 10), 
    images: imageCount, 
    lists: listCount 
  };
}

/**
 * Main scoring function - Calculate Content Score vs SERP
 */
export function calculateContentScore(
  article: ArticleData,
  serpMatrix: SERPMatrix | null
): ContentScore {
  // Extract metrics if not provided
  const metrics = extractArticleMetrics(article.content);
  const wordCount = article.wordCount || metrics.wordCount;
  const h2Count = article.h2Count || metrics.h2Count;
  const paragraphCount = article.paragraphCount || metrics.paragraphCount;
  const imageCount = article.imageCount || metrics.imageCount;
  
  // Default market averages if no SERP data
  const marketAvg = serpMatrix?.averages || {
    avgWords: 1500,
    avgH2: 8,
    avgH3: 4,
    avgParagraphs: 40,
    avgImages: 5,
    avgLists: 3
  };
  
  const commonTerms = serpMatrix?.commonTerms || [];
  const contentGaps = serpMatrix?.contentGaps || [];
  
  // Calculate individual scores
  const wordResult = calculateWordProximityScore(wordCount, marketAvg.avgWords);
  const h2Result = calculateH2CoverageScore(h2Count, marketAvg.avgH2);
  const semanticResult = calculateSemanticCoverageScore(article.content, commonTerms.slice(0, 15));
  const introResult = calculateIntroQualityScore(article.content);
  const propositionResult = calculatePropositionClarityScore(article.content);
  const depthResult = calculateThematicDepthScore(article.content, contentGaps);
  const visualResult = calculateVisualOrganizationScore(imageCount, metrics.listCount, marketAvg.avgImages);
  
  // Build breakdown
  const breakdown: ScoreBreakdown = {
    wordProximity: {
      score: wordResult.score,
      value: wordCount,
      target: marketAvg.avgWords,
      status: wordResult.status
    },
    h2Coverage: {
      score: h2Result.score,
      value: h2Count,
      target: marketAvg.avgH2,
      status: h2Result.status
    },
    semanticCoverage: {
      score: semanticResult.score,
      percentage: semanticResult.percentage,
      covered: semanticResult.covered,
      missing: semanticResult.missing
    },
    introQuality: {
      score: introResult.score,
      hasAnswerFirst: introResult.hasAnswerFirst
    },
    propositionClarity: {
      score: propositionResult.score,
      hasCTA: propositionResult.hasCTA
    },
    thematicDepth: {
      score: depthResult.score,
      coveredTopics: depthResult.coveredTopics
    },
    visualOrganization: {
      score: visualResult.score,
      images: visualResult.images,
      lists: visualResult.lists
    }
  };
  
  // Calculate total score
  const totalScore = Math.round(
    breakdown.wordProximity.score +
    breakdown.h2Coverage.score +
    breakdown.semanticCoverage.score +
    breakdown.introQuality.score +
    breakdown.propositionClarity.score +
    breakdown.thematicDepth.score +
    breakdown.visualOrganization.score
  );
  
  // Build market comparison
  const comparison: MarketComparison = {
    words: {
      article: wordCount,
      market: marketAvg.avgWords,
      diff: wordCount - marketAvg.avgWords,
      diffPercent: Math.round(((wordCount - marketAvg.avgWords) / marketAvg.avgWords) * 100)
    },
    h2: {
      article: h2Count,
      market: marketAvg.avgH2,
      diff: h2Count - marketAvg.avgH2,
      diffPercent: Math.round(((h2Count - marketAvg.avgH2) / marketAvg.avgH2) * 100)
    },
    paragraphs: {
      article: paragraphCount,
      market: marketAvg.avgParagraphs,
      diff: paragraphCount - marketAvg.avgParagraphs,
      diffPercent: Math.round(((paragraphCount - marketAvg.avgParagraphs) / marketAvg.avgParagraphs) * 100)
    },
    images: {
      article: imageCount,
      market: marketAvg.avgImages,
      diff: imageCount - marketAvg.avgImages,
      diffPercent: marketAvg.avgImages > 0 
        ? Math.round(((imageCount - marketAvg.avgImages) / marketAvg.avgImages) * 100)
        : 0
    }
  };
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (breakdown.wordProximity.status === 'below') {
    const needed = marketAvg.avgWords - wordCount;
    recommendations.push(`Adicione mais ${needed} palavras para atingir a média do mercado (${marketAvg.avgWords})`);
  }
  
  if (breakdown.h2Coverage.status === 'below') {
    const needed = marketAvg.avgH2 - h2Count;
    recommendations.push(`Adicione ${needed} seções H2 para melhor estruturação`);
  }
  
  if (breakdown.semanticCoverage.missing.length > 0) {
    const topMissing = breakdown.semanticCoverage.missing.slice(0, 5);
    recommendations.push(`Inclua os termos: ${topMissing.join(', ')}`);
  }
  
  if (!breakdown.introQuality.hasAnswerFirst) {
    recommendations.push('Use o padrão Answer-First na introdução');
  }
  
  if (!breakdown.propositionClarity.hasCTA) {
    recommendations.push('Adicione um CTA claro (ex: "Entre em contato")');
  }
  
  if (breakdown.visualOrganization.images < 3) {
    recommendations.push('Adicione mais imagens para quebrar o texto');
  }
  
  // Determine if meets market standards (at least 80% of metrics)
  const metricsAboveThreshold = [
    comparison.words.diffPercent >= -15,
    comparison.h2.diffPercent >= -20,
    breakdown.semanticCoverage.percentage >= 60,
    breakdown.propositionClarity.hasCTA
  ].filter(Boolean).length;
  
  const meetsMarketStandards = metricsAboveThreshold >= 3 && totalScore >= 65;
  
  return {
    total: totalScore,
    breakdown,
    comparison,
    recommendations,
    meetsMarketStandards,
    serpAnalyzed: serpMatrix !== null
  };
}

/**
 * Validate article for publication based on quality gate rules
 */
export function validateForPublication(
  article: ArticleData,
  contentScore: ContentScore,
  serpMatrix: SERPMatrix | null,
  minimumScore: number = 70
): QualityGateResult {
  const reasons: string[] = [];
  
  // RULE 1: Must have SERP analysis
  if (!serpMatrix) {
    reasons.push('BLOQUEADO: Artigo não passou por análise de concorrência SERP');
    return {
      approved: false,
      contentScore: contentScore.total,
      serpAnalyzed: false,
      meetsMarketStandards: false,
      reasons,
      minimumScore
    };
  }
  
  // RULE 2: Minimum score
  if (contentScore.total < minimumScore) {
    reasons.push(`BLOQUEADO: Content Score ${contentScore.total}/100 abaixo do mínimo (${minimumScore})`);
  }
  
  // RULE 3: Market standards check
  if (!contentScore.meetsMarketStandards) {
    const { comparison } = contentScore;
    if (comparison.words.article < comparison.words.market * 0.8) {
      reasons.push(`AVISO: Artigo tem ${comparison.words.article} palavras, mercado tem ${comparison.words.market}`);
    }
    if (comparison.h2.article < comparison.h2.market * 0.7) {
      reasons.push(`AVISO: Artigo tem ${comparison.h2.article} H2s, mercado tem ${comparison.h2.market}`);
    }
  }
  
  // RULE 4: Must have CTA
  if (!contentScore.breakdown.propositionClarity.hasCTA) {
    reasons.push('AVISO: Artigo sem CTA claro');
  }
  
  // RULE 5: Semantic coverage minimum 50%
  if (contentScore.breakdown.semanticCoverage.percentage < 50) {
    reasons.push(`AVISO: Cobertura semântica de ${contentScore.breakdown.semanticCoverage.percentage}% está abaixo de 50%`);
  }
  
  return {
    approved: reasons.length === 0 || !reasons.some(r => r.startsWith('BLOQUEADO')),
    contentScore: contentScore.total,
    serpAnalyzed: true,
    meetsMarketStandards: contentScore.meetsMarketStandards,
    reasons,
    minimumScore
  };
}
