import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinksRequest {
  articleId: string;
  clusterId?: string;
  blogId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_AI_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { articleId, clusterId, blogId }: LinksRequest = await req.json();

    if (!articleId || (!clusterId && !blogId)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: articleId and either clusterId or blogId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current article
    const { data: currentArticle, error: articleError } = await supabase
      .from('articles')
      .select('title, content, slug')
      .eq('id', articleId)
      .single();

    if (articleError || !currentArticle) {
      return new Response(
        JSON.stringify({ error: 'Article not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let otherArticlesData: Array<{
      id: string;
      title: string;
      slug: string;
      excerpt: string | null;
      isPillar?: boolean;
    }> = [];

    if (clusterId) {
      // Get other articles in the cluster
      const { data: clusterArticles } = await supabase
        .from('cluster_articles')
        .select('article_id, is_pillar')
        .eq('cluster_id', clusterId)
        .not('article_id', 'is', null)
        .neq('article_id', articleId);

      // Get article details separately
      const articleIds = clusterArticles?.map(ca => ca.article_id).filter(Boolean) || [];
      
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, slug, excerpt')
        .in('id', articleIds);

      const articlesMap = new Map(articles?.map(a => [a.id, a]) || []);
      otherArticlesData = clusterArticles
        ?.filter(ca => ca.article_id && articlesMap.has(ca.article_id))
        .map(ca => {
          const article = articlesMap.get(ca.article_id)!;
          return {
            id: article.id,
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            isPillar: ca.is_pillar,
          };
        }) || [];
    } else if (blogId) {
      // Get other published articles from the same blog
      const { data: blogArticles } = await supabase
        .from('articles')
        .select('id, title, slug, excerpt')
        .eq('blog_id', blogId)
        .eq('status', 'published')
        .neq('id', articleId)
        .limit(10);

      otherArticlesData = blogArticles?.map(a => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
      })) || [];
    }

    if (otherArticlesData.length === 0) {
      return new Response(
        JSON.stringify({ links: [], message: 'No other articles found for linking' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI to suggest internal links
    const prompt = `Você é um especialista em SEO e link building interno.

REGRA CRÍTICA - LEIA COM ATENÇÃO:
O "anchorText" DEVE ser uma frase que EXISTE LITERALMENTE no conteúdo do artigo atual.
Você DEVE copiar o texto EXATAMENTE como está no conteúdo abaixo.
NÃO use o título do artigo de destino como âncora.
NÃO invente texto que não existe no conteúdo.

ARTIGO ATUAL (copie o texto âncora daqui):
Título: ${currentArticle.title}
Conteúdo:
${currentArticle.content?.substring(0, 3000)}

ARTIGOS DISPONÍVEIS PARA LINKAR:
${otherArticlesData.map((a, i: number) => `${i}. Título: "${a.title}" | Resumo: ${a.excerpt?.substring(0, 80) || 'N/A'} ${a.isPillar ? '(Artigo Pilar)' : ''}`).join('\n')}

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

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('AI API error');
    }

    const aiResult = await response.json();
    let content = aiResult.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ links: [], error: 'Failed to parse AI response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const linksData = JSON.parse(jsonMatch[0]);

    // Map suggestions to actual articles
    const links = linksData.suggestions?.map((s: {
      anchorText: string;
      targetArticleIndex: number;
      context: string;
      reason: string;
    }) => {
      const targetArticle = otherArticlesData[s.targetArticleIndex];
      if (!targetArticle) return null;
      return {
        anchorText: s.anchorText,
        targetArticleId: targetArticle.id,
        targetTitle: targetArticle.title,
        targetSlug: targetArticle.slug,
        context: s.context,
        reason: s.reason,
      };
    }).filter(Boolean) || [];

    // Save links to cluster_articles
    if (links.length > 0) {
      await supabase
        .from('cluster_articles')
        .update({ internal_links: links })
        .eq('article_id', articleId)
        .eq('cluster_id', clusterId);
    }

    return new Response(
      JSON.stringify({ links }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating internal links:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
