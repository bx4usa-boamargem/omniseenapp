/**
 * Shared article types — extracted from legacy streamArticle.ts
 */

export interface ImagePrompt {
  context: 'problem' | 'solution' | 'result' | 'section_1' | 'section_2' | 'section_3' | 'section_4';
  prompt: string;
  after_section: number;
  section_title?: string;
  visual_concept?: string;
}

export interface ArticleData {
  id?: string;
  title: string;
  slug?: string;
  status?: string;
  meta_description: string;
  excerpt: string;
  content: string;
  faq: Array<{ question: string; answer: string }>;
  reading_time?: number;
  image_prompts?: ImagePrompt[];
  featured_image_url?: string | null;
  content_images?: Array<{ context: string; url: string; after_section: number }>;
}

export type GenerationStage = 'analyzing' | 'generating' | 'finalizing' | null;

export type EditorialModel = 'traditional' | 'strategic' | 'visual_guided';

export type GenerationMode = 'fast' | 'deep';
