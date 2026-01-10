import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface ContentImage {
  context: string;
  url: string;
  after_section: number;
}

interface ImagePrompt {
  context: string;
  prompt: string;
  after_section: number;
}

interface EditorialTemplate {
  company_name?: string;
  target_niche?: string;
  content_focus?: string;
  mandatory_structure?: Array<{ heading: string; key_message: string }>;
  title_guidelines?: string;
  tone_rules?: string;
  seo_settings?: {
    main_keyword?: string;
    secondary_keywords?: string[];
    search_intent?: string;
  };
  cta_template?: string;
  image_guidelines?: {
    cover?: string;
    internal?: string;
    style?: string;
  };
  category_default?: string;
}

// Calculate internal image count based on word count (automatic standard)
function calculateInternalImageCount(wordCount: number): number {
  if (wordCount <= 1000) return 1;      // Short article: 1 cover + 1 internal
  if (wordCount <= 1500) return 2;      // Medium article: 1 cover + 2 internal
  return 3;                              // Long article: 1 cover + 3 internal
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========== AUTENTICAÇÃO VIA X-CRON-SECRET (OBRIGATÓRIO) ==========
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  
  if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
    console.log('[AUTH] Unauthorized request - invalid or missing X-CRON-SECRET');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ========== LOGS: INÍCIO DA EXECUÇÃO ==========
  const startTime = Date.now();
  const executionId = crypto.randomUUID().slice(0, 8);
  console.log(`[${executionId}][START] Process-queue execution at ${new Date().toISOString()}`);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ========== CLEANUP: ITENS TRAVADOS > 30 MINUTOS ==========
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckItems, error: stuckError } = await supabase
      .from('article_queue')
      .update({
        status: 'failed',
        error_message: 'Timeout: geração excedeu 30 minutos',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'generating')
      .lt('updated_at', thirtyMinutesAgo)
      .select('id');

    if (stuckItems?.length) {
      console.log(`[${executionId}][CLEANUP] Marked ${stuckItems.length} stuck items as failed: ${stuckItems.map(i => i.id).join(', ')}`);
    }

    // ========== CLAIM ATÔMICO VIA RPC (FOR UPDATE SKIP LOCKED) ==========
    const { data: claimedItems, error: claimError } = await supabase
      .rpc('claim_queue_items', { p_limit: 5 });

    if (claimError) {
      throw new Error(`Failed to claim items: ${claimError.message}`);
    }

    if (!claimedItems || claimedItems.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`[${executionId}][END] No pending items. Duration: ${duration}ms`);
      return new Response(
        JSON.stringify({ 
          execution_id: executionId,
          processed: 0, 
          failed: 0,
          stuck_cleaned: stuckItems?.length || 0,
          duration_ms: duration,
          message: 'No pending items' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${executionId}][CLAIMED] ${claimedItems.length} items: ${claimedItems.map((i: {id: string}) => i.id).join(', ')}`);

    // Buscar dados do blog para os itens claimados
    const blogIds = [...new Set(claimedItems.map((i: {blog_id: string}) => i.blog_id))];
    const { data: blogs } = await supabase
      .from('blogs')
      .select('id, user_id, name, slug')
      .in('id', blogIds);

    const blogsMap = new Map(blogs?.map(b => [b.id, b]) || []);

    // Enriquecer itens com dados do blog
    const queueItems = claimedItems.map((item: any) => ({
      ...item,
      blogs: blogsMap.get(item.blog_id)
    }));

    let processed = 0;
    let failed = 0;
    const processedIds: string[] = [];
    const failedIds: string[] = [];

    for (const item of queueItems) {
      try {
        console.log(`[${executionId}] Processing queue item: ${item.id} - ${item.suggested_theme}`);

        // Get automation settings for this blog
        const { data: automation } = await supabase
          .from('blog_automation')
          .select('*')
          .eq('blog_id', item.blog_id)
          .single();

        // ========== FETCH EDITORIAL TEMPLATE AND BUSINESS PROFILE ==========
        let editorialTemplate: EditorialTemplate | null = null;

        // First try to get the default editorial template
        const { data: template } = await supabase
          .from('editorial_templates')
          .select('*')
          .eq('blog_id', item.blog_id)
          .eq('is_default', true)
          .single();

        if (template) {
          editorialTemplate = template as EditorialTemplate;
          console.log(`[${executionId}] Using editorial template: ${template.name}`);
        }

        // Fetch business profile for fallback/merge
        const { data: businessProfile } = await supabase
          .from('business_profile')
          .select('company_name, niche, tone_of_voice')
          .eq('blog_id', item.blog_id)
          .single();

        // Merge template with business profile data
        if (editorialTemplate) {
          editorialTemplate = {
            ...editorialTemplate,
            company_name: editorialTemplate.company_name || businessProfile?.company_name,
            target_niche: editorialTemplate.target_niche || businessProfile?.niche,
            tone_rules: editorialTemplate.tone_rules || businessProfile?.tone_of_voice
          };
        } else if (businessProfile) {
          // Create minimal template from business profile
          editorialTemplate = {
            company_name: businessProfile.company_name,
            target_niche: businessProfile.niche,
            tone_rules: businessProfile.tone_of_voice
          };
          console.log(`[${executionId}] Using business profile as template fallback: ${businessProfile.company_name}`);
        }

        // ========== PREPARE THEME WITH CHUNK CONTENT IF AVAILABLE ==========
        let generationTheme = item.suggested_theme;
        
        // If this is a PDF chunk, use the chunk content for richer context
        if (item.generation_source === 'pdf' && item.chunk_content) {
          const MAX_CHUNK_LENGTH = 20000; // Limit chunk content to prevent token overflow
          const chunkText = item.chunk_content.length > MAX_CHUNK_LENGTH
            ? item.chunk_content.substring(0, MAX_CHUNK_LENGTH) + '\n\n[...conteúdo truncado...]'
            : item.chunk_content;
          
          generationTheme = `Baseado na seguinte seção do documento "${item.suggested_theme}":\n\n${chunkText}`;
          console.log(`[${executionId}] Using PDF chunk content for generation (${item.chunk_content.length} chars)`);
        }

        // ========== USE STRUCTURED ARTICLE GENERATION WITH UNIVERSAL PROMPT ==========
        const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-article-structured`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            theme: generationTheme,
            keywords: item.keywords || [],
            tone: automation?.tone || 'friendly',
            category: item.blogs?.name || 'general',
            editorial_template: editorialTemplate,
            source: item.generation_source || 'form',
            blog_id: item.blog_id,
            // NOVOS CAMPOS - UNIVERSAL PROMPT TYPE OBRIGATÓRIO
            funnel_mode: item.funnel_mode || item.funnel_stage || 'top',
            article_goal: item.article_goal || (item.funnel_stage === 'bottom' ? 'converter' : item.funnel_stage === 'middle' ? 'autoridade' : 'educar')
          }),
        });

        const generateData = await generateResponse.json();

        if (!generateResponse.ok) {
          const errorCode = generateData.error || 'GENERATION_FAILED';
          const errorMsg = generateData.message || `Article generation failed: ${generateResponse.status}`;
          console.error(`[${executionId}] Article generation error: ${errorCode} - ${errorMsg}`);
          throw new Error(`${errorCode}: ${errorMsg}`);
        }

        if (!generateData.success || !generateData.article) {
          throw new Error('AI_OUTPUT_INVALID: No article in response');
        }

        const articleData = generateData.article;
        console.log(`[${executionId}] Article received: "${articleData.title}" (${articleData.content?.length || 0} chars)`);

        // Generate slug
        const slug = articleData.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .substring(0, 100);

        // ========== GENERATE AND UPLOAD FEATURED IMAGE ==========
        const placeholderImages = [
          'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=630&fit=crop',
          'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200&h=630&fit=crop',
          'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1200&h=630&fit=crop',
          'https://images.unsplash.com/photo-1557682260-96773eb01377?w=1200&h=630&fit=crop',
          'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=1200&h=630&fit=crop'
        ];
        const randomPlaceholder = placeholderImages[Math.floor(Math.random() * placeholderImages.length)];
        
        let featuredImageUrl: string = randomPlaceholder;
        let imagesGeneratedCount = 0;
        const shouldGenerateImage = automation?.generate_images !== false;
        
        if (shouldGenerateImage) {
          try {
            // Use realistic cover prompt based on niche
            const niche = editorialTemplate?.target_niche || 'service business';
            const coverPrompt = `Realistic photo style: ${niche} business owner at work, genuine expression, real workplace environment. NOT corporate stock photo. Natural lighting, authentic scene. Article topic: ${articleData.title}`;
            
            console.log(`[${executionId}] Generating featured image for article...`);
            const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                prompt: coverPrompt,
                context: 'hero',
                articleTheme: item.suggested_theme,
                targetAudience: 'business owners'
              }),
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              if (imageData.imageBase64) {
                // Upload to storage instead of storing base64 in database
                try {
                  const base64Data = imageData.imageBase64.replace(/^data:image\/\w+;base64,/, '');
                  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  
                  const fileName = `${item.blog_id}/${slug}-hero-${Date.now()}.png`;
                  
                  const { error: uploadError } = await supabase.storage
                    .from('article-images')
                    .upload(fileName, binaryData, {
                      contentType: 'image/png',
                      upsert: false
                    });

                  if (uploadError) {
                    console.error(`[${executionId}] Failed to upload image to storage:`, uploadError);
                    console.log(`[${executionId}] Using placeholder image as fallback`);
                  } else {
                    const { data: publicUrlData } = supabase.storage
                      .from('article-images')
                      .getPublicUrl(fileName);
                    
                    featuredImageUrl = publicUrlData.publicUrl;
                    imagesGeneratedCount++;
                    console.log(`[${executionId}] Featured image uploaded successfully: ${featuredImageUrl}`);
                  }
                } catch (uploadError) {
                  console.error(`[${executionId}] Error processing image upload:`, uploadError);
                  console.log(`[${executionId}] Using placeholder image as fallback`);
                }
              } else {
                console.log(`[${executionId}] No image in response, using placeholder`);
              }
            } else {
              const errText = await imageResponse.text();
              console.error(`[${executionId}] Image generation failed:`, imageResponse.status, errText);
              console.log(`[${executionId}] Using placeholder image as fallback`);
            }
          } catch (imageError) {
            console.error(`[${executionId}] Error generating featured image:`, imageError);
            console.log(`[${executionId}] Using placeholder image as fallback`);
          }
        } else {
          console.log(`[${executionId}] Image generation disabled, using placeholder`);
        }

        // ========== GENERATE CONTENT IMAGES ==========
        const contentImages: ContentImage[] = [];
        let imagePrompts: ImagePrompt[] = articleData.image_prompts || [];
        
        // Calculate expected internal images based on word count
        const wordCount = articleData.content?.split(/\s+/).length || 1000;
        const expectedInternalImages = calculateInternalImageCount(wordCount);
        console.log(`[${executionId}] Article has ${wordCount} words, expecting ${expectedInternalImages} internal images`);

        // If we don't have enough image prompts from AI, generate them based on H2 sections
        if (shouldGenerateImage && imagePrompts.length < expectedInternalImages) {
          const h2Matches = articleData.content?.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
          const sections = h2Matches.map((h2: string) => h2.replace(/<[^>]*>/g, '').trim());
          
          for (let i = imagePrompts.length; i < expectedInternalImages && i < sections.length; i++) {
            const niche = editorialTemplate?.target_niche || 'professional services';
            imagePrompts.push({
              context: sections[i] || `Section ${i + 1}`,
              prompt: `Realistic photo: ${sections[i] || 'professional setting'}. Related to ${niche}. Authentic, natural lighting.`,
              after_section: i + 1
            });
          }
        }

        if (shouldGenerateImage && imagePrompts.length > 0) {
          // Limit to expected number of internal images
          const imagesToGenerate = imagePrompts.slice(0, expectedInternalImages);
          console.log(`[${executionId}] Generating ${imagesToGenerate.length} content images...`);
          
          for (const imgPrompt of imagesToGenerate) {
            try {
              console.log(`[${executionId}] Generating image for context: ${imgPrompt.context}`);
              
              const contentImageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  prompt: imgPrompt.prompt,
                  context: imgPrompt.context,
                  articleTheme: item.suggested_theme,
                  targetAudience: 'business owners'
                }),
              });

              if (contentImageResponse.ok) {
                const contentImageData = await contentImageResponse.json();
                
                if (contentImageData.imageBase64) {
                  // Upload to storage
                  const base64Data = contentImageData.imageBase64.replace(/^data:image\/\w+;base64,/, '');
                  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  
                  const contentFileName = `${item.blog_id}/${slug}-${imgPrompt.context.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
                  
                  const { error: contentUploadError } = await supabase.storage
                    .from('article-images')
                    .upload(contentFileName, binaryData, {
                      contentType: 'image/png',
                      upsert: false
                    });

                  if (!contentUploadError) {
                    const { data: contentPublicUrl } = supabase.storage
                      .from('article-images')
                      .getPublicUrl(contentFileName);
                    
                    contentImages.push({
                      context: imgPrompt.context,
                      url: contentPublicUrl.publicUrl,
                      after_section: imgPrompt.after_section
                    });
                    
                    imagesGeneratedCount++;
                    console.log(`[${executionId}] Content image ${imgPrompt.context} uploaded: ${contentPublicUrl.publicUrl}`);
                  } else {
                    console.error(`[${executionId}] Failed to upload ${imgPrompt.context} image:`, contentUploadError);
                  }
                }
              } else {
                console.error(`[${executionId}] Failed to generate ${imgPrompt.context} image: HTTP ${contentImageResponse.status}`);
              }
            } catch (contentImgError) {
              console.error(`[${executionId}] Failed to generate ${imgPrompt.context} image:`, contentImgError);
              // Continue with other images, don't fail the whole article
            }
          }
          
          console.log(`[${executionId}] Generated ${contentImages.length} of ${expectedInternalImages} expected content images`);
        }

        // Check for auto_publish setting
        const shouldPublish = automation?.auto_publish !== false;

        // Insert the article
        const { data: article, error: insertError } = await supabase
          .from('articles')
          .insert({
            blog_id: item.blog_id,
            title: articleData.title,
            slug: `${slug}-${Date.now()}`,
            content: articleData.content,
            excerpt: articleData.excerpt || articleData.meta_description || '',
            meta_description: articleData.meta_description || articleData.excerpt || '',
            faq: articleData.faq || [],
            keywords: item.keywords || [],
            featured_image_url: featuredImageUrl,
            content_images: contentImages.length > 0 ? contentImages : null,
            status: shouldPublish ? 'published' : 'draft',
            published_at: shouldPublish ? new Date().toISOString() : null,
            reading_time: articleData.reading_time || Math.ceil(articleData.content?.split(' ').length / 200) || 5
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`DB_INSERT_FAILED: ${insertError.message}`);
        }

        // Update queue item to completed
        await supabase
          .from('article_queue')
          .update({
            status: shouldPublish ? 'published' : 'generated',
            article_id: article.id,
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        // Update usage tracking
        const currentMonth = new Date().toISOString().substring(0, 7) + '-01';
        
        // Create automation notification
        await supabase
          .from('automation_notifications')
          .insert({
            user_id: item.blogs.user_id,
            blog_id: item.blog_id,
            notification_type: shouldPublish ? 'article_published' : 'article_generated',
            title: shouldPublish ? 'Artigo publicado!' : 'Artigo gerado',
            message: `"${articleData.title}" ${shouldPublish ? 'foi publicado automaticamente' : 'está pronto para revisão'}. ${imagesGeneratedCount} imagem(ns) gerada(s).`,
            article_id: article.id
          });
        
        // First try to get existing record
        const { data: existingUsage } = await supabase
          .from('usage_tracking')
          .select('id, articles_generated, images_generated')
          .eq('user_id', item.blogs.user_id)
          .eq('month', currentMonth)
          .single();

        if (existingUsage) {
          // Update existing record
          await supabase
            .from('usage_tracking')
            .update({
              articles_generated: (existingUsage.articles_generated || 0) + 1,
              images_generated: (existingUsage.images_generated || 0) + imagesGeneratedCount,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUsage.id);
        } else {
          // Insert new record
          await supabase
            .from('usage_tracking')
            .insert({
              user_id: item.blogs.user_id,
              month: currentMonth,
              articles_generated: 1,
              images_generated: imagesGeneratedCount
            });
        }

        console.log(`[${executionId}] Successfully processed: ${item.id} -> Article: ${article.id} (${imagesGeneratedCount} images generated)`);
        processed++;
        processedIds.push(item.id);

      } catch (itemError: unknown) {
        console.error(`[${executionId}] Failed to process item ${item.id}:`, itemError);
        const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
        
        // Create failure notification
        if (item.blogs?.user_id) {
          await supabase
            .from('automation_notifications')
            .insert({
              user_id: item.blogs.user_id,
              blog_id: item.blog_id,
              notification_type: 'automation_failed',
              title: 'Falha na automação',
              message: `Erro ao gerar "${item.suggested_theme}". Será reprocessado automaticamente.`
            });
        }
        
        // Update queue item with error
        await supabase
          .from('article_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        failed++;
        failedIds.push(item.id);
      }
    }

    // ========== LOGS: FIM DA EXECUÇÃO ==========
    const duration = Date.now() - startTime;
    console.log(`[${executionId}][END] Summary:
  - Duration: ${duration}ms
  - Processed: ${processed} [${processedIds.join(', ')}]
  - Failed: ${failed} [${failedIds.join(', ')}]
  - Stuck cleaned: ${stuckItems?.length || 0}`);

    return new Response(
      JSON.stringify({
        execution_id: executionId,
        processed,
        failed,
        processed_ids: processedIds,
        failed_ids: failedIds,
        stuck_cleaned: stuckItems?.length || 0,
        duration_ms: duration,
        message: `Processed ${processed} articles, ${failed} failed`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error(`[${executionId}][ERROR] Process queue failed:`, error);
    const message = error instanceof Error ? error.message : 'Failed to process queue';
    return new Response(
      JSON.stringify({ 
        execution_id: executionId,
        error: message,
        duration_ms: duration
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
