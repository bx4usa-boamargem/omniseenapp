import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, targetWords = 2000 } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
// Limit input to prevent token overflow (100k chars ~ 25k tokens)
    const MAX_INPUT_CHARS = 100000;
    const truncatedText = text.length > MAX_INPUT_CHARS 
      ? text.substring(0, MAX_INPUT_CHARS) + '\n\n[...documento truncado por exceder limite de caracteres...]'
      : text;

    console.log(`Summarizing document: ${text.length} chars -> target ${targetWords} words`);

    const systemPrompt = `Você é um editor especialista em criar resumos detalhados para geração de conteúdo.

Sua tarefa é criar um resumo estruturado e completo do documento fornecido.

REGRAS IMPORTANTES:
1. O resumo deve ter aproximadamente ${targetWords} palavras
2. Preserve TODOS os dados, estatísticas, citações e fatos importantes
3. Mantenha a estrutura lógica do documento original
4. Organize o resumo em seções claras com títulos
5. Destaque os pontos principais de cada seção
6. Use bullet points para listas de informações importantes
7. Inclua exemplos e casos mencionados no documento
8. O resumo deve ser suficientemente detalhado para gerar um artigo de blog completo

FORMATO DE SAÍDA:
- Comece com um parágrafo de visão geral
- Use ## para títulos de seções
- Use • para bullet points
- Destaque termos importantes com **negrito**
- Termine com conclusões/recomendações principais`;

    const userPrompt = `Resuma o seguinte documento em ${targetWords} palavras, mantendo todos os detalhes importantes:

DOCUMENTO:
${truncatedText}`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated');
    }

    const summaryWordCount = summary.split(/\s+/).filter((w: string) => w.length > 0).length;
    console.log(`Summary generated: ${summaryWordCount} words`);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        originalWordCount: text.split(/\s+/).filter((w: string) => w.length > 0).length,
        summaryWordCount,
        wasTruncated: text.length > MAX_INPUT_CHARS
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error summarizing document:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to summarize document' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
