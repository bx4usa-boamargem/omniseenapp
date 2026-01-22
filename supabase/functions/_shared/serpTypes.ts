// ═══════════════════════════════════════════════════════════════════
// SERP ANALYSIS TYPES - Motor Editorial Orientado por Mercado Real
// ═══════════════════════════════════════════════════════════════════

/**
 * Individual competitor metrics from SERP analysis
 */
export interface SERPCompetitor {
  url: string;
  title: string;
  position: number;
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
 * Aggregated SERP analysis matrix
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
