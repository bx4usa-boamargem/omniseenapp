/**
 * Geração de imagens com Gemini Image Generation (Lovable AI Gateway)
 * Fallback: Unsplash
 * 
 * Usa modelo: google/gemini-2.5-flash-image via Lovable AI Gateway
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 */

const LOVABLE_AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export interface ImageGenerationResult {
  url: string;
  generated_by: 'gemini_image' | 'unsplash_fallback';
}

export async function generateImageWithGemini(
  prompt: string,
  context: string,
  niche: string,
  city: string
): Promise<ImageGenerationResult> {
  
  console.log('[GeminiImage] Attempting to generate image...');
  console.log('[GeminiImage] Prompt:', prompt.substring(0, 100) + '...');
  
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    console.warn('[GeminiImage] ⚠️ No LOVABLE_API_KEY found, using Unsplash fallback');
    return generateUnsplashFallback(niche, city, context);
  }

  try {
    // Construir prompt otimizado para Gemini Image
    const enhancedPrompt = `Professional business photography: ${prompt}. 
Context: ${context} service in ${city}. 
Industry: ${niche}.
Style: High-quality, photorealistic, modern, professional lighting. 
16:9 aspect ratio for web.
CRITICAL RULE: The image must contain ZERO text of any kind — no words, no letters, no numbers, no titles, no captions, no labels, no banners, no overlays, no watermarks, no logos, no signage, no typography whatsoever. Pure visual photography only.`;

    const response = await fetch(LOVABLE_AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GeminiImage] ❌ API Error:', response.status, errorText.substring(0, 200));
      
      // Handle rate limits gracefully
      if (response.status === 429 || response.status === 402) {
        console.warn('[GeminiImage] Rate limited or payment required, using fallback');
        return generateUnsplashFallback(niche, city, context);
      }
      
      throw new Error(`Gemini Image API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Extract image URL from response
    // Format: choices[0].message.images[0].image_url.url
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (imageUrl) {
      console.log('[GeminiImage] ✅ Image generated successfully');
      return { 
        url: imageUrl, 
        generated_by: 'gemini_image' 
      };
    }

    console.warn('[GeminiImage] ⚠️ No image URL in response, using fallback');
  } catch (error) {
    console.error('[GeminiImage] ❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    console.log('[GeminiImage] Using Unsplash fallback');
  }

  // Fallback: Unsplash
  return generateUnsplashFallback(niche, city, context);
}

function generateUnsplashFallback(
  niche: string, 
  city: string, 
  context: string
): ImageGenerationResult {
  // Use picsum.photos as functional placeholder (source.unsplash.com is deprecated)
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

  // Generate images sequentially to avoid rate limits
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
    
    const status = result.generated_by === 'gemini_image' ? '✅ Gemini' : '⚠️ Unsplash';
    console.log(`[Images] Image ${i + 1}: ${status}`);
    
    // Small delay between requests to avoid rate limiting
    if (i < article.image_prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Garantir featured_image_url (hero image)
  if (!article.featured_image_url && article.image_prompts[0]) {
    article.featured_image_url = article.image_prompts[0].url;
    console.log('[Images] Featured image set from first image prompt');
  }

  console.log(`[Images] ✅ All ${article.image_prompts.length} images have URLs`);
  
  return article;
}
