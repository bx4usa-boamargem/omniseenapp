import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArticleRequest {
  theme: string;
  keywords?: string[];
  tone: 'formal' | 'casual' | 'technical' | 'friendly';
  category?: string;
}

const buildPrompt = (request: ArticleRequest): string => {
  const keywordsText = request.keywords?.length 
    ? `Palavras-chave principais para SEO: ${request.keywords.join(', ')}.` 
    : '';
  
  const toneDescriptions: Record<string, string> = {
    formal: 'Tom formal e profissional, adequado para conteúdo corporativo.',
    casual: 'Tom casual e acessível, como uma conversa entre amigos.',
    technical: 'Tom técnico e detalhado, para audiência especializada.',
    friendly: 'Tom amigável e envolvente, fácil de ler.',
  };

  return `Você é um especialista em criação de conteúdo SEO para blogs em português brasileiro.

TAREFA: Criar um artigo completo e otimizado para SEO sobre o tema: "${request.theme}"

${keywordsText}
${request.category ? `Categoria do artigo: ${request.category}` : ''}
${toneDescriptions[request.tone]}

ESTRUTURA OBRIGATÓRIA DO ARTIGO:
1. TÍTULO (H1): Crie um título atraente e otimizado para SEO (máximo 60 caracteres)
2. META DESCRIPTION: Uma descrição para SEO (máximo 160 caracteres)
3. EXCERPT: Resumo atraente do artigo (máximo 200 caracteres)
4. CONTEÚDO: Artigo completo com 1500-2000 palavras incluindo:
   - Introdução engajadora (2-3 parágrafos)
   - 4-6 seções com subtítulos H2
   - Subseções H3 quando apropriado
   - Listas e bullet points para facilitar leitura
   - Conclusão com call-to-action
5. FAQ: 3-5 perguntas frequentes relacionadas ao tema

REGRAS DE SEO:
- Use as palavras-chave naturalmente no texto
- Inclua a palavra-chave principal no título, primeiro parágrafo e conclusão
- Use variações das palavras-chave ao longo do texto
- Crie subtítulos informativos e atrativos
- Parágrafos curtos (máximo 4 linhas)

FORMATO DE RESPOSTA (JSON):
{
  "title": "Título do artigo",
  "meta_description": "Meta description para SEO",
  "excerpt": "Resumo do artigo",
  "content": "Conteúdo completo em Markdown com headings H2 e H3",
  "faq": [
    {"question": "Pergunta 1?", "answer": "Resposta 1"},
    {"question": "Pergunta 2?", "answer": "Resposta 2"}
  ]
}

IMPORTANTE: Responda APENAS com o JSON, sem texto adicional antes ou depois.`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('AI service not configured');
    }

    const body: ArticleRequest & { blog_id?: string } = await req.json();
    console.log('Generating article for theme:', body.theme);

    if (!body.theme || body.theme.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Theme is required and must be at least 3 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch AI model preference from content_preferences
    let textModel = 'google/gemini-2.5-flash';
    if (body.blog_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && supabaseKey) {
          const response = await fetch(`${supabaseUrl}/rest/v1/content_preferences?blog_id=eq.${body.blog_id}&select=ai_model_text`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            }
          });
          const prefs = await response.json();
          if (prefs?.[0]?.ai_model_text) {
            textModel = prefs[0].ai_model_text;
            console.log(`Using configured text model: ${textModel}`);
          }
        }
      } catch (e) {
        console.warn('Could not fetch model preference:', e);
      }
    }

    const prompt = buildPrompt(body);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: textModel,
        messages: [
          { role: 'system', content: 'Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, especializada em criação de conteúdo SEO otimizado. Data de referência: Janeiro de 2026. Todos os dados, tendências e referências devem ser contextualizados para esta data. Sempre responda em JSON válido.' },
          { role: 'user', content: prompt }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error('AI Gateway error:', status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('AI service error');
    }

    console.log('Streaming response from AI Gateway');
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Error in generate-article:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao gerar artigo' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
