import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ThemeRequest {
  niche: string;
  keywords: string[];
  existingTitles: string[];
  count?: number;
  tone?: string;
  blog_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
const { niche, keywords, existingTitles, count = 5, tone = 'professional', blog_id }: ThemeRequest = await req.json();

    if (!niche) {
      return new Response(
        JSON.stringify({ error: 'Niche is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch AI model preference from content_preferences
    let textModel = 'gemini-2.5-flash';
    if (blog_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data: prefs } = await supabase
          .from('content_preferences')
          .select('ai_model_text')
          .eq('blog_id', blog_id)
          .maybeSingle();
        
        if (prefs?.ai_model_text) {
          textModel = prefs.ai_model_text;
          console.log(`Using configured text model: ${textModel}`);
        }
      } catch (e) {
        console.warn('Could not fetch model preference:', e);
      }
    }

    const existingTitlesList = existingTitles?.length > 0 
      ? `\n\nARTIGOS JÁ PUBLICADOS (NÃO REPETIR TEMAS SIMILARES):\n${existingTitles.map(t => `- ${t}`).join('\n')}`
      : '';

    const keywordsList = keywords?.length > 0
      ? `\nPalavras-chave foco: ${keywords.join(', ')}`
      : '';

    const prompt = `
Você é um especialista em marketing de conteúdo e SEO. Sugira ${count} temas de artigos originais e estratégicos.

NICHO: ${niche}${keywordsList}
TOM: ${tone}
${existingTitlesList}

CRITÉRIOS PARA OS TEMAS:
1. Alto potencial de busca orgânica (SEO)
2. Relevância para o público-alvo do nicho
3. Ângulo único ou perspectiva diferenciada
4. Potencial de engajamento e compartilhamento
5. Conexão com dores reais do público
6. Possibilidade de incluir call-to-action

FORMATO DE RESPOSTA (JSON):
{
  "themes": [
    {
      "title": "Título do artigo otimizado para SEO",
      "hook": "Gancho emocional ou problema que o artigo resolve",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "targetAudience": "Descrição do público específico",
      "estimatedSearchVolume": "alto|médio|baixo"
    }
  ]
}

Retorne APENAS o JSON, sem markdown ou explicações.
`.trim();

    console.log(`Suggesting ${count} themes for niche: ${niche}, model: ${textModel}`);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: textModel,
        messages: [
          {
            role: 'system',
            content: 'Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, especialista em SEO e marketing de conteúdo. Sempre responda em JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Theme suggestion error:', response.status, errorText);
      
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
      
      throw new Error(`Theme suggestion failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    // Parse the JSON response
    let themes;
    try {
      // Clean potential markdown code blocks
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      themes = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse themes:', content);
      throw new Error('Invalid response format');
    }

    console.log(`Generated ${themes.themes?.length || 0} theme suggestions`);

    return new Response(
      JSON.stringify(themes),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in suggest-themes:', error);
    const message = error instanceof Error ? error.message : 'Failed to suggest themes';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
