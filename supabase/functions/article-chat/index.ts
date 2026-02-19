import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  blogId: string;
  generateArticle?: boolean;
}

// ========================================================================
// ARTICLE CHAT - INTERFACE DE ENTRADA PARA O MOTOR UNIVERSAL
// ========================================================================
// O chat NÃO é um motor de geração. Ele é apenas uma interface.
// Quando o usuário pede um artigo, o chat DELEGA para o pipeline universal.
// ========================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, blogId, generateArticle }: ChatRequest = await req.json();

    if (!blogId) {
      return new Response(
        JSON.stringify({ error: 'blogId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch business profile for context
    const { data: businessProfile } = await supabase
      .from('business_profile')
      .select('*')
      .eq('blog_id', blogId)
      .single();

    const businessContext = businessProfile ? `
Contexto do Negócio:
- Empresa: ${businessProfile.company_name || 'Não informado'}
- Nicho: ${businessProfile.niche || 'Não informado'}
- Público-alvo: ${businessProfile.target_audience || 'Não informado'}
- Tom de voz: ${businessProfile.tone_of_voice || 'profissional'}
- Palavras-chave da marca: ${businessProfile.brand_keywords?.join(', ') || 'Não informado'}
- Descrição: ${businessProfile.long_description || 'Não informado'}
` : '';

    // ========================================================================
    // SE generateArticle = true → DELEGAR PARA O PIPELINE UNIVERSAL
    // ========================================================================
    if (generateArticle) {
      console.log('[CHAT→UNIVERSAL] Delegating article generation to universal pipeline');
      
      // Extrair tema da conversa
      const theme = extractThemeFromMessages(messages);
      console.log(`[CHAT→UNIVERSAL] Extracted theme: "${theme}"`);
      
      // Buscar dados GEO antes de delegar
      const { data: territory } = await supabase
        .from('territories')
        .select('id, official_name, lat, lng, neighborhood_tags')
        .eq('blog_id', blogId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      // Buscar artigos existentes para links internos
      const { data: existingArticles } = await supabase
        .from('articles')
        .select('title, slug')
        .eq('blog_id', blogId)
        .eq('status', 'published')
        .limit(5);

      const internalLinks = existingArticles?.map(a => ({
        title: a.title,
        url: `/blog/${a.slug}`
      })) || [];

      // ENGINE V1: Delegate to create-generation-job → orchestrate-generation
      console.log('[CHAT→ENGINE_V1] Delegating article generation to Engine v1');
      
      const jobResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-generation-job`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: theme,
          blog_id: blogId,
          city: territory?.official_name || '',
          niche: businessProfile?.niche || 'default',
          country: 'BR',
          language: 'pt-BR',
          job_type: 'article',
          intent: 'informational',
          target_words: 2500,
          image_count: 4,
        }),
      });

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json().catch(() => ({}));
        console.error('[CHAT→ENGINE_V1] Job creation error:', errorData);
        
        if (jobResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(errorData.error || 'Failed to create generation job');
      }

      const jobResult = await jobResponse.json();
      console.log(`[CHAT→ENGINE_V1] Job created: ${jobResult.job_id}`);

      return new Response(
        JSON.stringify({ 
          type: 'job_created',
          job_id: jobResult.job_id,
          message: 'Artigo sendo gerado pelo Engine v1. Acompanhe o progresso na dashboard.',
          source: 'engine_v1',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // FLUXO DE CHAT NORMAL (Conversa para coletar informações)
    // ========================================================================
    const systemPrompt = `Você é a OMNISEEN AI, a assistente virtual inteligente da plataforma OMNISEEN, especializada em criação de artigos para blogs.
Quando perguntada quem você é, responda: "Sou a OMNISEEN AI, sua assistente de criação de conteúdo! Vou te ajudar a criar artigos incríveis."

🤖 IDENTIDADE:
- Nome: OMNISEEN AI
- Função: Assistente de Criação de Conteúdo da OMNISEEN
- Personalidade: Criativa, prestativa e especialista em conteúdo

${businessContext}

FLUXO DA CONVERSA:
1. Se apresente brevemente como OMNISEEN AI na primeira mensagem
2. Pergunte sobre o TEMA principal do artigo
3. Pergunte sobre o PÚBLICO-ALVO específico 
4. Pergunte sobre o TOM desejado (profissional, descontraído, técnico, etc.)
5. Pergunte sobre PONTOS-CHAVE que devem ser abordados
6. Confirme as informações e ofereça gerar o artigo

REGRAS:
- Sempre se identifique como OMNISEEN AI quando perguntada
- Seja amigável e objetivo
- Faça uma pergunta por vez
- Sugira opções quando apropriado
- Use o contexto do negócio para fazer sugestões relevantes
- Quando tiver todas as informações, indique que está pronto para gerar

Se o usuário pedir para gerar o artigo, responda com um JSON no formato:
{"ready_to_generate": true, "article_data": {"theme": "...", "audience": "...", "tone": "...", "keyPoints": ["..."], "keywords": ["..."]}}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
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
          JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI API error');
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    // Check if response contains ready_to_generate
    let isReadyToGenerate = false;
    let articleData = null;

    try {
      const jsonMatch = content.match(/\{[\s\S]*"ready_to_generate"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.ready_to_generate) {
          isReadyToGenerate = true;
          articleData = parsed.article_data;
        }
      }
    } catch {
      // Not a JSON response, that's fine
    }

    return new Response(
      JSON.stringify({ 
        type: 'message',
        message: content,
        isReadyToGenerate,
        articleData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in article-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========================================================================
// HELPER: Extrai o tema principal da conversa do chat
// ========================================================================
function extractThemeFromMessages(messages: ChatMessage[]): string {
  // Buscar mensagens do usuário em ordem reversa
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content);
  
  if (userMessages.length === 0) {
    return 'Artigo sobre o negócio';
  }

  // Buscar JSON com article_data se existir
  for (const msg of userMessages) {
    try {
      const jsonMatch = msg.match(/\{[\s\S]*"theme"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.theme) {
          return parsed.theme;
        }
      }
    } catch {
      // Continue
    }
  }

  // Buscar a mensagem mais longa ou a mais recente que pareça um tema
  const themeIndicators = /sobre|artigo|escreva|crie|gere|quero|preciso|tema/i;
  
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const msg = userMessages[i];
    if (themeIndicators.test(msg) && msg.length > 10) {
      // Limpar e retornar
      return msg
        .replace(/^(quero|preciso|gere|crie|escreva)\s+(um\s+)?(artigo\s+)?(sobre\s+)?/i, '')
        .trim()
        .substring(0, 200);
    }
  }

  // Fallback: última mensagem do usuário
  return userMessages[userMessages.length - 1]?.substring(0, 200) || 'Artigo sobre o negócio';
}
