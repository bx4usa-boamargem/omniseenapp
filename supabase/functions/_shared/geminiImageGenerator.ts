/**
 * Geração de imagens com Gemini Image Generation (API Direta)
 * Fallback: Picsum (Unsplash substituído)
 *
 * Usa modelo: gemini-2.5-flash via Google AI Studio API direta
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 *
 * ZERO dependência do Lovable AI Gateway.
 */

import { generateImage, type ImageResult as OmniImageResult } from './omniseen-ai.ts';

export interface ImageGenerationResult {
  url: string;
  generated_by: 'gemini_image' | 'unsplash_fallback';
  base64?: string;
  mimeType?: string;
}

export async function generateImageWithGemini(
  prompt: string,
  context: string,
  niche: string,
  city: string
): Promise<ImageGenerationResult> {

  console.log('[GeminiImage] Attempting to generate image...');
  console.log('[GeminiImage] Prompt:', prompt.substring(0, 100) + '...');

  const enhancedPrompt = `Professional business photography: ${prompt}.
Context: ${context} service in ${city}.
Industry: ${niche}.
Style: High-quality, photorealistic, modern, professional lighting.
16:9 aspect ratio for web.`;

  const result: OmniImageResult = await generateImage(enhancedPrompt);

  if (result.success && result.url) {
    console.log('[GeminiImage] ✅ Image generated successfully');
    return {
      url: result.url,
      generated_by: result.model === 'picsum-fallback' ? 'unsplash_fallback' : 'gemini_image',
      base64: result.base64,
      mimeType: result.mimeType,
    };
  }

  console.warn('[GeminiImage] ⚠️ Failed, using Picsum fallback');
  return generateUnsplashFallback(niche, city, context);
}

function generateUnsplashFallback(
  niche: string,
  city: string,
  context: string
): ImageGenerationResult {
  const seed = `${niche}-${city}-${context}-${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '');
  const url = `https://picsum.photos/seed/${seed}/1024/576`;

  console.log('[GeminiImage] Picsum fallback URL generated');

  return {
    url,
    generated_by: 'unsplash_fallback'
  };
}

/**
 * Generate images for all prompts in an article
 * Returns article with URLs populated in image_prompts
 */
export async function generateArticleImages(
  // deno-lint-ignore no-explicit-any
  article: any,
  niche: string,
  city: string
// deno-lint-ignore no-explicit-any
): Promise<any> {
  if (!Array.isArray(article.image_prompts) || article.image_prompts.length === 0) {
    console.log('[Images] No image prompts to generate');
    return article;
  }

  console.log(`[Images] Starting generation for ${article.image_prompts.length} images...`);

  for (let i = 0; i < article.image_prompts.length; i++) {
    const imgPrompt = article.image_prompts[i];

    console.log(`[Images] Generating ${i + 1}/${article.image_prompts.length}...`);

    const result = await generateImageWithGemini(
      imgPrompt.prompt || `Professional ${imgPrompt.context || 'business'} image`,
      imgPrompt.context || 'business',
      niche,
      city
    );

    imgPrompt.url = result.url;
    imgPrompt.generated_by = result.generated_by;

    const status = result.generated_by === 'gemini_image' ? '✅ Gemini' : '⚠️ Picsum';
    console.log(`[Images] Image ${i + 1}: ${status}`);

    if (i < article.image_prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (!article.featured_image_url && article.image_prompts[0]) {
    article.featured_image_url = article.image_prompts[0].url;
    console.log('[Images] Featured image set from first image prompt');
  }

  console.log(`[Images] ✅ All ${article.image_prompts.length} images have URLs`);

  return article;
}
