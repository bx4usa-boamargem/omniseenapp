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

interface RegenerateRequest {
  article_id: string;
  regenerate_type: 'all' | 'cover' | 'internal';
}

// Calculate internal image count based on word count
function calculateInternalImageCount(wordCount: number): number {
  if (wordCount <= 1000) return 1;      // Short article
  if (wordCount <= 1500) return 2;      // Medium article
  return 3;                              // Long article (+1500)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { article_id, regenerate_type }: RegenerateRequest = await req.json();

    if (!article_id) {
      return new Response(
        JSON.stringify({ error: 'article_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch article with blog info
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select(`
        *,
        blogs (
          id,
          user_id,
          slug
        )
      `)
      .eq('id', article_id)
      .single();

    if (articleError || !article) {
      return new Response(
        JSON.stringify({ error: 'Article not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Regenerating images for article: ${article.title} (type: ${regenerate_type})`);

    // Buscar contexto do negócio para prompts mais precisos
    const { data: businessProfile } = await supabase
      .from('business_profile')
      .select('niche, company_name, target_audience')
      .eq('blog_id', article.blog_id)
      .maybeSingle();

    const businessNiche = businessProfile?.niche || 'serviços profissionais';
    const targetAudience = businessProfile?.target_audience || 'empresários e gestores';

    const wordCount = article.content?.split(/\s+/).length || 1000;
    const internalImageCount = calculateInternalImageCount(wordCount);
    let featuredImageUrl = article.featured_image_url;
    let contentImages: ContentImage[] = article.content_images || [];
    let imagesGenerated = 0;

    // Generate slug for file naming
    const slug = article.slug || article.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 50);

    // ============================================================================
    // PROMPT EDITORIAL PROFISSIONAL - DIRETOR DE FOTOGRAFIA
    // Padrão: Estilo Forbes / Harvard Business Review
    // ============================================================================

    // Regenerate cover image
    if (regenerate_type === 'all' || regenerate_type === 'cover') {
      try {
        console.log('Generating cover image with editorial prompt...');
        
        const coverPrompt = `
Você é um diretor de fotografia editorial para blogs profissionais.
Crie uma imagem fotográfica realista que represente VISUALMENTE o tema: "${article.title}"

REGRAS OBRIGATÓRIAS:
- A imagem deve ter relação direta com o artigo.
- Não gerar cenas genéricas ou "stock photo fake".
- Pessoas devem ser diferentes entre si (proibido rostos duplicados).
- Evitar simetria artificial.
- Estilo: fotografia editorial profissional (Forbes, Harvard Business Review).
- Mostrar situações reais do nicho: ${businessNiche}
- Público-alvo: ${targetAudience}

TIPO DE IMAGEM (CAPA):
Representar o tema principal do artigo de forma impactante e memorável.

A imagem deve parecer uma fotografia real capturada no mundo real, não uma ilustração artificial.
NÃO inclua: texto, logotipos, marcas d'água, elementos caricatos.
`.trim();

        const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            prompt: coverPrompt,
            context: 'cover',
            articleTitle: article.title,
            targetAudience: targetAudience
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          if (imageData.imageBase64) {
            const base64Data = imageData.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            const fileName = `${article.blog_id}/${slug}-hero-${Date.now()}.png`;
            
            const { error: uploadError } = await supabase.storage
              .from('article-images')
              .upload(fileName, binaryData, {
                contentType: 'image/png',
                upsert: false
              });

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage
                .from('article-images')
                .getPublicUrl(fileName);
              
              featuredImageUrl = publicUrlData.publicUrl;
              imagesGenerated++;
              console.log('Cover image regenerated:', featuredImageUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error regenerating cover image:', error);
      }
    }

    // Regenerate internal images
    if (regenerate_type === 'all' || regenerate_type === 'internal') {
      console.log(`Generating ${internalImageCount} internal images with editorial prompt...`);
      contentImages = [];

      // Extract H2 sections from content for context
      const h2Matches = article.content?.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
      const sections = h2Matches.map((h2: string) => h2.replace(/<[^>]*>/g, '').trim());

      // Determine image context types based on position
      const contextTypes = ['problem', 'solution', 'result'];

      for (let i = 0; i < internalImageCount; i++) {
        try {
          const sectionIndex = Math.min(i, sections.length - 1);
          const sectionContext = sections[sectionIndex] || `Seção ${i + 1}`;
          const contextType = contextTypes[i % contextTypes.length];
          
          const contextInstructions: Record<string, string> = {
            problem: 'Mostrar a dor, frustração ou dificuldade real enfrentada pelo público-alvo.',
            solution: 'Mostrar ação, organização, tecnologia ou melhoria sendo implementada.',
            result: 'Mostrar progresso, alívio, crescimento ou sucesso real e tangível.'
          };
          
          const internalPrompt = `
Você é um diretor de fotografia editorial para blogs profissionais.
Crie uma imagem fotográfica realista para a seção: "${sectionContext}"

REGRAS OBRIGATÓRIAS:
- A imagem deve ter relação direta com o artigo: "${article.title}"
- Não gerar cenas genéricas ou "stock photo fake".
- Pessoas devem ser diferentes entre si (proibido rostos duplicados).
- Evitar simetria artificial.
- Estilo: fotografia editorial profissional (Forbes, Harvard Business Review).
- Mostrar situações reais do nicho: ${businessNiche}
- Público-alvo: ${targetAudience}

TIPO DE IMAGEM (${contextType.toUpperCase()}):
${contextInstructions[contextType]}

A imagem deve parecer uma fotografia real, não uma ilustração artificial.
NÃO inclua: texto, logotipos, marcas d'água, elementos caricatos.
`.trim();

          console.log(`Generating internal image ${i + 1} (${contextType}) for: ${sectionContext}`);

          const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              prompt: internalPrompt,
              context: contextType,
              articleTitle: article.title,
              targetAudience: targetAudience
            }),
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            if (imageData.imageBase64) {
              const base64Data = imageData.imageBase64.replace(/^data:image\/\w+;base64,/, '');
              const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              
              const fileName = `${article.blog_id}/${slug}-section-${i + 1}-${Date.now()}.png`;
              
              const { error: uploadError } = await supabase.storage
                .from('article-images')
                .upload(fileName, binaryData, {
                  contentType: 'image/png',
                  upsert: false
                });

              if (!uploadError) {
                const { data: publicUrlData } = supabase.storage
                  .from('article-images')
                  .getPublicUrl(fileName);
                
                contentImages.push({
                  context: sectionContext,
                  url: publicUrlData.publicUrl,
                  after_section: Math.floor((sectionIndex + 1) * (sections.length / internalImageCount))
                });
                imagesGenerated++;
                console.log(`Internal image ${i + 1} generated:`, publicUrlData.publicUrl);
              }
            }
          }
        } catch (error) {
          console.error(`Error generating internal image ${i + 1}:`, error);
        }
      }
    }

    // Update article with new images
    const { error: updateError } = await supabase
      .from('articles')
      .update({
        featured_image_url: featuredImageUrl,
        content_images: contentImages.length > 0 ? contentImages : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', article_id);

    if (updateError) {
      throw new Error(`Failed to update article: ${updateError.message}`);
    }

    // Create notification
    await supabase
      .from('automation_notifications')
      .insert({
        user_id: article.blogs.user_id,
        blog_id: article.blog_id,
        notification_type: 'images_generated',
        title: `Imagens regeneradas`,
        message: `${imagesGenerated} imagem(ns) regenerada(s) para "${article.title}"`,
        article_id: article_id
      });

    console.log(`Successfully regenerated ${imagesGenerated} images for article ${article_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        images_generated: imagesGenerated,
        featured_image_url: featuredImageUrl,
        content_images: contentImages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in regenerate-article-images:', error);
    const message = error instanceof Error ? error.message : 'Failed to regenerate images';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
