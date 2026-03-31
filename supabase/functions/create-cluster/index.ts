import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClusterRequest {
  blogId: string;
  pillarKeyword: string;
  description?: string;
  numSatellites?: number;
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

    const { blogId, pillarKeyword, description, numSatellites = 5 }: ClusterRequest = await req.json();

    if (!blogId || !pillarKeyword) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use AI to generate cluster structure
    const prompt = `Você é um especialista em SEO e estratégia de conteúdo. Crie um cluster de conteúdo para o tema "${pillarKeyword}".

O cluster deve ter:
1. Um artigo pilar (pillar content) - guia completo e abrangente
2. ${numSatellites} artigos satélite que exploram subtópicos específicos

Para cada artigo, forneça:
- title: título otimizado para SEO
- keywords: 3-5 palavras-chave secundárias

Responda APENAS com JSON válido no formato:
{
  "pillar": {
    "title": "Título do artigo pilar",
    "keywords": ["keyword1", "keyword2", "keyword3"]
  },
  "satellites": [
    {
      "title": "Título do satélite 1",
      "keywords": ["keyword1", "keyword2"]
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
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate cluster structure' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await response.json();
    let content = aiResult.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clusterData = JSON.parse(jsonMatch[0]);

    // Create cluster in database
    const { data: cluster, error: clusterError } = await supabase
      .from('content_clusters')
      .insert({
        blog_id: blogId,
        name: pillarKeyword,
        pillar_keyword: pillarKeyword,
        description: description || `Cluster de conteúdo sobre ${pillarKeyword}`,
        status: 'planning',
      })
      .select()
      .single();

    if (clusterError) {
      console.error('Error creating cluster:', clusterError);
      return new Response(
        JSON.stringify({ error: 'Failed to create cluster' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create cluster articles
    const articles = [
      {
        cluster_id: cluster.id,
        is_pillar: true,
        suggested_title: clusterData.pillar.title,
        suggested_keywords: clusterData.pillar.keywords,
        status: 'planned',
      },
      ...clusterData.satellites.map((sat: { title: string; keywords: string[] }) => ({
        cluster_id: cluster.id,
        is_pillar: false,
        suggested_title: sat.title,
        suggested_keywords: sat.keywords,
        status: 'planned',
      })),
    ];

    const { error: articlesError } = await supabase
      .from('cluster_articles')
      .insert(articles);

    if (articlesError) {
      console.error('Error creating cluster articles:', articlesError);
    }

    // Fetch complete cluster with articles
    const { data: completeCluster } = await supabase
      .from('content_clusters')
      .select(`
        *,
        cluster_articles (*)
      `)
      .eq('id', cluster.id)
      .single();

    return new Response(
      JSON.stringify({ cluster: completeCluster }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating cluster:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
