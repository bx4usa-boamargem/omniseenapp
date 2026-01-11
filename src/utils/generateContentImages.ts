import { supabase } from "@/integrations/supabase/client";
import { base64ToBlob } from "@/utils/imageUtils";
import type { ImagePrompt } from "./streamArticle";

export interface ContentImage {
  context: 'hero' | 'problem' | 'solution' | 'result' | 'section_1' | 'section_2' | 'section_3' | 'section_4';
  url: string;
  after_section: number;
}

export interface ImageGenerationProgress {
  current: number;
  total: number;
  context: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

// NEW: Contextualized Image interface for section-specific images
export interface ContextualizedImage {
  section_title: string;
  section_index: number;
  visual_concept: string;
  description: string;
  style?: string;
}

/**
 * Build a contextualized prompt for section-specific images
 */
function buildContextualizedPrompt(
  image: ImagePrompt,
  theme: string,
  niche: string
): string {
  // Check if it's a contextualized image with section details
  if (image.section_title && image.visual_concept) {
    return `Create a professional, realistic photograph for a blog article section.

ARTICLE THEME: ${theme}
SECTION: "${image.section_title}"
VISUAL CONCEPT: ${image.visual_concept}
DESCRIPTION: ${image.prompt}

STYLE REQUIREMENTS:
- Professional photography, NOT illustration
- Real people in authentic ${niche} settings
- Natural lighting, modern composition
- 16:9 aspect ratio for web
- Clean, editorial quality

DO NOT include: text, logos, watermarks, cartoons, generic stock imagery.`;
  }
  
  // Fallback to standard prompt
  return image.prompt;
}

/**
 * Generate a simplified fallback prompt based on visual concept
 */
function buildFallbackPrompt(visualConcept: string, theme: string, niche: string): string {
  return `Professional photo representing: ${visualConcept}. 
Context: ${theme}. 
Industry: ${niche}. 
Style: Modern, clean, realistic photography. 16:9 aspect ratio.`;
}

/**
 * Generate a generic fallback prompt based only on theme
 */
function buildGenericFallbackPrompt(theme: string, niche: string): string {
  return `Professional blog image about ${theme}. 
${niche} industry setting. 
Modern photography style, natural lighting. 
16:9 aspect ratio. Clean, editorial quality.`;
}

async function generateSingleImage(prompt: string, context: string, theme: string): Promise<string | null> {
  try {
    // Use supabase.functions.invoke instead of direct fetch to avoid CORS issues
    const { data, error } = await supabase.functions.invoke('generate-image', {
      body: {
        prompt,
        context,
        articleTitle: theme,
        articleTheme: theme,
      }
    });

    if (error) {
      console.error('Image generation failed:', error);
      return null;
    }

    // Return base64 data for further processing
    return data?.imageBase64 || null;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
}

/**
 * Generate image with intelligent fallback
 * Attempts contextualized prompt first, then simplified, then generic
 */
async function generateImageWithFallback(
  imagePrompt: ImagePrompt,
  theme: string,
  niche: string
): Promise<string | null> {
  const context = imagePrompt.context;
  
  // Attempt 1: Contextualized prompt (if section details available)
  if (imagePrompt.section_title && imagePrompt.visual_concept) {
    console.log(`Attempt 1: Contextualized prompt for section ${imagePrompt.section_title}`);
    const contextualizedPrompt = buildContextualizedPrompt(imagePrompt, theme, niche);
    const result = await generateSingleImage(contextualizedPrompt, context, theme);
    if (result) return result;
    console.log('Contextualized prompt failed, trying fallback...');
  }
  
  // Attempt 2: Simplified prompt based on visual_concept
  if (imagePrompt.visual_concept) {
    console.log(`Attempt 2: Fallback with visual_concept for ${context}`);
    const fallbackPrompt = buildFallbackPrompt(imagePrompt.visual_concept, theme, niche);
    const result = await generateSingleImage(fallbackPrompt, context, theme);
    if (result) return result;
    console.log('Visual concept fallback failed, trying generic...');
  }
  
  // Attempt 3: Generic prompt based on theme
  console.log(`Attempt 3: Generic fallback for ${context}`);
  const genericPrompt = buildGenericFallbackPrompt(theme, niche);
  const result = await generateSingleImage(genericPrompt, context, theme);
  if (result) return result;
  
  // Attempt 4: Original prompt as last resort
  if (imagePrompt.prompt) {
    console.log(`Attempt 4: Original prompt for ${context}`);
    return await generateSingleImage(imagePrompt.prompt, context, theme);
  }
  
  return null;
}

async function uploadImageToStorage(base64Data: string, fileName: string): Promise<string | null> {
  try {
    // Convert base64 to blob using helper to avoid prefix duplication
    const blob = await base64ToBlob(base64Data);

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('article-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('article-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

export async function generateContentImages(
  imagePrompts: ImagePrompt[],
  heroPrompt: string,
  theme: string,
  onProgress?: (progress: ImageGenerationProgress) => void,
  niche?: string
): Promise<{ heroImage: string | null; contentImages: ContentImage[] }> {
  const totalImages = 1 + imagePrompts.length; // Hero + content images
  let currentImage = 0;
  
  const contentImages: ContentImage[] = [];
  let heroImage: string | null = null;
  const detectedNiche = niche || 'business';

  // Generate hero image first
  onProgress?.({ current: 1, total: totalImages, context: 'hero', status: 'generating' });
  
  const heroBase64 = await generateSingleImage(heroPrompt, 'hero', theme);
  if (heroBase64) {
    const heroFileName = `hero-${Date.now()}.png`;
    heroImage = await uploadImageToStorage(heroBase64, heroFileName);
  }
  
  onProgress?.({ current: 1, total: totalImages, context: 'hero', status: heroImage ? 'done' : 'error' });
  currentImage++;

  // Generate content images with intelligent fallback
  for (const imagePrompt of imagePrompts) {
    onProgress?.({ 
      current: currentImage + 1, 
      total: totalImages, 
      context: imagePrompt.context, 
      status: 'generating' 
    });

    // Use intelligent fallback for content images
    const imageBase64 = await generateImageWithFallback(imagePrompt, theme, detectedNiche);
    
    if (imageBase64) {
      const fileName = `${imagePrompt.context}-${Date.now()}.png`;
      const uploadedUrl = await uploadImageToStorage(imageBase64, fileName);
      
      if (uploadedUrl) {
        contentImages.push({
          context: imagePrompt.context as ContentImage['context'],
          url: uploadedUrl,
          after_section: imagePrompt.after_section
        });
      }
    }

    onProgress?.({ 
      current: currentImage + 1, 
      total: totalImages, 
      context: imagePrompt.context, 
      status: contentImages.find(c => c.context === imagePrompt.context) ? 'done' : 'error'
    });
    
    currentImage++;
  }

  return { heroImage, contentImages };
}
