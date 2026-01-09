import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildUniversalPrompt, type ClientStrategy, type FunnelMode, type ArticleGoal } from '../_shared/promptTypeCore.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MandatorySection {
  heading: string;
  key_message: string;
}

interface EditorialTemplate {
  target_niche?: string;
  content_focus?: string;
  mandatory_structure?: MandatorySection[];
  title_guidelines?: string;
  tone_rules?: string;
  seo_settings?: {
    main_keyword?: string;
    secondary_keywords?: string[];
    search_intent?: string;
  };
  cta_template?: string;
  image_guidelines?: {
    cover?: string;
    internal?: string;
    style?: string;
  };
  company_name?: string;
  category_default?: string;
}

interface ArticleRequest {
  theme: string;
  keywords?: string[];
  tone?: string;
  category?: string;
  editorial_template?: EditorialTemplate;
  image_count?: number;
  word_count?: number;
  user_id?: string;
  blog_id?: string;
  section_count?: number;
  include_faq?: boolean;
  include_conclusion?: boolean;
  include_visual_blocks?: boolean;
  optimize_for_ai?: boolean;
  source?: 'chat' | 'instagram' | 'youtube' | 'pdf' | 'url' | 'form';
}

// Validation rules per content source
const sourceValidationRules: Record<string, { minPercent: number; minWords: number; maxWords?: number; autoRetry: boolean }> = {
  chat: { minPercent: 0.70, minWords: 500, maxWords: 800, autoRetry: false },
  instagram: { minPercent: 0.70, minWords: 600, maxWords: 1000, autoRetry: true },
  youtube: { minPercent: 0.85, minWords: 1500, maxWords: 3000, autoRetry: true },
  pdf: { minPercent: 0.85, minWords: 1500, maxWords: 3000, autoRetry: true },
  url: { minPercent: 0.85, minWords: 1500, maxWords: 3000, autoRetry: true },
  form: { minPercent: 0.85, minWords: 1500, maxWords: 3000, autoRetry: true },
};

const sourceNames: Record<string, string> = {
  chat: 'Chat IA',
  instagram: 'Instagram',
  youtube: 'YouTube',
  pdf: 'PDF',
  url: 'URL',
  form: 'Formulário'
};

// Helper function to clean and parse JSON with retry
function parseArticleJSON(rawArgs: string): Record<string, unknown> {
  // First attempt: direct parse
  try {
    return JSON.parse(rawArgs);
  } catch {
    console.log('Direct JSON parse failed, attempting cleanup...');
  }

  // Second attempt: clean control characters
  try {
    const cleanedArgs = rawArgs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except \t \n \r
      .replace(/\r\n/g, '\\n') // Normalize line endings
      .replace(/\r/g, '\\n')
      .replace(/(?<!\\)\n/g, '\\n'); // Escape unescaped newlines
    return JSON.parse(cleanedArgs);
  } catch {
    console.log('Cleanup parse failed, attempting aggressive cleanup...');
  }

  // Third attempt: aggressive cleanup
  try {
    // Find content boundaries and escape problematic characters
    let processed = rawArgs;
    
    // Handle content field which often has unescaped newlines
    const contentMatch = processed.match(/"content"\s*:\s*"([\s\S]*?)(?:","|\","|"\s*,\s*")/);
    if (contentMatch) {
      const originalContent = contentMatch[1];
      const escapedContent = originalContent
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/"/g, '\\"');
      processed = processed.replace(contentMatch[1], escapedContent);
    }
    
    return JSON.parse(processed);
  } catch (finalError) {
    console.error('All parse attempts failed:', finalError);
    throw new Error('AI_OUTPUT_INVALID: Failed to parse article data after all cleanup attempts');
  }
}

// Tone instructions mapping - configurable per account
const toneInstructions: Record<string, string> = {
  personal: `Use primeira pessoa ("eu", "minha experiência"). 
Compartilhe como se fosse um amigo especialista dando conselhos pessoais.
Ex: "Eu já cometi esse erro dezenas de vezes antes de descobrir..."`,
  
  professional: `Tom empresarial mas humano. Evite jargões corporativos.
Fale como um consultor experiente em reunião com cliente.
Ex: "A realidade de quem gerencia uma empresa é..."`,
  
  friendly: `Linguagem informal, como conversa entre parceiros de negócio.
Use "você" frequentemente, crie conexão emocional.
Ex: "Sabe aquele dia que parece que nada dá certo?"`,
  
  educational: `Tom didático e paciente. Explique passo a passo.
Use numeração e organização clara.
Ex: "Vamos entender isso em 3 passos simples..."`,
  
  authoritative: `Voz de especialista reconhecido. Dados quando relevante.
Posicione-se como referência no assunto.
Ex: "Depois de analisar centenas de casos, posso afirmar..."`,
  
  conversational: `Como uma mensagem de WhatsApp para um colega.
Direto, prático, sem enrolação.
Ex: "Olha só, o negócio é o seguinte..."`
};

