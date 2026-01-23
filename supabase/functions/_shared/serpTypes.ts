// ═══════════════════════════════════════════════════════════════════
// SERP ANALYSIS TYPES - Motor Editorial Orientado por Mercado Real
// V2.0: Deterministic Content Engine
// ═══════════════════════════════════════════════════════════════════

/**
 * Individual competitor metrics from SERP analysis
 */
export interface SERPCompetitor {
  url: string;
  title: string;
  position: number;
  metaDescription?: string;  // V2.0: Real meta description from scraping
  metrics: {
    wordCount: number;
    h2Count: number;
    h3Count: number;
    paragraphCount: number;
    imageCount: number;
    listCount: number;
    hasSchema: boolean;
    hasFAQ: boolean;
  };
  semanticTerms: string[];
  titlePatterns: string[];
}

/**
 * V2.0: Keyword frequency tracking per term
 */
export interface KeywordFrequency {
  occurrences: number;       // How many competitors use this term
  avgFrequency: number;      // Average times per article
  positions: string[];       // Where it appears: 'title', 'h1', 'h2', 'meta', 'body'
}

/**
 * V2.0: Market ranges for deterministic comparison
 */
export interface MarketRanges {
  minWords: number;
  maxWords: number;
  minH2: number;
  maxH2: number;
  minImages: number;
  maxImages: number;
}

/**
 * V2.0: Meta patterns extracted from competitors
 */
export interface MetaPatterns {
  avgLength: number;
  commonPhrases: string[];
  descriptions: string[];    // Actual meta descriptions from competitors
}

/**
 * V2.0: Keyword presence percentages in structure elements
 */
export interface KeywordPresence {
  inTitle: number;           // % of competitors with keyword in title
  inH1: number;
  inH2: number;
  inMeta: number;
  inFirstParagraph: number;
}

/**
 * Aggregated SERP analysis matrix - V2.0 Deterministic
 */
export interface SERPMatrix {
  keyword: string;
  territory: string | null;
  analyzedAt: string;
  competitors: SERPCompetitor[];
  averages: {
    avgWords: number;
    avgH2: number;
    avgH3: number;
    avgParagraphs: number;
    avgImages: number;
    avgLists: number;
  };
  commonTerms: string[];
  topTitles: string[];
  contentGaps: string[];
  
  // V2.0: Deterministic fields
  ranges: MarketRanges;
  keywordFrequencyMap: Record<string, KeywordFrequency>;
  metaPatterns: MetaPatterns;
  keywordPresence: KeywordPresence;
  serpHash: string;          // Hash to detect SERP changes
  scrapeMethod: 'perplexity' | 'firecrawl' | 'hybrid';
}

/**
 * Content score breakdown by criteria
 */
export interface ScoreBreakdown {
  wordProximity: {
    score: number;
    value: number;
    target: number;
    status: 'below' | 'within' | 'above';
  };
  h2Coverage: {
    score: number;
    value: number;
    target: number;
    status: 'below' | 'within' | 'above';
  };
  semanticCoverage: {
    score: number;
    percentage: number;
    covered: string[];
    missing: string[];
  };
  introQuality: {
    score: number;
    hasAnswerFirst: boolean;
  };
  propositionClarity: {
    score: number;
    hasCTA: boolean;
  };
  thematicDepth: {
    score: number;
    coveredTopics: string[];
  };
  visualOrganization: {
    score: number;
    images: number;
    lists: number;
  };
}

/**
 * Market comparison metrics
 */
export interface MarketComparison {
  words: { article: number; market: number; diff: number; diffPercent: number };
  h2: { article: number; market: number; diff: number; diffPercent: number };
  paragraphs: { article: number; market: number; diff: number; diffPercent: number };
  images: { article: number; market: number; diff: number; diffPercent: number };
}

/**
 * Complete content score result
 */
export interface ContentScore {
  total: number;
  breakdown: ScoreBreakdown;
  comparison: MarketComparison;
  recommendations: string[];
  meetsMarketStandards: boolean;
  serpAnalyzed: boolean;
}

/**
 * Article data structure for scoring
 */
export interface ArticleData {
  id?: string;
  title: string;
  content: string;
  wordCount?: number;
  h2Count?: number;
  paragraphCount?: number;
  imageCount?: number;
  keywords?: string[];
}

/**
 * SERP analysis request
 */
