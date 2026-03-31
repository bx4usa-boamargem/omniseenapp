import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateText } from '../_shared/omniseen-ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SupportRequest {
  messages: ChatMessage[];
  currentPage?: string;
}

const systemPrompt = `Você é a OMNISEEN AI, a assistente virtual inteligente e PROATIVA da plataforma OMNISEEN.

IDENTIDADE:
- Nome: OMNISEEN AI
- Função: Assistente Virtual de Suporte e Consultora de Crescimento
- Personalidade: Amigável, proativa, especialista em marketing de conteúdo e SEO local
- Tom: BREVE e DIRETO (máximo 2-3 parágrafos curtos)

ROTAS DA PLATAFORMA:
- /client/dashboard: Visão geral, artigos publicados, histórico de gerações
- /client/results: Métricas, performance de busca, ROI real
- /client/radar: Oportunidades de conteúdo com score, 1 clique para criar artigo
- /client/seo: Score de saúde do blog, diagnóstico automático
- /client/articles: Lista, criação, edição, publicação de artigos
- /client/portal: Personalização visual e domínio
- /client/automation: Autopilot de publicação

REGRAS DE RESPOSTA:
1. Seja BREVE: máximo 2-3 parágrafos curtos
2. Use emojis com moderação (1-2 por resposta)
3. Sempre indique o CAMINHO exato: "Vá em X > Y"
4. Finalize com uma sugestão proativa quando possível
5. Se não souber, diga: "Vou encaminhar para o suporte humano!"
6. NUNCA crie artigos por este chat - direcione para /client/articles`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentPage }: SupportRequest = await req.json();

    let contextHint = '';
    if (currentPage) {
      const pageContexts: Record<string, string> = {
        '/client/dashboard': 'O usuário está na página INÍCIO. Sugira explorar o Radar ou criar artigo.',
        '/client/results': 'O usuário está vendo RESULTADOS & ROI. Ajude a interpretar métricas.',
        '/client/radar': 'O usuário está no RADAR. Incentive a converter oportunidades em artigos!',
        '/client/seo': 'O usuário está na ANÁLISE DE SEO. Foque em otimizações práticas.',
        '/client/articles': 'O usuário está em ARTIGOS. Ajude com criação, edição ou publicação.',
        '/client/portal': 'O usuário está no PORTAL PÚBLICO. Ajude com personalização visual.',
        '/client/automation': 'O usuário está em AUTOMAÇÃO. Explique frequência e fila.',
        '/client/company': 'O usuário está em MINHA EMPRESA. Ajude com configurações do negócio.',
        '/client/account': 'O usuário está em MINHA CONTA. Ajude com perfil, equipe ou domínio.',
      };
      for (const [route, context] of Object.entries(pageContexts)) {
        if (currentPage.startsWith(route)) {
          contextHint = context;
          break;
        }
      }
    }

    const contextualSystemPrompt = contextHint
      ? `${systemPrompt}\n\nCONTEXTO ATUAL: ${contextHint}`
      : systemPrompt;

    const aiMessages = [
      { role: 'system' as const, content: contextualSystemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const aiResult = await generateText('support_chat', aiMessages);

    if (!aiResult.success) {
      console.error('[SUPPORT_CHAT] AI error:', aiResult.error);
      return new Response(
        JSON.stringify({ message: 'Desculpe, não consegui processar sua pergunta. Tente novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: aiResult.content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SUPPORT_CHAT] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
