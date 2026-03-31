/**
 * Super Page Engine — Quality gate thresholds and constants
 * Block publish when below these.
 */

export const QUALITY_GATE = {
  /** Minimum entity coverage score (0-100). Below = block publish. */
  ENTITY_COVERAGE_MIN: 50,
  /** Minimum FAQ items. */
  FAQ_MIN_ITEMS: 3,
  /** Minimum content/semantic score (0-100). Below = block publish. */
  SEMANTIC_SCORE_MIN: 40,
} as const;

export type ContentType = 'article' | 'super_page';

/**
 * Dynamic min word count: 75% of target_words (respects user choice).
 * Falls back to legacy defaults only when target_words is missing.
 */
export function getMinWordCount(contentType: ContentType, targetWords?: number): number {
  if (targetWords && targetWords > 0) {
    return Math.round(targetWords * 0.75);
  }
  // Legacy fallback (should rarely be used)
  return contentType === 'super_page' ? 2000 : 800;
}

/**
 * Compute dynamic word range from user's target_words.
 * Returns { min, max } with ±15% tolerance.
 */
export function computeWordRange(targetWords: number): { min: number; max: number } {
  const min = Math.round(targetWords * 0.85);
  const max = Math.round(targetWords * 1.15);
  return { min, max };
}

/**
 * Compute recommended outline size based on target_words.
 */
export function computeOutlineSize(targetWords: number): { minH2: number; maxH2: number; maxH3PerH2: number } {
  if (targetWords <= 1200) return { minH2: 3, maxH2: 5, maxH3PerH2: 2 };
  if (targetWords <= 1800) return { minH2: 4, maxH2: 6, maxH3PerH2: 2 };
  if (targetWords <= 2500) return { minH2: 5, maxH2: 8, maxH3PerH2: 3 };
  return { minH2: 6, maxH2: 10, maxH3PerH2: 4 };
}
