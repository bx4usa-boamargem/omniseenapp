import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeywordRequest {
  blogId: string;
  keyword: string;
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

    const { blogId, keyword }: KeywordRequest = await req.json();

    if (!blogId || !keyword) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use AI to analyze keyword with QUALITATIVE analysis only
    const prompt = `Você é um especialista em SEO. Analise a palavra-chave "${keyword}" para o mercado brasileiro.

IMPORTANTE: NÃO invente números de volume de busca ou dificuldade. Forneça apenas análise QUALITATIVA.

Forneça uma análise com:
1. Classificação de competitividade: "baixa", "média" ou "alta"
2. Justificativa da competitividade (1-2 frases)
3. Intenção de busca: "informacional", "transacional" ou "navegacional"
4. 5-8 palavras-chave relacionadas (variações, long-tail, sinônimos)
5. 3 sugestões de títulos de artigos otimizados para SEO
6. 3-5 dicas de conteúdo (o que incluir no artigo)

Responda APENAS com JSON válido:
{
  "competitiveness": "média",
  "competitivenessReason": "É um tema popular com muitos conteúdos existentes, mas há espaço para abordagens diferenciadas.",
  "searchIntent": "informacional",
  "suggestions": [
    { "keyword": "palavra relacionada 1", "type": "related" },
    { "keyword": "como fazer X", "type": "long_tail" }
  ],
  "titleSuggestions": [
    "Título sugerido 1",
    "Título sugerido 2",
    "Título sugerido 3"
  ],
  "contentTips": [
    "Inclua exemplos práticos e passo a passo",
    "Adicione estatísticas recentes do mercado",
    "Responda às principais dúvidas dos usuários"
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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI API error');
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

    const analysisData = JSON.parse(jsonMatch[0]);

    // Save analysis to database (without fake numeric data)
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('keyword_analyses')
      .insert({
        blog_id: blogId,
        keyword: keyword,
        difficulty: null, // No longer inventing this
        search_volume: null, // No longer inventing this
        suggestions: analysisData.suggestions,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving analysis:', saveError);
    }

    return new Response(
      JSON.stringify({
        analysis: {
          keyword,
          competitiveness: analysisData.competitiveness,
          competitivenessReason: analysisData.competitivenessReason,
          searchIntent: analysisData.searchIntent,
          suggestions: analysisData.suggestions,
          titleSuggestions: analysisData.titleSuggestions,
          contentTips: analysisData.contentTips,
        },
        saved: savedAnalysis,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing keyword:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
