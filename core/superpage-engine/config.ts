/**
 * Superpage Engine — Default pipeline configuration per content type
 */

import type { ContentType, PipelineConfig } from './types';

export const DEFAULT_CONFIG: Record<ContentType, PipelineConfig> = {
  super_page: {
    contentType: 'super_page',
    wordCountMin: 1800,
    wordCountMax: 3000,
    generateSectionImages: true,
    maxSectionImages: 7,
    runSeoScore: true,
    publishAfterSave: false,
  },
  article: {
    contentType: 'article',
    wordCountMin: 1500,
    wordCountMax: 3000,
    generateSectionImages: true,
    maxSectionImages: 5,
    runSeoScore: true,
    publishAfterSave: false,
  },
};

export function getConfig(contentType: ContentType, overrides?: Partial<PipelineConfig>): PipelineConfig {
  const base = DEFAULT_CONFIG[contentType];
  return overrides ? { ...base, ...overrides } : base;
}
