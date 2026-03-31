/**
 * V4.7: Background Image Generation Job with Content Injection
 * 
 * This edge function generates high-quality images asynchronously
 * after the article has been delivered with placeholders.
 * 
 * Features:
 * - Retry logic with exponential backoff (500ms, 1500ms, 3000ms)
 * - Incremental database updates after each image
 * - V4.7: Uses content_images (NOT image_prompts which doesn't exist)
 * - V4.7: Injects images into content HTML with Structure Guard
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callImageGeneration } from '../_shared/aiProviders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImagePrompt {
  context: string;
  prompt: string;
  after_section: number;
  alt?: string;
  url?: string;
  generated_by?: string;
}

interface BackgroundImageRequest {
  article_id: string;
  blog_id: string;
  request_id: string;
  image_prompts: ImagePrompt[];
  niche: string;
  city: string;
}

// Retry delays in ms (exponential backoff)
const RETRY_DELAYS = [500, 1500, 3000];

async function generateImageWithRetry(
  imgPrompt: ImagePrompt,
  niche: string,
  city: string,
  requestId: string,
  imageIndex: number
): Promise<{ url: string | null; generatedBy: string | null }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const result = await callImageGeneration({
        prompt: imgPrompt.prompt || `Professional ${imgPrompt.context} image`,
        context: imgPrompt.context,
        niche,
        city
      });
      
      if (result.success && result.data) {
        console.log(`[${requestId}][ImageJob] Image ${imageIndex}: ✅ ${result.data.generatedBy} (attempt ${attempt + 1})`);
        return { url: result.data.url, generatedBy: result.data.generatedBy };
      }
      
      lastError = new Error('Image generation returned no data');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`[${requestId}][ImageJob] Image ${imageIndex}: Attempt ${attempt + 1} failed - ${lastError.message}`);
    }
    
    // Wait before retry (if not last attempt)
    if (attempt < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[attempt];
      console.log(`[${requestId}][ImageJob] Image ${imageIndex}: Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  console.error(`[${requestId}][ImageJob] Image ${imageIndex}: ❌ All retries failed, keeping placeholder`);
  return { url: null, generatedBy: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body: BackgroundImageRequest = await req.json();
    const { article_id, blog_id, request_id, image_prompts, niche, city } = body;
    const { data: articleData } = await supabase
      .from('articles')
      .select('content')
      .eq('id', article_id)
      .maybeSingle();

    const articleWordCount = (articleData?.content || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    const maxTotalImages = articleWordCount >= 2200 ? 4 : 3;
    const limitedPrompts = image_prompts.slice(0, maxTotalImages);

    console.log(`[${request_id}][ImageJob] Starting background generation for ${limitedPrompts.length} images`);
    console.log(`[${request_id}][ImageJob] Article: ${article_id}, Niche: ${niche}, City: ${city}`);

    const startTime = Date.now();
    const totalImages = limitedPrompts.length;
    let completedImages = 0;

    // V4.7: Initialize tracking columns - NUNCA alterar generation_stage
    await supabase
      .from('articles')
      .update({ 
        images_total: totalImages,
        images_completed: 0,
        images_pending: true
        // V4.3: REMOVIDO generation_stage - artigo principal define estado
      })
      .eq('id', article_id);

    // V4.7: Generate each image with resilient loop - NUNCA abortar
    for (let i = 0; i < limitedPrompts.length; i++) {
      const imgPrompt = limitedPrompts[i];
      const imageIndex = i + 1;
      
      console.log(`[${request_id}][IMAGES LOOP] index=${imageIndex}/${totalImages}`);
      
      try {
        const result = await generateImageWithRetry(imgPrompt, niche, city, request_id, imageIndex);
        
        if (result.url) {
          imgPrompt.url = result.url;
          imgPrompt.generated_by = result.generatedBy || 'ai';
          completedImages++;
          console.log(`[${request_id}][IMAGES LOOP] ✅ Image ${imageIndex} completed`);
        } else {
          console.warn(`[${request_id}][IMAGES LOOP] ⚠️ Image ${imageIndex} no URL, keeping placeholder`);
        }
      } catch (err) {
        console.error(`[${request_id}][IMAGES LOOP] ❌ Image ${imageIndex} exception:`, err);
        // V4.3: CONTINUE - nunca abortar loop
        continue;
      }
      
      // V4.7: Convert to content_images format and update incrementally
      const contentImagesForDb = limitedPrompts
        .filter((p: ImagePrompt) => p.url)
        .map((p: ImagePrompt, idx: number) => ({
          context: p.context,
          url: p.url!,
          alt: p.alt || p.context,
          after_section: p.after_section || (idx + 1)
        }));

      console.log(`[${request_id}][IMAGES][SAVE] content_images count=${contentImagesForDb.length}`);

      // INCREMENTAL UPDATE: Update article after each image
      try {
        const { error: incrementalError } = await supabase
          .from('articles')
          .update({
            content_images: contentImagesForDb, // V4.7: Coluna correta (NOT image_prompts)
            images_completed: completedImages,
            // Update featured image if this is the first image
            ...(i === 0 && imgPrompt.url ? { featured_image_url: imgPrompt.url } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', article_id);
        
        if (incrementalError) {
          console.warn(`[${request_id}][ImageJob] Incremental update failed:`, incrementalError);
        } else {
          console.log(`[${request_id}][ImageJob] Progress: ${completedImages}/${totalImages} images completed`);
        }
      } catch (updateErr) {
        console.error(`[${request_id}][ImageJob] Incremental update exception:`, updateErr);
      }
      
      // Small delay between requests to avoid rate limiting
      if (i < limitedPrompts.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // V4.7: Build final content_images array
    const finalContentImages = limitedPrompts
      .filter((p: ImagePrompt) => p.url)
      .map((p: ImagePrompt, idx: number) => ({
        context: p.context,
        url: p.url!,
        alt: p.alt || p.context,
        after_section: p.after_section || (idx + 1)
      }));

    // Final update: Mark as complete
    const featuredUrl = limitedPrompts[0]?.url || null;
    const allCompleted = completedImages === totalImages;

    // V4.7: Final update - use content_images (NOT image_prompts)
    const { error: finalError } = await supabase
      .from('articles')
      .update({
        content_images: finalContentImages, // V4.7: Coluna correta
        featured_image_url: featuredUrl,
        images_pending: completedImages < totalImages, // V4.3: Pendente apenas se incompleto
        images_completed: completedImages,
        // V4.3: REMOVIDO generation_stage: null - background job não altera estado principal
        updated_at: new Date().toISOString()
      })
      .eq('id', article_id);

    if (finalError) {
      console.error(`[${request_id}][ImageJob] Final update failed:`, finalError);
      return new Response(JSON.stringify({ error: 'Final update failed', details: finalError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[${request_id}][PIPELINE][DONE] stage=completed progress=100`);
    console.log(`[${request_id}][ImageJob] ✅ Article ${article_id} images updated in ${duration}ms (${completedImages}/${totalImages})`);

    // Log to ai_usage_logs
    try {
      await supabase.from('ai_usage_logs').insert({
        blog_id,
        provider: 'lovable-gateway',
        endpoint: 'generate-images-background',
        success: allCompleted,
        cost_usd: 0,
        metadata: {
          article_id,
          request_id,
          images_total: totalImages,
          images_completed: completedImages,
          content_injected: contentUpdated,
          duration_ms: duration,
          all_succeeded: allCompleted
        }
      });
    } catch (_logError) {
      // Non-blocking
    }

    return new Response(JSON.stringify({ 
      success: true, 
      images_total: totalImages,
      images_completed: completedImages,
      content_injected: contentUpdated,
      all_succeeded: allCompleted,
      duration_ms: duration
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('[ImageJob] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