// MASTER PROMPT - MANDATORY EDITORIAL FRAMEWORK (AUTOMARTICLES STYLE)
function buildMasterPrompt(template: EditorialTemplate | null, theme: string, keywords: string[], tone: string = 'friendly'): string {
  const companyName = template?.company_name || 'a empresa';
  const niche = template?.target_niche || 'empresas de serviços';
  const keywordsText = keywords.length > 0 ? keywords.join(', ') : theme;

  // Get tone instructions based on account configuration
  const selectedToneInstructions = toneInstructions[tone] || toneInstructions.friendly;

  // Custom structure from template
  const structureText = template?.mandatory_structure?.length 
    ? template.mandatory_structure.map((s, i) => `   ${i + 1}. H2: "${s.heading}" → Mensagem: ${s.key_message}`).join('\n')
    : '';

  return `Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, Especialista Editorial em Conteúdo para DONOS de Empresas de Serviços.

🤖 IDENTIDADE: OMNISEEN AI - Assistente de Criação de Conteúdo

🎯 PRINCÍPIO MESTRE (INQUEBRÁVEL)
Todo conteúdo deve parecer escrito para um dono de negócio lendo no celular, no carro ou no meio do trabalho.
O dono deve pensar: "Isso foi escrito para MIM."
Se isso não for atendido, o conteúdo está ERRADO e deve ser refeito.

🎙️ TOM DO ARTIGO (CONFIGURAÇÃO DA CONTA):
${selectedToneInstructions}

🧠 PERSONA OBRIGATÓRIA DO LEITOR
- Dono de pequena/média empresa de ${niche}
- Trabalha no campo, no atendimento ou na operação
- Vive apagando incêndios
- NÃO tem tempo para estudar tecnologia
- Quer parar de perder clientes, dinheiro e controle
- Lê no celular, entre um serviço e outro

🏷️ IDENTIDADE DA MARCA: ${companyName}
⚠️ EXTREMAMENTE IMPORTANTE:
- TODO benefício, exemplo e resultado deve ser em nome de: ${companyName}
- NUNCA use: "nossa plataforma", "esta solução", "o sistema", "a ferramenta", "a tecnologia"
- SEMPRE use: "${companyName}" ou fale direto com "você", "seu negócio", "seu cliente"
- Os benefícios pertencem à marca do dono, NUNCA à ferramenta

📐 ESTRUTURA EDITORIAL (ESTILO AUTOMARTICLES):
- 7-9 seções H2 (mais profundidade que o padrão)
- Parágrafos de 1-3 linhas no MÁXIMO
- Frases curtas e diretas (máximo 2 linhas)
- Listas com bullets FREQUENTES
- 1-2 blockquotes por artigo para insights importantes (use > no markdown)
- Negrito estratégico para pontos-chave
- Transições suaves entre seções
- Blocos visuais 💡⚠️📌 (mínimo 3, máximo 5)

🚨 PROIBIDO (CAUSA REJEIÇÃO IMEDIATA):
❌ Linguagem corporativa ("maximizar", "otimizar processos", "omnichannel", "estratégico")
❌ Jargões técnicos ("URA", "CRM", "API", "machine learning", "automação inteligente")
❌ Parágrafos com mais de 3 linhas
❌ Frases com mais de 2 linhas
❌ Conceitos abstratos sem exemplos reais do dia a dia
❌ Estatísticas genéricas ("empresas que usam X aumentam Y%")
❌ Tom acadêmico, de whitepaper ou de marketing corporativo
❌ Promessas milagrosas ou exageradas
❌ "Nossa plataforma", "nossa solução", "esta ferramenta"

✅ OBRIGATÓRIO EM CADA PARÁGRAFO:
- Frases CURTAS (máximo 2 linhas)
- Parágrafos CURTOS (máximo 3 linhas)
- Linguagem de conversa WhatsApp entre empresários
- Cenários REAIS: telefone tocando, cliente esperando, dono trabalhando
- Sempre "você", "seu negócio", "seu cliente"
- Conexão emocional com a rotina real do dono
- Tom de parceiro de negócio, não de empresa de tecnologia

🎨 BLOCOS VISUAIS OBRIGATÓRIOS (usar 3-5 no artigo):
Use estes emojis no INÍCIO de parágrafos especiais para criar destaque visual:
- 💡 para "Verdade Dura" → Insight importante que o dono precisa aceitar
- ⚠️ para "Alerta" → Erro comum ou risco que precisa evitar
- 📌 para "Dica Prática" → Ação imediata que pode tomar agora
Distribua estes blocos ao longo do artigo (mínimo 3, máximo 5).

🧱 ESTRUTURA OBRIGATÓRIA DO ARTIGO (7-9 H2s - ESTILO AUTOMARTICLES):

1️⃣ ABERTURA (H2 #1) — Choque de Realidade
- Começar com cena REAL do dia a dia do dono
- Exemplos: telefone tocando, cliente esperando, dono ocupado
- O leitor deve se reconhecer em até 3 linhas
- NUNCA começar com definição ou conceito

2️⃣ A DOR (H2 #2) — Sem Culpa
- Explicar o problema deixando claro:
  • NÃO é falta de esforço
  • É falta de estrutura
  • O dono NÃO está errado
- Mostrar consequências REAIS: perda de clientes, dinheiro jogado fora, estresse, reputação
- INCLUIR pelo menos 1 bloco 💡 ou ⚠️

3️⃣ O ERRO COMUM (H2 #3)
- Mostrar o erro que quase todo dono comete
- Exemplos: tentar fazer tudo sozinho, depender só de atendimento humano, achar que "depois resolve"
- INCLUIR 1 bloco ⚠️ destacando o erro

4️⃣ CONTEXTO/CENÁRIO (H2 #4) — Aprofundamento
- Expandir o contexto do problema
- Mostrar como o mercado mudou
- Usar BLOCKQUOTE para insight importante

5️⃣ A SOLUÇÃO (H2 #5) — Como Alívio, NUNCA como Tecnologia
- A solução deve parecer: simples, prática, acessível, possível AGORA
- NUNCA explicar tecnologia
- NUNCA usar termos técnicos
- A solução existe para: atender o cliente enquanto o dono trabalha
- INCLUIR 1-2 blocos 📌 com dicas práticas

6️⃣ PASSO A PASSO (H2 #6) — Implementação Prática
- Lista numerada de ações concretas
- Cada passo simples e executável
- Sem complexidade técnica

7️⃣ A MARCA ${companyName} (H2 #7)
- ${companyName} aparece como: criada para essa dor, pensada para rotina real
- Sem exagero, sem promessa milagrosa, sem discurso de marketing
- Foco em resultado prático
- INCLUIR BLOCKQUOTE com depoimento ou insight

8️⃣ RESULTADOS ESPERADOS (H2 #8) — O Que Muda
- Pintar o cenário após implementar a solução
- Benefícios concretos e tangíveis
- Sem promessas irreais

9️⃣ RESUMO (H2 #9) — Checklist Visual dos Pontos Principais
- Título OBRIGATÓRIO: "Resumo: [número] passos/dicas para [objetivo do artigo]"
- Lista em bullets com CADA ponto principal discutido no artigo
- Uma linha por ponto, máximo 10 palavras cada
- O leitor deve poder escanear e lembrar de tudo rapidamente
- Formato de checklist visual que funciona como "cola" do artigo
- EXEMPLO:
  ## Resumo: 7 dicas para nunca perder cliente
  - Responda em menos de 5 minutos
  - Tenha atendimento fora do horário comercial
  - Personalize cada mensagem com o nome do cliente
  - Acompanhe o histórico de conversas
  - Automatize perguntas frequentes
  - Peça feedback após cada atendimento
  - Analise dados para melhorar continuamente

🔟 DIRETO AO PONTO (H2 #10) — CTA Natural e Humanizado
- Título que convida: "Direto ao ponto: Por onde começar?" ou "Seu próximo passo"
- NUNCA use: "Conclusão", "Considerações Finais", "Saiba Mais", "Entre em Contato"
- Primeiro parágrafo: reconheça a jornada do leitor ("Você agora sabe...")
- Segundo parágrafo: convide naturalmente para testar a solução
- INCLUA blockquote inspirador (frase impactante relacionada ao tema):
  > "Quem atende bem, vende sempre."
- Último parágrafo: CTA em **NEGRITO** com ação específica
${template?.cta_template ? `- CTA OBRIGATÓRIO: **${template.cta_template}**` : '- Ex: **Teste grátis por 7 dias e veja quantos clientes você consegue recuperar.**'}
- EXEMPLO COMPLETO:
  ## Direto ao ponto: Seu próximo passo
  
  Você agora sabe o que está perdendo por não ter atendimento 24h.
  
  A boa notícia? Resolver isso é mais simples do que parece.
  
  > "Cliente que espera, é cliente que vai embora."
  
  **Teste ${companyName} grátis por 7 dias e veja quantos clientes você consegue recuperar.**

${structureText ? `📐 ESTRUTURA H2 PERSONALIZADA (usar se definida):
${structureText}
` : ''}

❓ FAQ (3-5 perguntas):
- Perguntas que um DONO faria de verdade
- Respostas CURTAS (máximo 4 linhas)
- Linguagem tranquilizadora
- Orientada à ação, não à explicação

📊 SEO:
- Palavra-chave principal: ${template?.seo_settings?.main_keyword || theme}
- Palavras secundárias: ${template?.seo_settings?.secondary_keywords?.join(', ') || keywordsText}
- Formatação: Markdown (## H2, ### H3, **negrito**, listas, > blockquotes)

${template?.tone_rules ? `🎙️ TOM ADICIONAL: ${template.tone_rules}` : ''}
${template?.title_guidelines ? `📰 TÍTULO: ${template.title_guidelines}` : ''}

🛑 VALIDAÇÃO FINAL:
Antes de finalizar, pergunte-se:
"Esse conteúdo parece escrito especificamente para esse dono de negócio?"
"O dono vai pensar: isso acontece comigo?"
"Tem 7-9 H2s, parágrafos curtos, e blocos visuais?"
Se NÃO → REFAZER.`;
}

