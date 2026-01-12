import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageRequest {
  prompt?: string;  // Agora opcional - será auto-gerado se ausente
  context?: 'hero' | 'cover' | 'problem' | 'pain' | 'solution' | 'result';
  articleTitle?: string;  // Principal - nome preferido
  articleTheme?: string;  // Fallback para compatibilidade
  targetAudience?: string;
  user_id?: string;
  blog_id?: string;
  article_id?: string;  // Se fornecido, faz upload e persiste no DB
}

// Generate a normalized hash for cache lookup
function generateHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Generate fallback prompt when none is provided - RESILIENTE
function buildFallbackPrompt(title: string, context: string): string {
  const contextDescriptions: Record<string, string> = {
    hero: 'imagem principal de capa profissional e impactante',
    cover: 'imagem de capa profissional e atraente',
    problem: 'ilustração visual do problema enfrentado pelo público',
    pain: 'representação da dor ou frustração causada pelo problema',
    solution: 'demonstração da solução de forma moderna e profissional',
    result: 'resultado positivo após implementar a solução'
  };

  return `Crie uma imagem fotorrealista para um artigo intitulado "${title}". 
Tipo: ${contextDescriptions[context] || 'imagem ilustrativa'}. 
Estilo: fotografia profissional, moderno, clean, sem texto, cores harmoniosas.
Aspecto: 16:9, alta qualidade, nítida e bem definida.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Starting image generation request`);

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { prompt, context, articleTitle, articleTheme, targetAudience, user_id, blog_id, article_id }: ImageRequest = await req.json();

    // Aceitar articleTitle OU articleTheme para máxima compatibilidade
    const effectiveTitle = articleTitle || articleTheme || '';
    const effectiveContext = context || 'cover';

    console.log(`[${requestId}] Request params:`, { 
      hasPrompt: !!prompt, 
      hasTitle: !!articleTitle,
      hasTheme: !!articleTheme,
      effectiveTitle: effectiveTitle.substring(0, 50),
      context: effectiveContext, 
      blog_id 
    });

    // Auto-generate prompt if missing - LÓGICA RESILIENTE
    let finalPrompt = prompt;
    
    if (!prompt || prompt.trim().length === 0) {
      if (!effectiveTitle || effectiveTitle.trim().length === 0) {
        console.error(`[${requestId}] Missing prompt, articleTitle and articleTheme`);
        return new Response(
          JSON.stringify({ 
            error: 'Não foi possível gerar a imagem',
            details: 'O artigo precisa ter um título antes de gerar imagem.',
            action: 'Adicione um título ao artigo e tente novamente.',
            code: 'MISSING_TITLE',
            requestId
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Gerar prompt automaticamente a partir do título
      finalPrompt = buildFallbackPrompt(effectiveTitle, effectiveContext);
      console.log(`[${requestId}] Auto-generated prompt from title "${effectiveTitle}": ${finalPrompt.substring(0, 100)}...`);
    }

    // Fetch AI model preference from content_preferences
    let imageModel = 'google/gemini-2.5-flash-image-preview';
    if (blog_id) {
      const { data: prefs } = await supabase
        .from('content_preferences')
        .select('ai_model_image')
        .eq('blog_id', blog_id)
        .maybeSingle();
      
      if (prefs?.ai_model_image) {
        imageModel = prefs.ai_model_image;
        console.log(`Using configured image model: ${imageModel}`);
      }
    }

    // Build enhanced prompt based on ClickOne editorial guidelines
    const contextDescriptionsMap: Record<string, string> = {
      hero: 'Uma imagem principal impactante que captura a essência do artigo',
      cover: 'Uma imagem de capa profissional e atraente para o artigo',
      problem: 'Uma cena que mostra claramente o problema enfrentado pelo público-alvo',
      pain: 'Uma representação visual da dor ou frustração causada pelo problema',
      solution: 'Uma imagem que demonstra a solução de forma profissional e moderna',
      result: 'Uma cena positiva mostrando o resultado após implementar a solução'
    };

    const enhancedPrompt = `
Crie uma imagem fotorrealista e profissional para um artigo de blog.

Tema do artigo: ${effectiveTitle}
${targetAudience ? `Público-alvo: ${targetAudience}` : ''}
Contexto visual: ${contextDescriptionsMap[effectiveContext] || effectiveContext}

Descrição específica: ${finalPrompt}

DIRETRIZES OBRIGATÓRIAS:
- Pessoas reais em contextos profissionais (não ilustrações ou caricaturas)
- Ambiente de trabalho moderno e contemporâneo
- Iluminação natural e profissional
- Expressões autênticas e situações realistas
- Cores harmoniosas que transmitam profissionalismo
- Composição equilibrada adequada para web
- Alta qualidade, nítida e bem definida
- Aspecto 16:9 para web

NÃO inclua: texto, logotipos, marcas d'água, elementos caricatos, ilustrações genéricas.
`.trim();

    // Generate cache key and check cache
    const cacheKey = `${finalPrompt}|${effectiveContext}|${effectiveTitle}`;
    const contentHash = generateHash(cacheKey);

    console.log(`[${requestId}] Checking cache for image: ${effectiveContext}, hash: ${contentHash}`);
    const { data: cacheHit } = await supabase
      .from("ai_content_cache")
      .select("*")
      .eq("cache_type", "image")
      .eq("content_hash", contentHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cacheHit) {
      console.log(`CACHE HIT for image: ${context}`);
      
      // Increment hit counter
      await supabase
        .from("ai_content_cache")
        .update({ hits: (cacheHit.hits || 0) + 1 })
        .eq("id", cacheHit.id);

      // Log cache hit
      if (user_id) {
        await supabase.from("consumption_logs").insert({
          user_id,
          blog_id: blog_id || null,
          action_type: "image_generation_cached",
          action_description: `Cached Image: ${effectiveContext}`,
          model_used: "cache",
          input_tokens: 0,
          output_tokens: 0,
          images_generated: 0,
          estimated_cost_usd: 0,
          metadata: { context: effectiveContext, articleTitle: effectiveTitle, cache_hit: true },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          imageBase64: (cacheHit.response_data as {imageBase64?: string})?.imageBase64,
          context: effectiveContext,
          from_cache: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure we use the correct model with -preview suffix for image generation
    const actualModel = 'google/gemini-2.5-flash-image-preview';
    console.log(`[${requestId}] Generating image for context: ${effectiveContext}, model: ${actualModel}`);
    console.log(`Enhanced prompt: ${enhancedPrompt.substring(0, 200)}...`);

    // Retry logic for image generation (sometimes model returns text without image)
    let imageData: string | null = null;
    let lastError: string | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: actualModel,
            messages: [
              {
                role: 'user',
                content: attempt === 1 
                  ? enhancedPrompt 
                  : `IMPORTANTE: Você DEVE gerar uma imagem. Não responda com texto, apenas gere a imagem.\n\n${enhancedPrompt}`
              }
            ],
            modalities: ['image', 'text']
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Image generation error (attempt ${attempt}):`, response.status, errorText);
          
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: 'Insufficient credits. Please add credits to continue.' }),
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          lastError = `API error: ${response.status}`;
          continue;
        }

        const data = await response.json();
        imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageData) {
          console.log(`Image generated successfully on attempt ${attempt}`);
          break;
        } else {
          lastError = `No image in response (attempt ${attempt}): ${JSON.stringify(data).substring(0, 200)}`;
          console.warn(lastError);
          
          // Wait a bit before retrying
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (fetchError) {
        lastError = `Fetch error: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}`;
        console.error(`Attempt ${attempt} failed:`, lastError);
      }
    }

    if (!imageData) {
      console.error('All attempts failed. Last error:', lastError);
      throw new Error('No image generated after multiple attempts');
    }

    const estimatedCost = 0.02;

    // === UPLOAD TO STORAGE AND PERSIST ===
    let publicUrl: string | null = null;
    let storagePath: string | null = null;
    
    // Upload to storage if we have an article_id or just generate a unique filename
    try {
      const timestamp = Date.now();
      const fileName = article_id 
        ? `${effectiveContext}-${article_id}-${timestamp}.png`
        : `${effectiveContext}-${blog_id || 'standalone'}-${timestamp}.png`;
      
      // Decode base64 and upload
      const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(fileName, imageBytes, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error(`[${requestId}] Storage upload failed:`, uploadError);
      } else {
        storagePath = uploadData.path;
        const { data: urlData } = supabase.storage
          .from('article-images')
          .getPublicUrl(uploadData.path);
        publicUrl = urlData.publicUrl;
        console.log(`[${requestId}] Image uploaded to storage: ${publicUrl}`);
      }
    } catch (uploadError) {
      console.error(`[${requestId}] Upload error:`, uploadError);
    }

    // Persist to article if article_id provided
    if (article_id && publicUrl) {
      try {
        if (effectiveContext === 'cover' || effectiveContext === 'hero') {
          // Persist cover image
          const { error: updateError } = await supabase
            .from('articles')
            .update({ 
              featured_image_url: publicUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', article_id);

          if (updateError) {
            console.error(`[${requestId}] Article update failed:`, updateError);
          } else {
            console.log(`[${requestId}] Article ${article_id} updated with featured_image_url`);
          }
        } else {
          // Persist content images (problem, solution, result, etc.)
          const { data: article } = await supabase
            .from('articles')
            .select('content_images')
            .eq('id', article_id)
            .single();
          
          const currentImages = (article?.content_images as any[]) || [];
          
          // Determine after_section based on context
          const sectionMap: Record<string, number> = {
            'problem': 1,
            'pain': 1,
            'solution': 2,
            'result': 3
          };
          
          const newImage = {
            context: effectiveContext,
            url: publicUrl,
            after_section: sectionMap[effectiveContext] || currentImages.length + 1
          };
          
          // Avoid duplicates by context
          const filteredImages = currentImages.filter(img => img.context !== effectiveContext);
          const updatedImages = [...filteredImages, newImage];
          
          const { error: updateError } = await supabase
            .from('articles')
            .update({ 
              content_images: updatedImages,
              updated_at: new Date().toISOString()
            })
            .eq('id', article_id);
          
          if (updateError) {
            console.error(`[${requestId}] Content images update failed:`, updateError);
          } else {
            console.log(`[${requestId}] Article ${article_id} content_images updated with ${effectiveContext}`);
          }
        }
      } catch (dbError) {
        console.error(`[${requestId}] DB error:`, dbError);
      }
    }

    // Log consumption if user_id provided
    if (user_id) {
      try {
        await supabase.from("consumption_logs").insert({
          user_id,
          blog_id: blog_id || null,
          action_type: "image_generation",
          action_description: `Image: ${effectiveContext} for ${effectiveTitle.substring(0, 50)}`,
          model_used: imageModel,
          input_tokens: 0,
          output_tokens: 0,
          images_generated: 1,
          estimated_cost_usd: estimatedCost,
          metadata: { context: effectiveContext, articleTitle: effectiveTitle, publicUrl },
        });
        console.log("Consumption logged for image generation");
      } catch (logError) {
        console.warn("Failed to log consumption:", logError);
      }
    }

    // Save to cache for future use
    try {
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      await supabase.from("ai_content_cache").upsert({
        cache_type: "image",
        content_hash: contentHash,
        prompt_text: cacheKey,
        response_data: { imageBase64: imageData, publicUrl },
        model_used: imageModel,
        tokens_saved: 0,
        cost_saved_usd: estimatedCost,
        blog_id: blog_id || null,
        user_id: user_id || null,
        expires_at: expiresAt.toISOString(),
        hits: 0,
      }, { onConflict: 'cache_type,content_hash' });
      console.log("Image saved to cache");
    } catch (cacheError) {
      console.warn("Failed to save to cache:", cacheError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageBase64: imageData,
        publicUrl,        // NEW: Direct storage URL
        storagePath,      // NEW: Storage path
        context: effectiveContext,
        requestId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-image:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate image';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
