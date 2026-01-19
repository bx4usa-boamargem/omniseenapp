import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArticleData {
  id: string;
  title: string;
  content: string | null;
  slug: string;
  excerpt: string | null;
}

interface LinkSuggestion {
  anchorText: string;
  targetArticleIndex: number;
  context: string;
  reason: string;
}

interface ProcessingResult {
  articleId: string;
  title: string;
  linksAdded: number;
  error?: string;
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { blogId } = await req.json();

    if (!blogId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: blogId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting batch internal links processing for blog: ${blogId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get blog slug
    const { data: blogData, error: blogError } = await supabase
      .from('blogs')
      .select('slug')
      .eq('id', blogId)
      .single();

    if (blogError || !blogData) {
      console.error('Blog not found:', blogError);
      return new Response(
        JSON.stringify({ error: 'Blog not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const blogSlug = blogData.slug;

    // Get all published articles
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, content, slug, excerpt')
      .eq('blog_id', blogId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (articlesError) {
      console.error('Error fetching articles:', articlesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch articles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!articles || articles.length < 2) {
      return new Response(
        JSON.stringify({ 
          success: true,
          processed: 0, 
          linksInserted: 0,
          message: 'At least 2 published articles are required for internal linking'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${articles.length} articles to process`);

    const results: ProcessingResult[] = [];
    let totalLinksInserted = 0;

    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const currentArticle = articles[i];
      
      if (!currentArticle.content) {
        console.log(`Skipping article ${currentArticle.id} - no content`);
        results.push({
          articleId: currentArticle.id,
          title: currentArticle.title,
          linksAdded: 0,
          error: 'No content'
        });
        continue;
      }

      console.log(`Processing article ${i + 1}/${articles.length}: ${currentArticle.title}`);

      // Get other articles (exclude current)
      const otherArticles = articles.filter(a => a.id !== currentArticle.id);

      try {
        // Check existing links to avoid duplicates
        const { data: existingLinks } = await supabase
          .from('article_internal_links')
          .select('target_article_id')
          .eq('source_article_id', currentArticle.id);

        const existingTargetIds = new Set(existingLinks?.map(l => l.target_article_id) || []);
        const availableTargets = otherArticles.filter(a => !existingTargetIds.has(a.id));

        if (availableTargets.length === 0) {
          console.log(`Article ${currentArticle.id} already has links to all articles`);
          results.push({
            articleId: currentArticle.id,
            title: currentArticle.title,
            linksAdded: 0
          });
          continue;
        }

        // Generate link suggestions via AI
        const prompt = `Você é um especialista em SEO e link building interno.

REGRA CRÍTICA - LEIA COM ATENÇÃO:
O "anchorText" DEVE ser uma frase que EXISTE LITERALMENTE no conteúdo do artigo atual.
Você DEVE copiar o texto EXATAMENTE como está no conteúdo abaixo.
NÃO use o título do artigo de destino como âncora.
NÃO invente texto que não existe no conteúdo.

ARTIGO ATUAL (copie o texto âncora daqui):
Título: ${currentArticle.title}
Conteúdo:
${currentArticle.content.substring(0, 3000)}

ARTIGOS DISPONÍVEIS PARA LINKAR:
${availableTargets.slice(0, 8).map((a, idx) => `${idx}. Título: "${a.title}" | Resumo: ${a.excerpt?.substring(0, 80) || 'N/A'}`).join('\n')}

TAREFA:
Encontre até 3 trechos NO CONTEÚDO ACIMA que tenham relação semântica com os artigos disponíveis.

EXEMPLO CORRETO:
- Conteúdo do artigo tem: "muitos empreendedores perdem vendas por não atender rápido"
- Artigo disponível: "Seu negócio perde vendas por não atender rápido?"
- anchorText: "perdem vendas por não atender rápido" ✅ (existe literalmente no conteúdo)

EXEMPLO ERRADO:
- anchorText: "Seu negócio perde vendas por não atender rápido?" ❌ (é o título do artigo destino, não existe no conteúdo atual)

Responda APENAS com JSON válido:
{
  "suggestions": [
    {
      "anchorText": "frase EXATA copiada do conteúdo acima",
      "targetArticleIndex": 0,
      "context": "parágrafo onde o texto aparece",
      "reason": "por que faz sentido linkar"
    }
  ]
}`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (!response.ok) {
          console.error(`AI API error for article ${currentArticle.id}`);
          results.push({
            articleId: currentArticle.id,
            title: currentArticle.title,
            linksAdded: 0,
            error: 'AI API error'
          });
          continue;
        }

        const aiResult = await response.json();
        let content = aiResult.choices?.[0]?.message?.content || '';
        
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.log(`No valid JSON in AI response for article ${currentArticle.id}`);
          results.push({
            articleId: currentArticle.id,
            title: currentArticle.title,
            linksAdded: 0,
            error: 'Invalid AI response'
          });
          continue;
        }

        const linksData = JSON.parse(jsonMatch[0]) as { suggestions: LinkSuggestion[] };
        let updatedContent = currentArticle.content;
        let linksAdded = 0;

        // Process each suggestion
        for (const suggestion of linksData.suggestions || []) {
          const targetArticle = availableTargets[suggestion.targetArticleIndex];
          if (!targetArticle) continue;

          // Validate anchor exists in content
          const anchorRegex = new RegExp(`\\b${escapeRegex(suggestion.anchorText)}\\b`, 'i');
          const match = updatedContent.match(anchorRegex);

          if (match) {
            // Create markdown link
            const linkMarkdown = `[${suggestion.anchorText}](/blog/${blogSlug}/${targetArticle.slug})`;
            
            // Replace first occurrence only
            updatedContent = updatedContent.replace(anchorRegex, linkMarkdown);

            // Record the link
            await supabase.from('article_internal_links').insert({
              source_article_id: currentArticle.id,
              target_article_id: targetArticle.id,
              anchor_text: suggestion.anchorText
            });

            linksAdded++;
            totalLinksInserted++;
            console.log(`  Added link: "${suggestion.anchorText}" -> ${targetArticle.title}`);
          } else {
            console.log(`  Anchor not found: "${suggestion.anchorText}"`);
          }
        }

        // Update article content if links were added
        if (linksAdded > 0) {
          await supabase
            .from('articles')
            .update({ content: updatedContent })
            .eq('id', currentArticle.id);
        }

        results.push({
          articleId: currentArticle.id,
          title: currentArticle.title,
          linksAdded
        });

      } catch (err) {
        console.error(`Error processing article ${currentArticle.id}:`, err);
        results.push({
          articleId: currentArticle.id,
          title: currentArticle.title,
          linksAdded: 0,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }

      // Delay to avoid rate limits
      if (i < articles.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`Batch processing complete: ${totalLinksInserted} links inserted across ${articles.length} articles`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: articles.length,
        linksInserted: totalLinksInserted,
        details: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch internal links:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