// Build realistic image prompts focused on real business scenarios
function buildImagePrompts(theme: string, niche: string, count: number = 3): Array<{context: string; prompt: string; after_section: number}> {
  const nicheDescription = niche || 'service business';
  
  const allPrompts = [
    { 
      context: 'problem', 
      prompt: `Realistic photo style: A stressed small ${nicheDescription} owner unable to answer ringing phone while working. Real workshop or job site environment, natural warm lighting, genuine frustrated expression. Authentic workplace, NOT corporate stock photo. Medium shot, warm tones. Worker clothes, real tools visible. Photo that a business owner would relate to.`,
      after_section: 1 
    },
    { 
      context: 'solution', 
      prompt: `Realistic photo style: A calm ${nicheDescription} business owner working peacefully while phone shows notification that customer is being attended automatically. Real work environment (van, workshop, site), relief expression on face, natural lighting. Subtle smartphone notification visible. NOT corporate office, NOT suit. Authentic working person.`,
      after_section: 3 
    },
    { 
      context: 'result', 
      prompt: `Realistic photo style: Happy ${nicheDescription} business owner checking smartphone showing new appointments and satisfied customer messages. Real small business environment, genuine smile, natural lighting. Signs of business growth visible. NOT corporate celebration, NOT stock photo pose. Authentic success moment.`,
      after_section: 5 
    },
    { 
      context: 'insight', 
      prompt: `Realistic photo style: ${nicheDescription} business owner having a productive moment, reviewing documents or phone with focused expression. Clean workspace in authentic environment, natural daylight. Shows professionalism without corporate feel. Real person, real work.`,
      after_section: 2 
    },
    { 
      context: 'cta', 
      prompt: `Realistic photo style: Confident ${nicheDescription} business owner ready to take action, standing in their workplace with positive body language. Inviting expression, natural setting. Represents success and approachability. Authentic small business atmosphere.`,
      after_section: 6 
    }
  ];
  
  // Return only the requested number of prompts (1-5)
  const safeCount = Math.min(Math.max(count, 1), 5);
  return allPrompts.slice(0, safeCount);
}