export interface AnalyzeSERPRequest {
  keyword: string;
  territory?: string;
  blogId: string;
  forceRefresh?: boolean;
}

/**
 * Content optimization request
 */
export interface OptimizeContentRequest {
  articleId: string;
  content: string;
  serpMatrix: SERPMatrix;
  targetScore?: number;
  optimizationType: 'terms' | 'structure' | 'rewrite' | 'full';
}

/**
 * Pipeline phase log for traceability
 */
export interface PipelinePhaseLog {
  phase: 'serp_analysis' | 'research' | 'plan' | 'write' | 'compare' | 'quality_gate';
  model: string;
  source: 'PromptPy';
  tokens: { input: number; output: number };
  duration_ms: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Complete pipeline execution log
 */
export interface PipelineLog {
  request_id: string;
  blog_id: string;
  article_id?: string;
  phases: PipelinePhaseLog[];
  total_duration_ms: number;
  final_score?: number;
  serp_analyzed: boolean;
  meets_quality_gate: boolean;
}

/**
 * Quality gate validation result
 */
export interface QualityGateResult {
  approved: boolean;
  contentScore: number;
  serpAnalyzed: boolean;
  meetsMarketStandards: boolean;
  reasons: string[];
  minimumScore: number;
}

// ═══════════════════════════════════════════════════════════════════
// V2.0: Utility Functions for Deterministic Analysis
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a hash for content change detection
 */
export function generateContentHash(content: string): string {
  const normalized = content
    .replace(/<[^>]*>/g, '')     // Remove HTML
    .replace(/\s+/g, ' ')        // Normalize spaces
    .trim()
    .toLowerCase();
  
  // Simple hash for now - in production would use crypto.subtle
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a hash for SERP results change detection
 */
export function generateSerpHash(competitors: SERPCompetitor[]): string {
  const urls = competitors.map(c => c.url).sort().join('|');
  let hash = 0;
  for (let i = 0; i < urls.length; i++) {
    const char = urls.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Filter terms to only those appearing in 2+ competitors
 */
export function filterTermsByCompetitorCount(
  termMap: Record<string, KeywordFrequency>,
  minCompetitors: number = 2
): string[] {
  return Object.entries(termMap)
    .filter(([_, freq]) => freq.occurrences >= minCompetitors)
    .map(([term, _]) => term);
}

/**
 * Calculate market ranges from competitors
 */
export function calculateMarketRanges(competitors: SERPCompetitor[]): MarketRanges {
  if (competitors.length === 0) {
    return {
      minWords: 1000,
      maxWords: 3000,
      minH2: 5,
      maxH2: 15,
      minImages: 2,
      maxImages: 10
    };
  }

  const wordCounts = competitors.map(c => c.metrics.wordCount).filter(w => w > 0);
  const h2Counts = competitors.map(c => c.metrics.h2Count).filter(h => h > 0);
  const imageCounts = competitors.map(c => c.metrics.imageCount).filter(i => i >= 0);

  return {
    minWords: Math.min(...wordCounts) || 1000,
    maxWords: Math.max(...wordCounts) || 3000,
    minH2: Math.min(...h2Counts) || 5,
    maxH2: Math.max(...h2Counts) || 15,
    minImages: Math.min(...imageCounts) || 2,
    maxImages: Math.max(...imageCounts) || 10
  };
}

/**
 * Calculate keyword presence in structure elements
 */
export function calculateKeywordPresence(
  competitors: SERPCompetitor[],
  keyword: string
): KeywordPresence {
  if (competitors.length === 0) {
    return { inTitle: 0, inH1: 0, inH2: 0, inMeta: 0, inFirstParagraph: 0 };
  }

  const keywordLower = keyword.toLowerCase();
  const total = competitors.length;

  const inTitle = competitors.filter(c => 
    c.title.toLowerCase().includes(keywordLower)
  ).length;

  const inMeta = competitors.filter(c => 
    c.metaDescription?.toLowerCase().includes(keywordLower)
  ).length;

  // For H1, H2, firstParagraph we would need full content scraping
  // For now, estimate based on title patterns
  return {
    inTitle: Math.round((inTitle / total) * 100),
    inH1: Math.round((inTitle / total) * 100),  // Assume H1 ≈ Title
    inH2: Math.round((inTitle / total) * 70),   // Estimate
    inMeta: Math.round((inMeta / total) * 100),
    inFirstParagraph: Math.round((inTitle / total) * 60) // Estimate
  };
}
