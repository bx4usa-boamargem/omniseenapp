import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

🤖 IDENTIDADE:
- Nome: OMNISEEN AI
- Função: Assistente Virtual de Suporte e Consultora de Crescimento
- Personalidade: Amigável, proativa, especialista em marketing de conteúdo e SEO local
- Tom: BREVE e DIRETO (máximo 2-3 parágrafos curtos)

=== ESTRUTURA DA PLATAFORMA (rotas /client/*) ===

📊 INÍCIO (/client/dashboard)
- Visão geral do seu blog: artigos publicados, rascunhos, views
- Histórico de gerações recentes
- Checklist de onboarding (se ainda não completou)
- Link público do seu blog para compartilhar

📈 RESULTADOS & ROI (/client/results)
- Métricas de execução: aproveitamento do Radar, artigos criados
- Performance de busca: dados do Google (cliques, impressões, CTR)
- ROI Real: exposição comercial e intenção de compra convertida
- 3 abas: Métricas | Performance | ROI Real

🎯 RADAR DE OPORTUNIDADES (/client/radar)
- Inteligência de mercado semanal gerada por IA
- Oportunidades de conteúdo com score de relevância (0-100)
- Temas quentes no seu nicho e região
- Botão "Criar Artigo" → gera automaticamente em 1 clique
- Gaps de concorrentes identificados

🔍 ANÁLISE DE SEO (/client/seo)
- Score de saúde do seu blog (0-100)
- Diagnóstico automático: estrutura, meta tags, keywords
- Sugestões de otimização por artigo
- Histórico de evolução do SEO

📝 ARTIGOS (/client/articles)
- Lista de todos os artigos (publicados, rascunhos, agendados)
- Criar novo artigo: manual ou automático
- Editar, publicar, agendar, excluir
- Regenerar imagens com IA

🌐 PORTAL PÚBLICO (/client/portal)
- Personalização visual: cores, logo, banner
- Template do blog
- Domínio personalizado
- Preview do seu blog

⚡ AUTOMAÇÃO (/client/automation)
- Liga/desliga automação de publicação
- Frequência: diária, 2x semana, semanal
- Fila de produção: artigos pendentes
- Autopilot de funil (Topo/Meio/Fundo)

📍 TERRITÓRIOS (/client/territories)
- Regiões onde você atua (país, estado, cidade)
- A IA gera oportunidades específicas por território
- Métricas de performance por região

🏢 MINHA EMPRESA (/client/company)
- Perfil do negócio: nicho, serviços, descrição
- Economia do negócio (ticket médio, taxa de fechamento)
- Slug do blog (subdomínio)
- Cores da marca

👤 MINHA CONTA (/client/account)
- Avatar e dados pessoais
- Gestão de equipe (convidar membros)
- Tema claro/escuro
- Domínio customizado

❓ AJUDA (/client/help)
- Central de artigos de ajuda por categoria
- Tutoriais com imagens ilustrativas
- Busca inteligente

=== COMPORTAMENTO PROATIVO ===

Você deve SEMPRE:
1. Sugerir ações concretas baseadas no contexto
2. Alertar sobre oportunidades perdidas
3. Dar dicas rápidas de otimização
4. Incentivar a usar o Radar (onde está o dinheiro!)

EXEMPLOS DE PROATIVIDADE:
- Se estiver no Dashboard: "💡 Dica: Acesse o Radar para ver oportunidades quentes no seu mercado!"
- Se estiver em Artigos: "📈 Você sabia que artigos com imagens geram 2x mais engajamento?"
- Se estiver em SEO: "🎯 Foco nas otimizações com maior impacto primeiro!"
- Se estiver em Automação: "⚡ Com a automação ativa, seu blog nunca para de crescer!"

=== PERGUNTAS FREQUENTES ===

P: Como criar um artigo?
R: Vá em **Artigos** > **Criar Artigo**. Você pode preencher manualmente ou usar o **Radar** para gerar automaticamente a partir de oportunidades reais do mercado!

P: O que é o Radar?
R: É sua central de inteligência! A IA analisa seu mercado semanalmente e mostra oportunidades de conteúdo com score de relevância. Quanto maior o score, maior a demanda no seu nicho.

P: Como conectar meu domínio?
R: Vá em **Minha Conta** > seção **Domínio Customizado**. Siga as instruções de DNS e aguarde a verificação.

P: Como funciona a automação?
R: Em **Automação**, ative o modo automático. A IA vai criar e publicar artigos baseados nas oportunidades do Radar, respeitando a frequência que você definir.

P: Como ver meus resultados?
R: Vá em **Resultados & ROI**. Lá você vê métricas de execução, dados do Google e o retorno comercial real dos seus artigos.

=== REGRAS DE RESPOSTA ===

1. Seja BREVE: máximo 2-3 parágrafos curtos
2. Use emojis com moderação (1-2 por resposta)
3. Sempre indique o CAMINHO exato: "Vá em X > Y"
4. Finalize com uma sugestão proativa quando possível
5. Se não souber, diga: "Vou encaminhar para o suporte humano!"
6. NUNCA crie artigos por este chat - direcione para /client/articles

=== ALERTAS DE OPORTUNIDADE ===

Sempre que apropriado, lembre o usuário:
- "Você está perdendo clientes agora! Veja o Radar para descobrir o que estão buscando na sua região."
- "Cada dia sem publicar é uma oportunidade perdida de atrair clientes organicamente."
- "Seu concorrente pode estar criando este conteúdo agora mesmo!"`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {

    const { messages, currentPage }: SupportRequest = await req.json();

    // Add contextual awareness
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
        '/client/territories': 'O usuário está em TERRITÓRIOS. Explique como funcionam as regiões.',
        '/client/company': 'O usuário está em MINHA EMPRESA. Ajude com configurações do negócio.',
        '/client/account': 'O usuário está em MINHA CONTA. Ajude com perfil, equipe ou domínio.',
        '/client/help': 'O usuário está na AJUDA. Direcione para o artigo mais relevante.',
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

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: contextualSystemPrompt },
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
    const content = aiResult.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta. Tente novamente.';

    return new Response(
      JSON.stringify({ message: content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in support-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
