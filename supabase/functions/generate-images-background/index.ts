/**
 * V4.1: Background Image Generation Job
 * 
 * This edge function generates high-quality images asynchronously
 * after the article has been delivered with placeholders.
 * 
 * Triggered when image generation times out (>5s) in the main flow.
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
    
    console.log(`[${request_id}][ImageJob] Starting background generation for ${image_prompts.length} images`);
    console.log(`[${request_id}][ImageJob] Article: ${article_id}, Niche: ${niche}, City: ${city}`);

    const startTime = Date.now();

    // Generate each image sequentially to avoid rate limits
    for (let i = 0; i < image_prompts.length; i++) {
      const imgPrompt = image_prompts[i];
      
      console.log(`[${request_id}][ImageJob] Generating image ${i + 1}/${image_prompts.length}...`);
      
      try {
        const result = await callImageGeneration({
          prompt: imgPrompt.prompt || `Professional ${imgPrompt.context} image`,
          context: imgPrompt.context,
          niche,
          city
        });
        
        if (result.success && result.data) {
          imgPrompt.url = result.data.url;
          imgPrompt.generated_by = result.data.generatedBy;
          console.log(`[${request_id}][ImageJob] Image ${i + 1}: ✅ ${result.data.generatedBy}`);
        } else {
          console.warn(`[${request_id}][ImageJob] Image ${i + 1}: ⚠️ Failed, keeping placeholder`);
        }
      } catch (imgError) {
        console.error(`[${request_id}][ImageJob] Image ${i + 1} error:`, imgError);
        // Keep existing placeholder URL
      }
      
      // Small delay between requests to avoid rate limiting
      if (i < image_prompts.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Set featured image from first prompt
    const featuredUrl = image_prompts[0]?.url || null;

    // Update article with real images
    const { error: updateError } = await supabase
      .from('articles')
      .update({
        image_prompts: image_prompts,
        featured_image_url: featuredUrl,
        images_pending: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', article_id);

    if (updateError) {
      console.error(`[${request_id}][ImageJob] Update failed:`, updateError);
      return new Response(JSON.stringify({ error: 'Update failed', details: updateError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[${request_id}][ImageJob] ✅ Article ${article_id} images updated in ${duration}ms`);

    // Log to ai_usage_logs
    try {
      await supabase.from('ai_usage_logs').insert({
        blog_id,
        provider: 'lovable-gateway',
        endpoint: 'generate-images-background',
        success: true,
        cost_usd: 0,
        metadata: {
          article_id,
          request_id,
          images_count: image_prompts.length,
          duration_ms: duration
        }
      });
    } catch (_logError) {
      // Non-blocking
    }

    return new Response(JSON.stringify({ 
      success: true, 
      images_generated: image_prompts.length,
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
