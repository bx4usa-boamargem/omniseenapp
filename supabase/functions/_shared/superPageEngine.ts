/**
 * Super Page Engine — Quality gate thresholds and constants
 * Block publish when below these.
 */

export const QUALITY_GATE = {
  /** Minimum entity coverage score (0-100). Below = block publish. */
  ENTITY_COVERAGE_MIN: 60,
  /** Minimum word count for article.
   *  Set to 800 so articles targeting 1500 words pass without inflation. */
  WORD_COUNT_MIN_ARTICLE: 800,
  /** Minimum word count for super_page. */
  WORD_COUNT_MIN_SUPER_PAGE: 2500,
  /** Minimum FAQ items. */
  FAQ_MIN_ITEMS: 3,
  /** Minimum content/semantic score (0-100). Below = block publish. */
  SEMANTIC_SCORE_MIN: 50,
} as const;

export type ContentType = 'article' | 'super_page';

export function getMinWordCount(contentType: ContentType): number {
  return contentType === 'super_page' ? QUALITY_GATE.WORD_COUNT_MIN_SUPER_PAGE : QUALITY_GATE.WORD_COUNT_MIN_ARTICLE;
}