// Generate a normalized hash for cache lookup
function generateHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      theme, keywords = [], tone = 'friendly', category = 'general', 
      editorial_template, image_count = 3, word_count, user_id, blog_id,
      section_count = 7,
      include_faq = true,
      include_conclusion = true,
      include_visual_blocks = true,
      optimize_for_ai = false,
      source = 'form',
      funnel_mode = 'middle',
      article_goal = null
    }: ArticleRequest & { funnel_mode?: FunnelMode; article_goal?: ArticleGoal | null } = await req.json();

    if (!theme) {
      return new Response(
        JSON.stringify({ error: 'Theme is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch AI model and content preferences
    let textModel = 'google/gemini-2.5-flash';
    let defaultWordCount = 1500;
    
    if (blog_id) {
      const { data: prefs } = await supabase
        .from('content_preferences')
        .select('ai_model_text, default_word_count')
        .eq('blog_id', blog_id)
        .maybeSingle();
      
      if (prefs?.ai_model_text) {
        textModel = prefs.ai_model_text;
        console.log(`Using configured text model: ${textModel}`);
      }
      if (prefs?.default_word_count) {
        defaultWordCount = prefs.default_word_count;
        console.log(`Using configured word count: ${defaultWordCount}`);
      }
    }
    
    // Use word_count from request or fallback to preferences
    const targetWordCount = word_count || defaultWordCount;
    // Ensure image count is valid (1-5)
    const targetImageCount = Math.min(Math.max(image_count || 3, 1), 5);
    
    console.log(`Target word count: ${targetWordCount}, Target image count: ${targetImageCount}`);

    // Generate cache key including ALL parameters that affect output
    const templateSignature = editorial_template 
      ? `${editorial_template.target_niche || ''}|${editorial_template.cta_template || ''}|${editorial_template.company_name || ''}`
      : '';
    const cacheKey = `${theme}|${keywords.sort().join(',')}|${tone}|wc:${targetWordCount}|ic:${targetImageCount}|sc:${section_count}|faq:${include_faq}|conc:${include_conclusion}|visual:${include_visual_blocks}|ai:${optimize_for_ai}|${templateSignature}|${blog_id || ''}`;
    const contentHash = generateHash(cacheKey);
    
    // Check cache first
    console.log(`Checking cache for theme: ${theme}, hash: ${contentHash}, target words: ${targetWordCount}`);
    const { data: cacheHit } = await supabase
      .from("ai_content_cache")
      .select("*")
      .eq("cache_type", "article")
      .eq("content_hash", contentHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cacheHit) {
      // Validate cached article word count meets current target
      const cachedContent = (cacheHit.response_data as {content?: string})?.content || '';
      const cachedWordCount = cachedContent.split(/\s+/).filter(Boolean).length;
      
      // Only use cache if word count is within 15% of target (tolerance)
      const minAcceptable = targetWordCount * 0.85;
      
      if (cachedWordCount >= minAcceptable) {
        console.log(`CACHE HIT for article: ${theme} (${cachedWordCount} words, target: ${targetWordCount})`);
        
        // Increment hit counter
        await supabase
          .from("ai_content_cache")
          .update({ hits: (cacheHit.hits || 0) + 1 })
          .eq("id", cacheHit.id);

        // Log cache hit as consumption (with zero cost)
        if (user_id) {
          await supabase.from("consumption_logs").insert({
            user_id,
            blog_id: blog_id || null,
            action_type: "article_generation_cached",
            action_description: `Cached Article: ${(cacheHit.response_data as {title?: string})?.title || theme}`,
            model_used: cacheHit.model_used || "cache",
            input_tokens: 0,
            output_tokens: 0,
            images_generated: 0,
            estimated_cost_usd: 0,
            metadata: { theme, keywords, cache_hit: true, original_cost: cacheHit.cost_saved_usd },
          });
        }

        return new Response(
          JSON.stringify({ success: true, article: cacheHit.response_data, from_cache: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log(`CACHE SKIP - word count too low: ${cachedWordCount} < ${minAcceptable} (target: ${targetWordCount})`);
      }
    }

    console.log(`Cache MISS - Generating structured article for theme: ${theme}`, editorial_template ? '(with template)' : '');

    // Fetch client_strategy for Universal Prompt Type (if exists)
    let clientStrategy: ClientStrategy | null = null;
    if (blog_id) {
      const { data: strategy } = await supabase
        .from('client_strategy')
        .select('*')
        .eq('blog_id', blog_id)
        .maybeSingle();
      
      if (strategy) {
        clientStrategy = strategy as ClientStrategy;
        console.log('Found client_strategy - will use Universal Prompt Type');
      }
    }

    // Build the system prompt - Universal Prompt Type if client_strategy exists, otherwise legacy
    let systemPrompt: string;
    
    if (clientStrategy) {
      // 🔥 NEW PATH — UNIVERSAL PROMPT TYPE
      systemPrompt = buildUniversalPrompt(
        clientStrategy,
        funnel_mode as FunnelMode,
        article_goal as ArticleGoal | null,
        theme,
        keywords
      );
      console.log(`Universal Prompt Type: funnel=${funnel_mode}, goal=${article_goal}`);
    } else {
      // 🧯 FALLBACK — LEGACY buildMasterPrompt (unchanged)
      systemPrompt = buildMasterPrompt(editorial_template || null, theme, keywords, tone);
      console.log('Fallback to legacy buildMasterPrompt');
    }

    const userPrompt = `Escreva um artigo completo sobre: "${theme}"

LEMBRE-SE: O dono de negócio deve ler e pensar "isso foi escrito para mim".

📏 ESTRUTURA OBRIGATÓRIA (DEFINIDA PELO USUÁRIO):
- Quantidade de seções H2: EXATAMENTE ${section_count} seções
- Tamanho mínimo: ${targetWordCount} palavras (NÃO entregue menos)
- FAQ: ${include_faq ? 'INCLUIR seção de FAQ (3-5 perguntas que um dono perguntaria de verdade)' : 'NÃO incluir FAQ'}
- Conclusão: ${include_conclusion ? 'INCLUIR seção de conclusão/próximos passos ao final' : 'NÃO incluir seção de conclusão separada'}
- Blocos visuais (💡, ⚠️, 📌): ${include_visual_blocks ? 'OBRIGATÓRIO incluir 3-5 blocos visuais distribuídos no artigo' : 'NÃO usar blocos visuais com emojis'}
${optimize_for_ai ? `
🤖 OTIMIZAÇÃO PARA IAs (GEO/AEO):
- Estruture o conteúdo para ser facilmente citado por ChatGPT, Perplexity, etc.
- Use fatos e dados específicos, não afirmações genéricas
- Responda perguntas diretamente nos primeiros parágrafos de cada seção
- Use listas e formatação clara para facilitar extração
` : ''}

O artigo deve ter:
1. Título atraente que fala diretamente com o dono (50-60 caracteres)
2. Meta description focada na dor do dono (até 160 caracteres)
3. Excerpt/resumo que gera identificação (2-3 frases curtas)
4. Conteúdo completo com EXATAMENTE ${section_count} seções H2 (${targetWordCount}+ palavras)
${include_faq ? '5. 3-5 FAQs que um dono perguntaria de verdade (respostas máx 4 linhas)' : ''}
6. Tempo estimado de leitura

FORMATO AUTOMARTICLES:
- Parágrafos de 1-3 linhas MÁXIMO
- Frases curtas e diretas
- Listas com bullets frequentes
- 1-2 blockquotes (>) para insights importantes
- Negrito estratégico
${include_visual_blocks ? `
BLOCOS VISUAIS OBRIGATÓRIOS (3-5 no total):
Use estes emojis no INÍCIO de parágrafos para criar destaque:
- 💡 Verdade Dura (insight importante)
- ⚠️ Alerta (erro ou risco)  
- 📌 Dica Prática (ação imediata)
` : ''}

📋 SEÇÃO DE RESUMO OBRIGATÓRIA (penúltima H2):
- Título: "Resumo: [número] passos/dicas para [objetivo]"
- Lista em bullets de TODOS os pontos principais do artigo
- Uma linha por ponto, máximo 10 palavras
- Formato de checklist visual
- EXEMPLO:
  ## Resumo: 5 dicas para nunca perder cliente
  - Responda em menos de 5 minutos
  - Tenha atendimento fora do horário comercial
  - Personalize cada mensagem
  - Acompanhe o histórico de conversas
  - Peça feedback após cada atendimento

🎯 SEÇÃO DE CTA NATURAL (última H2 - OBRIGATÓRIA):
- Título: "Direto ao ponto: Por onde começar?" ou similar
- NÃO use: "Conclusão", "Considerações Finais", "Saiba Mais"
- Primeiro parágrafo: reconheça que o leitor entendeu o problema
- Segundo parágrafo: convide naturalmente para testar a solução
- INCLUA um blockquote inspirador:
  > "Frase impactante relacionada ao tema"
- Último parágrafo com CTA em **NEGRITO**:
${editorial_template?.cta_template ? `  **${editorial_template.cta_template}**` : '  **Teste agora e veja a diferença no seu negócio.**'}

🖼️ IMAGENS - GERE EXATAMENTE ${targetImageCount} PROMPT(S):
${targetImageCount >= 1 ? '- "problem": Dono estressado, telefone tocando, no trabalho real' : ''}
${targetImageCount >= 2 ? '- "solution": Dono trabalhando tranquilo, atendimento automático' : ''}
${targetImageCount >= 3 ? '- "result": Dono satisfeito vendo resultados no celular' : ''}
${targetImageCount >= 4 ? '- "insight": Dono focado analisando documento ou celular' : ''}
${targetImageCount >= 5 ? '- "cta": Dono confiante pronto para ação' : ''}

Cada prompt deve mostrar cenários REAIS de trabalho, não escritórios corporativos.`;

    // Build dynamic tool schema based on targetImageCount and targetWordCount
    const contextEnumValues = ['problem', 'solution', 'result', 'insight', 'cta'].slice(0, targetImageCount);
    
    const toolSchema = {
      type: 'function' as const,
      function: {
        name: 'create_article',
        description: 'Creates a complete SEO-optimized blog article written for business owners, with realistic image prompts',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Article title that speaks directly to the business owner (50-60 characters)'
            },
            meta_description: {
              type: 'string',
              description: 'Meta description focused on the owner pain point (max 160 characters)'
            },
            excerpt: {
              type: 'string',
              description: 'Short summary that creates identification with the owner (2-3 sentences)'
            },
            content: {
              type: 'string',
              description: `Full article in Markdown (MINIMUM ${targetWordCount} words, EXACTLY ${section_count} H2 sections). MUST include: 1) Penultimate H2 titled "Resumo: X passos/dicas para Y" with bullet list summarizing ALL key points, 2) Final H2 titled "Direto ao ponto: Por onde começar?" with natural CTA, inspirational blockquote (>), and bold call-to-action. Follow mandatory structure with short paragraphs (1-3 lines), bullet lists, blockquotes.`
            },
            faq: {
              type: 'array',
              description: 'Real questions a business owner would ask (3-5 items, max 4 line answers)',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string', description: 'Short answer, max 4 lines, reassuring tone' }
                },
                required: ['question', 'answer']
              }
            },
            reading_time: {
              type: 'number',
              description: 'Estimated reading time in minutes'
            },
            image_prompts: {
              type: 'array',
              description: `Exactly ${targetImageCount} REALISTIC image prompts showing real work scenarios, NOT corporate settings`,
              items: {
                type: 'object',
                properties: {
                  context: { 
                    type: 'string',
                    enum: contextEnumValues,
                    description: 'The narrative context: problem (stressed owner), solution (calm working), result (happy with results), insight (focused analysis), cta (confident ready)'
                  },
                  prompt: { 
                    type: 'string',
                    description: 'REALISTIC photo prompt in English showing real work environment: workshop, van, job site. NOT corporate office. Include: real worker, authentic expression, natural lighting, work clothes'
                  },
                  after_section: {
                    type: 'number',
                    description: 'Insert image after this H2 section number (1-6)'
                  }
                },
                required: ['context', 'prompt', 'after_section']
              },
              minItems: targetImageCount,
              maxItems: targetImageCount
            }
          },
          required: ['title', 'meta_description', 'excerpt', 'content', 'faq', 'reading_time', 'image_prompts'],
          additionalProperties: false
        }
      }
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: textModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [toolSchema],
        tool_choice: { type: 'function', function: { name: 'create_article' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI_RATE_LIMIT', message: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI_CREDITS', message: 'Insufficient credits. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function?.name !== 'create_article') {
      console.error('No valid tool call in response:', JSON.stringify(data));
      throw new Error('AI_OUTPUT_INVALID: No structured article output received');
    }

    // Parse with retry logic
    const articleData = parseArticleJSON(toolCall.function.arguments);

    // Validate required fields
    if (!articleData.title || typeof articleData.title !== 'string') {
      throw new Error('AI_OUTPUT_INVALID: Missing or invalid title');
    }
    if (!articleData.content || typeof articleData.content !== 'string') {
      throw new Error('AI_OUTPUT_INVALID: Missing or invalid content');
    }
    if ((articleData.content as string).length < 500) {
      throw new Error('AI_OUTPUT_INVALID: Content too short (characters)');
    }
    
    // Validate word count using source-specific rules
    const rules = sourceValidationRules[source] || sourceValidationRules.form;
    
    let generatedWordCount = (articleData.content as string).split(/\s+/).filter(Boolean).length;
    const minAcceptableWords = Math.max(targetWordCount * rules.minPercent, rules.minWords);
    
    console.log(`Source: ${source}, Generated: ${generatedWordCount} words, Min acceptable: ${minAcceptableWords}, Max: ${rules.maxWords || 'unlimited'}`);
    
    // Apply maximum word limit for sources with limited content (chat, instagram)
    if (rules.maxWords && generatedWordCount > rules.maxWords) {
      console.log(`Truncating article from ${generatedWordCount} to ${rules.maxWords} words for ${source}`);
      const words = (articleData.content as string).split(/\s+/);
      articleData.content = words.slice(0, rules.maxWords).join(' ');
      generatedWordCount = rules.maxWords;
    }
    
    // Validate minimum word count with auto-retry for rich sources
    if (generatedWordCount < minAcceptableWords) {
      console.warn(`AI_OUTPUT_TOO_SHORT: ${generatedWordCount} words < ${minAcceptableWords} minimum for ${source}`);
      
      // Check if this source supports auto-retry
      if (rules.autoRetry) {
        console.log(`Auto-retry enabled for ${source}, attempting content expansion...`);
        
        // Build expansion prompt
        const expansionPrompt = `O artigo abaixo tem apenas ${generatedWordCount} palavras, mas precisa de no mínimo ${targetWordCount} palavras.

EXPANDA o conteúdo mantendo a mesma estrutura, mas:
1. Adicione mais exemplos práticos em cada seção
2. Desenvolva mais os cenários do dia a dia do dono
3. Inclua mais dicas específicas e acionáveis
4. Expanda as explicações com mais detalhes

ARTIGO ORIGINAL PARA EXPANDIR:
${articleData.content}

REGRAS IMPORTANTES:
- Mantenha a mesma estrutura de H2s
- Mantenha o mesmo tom de conversa
- NÃO adicione novas seções, apenas expanda as existentes
- O resultado deve ter no mínimo ${targetWordCount} palavras
- Retorne APENAS o conteúdo expandido em Markdown`;

        try {
          const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: textModel,
              messages: [
                { role: 'system', content: 'Você é um redator SEO especialista em expandir artigos para donos de pequenos negócios. Expanda o conteúdo mantendo o tom de conversa direto e prático.' },
                { role: 'user', content: expansionPrompt }
              ]
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const expandedContent = retryData.choices?.[0]?.message?.content;
            
            if (expandedContent) {
              const expandedWordCount = expandedContent.split(/\s+/).filter(Boolean).length;
              console.log(`Expansion successful: ${generatedWordCount} -> ${expandedWordCount} words`);
              
              if (expandedWordCount >= minAcceptableWords * 0.9) {
                // Use expanded content
                articleData.content = expandedContent;
                generatedWordCount = expandedWordCount;
                console.log(`Using expanded content with ${expandedWordCount} words`);
              } else {
                console.warn(`Expansion still too short: ${expandedWordCount} words`);
              }
            }
          } else {
            console.error(`Retry request failed: ${retryResponse.status}`);
          }
        } catch (retryError) {
          console.error('Retry expansion failed:', retryError);
        }
      }
      
      // Check again after potential retry
      if (generatedWordCount < minAcceptableWords) {
        // Create structured error with user-friendly message
        const errorData = {
          code: 'AI_OUTPUT_TOO_SHORT',
          message: `O artigo gerado tem ${generatedWordCount} palavras, mas o mínimo para ${sourceNames[source] || source} é ${Math.round(minAcceptableWords)} palavras.`,
          suggestion: ['chat', 'instagram'].includes(source)
            ? 'Para artigos mais extensos (1500-3000 palavras), utilize importação de PDF, YouTube ou URL com mais conteúdo de referência.'
            : 'Tente novamente ou forneça mais conteúdo de referência sobre o tema.',
          generatedWords: generatedWordCount,
          requiredWords: Math.round(minAcceptableWords),
          source
        };
        
        throw new Error(JSON.stringify(errorData));
      }
    }

    // Get niche for image prompts
    const niche = editorial_template?.target_niche || 'service business';
    
    // Ensure image_prompts have correct structure with realistic defaults
    const defaultImagePrompts = buildImagePrompts(theme, niche);

    let imagePrompts = defaultImagePrompts;
    if (Array.isArray(articleData.image_prompts) && articleData.image_prompts.length > 0) {
      // Validate and fix each prompt
      imagePrompts = (articleData.image_prompts as Array<{context?: string; prompt?: string; after_section?: number}>).map((p, i) => ({
        context: p.context || defaultImagePrompts[i]?.context || 'problem',
        prompt: p.prompt || defaultImagePrompts[i]?.prompt || `Realistic photo of ${niche} business owner at work`,
        after_section: typeof p.after_section === 'number' ? p.after_section : (i === 0 ? 1 : i === 1 ? 3 : 5)
      }));
    }

    // Ensure all fields have defaults
    const article = {
      title: (articleData.title as string).trim(),
      meta_description: ((articleData.meta_description || '') as string).trim().substring(0, 160),
      excerpt: ((articleData.excerpt || articleData.meta_description || '') as string).trim(),
      content: (articleData.content as string).trim(),
      faq: Array.isArray(articleData.faq) ? articleData.faq : [],
      reading_time: (articleData.reading_time as number) || Math.ceil((articleData.content as string).split(' ').length / 200),
      image_prompts: imagePrompts
    };

    console.log(`Article generated successfully: "${article.title}" (${article.content.length} chars, ${article.image_prompts.length} image prompts)`);

    // Log consumption if user_id provided
    const inputTokens = Math.ceil((theme.length + keywords.join(' ').length + 2000) / 4);
    const outputTokens = Math.ceil(article.content.length / 4);
    const estimatedCost = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

    if (user_id) {
      try {
        await supabase.from("consumption_logs").insert({
          user_id,
          blog_id: blog_id || null,
          action_type: "article_generation",
          action_description: `Article: ${article.title}`,
          model_used: "google/gemini-2.5-flash",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          images_generated: 0,
          estimated_cost_usd: estimatedCost,
          metadata: { theme, keywords },
        });
        console.log("Consumption logged for article generation");
      } catch (logError) {
        console.warn("Failed to log consumption:", logError);
      }
    }

    // Save to cache for future use
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await supabase.from("ai_content_cache").upsert({
        cache_type: "article",
        content_hash: contentHash,
        prompt_text: cacheKey,
        response_data: article,
        model_used: "google/gemini-2.5-flash",
        tokens_saved: inputTokens + outputTokens,
        cost_saved_usd: estimatedCost,
        blog_id: blog_id || null,
        user_id: user_id || null,
        expires_at: expiresAt.toISOString(),
        hits: 0,
      }, { onConflict: 'cache_type,content_hash' });
      console.log("Article saved to cache");
    } catch (cacheError) {
      console.warn("Failed to save to cache:", cacheError);
    }

    return new Response(
      JSON.stringify({ success: true, article }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-article-structured:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate article';
    
    // Categorize error for better debugging
    let errorCode = 'UNKNOWN_ERROR';
    if (message.includes('AI_RATE_LIMIT')) errorCode = 'AI_RATE_LIMIT';
    else if (message.includes('AI_CREDITS')) errorCode = 'AI_CREDITS';
    else if (message.includes('AI_OUTPUT_INVALID')) errorCode = 'AI_OUTPUT_INVALID';
    else if (message.includes('LOVABLE_API_KEY')) errorCode = 'CONFIG_ERROR';
    
    return new Response(
      JSON.stringify({ error: errorCode, message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
