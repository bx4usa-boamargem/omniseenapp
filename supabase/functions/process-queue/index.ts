import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Processing article queue...');

    // Get pending queue items scheduled for now or earlier
    const { data: queueItems, error: queueError } = await supabase
      .from('article_queue')
      .select(`
        *,
        blogs (
          id,
          user_id,
          name,
          slug
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(5);

    if (queueError) {
      throw new Error(`Failed to fetch queue: ${queueError.message}`);
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending items in queue');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending items' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${queueItems.length} items to process`);

    let processed = 0;
    let failed = 0;

    for (const item of queueItems) {
      try {
        // Update status to generating (prevents duplicate processing)
        const { error: updateError } = await supabase
          .from('article_queue')
          .update({ status: 'generating', updated_at: new Date().toISOString() })
          .eq('id', item.id)
          .eq('status', 'pending'); // Only update if still pending

        if (updateError) {
          console.log(`Item ${item.id} already being processed, skipping`);
          continue;
        }

        console.log(`Processing queue item: ${item.id} - ${item.suggested_theme}`);

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
          console.log(`Using editorial template: ${template.name}`);
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
          console.log(`Using business profile as template fallback: ${businessProfile.company_name}`);
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
          console.log(`Using PDF chunk content for generation (${item.chunk_content.length} chars)`);
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
            funnel_mode: item.funnel_stage || 'top',
            article_goal: item.funnel_stage === 'bottom' ? 'converter' : item.funnel_stage === 'middle' ? 'autoridade' : 'educar'
          }),
        });

        const generateData = await generateResponse.json();

        if (!generateResponse.ok) {
          const errorCode = generateData.error || 'GENERATION_FAILED';
          const errorMsg = generateData.message || `Article generation failed: ${generateResponse.status}`;
          console.error(`Article generation error: ${errorCode} - ${errorMsg}`);
          throw new Error(`${errorCode}: ${errorMsg}`);
        }

        if (!generateData.success || !generateData.article) {
          throw new Error('AI_OUTPUT_INVALID: No article in response');
        }

        const articleData = generateData.article;
        console.log(`Article received: "${articleData.title}" (${articleData.content?.length || 0} chars)`);

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
            
            console.log('Generating featured image for article...');
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
                    console.error('Failed to upload image to storage:', uploadError);
                    console.log('Using placeholder image as fallback');
                  } else {
                    const { data: publicUrlData } = supabase.storage
                      .from('article-images')
                      .getPublicUrl(fileName);
                    
                    featuredImageUrl = publicUrlData.publicUrl;
                    imagesGeneratedCount++;
                    console.log('Featured image uploaded successfully:', featuredImageUrl);
                  }
                } catch (uploadError) {
                  console.error('Error processing image upload:', uploadError);
                  console.log('Using placeholder image as fallback');
                }
              } else {
                console.log('No image in response, using placeholder');
              }
            } else {
              const errText = await imageResponse.text();
              console.error('Image generation failed:', imageResponse.status, errText);
              console.log('Using placeholder image as fallback');
            }
          } catch (imageError) {
            console.error('Error generating featured image:', imageError);
            console.log('Using placeholder image as fallback');
          }
        } else {
          console.log('Image generation disabled, using placeholder');
        }

        // ========== GENERATE CONTENT IMAGES ==========
        const contentImages: ContentImage[] = [];
        let imagePrompts: ImagePrompt[] = articleData.image_prompts || [];
        
        // Calculate expected internal images based on word count
        const wordCount = articleData.content?.split(/\s+/).length || 1000;
        const expectedInternalImages = calculateInternalImageCount(wordCount);
        console.log(`Article has ${wordCount} words, expecting ${expectedInternalImages} internal images`);

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
          console.log(`Generating ${imagesToGenerate.length} content images...`);
          
          for (const imgPrompt of imagesToGenerate) {
            try {
              console.log(`Generating image for context: ${imgPrompt.context}`);
              
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
                    console.log(`Content image ${imgPrompt.context} uploaded: ${contentPublicUrl.publicUrl}`);
                  } else {
                    console.error(`Failed to upload ${imgPrompt.context} image:`, contentUploadError);
                  }
                }
              } else {
                console.error(`Failed to generate ${imgPrompt.context} image: HTTP ${contentImageResponse.status}`);
              }
            } catch (contentImgError) {
              console.error(`Failed to generate ${imgPrompt.context} image:`, contentImgError);
              // Continue with other images, don't fail the whole article
            }
          }
          
          console.log(`Generated ${contentImages.length} of ${expectedInternalImages} expected content images`);
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
            error_message: null
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

        console.log(`Successfully processed: ${item.id} -> Article: ${article.id} (${imagesGeneratedCount} images generated)`);
        processed++;

      } catch (itemError: unknown) {
        console.error(`Failed to process item ${item.id}:`, itemError);
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
            error_message: errorMessage
          })
          .eq('id', item.id);

        failed++;
      }
    }

    console.log(`Queue processing complete. Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        processed,
        failed,
        message: `Processed ${processed} articles, ${failed} failed`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in process-queue:', error);
    const message = error instanceof Error ? error.message : 'Failed to process queue';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
