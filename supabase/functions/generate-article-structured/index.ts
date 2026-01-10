import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildUniversalPrompt, type ClientStrategy, type FunnelMode, type ArticleGoal } from '../_shared/promptTypeCore.ts';
import { resolveStrategy } from '../_shared/strategyResolver.ts';
import { validateArticleQuality, generateCorrectionInstructions } from '../_shared/qualityValidator.ts';

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

// Generation Mode Type - NUNCA pode ser undefined
type GenerationMode = 'fast' | 'deep';

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
  editorial_model?: 'traditional' | 'strategic' | 'visual_guided';
  generation_mode?: GenerationMode;
}

// Editorial Model Instructions with strict visual block limits
const EDITORIAL_MODEL_INSTRUCTIONS = {
  traditional: {
    name: 'Artigo Clássico',
    instructions: `## MODELO: ARTIGO CLÁSSICO (SEO & Autoridade)
📐 ESTRUTURA: 5-7 seções H2, estrutura limpa e clássica
📝 BLOCOS VISUAIS: Usar APENAS 2-3 blocos (💡, ⚠️ ou 📌) - NÃO ULTRAPASSAR
🎯 CTA: APENAS no final do artigo
📷 IMAGENS: 1 capa + 2 imagens de apoio (1 a cada 3 seções)
TOM: Consultivo, informativo, profissional`,
    visualBlockLimit: { min: 2, max: 3, types: ['💡', '⚠️', '📌'] }
  },
  strategic: {
    name: 'Artigo de Impacto',
    instructions: `## MODELO: ARTIGO DE IMPACTO (Conversão & Persuasão)
📐 ESTRUTURA: 5-7 seções H2, estrutura dinâmica
📝 BLOCOS VISUAIS: Usar 5-7 blocos INTENSIVAMENTE (💡, ⚠️, 📌, ✅, ❝) - Pull quotes (❝) a cada 2 seções
🎯 CTA: CTAs distribuídos (a cada 2-3 seções) + CTA forte no final
📷 IMAGENS: 1 capa + 3 imagens de apoio (1 a cada 2 seções)
TOM: Persuasivo, direto, orientado a conversão`,
    visualBlockLimit: { min: 5, max: 7, types: ['💡', '⚠️', '📌', '✅', '❝'] }
  },
  visual_guided: {
    name: 'Artigo Visual',
    instructions: `## MODELO: ARTIGO VISUAL (Leitura Fluida & Mobile-first)
📐 ESTRUTURA: 5-6 seções H2 curtas, alternância clara: Imagem → Título → Texto curto
📝 BLOCOS VISUAIS: Usar 3-4 blocos (💡, 📌, ✅) - Menos texto por seção, mais respiro visual
🎯 CTA: CTA no final + 1 CTA sutil no meio
📷 IMAGENS: 1 capa + 4 imagens de apoio (1 por seção) - CADA IMAGEM LOGO APÓS O TÍTULO H2
TOM: Amigável, convidativo, escaneável`,
    visualBlockLimit: { min: 3, max: 4, types: ['💡', '📌', '✅'] }
  }
};

// Hierarchy validation rules
const HIERARCHY_RULES = `
## ⛔ REGRAS ABSOLUTAS DE HIERARQUIA (VIOLAÇÃO = ARTIGO INVÁLIDO)

❌ PROIBIDO:
- Mais de 1 H1 por artigo
- H2 na introdução (primeiras 3-4 linhas)
- H3 sem H2 pai imediatamente antes
- H2 consecutivos sem conteúdo entre eles (mínimo 2 parágrafos)
- Mais de 3 H3 dentro de um único H2
- H2 com menos de 50 palavras de conteúdo

✅ ESTRUTURA CORRETA:
1. H1 (título) → 1 único
2. Introdução → 3-4 linhas, SEM headings
3. H2 → 2-3 parágrafos + blocos visuais opcionais
4. H3 (opcional) → detalhamento, máx. 2 por H2
5. Último H2 → CTA natural (NUNCA "Conclusão")`;

// ============================================================================
// REGRAS DE GERAÇÃO POR MODO (FAST vs DEEP)
// ============================================================================
// O sistema opera com DOIS MODOS CLAROS - nunca undefined:
// - FAST: Chat/Instagram - artigos rápidos (400-1000 palavras)
// - DEEP: Form/Funil/URL/PDF/YouTube - ativos editoriais profundos (1500-3000)
// ============================================================================

const generationRules: Record<GenerationMode, { 
  minPercent: number; 
  minWords: number; 
  maxWords: number; 
  autoRetry: boolean; 
  maxRetries: number;
  promptInstruction: string;
}> = {
  fast: {
    minPercent: 0.50,
    minWords: 400,
    maxWords: 1000,
    autoRetry: true,
    maxRetries: 2,
    promptInstruction: `# 🚀 MODO RÁPIDO (400-1000 palavras)
Gere um artigo OBJETIVO e DIRETO, entre 400 e 1000 palavras.
- Seja prático e vá ao ponto
- Foque na essência do tema
- Parágrafos curtos (1-2 linhas)
- 3-5 seções H2 máximo
- CTA simples no final`
  },
  deep: {
    minPercent: 0.85,
    minWords: 1500,
    maxWords: 3000,
    autoRetry: true,
    maxRetries: 2,
    promptInstruction: `# 🧠 MODO PROFUNDO (1500-3000 palavras)
Gere um artigo COMPLETO e APROFUNDADO, entre 1500 e 3000 palavras.
- Explore o tema com profundidade estratégica
- Inclua exemplos práticos e cenários reais
- Insights e dicas acionáveis em cada seção
- 5-7 seções H2 bem desenvolvidas
- FAQ e resumo obrigatórios
- CTA estruturado com contexto`
  }
};

// Helper: Determinar generation_mode a partir do source (fallback)
function resolveGenerationMode(requestMode: GenerationMode | undefined, source: string): GenerationMode {
  // Se o modo foi explicitamente passado, usar ele
  if (requestMode === 'fast' || requestMode === 'deep') {
    return requestMode;
  }
  // Inferir a partir do source - chat/instagram = fast, resto = deep
  if (source === 'chat' || source === 'instagram') {
    return 'fast';
  }
  // Default é SEMPRE deep (nunca undefined)
  return 'deep';
}

// Word Count Enforcer: Expands article content until it meets minimum word count
async function expandArticleContent(
  content: string,
  title: string,
  targetWordCount: number,
  currentWordCount: number,
  textModel: string,
  LOVABLE_API_KEY: string,
  maxRetries: number = 2
): Promise<{ content: string; wordCount: number; retries: number }> {
  let expandedContent = content;
  let wordCount = currentWordCount;
  let retryCount = 0;
  const minAcceptable = targetWordCount * 0.90; // 90% of target is acceptable

  while (wordCount < minAcceptable && retryCount < maxRetries) {
    retryCount++;
    console.log(`Word Count Enforcer: Expansion attempt ${retryCount}/${maxRetries} - Current: ${wordCount} words, Target: ${targetWordCount}`);

    const expansionPrompt = `# TAREFA: EXPANSÃO OBRIGATÓRIA DE ARTIGO

O artigo abaixo tem apenas ${wordCount} palavras, mas PRECISA ter no mínimo ${targetWordCount} palavras.

## REGRAS DE EXPANSÃO (TODAS OBRIGATÓRIAS):

1. **MANTER** a mesma estrutura de H2s (NÃO adicionar nem remover seções)
2. **MANTER** o mesmo título: "${title}"
3. **MANTER** o mesmo tom de conversa e linguagem
4. **MANTER** todos os blockquotes (>) e emojis (💡⚠️📌) existentes

5. **EXPANDIR** cada seção H2 com:
   - Mais exemplos práticos do dia a dia do dono
   - Mais detalhes técnicos explicados de forma simples
   - Mais benefícios e consequências reais
   - Mais dicas acionáveis e específicas
   - Mais cenários "Imagine que..." ou "Por exemplo..."
   - Mais perguntas retóricas que engajam o leitor

6. **PARÁGRAFOS CURTOS**: Máximo 1-3 linhas cada (NÃO escreva parágrafos longos)
7. **LISTAS**: Use bullets frequentemente para organizar informações
8. **NEGRITO**: Use **negrito** para pontos-chave

9. **NÃO REMOVER** nenhum conteúdo existente - apenas ADICIONAR
10. **NÃO ALTERAR** o bloco de imagens ou FAQs

O resultado DEVE ter no mínimo ${targetWordCount} palavras. Se necessário, dobre cada seção.

## ARTIGO PARA EXPANDIR:

${expandedContent}

---

Retorne APENAS o conteúdo expandido em Markdown, sem explicações ou comentários.`;

    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: textModel,
          messages: [
            { 
              role: 'system', 
              content: `Você é um redator SEO especialista em expandir artigos para donos de pequenos negócios.

Sua ÚNICA tarefa é AUMENTAR significativamente o conteúdo mantendo qualidade e estrutura.

REGRAS ABSOLUTAS:
- NUNCA reduza o tamanho do artigo
- SEMPRE expanda cada seção com mais detalhes, exemplos e dicas
- Mantenha parágrafos curtos (1-3 linhas)
- Use linguagem de conversa WhatsApp entre empresários
- Adicione cenários reais do dia a dia do dono
- O resultado deve ter no mínimo ${targetWordCount} palavras` 
            },
            { role: 'user', content: expansionPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        console.error(`Word Count Enforcer: Expansion retry ${retryCount} failed with status ${response.status}`);
        break;
      }

      const data = await response.json();
      const newContent = data.choices?.[0]?.message?.content;

      if (newContent) {
        const newWordCount = newContent.split(/\s+/).filter(Boolean).length;
        console.log(`Word Count Enforcer: Expansion ${retryCount} result: ${wordCount} → ${newWordCount} words (${newWordCount > wordCount ? '+' : ''}${newWordCount - wordCount})`);

        if (newWordCount > wordCount) {
          expandedContent = newContent;
          wordCount = newWordCount;
        } else {
          console.warn(`Word Count Enforcer: Expansion ${retryCount} did not increase word count, stopping`);
          break;
        }
      } else {
        console.error(`Word Count Enforcer: Empty response in retry ${retryCount}`);
        break;
      }
    } catch (error) {
      console.error(`Word Count Enforcer: Expansion retry ${retryCount} error:`, error);
      break;
    }
  }

  console.log(`Word Count Enforcer: Complete - Final word count: ${wordCount} after ${retryCount} retries`);
  return { content: expandedContent, wordCount, retries: retryCount };
}

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
      article_goal = null,
      editorial_model = 'traditional',
      generation_mode: requestedGenerationMode
    }: ArticleRequest & { funnel_mode?: FunnelMode; article_goal?: ArticleGoal | null } = await req.json();

    // RESOLVER GENERATION_MODE: Nunca undefined - fast ou deep
    const generation_mode = resolveGenerationMode(requestedGenerationMode, source);
    console.log(`[GENERATION MODE] Resolved: ${generation_mode} (requested: ${requestedGenerationMode || 'undefined'}, source: ${source})`);

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
    
    // ============ EDITORIAL MODEL CONFIGURATION ============
    const MODEL_CONFIG = {
      traditional: {
        sections: { min: 5, max: 7, default: 6 },
        imageFrequency: 3,   // 1 image per 3 H2s
        visualBlocks: { min: 2, max: 3, types: ['💡', '⚠️', '📌'] }
      },
      strategic: {
        sections: { min: 5, max: 9, default: 7 },
        imageFrequency: 2,   // 1 image per 2 H2s
        visualBlocks: { min: 5, max: 7, types: ['💡', '⚠️', '📌', '✅', '❝'] }
      },
      visual_guided: {
        sections: { min: 5, max: 6, default: 5 },
        imageFrequency: 1,   // 1 image per H2
        visualBlocks: { min: 3, max: 4, types: ['💡', '📌', '✅'] }
      }
    };
    
    const modelConfig = MODEL_CONFIG[editorial_model] || MODEL_CONFIG.traditional;
    const modelInstructions = EDITORIAL_MODEL_INSTRUCTIONS[editorial_model] || EDITORIAL_MODEL_INSTRUCTIONS.traditional;
    
    // Adjust section count based on model if not explicitly set
    const effectiveSectionCount = section_count || modelConfig.sections.default;
    
    // Calculate image count based on model frequency
    const calculatedImageCount = Math.ceil(effectiveSectionCount / modelConfig.imageFrequency);
    const targetImageCount = Math.min(Math.max(image_count || calculatedImageCount, 1), 5);
    
    console.log(`Editorial Model: ${editorial_model}, Sections: ${effectiveSectionCount}, Target words: ${targetWordCount}, Target images: ${targetImageCount}`);

    // Generate cache key including editorial_model
    const templateSignature = editorial_template 
      ? `${editorial_template.target_niche || ''}|${editorial_template.cta_template || ''}|${editorial_template.company_name || ''}`
      : '';
    const cacheKey = `${theme}|${keywords.sort().join(',')}|${tone}|wc:${targetWordCount}|ic:${targetImageCount}|sc:${effectiveSectionCount}|faq:${include_faq}|conc:${include_conclusion}|visual:${include_visual_blocks}|ai:${optimize_for_ai}|model:${editorial_model}|${templateSignature}|${blog_id || ''}`;
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

    // ========================================================================
    // UNIVERSAL PROMPT TYPE V1.0 - OBRIGATÓRIO SEM FALLBACK
    // ========================================================================
    // A função resolveStrategy() GARANTE que sempre existe uma estratégia.
    // Se não existir client_strategy, ela cria automaticamente com defaults.
    // ========================================================================
    
    let strategyId: string | null = null;
    let isDefaultStrategy = false;
    let clientStrategy: ClientStrategy;
    
    if (blog_id) {
      const resolution = await resolveStrategy(supabase, blog_id);
      clientStrategy = resolution.strategy;
      strategyId = resolution.strategyId;
      isDefaultStrategy = resolution.isDefault;
      console.log(`[UNIVERSAL V1.0] Strategy resolved: source=${resolution.source}, isDefault=${isDefaultStrategy}`);
    } else {
      // Fallback para geração sem blog_id (raro, mas possível)
      clientStrategy = {
        empresa_nome: editorial_template?.company_name || null,
        tipo_negocio: editorial_template?.target_niche || 'serviços',
        regiao_atuacao: 'Brasil',
        tipo_publico: 'B2B/B2C',
        nivel_consciencia: 'consciente_problema',
        nivel_conhecimento: 'iniciante',
        dor_principal: null,
        desejo_principal: null,
        o_que_oferece: null,
        principais_beneficios: null,
        diferenciais: null,
        acao_desejada: 'entre em contato',
        canal_cta: 'WhatsApp'
      };
      isDefaultStrategy = true;
      console.log('[UNIVERSAL V1.0] No blog_id - using minimal default strategy');
    }

    // SEMPRE usar Universal Prompt - SEM FALLBACK LEGADO
    const systemPrompt = buildUniversalPrompt(
      clientStrategy,
      funnel_mode as FunnelMode,
      article_goal as ArticleGoal | null,
      theme,
      keywords
    );
    console.log(`[UNIVERSAL V1.0] Prompt built: funnel=${funnel_mode}, goal=${article_goal}, isDefault=${isDefaultStrategy}`);

    // ============ INJECT GENERATION MODE + EDITORIAL MODEL INSTRUCTIONS ============
    // Obter instrução de modo (NUNCA undefined - sempre fast ou deep)
    const modeInstruction = generationRules[generation_mode].promptInstruction;
    
    // Ajustar limites de palavras baseado no modo
    const wordLimitInstruction = generation_mode === 'fast'
      ? `- Tamanho: ENTRE 400 e 1.000 palavras (alvo: ${targetWordCount})`
      : `- Tamanho: ENTRE 1.500 e 3.000 palavras (alvo: ${targetWordCount})`;
    
    // Ajustar seções baseado no modo
    const sectionInstruction = generation_mode === 'fast'
      ? `- Quantidade de seções H2: 3-5 seções (rápido e objetivo)`
      : `- Quantidade de seções H2: EXATAMENTE ${effectiveSectionCount} seções`;
    
    const userPrompt = `${modeInstruction}

---

⛔ MODELO EDITORIAL OBRIGATÓRIO: ${modelInstructions.name.toUpperCase()}
⛔ QUALQUER DESVIO INVALIDA A RESPOSTA

${modelInstructions.instructions}

${HIERARCHY_RULES}

📊 LIMITES ESTRITOS PARA ESTE MODELO:
${sectionInstruction}
- Blocos visuais: ${modelConfig.visualBlocks.min} a ${modelConfig.visualBlocks.max} blocos
- Tipos PERMITIDOS: ${modelConfig.visualBlocks.types.join(', ')}
- Tipos PROIBIDOS: ${['💡', '⚠️', '📌', '✅', '❝'].filter(t => !modelConfig.visualBlocks.types.includes(t)).join(', ') || 'nenhum'}
- Frequência de imagens: 1 a cada ${modelConfig.imageFrequency} seções H2

---

Escreva um artigo completo sobre: "${theme}"

LEMBRE-SE: O dono de negócio deve ler e pensar "isso foi escrito para mim".

📏 ESTRUTURA OBRIGATÓRIA:
${sectionInstruction}
${wordLimitInstruction}
- FAQ: ${include_faq ? 'INCLUIR seção de FAQ (3-5 perguntas que um dono perguntaria de verdade)' : 'NÃO incluir FAQ'}
- Conclusão: ${include_conclusion ? 'INCLUIR seção de conclusão/próximos passos ao final' : 'NÃO incluir seção de conclusão separada'}
- Blocos visuais: ${include_visual_blocks ? `OBRIGATÓRIO ${modelConfig.visualBlocks.min}-${modelConfig.visualBlocks.max} blocos (${modelConfig.visualBlocks.types.join(', ')})` : 'NÃO usar blocos visuais com emojis'}
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
4. Conteúdo completo com EXATAMENTE ${effectiveSectionCount} seções H2 (${targetWordCount} palavras)
${include_faq ? '5. 3-5 FAQs que um dono perguntaria de verdade (respostas máx 4 linhas)' : ''}
6. Tempo estimado de leitura

FORMATO AUTOMARTICLES (MOBILE-FIRST):
- Parágrafos de 1-3 linhas MÁXIMO
- Frases curtas (máx. 2 linhas)
- Listas com bullets frequentes
- 1-2 blockquotes (>) para insights importantes
- Negrito estratégico
${include_visual_blocks ? `
📝 BLOCOS VISUAIS (${modelConfig.visualBlocks.min}-${modelConfig.visualBlocks.max} no total):
APENAS ESTES TIPOS PERMITIDOS para ${modelInstructions.name}:
${modelConfig.visualBlocks.types.includes('💡') ? '- 💡 Insight (verdade ou descoberta importante)' : ''}
${modelConfig.visualBlocks.types.includes('⚠️') ? '- ⚠️ Alerta (erro ou risco)' : ''}
${modelConfig.visualBlocks.types.includes('📌') ? '- 📌 Destaque (dica prática)' : ''}
${modelConfig.visualBlocks.types.includes('✅') ? '- ✅ Resumo Rápido (pontos-chave)' : ''}
${modelConfig.visualBlocks.types.includes('❝') ? '- ❝ Citação Destacada (frase impactante)' : ''}
` : ''}

📋 SEÇÃO DE RESUMO OBRIGATÓRIA (penúltima H2):
- Título: "Resumo: [número] passos/dicas para [objetivo]"
- Lista em bullets de TODOS os pontos principais do artigo
- Uma linha por ponto, máximo 10 palavras
- Formato de checklist visual

⛔ SEÇÃO FINAL OBRIGATÓRIA (última H2 - SEM EXCEÇÕES):
- Título EXATO: "## Próximo passo" (NÃO use variações!)
- ⚠️ QUALQUER outro título será REJEITADO automaticamente
- NÃO use: "Conclusão", "Considerações Finais", "Direto ao ponto", "Saiba Mais", ou QUALQUER variação
- Primeiro parágrafo: conecte a dor do artigo com a solução
- Segundo parágrafo: CTA direto dizendo EXATAMENTE o que fazer
- Último parágrafo com CTA em **NEGRITO**:
${editorial_template?.cta_template ? `  **${editorial_template.cta_template}**` : '  **Quem age primeiro, vence.**'}

🖼️ IMAGENS CONTEXTUALIZADAS (${targetImageCount} prompts):
Cada imagem DEVE ser baseada no CONTEÚDO ESPECÍFICO da seção correspondente.
Frequência: 1 imagem a cada ${modelConfig.imageFrequency} seções H2.
Formato obrigatório para cada imagem:
- section_title: Título EXATO do H2 que ilustra
- section_index: Número da seção (1, 2, 3...)
- visual_concept: Conceito visual da IDEIA CENTRAL da seção
- description: Descrição detalhada baseada no TEXTO ESPECÍFICO
- style: "fotografia realista profissional"

${targetImageCount >= 1 ? '- Imagem 1: Representa o PROBLEMA central do artigo' : ''}
${targetImageCount >= 2 ? '- Imagem 2: Representa a SOLUÇÃO ou caminho' : ''}
${targetImageCount >= 3 ? '- Imagem 3: Representa o RESULTADO ou benefício' : ''}
${targetImageCount >= 4 ? '- Imagem 4: Representa INSIGHT específico de uma seção' : ''}
${targetImageCount >= 5 ? '- Imagem 5: Representa o CTA ou próximo passo' : ''}

Cada prompt deve mostrar cenários REAIS de trabalho, não escritórios corporativos.`;

    // Build dynamic tool schema based on targetImageCount and targetWordCount
    const contextEnumValues = ['problem', 'solution', 'result', 'insight', 'cta'].slice(0, targetImageCount);
    
    const toolSchema = {
      type: 'function' as const,
      function: {
        name: 'create_article',
        description: 'Creates a complete SEO-optimized blog article written for business owners, with realistic image prompts and mandatory image descriptions',
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
              description: `CRITICAL: Full article in Markdown with MINIMUM ${targetWordCount} words. This is a HARD requirement - articles with fewer words will be rejected. Use EXACTLY ${section_count} H2 sections. Each section should have at least 200-300 words with detailed examples, practical tips, and real-world scenarios. MUST include: 1) Penultimate H2 titled "Resumo: X passos/dicas para Y" with bullet list summarizing ALL key points, 2) ⚠️ FINAL H2 MUST BE EXACTLY "## Próximo passo" (no variations!) with CTA connecting pain to solution. Follow mandatory structure with short paragraphs (1-3 lines), bullet lists, blockquotes.`
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
            },
            images: {
              type: 'object',
              description: 'MANDATORY block with detailed image descriptions for cover and content images. Must follow niche-specific visual guidelines.',
              properties: {
                cover_image: {
                  type: 'object',
                  description: 'Cover image representing the central problem of the article',
                  properties: {
                    description: { type: 'string', description: 'Detailed description of the cover image showing the main problem. Must be realistic photography, professional style.' },
                    style: { type: 'string', description: 'Visual style: realistic photography, professional, natural lighting' },
                    use_case: { type: 'string', enum: ['capa do artigo'] }
                  },
                  required: ['description', 'style', 'use_case']
                },
                content_images: {
                  type: 'array',
                  description: 'Exactly 3 support images linked to key article sections',
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: 'object',
                    properties: {
                      section: { type: 'string', description: 'H2 section name this image relates to' },
                      description: { type: 'string', description: 'Detailed description of the image reinforcing the section argument. Must be realistic, not stock photos or cartoons.' },
                      style: { type: 'string', description: 'Visual style: realistic photography, natural lighting, professional' },
                      use_case: { type: 'string', enum: ['imagem de apoio'] }
                    },
                    required: ['section', 'description', 'style', 'use_case']
                  }
                }
              },
              required: ['cover_image', 'content_images']
            }
          },
          required: ['title', 'meta_description', 'excerpt', 'content', 'faq', 'reading_time', 'image_prompts', 'images'],
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
    
    // Validate mandatory images block
    if (!articleData.images || typeof articleData.images !== 'object') {
      console.error('AI_OUTPUT_INVALID: Missing images block');
      throw new Error('AI_OUTPUT_INVALID: Bloco "images" obrigatório não foi gerado. O artigo precisa incluir descrições de imagens.');
    }

    const imagesBlock = articleData.images as { 
      cover_image?: { description?: string; style?: string; use_case?: string }; 
      content_images?: Array<{ section?: string; description?: string; style?: string; use_case?: string }> 
    };
    
    if (!imagesBlock.cover_image || !imagesBlock.cover_image.description) {
      console.error('AI_OUTPUT_INVALID: Missing or invalid cover_image');
      throw new Error('AI_OUTPUT_INVALID: Imagem de capa (cover_image) obrigatória não foi gerada corretamente.');
    }
    
    // REGRA GLOBAL: Mínimo 2 imagens internas (artigo sem imagem é rascunho)
    const MIN_INTERNAL_IMAGES = 2;
    
    if (!Array.isArray(imagesBlock.content_images) || imagesBlock.content_images.length < MIN_INTERNAL_IMAGES) {
      console.error(`AI_OUTPUT_INVALID: Invalid content_images - expected at least ${MIN_INTERNAL_IMAGES}, got:`, imagesBlock.content_images?.length || 0);
      throw new Error(`AI_OUTPUT_INVALID: Artigo sem imagem é rascunho. Mínimo ${MIN_INTERNAL_IMAGES} imagens internas obrigatórias. Geradas: ${imagesBlock.content_images?.length || 0}`);
    }
    
    // Validate each content image has required fields
    for (let i = 0; i < imagesBlock.content_images.length; i++) {
      const img = imagesBlock.content_images[i];
      if (!img.description || !img.section) {
        console.error(`AI_OUTPUT_INVALID: content_images[${i}] missing required fields`);
        throw new Error(`AI_OUTPUT_INVALID: Imagem de apoio ${i + 1} está incompleta (falta description ou section).`);
      }
    }
    
    console.log(`Images block validated successfully: cover + ${imagesBlock.content_images.length} content images`);
    
    // REGRA GLOBAL: Última seção DEVE ser "## Próximo passo"
    const MANDATORY_FINAL_SECTION = '## Próximo passo';
    const contentText = articleData.content as string;
    const h2Matches = contentText.match(/^## .+$/gm) || [];
    
    if (h2Matches.length > 0) {
      const lastH2 = h2Matches[h2Matches.length - 1].trim();
      
      if (lastH2 !== MANDATORY_FINAL_SECTION) {
        console.error(`AI_OUTPUT_INVALID: Last H2 is "${lastH2}", expected "${MANDATORY_FINAL_SECTION}"`);
        throw new Error(`AI_OUTPUT_INVALID: A última seção DEVE ser exatamente "${MANDATORY_FINAL_SECTION}". Artigo sem CTA final padronizado é inválido. Encontrado: "${lastH2}"`);
      }
      
      console.log('✅ CTA Final "## Próximo passo" validated');
    } else {
      console.error('AI_OUTPUT_INVALID: No H2 sections found in article');
      throw new Error('AI_OUTPUT_INVALID: Artigo não possui seções H2. Estrutura inválida.');
    }
    
    // ============ VALIDATE EDITORIAL MODEL COMPLIANCE ============
    // Note: contentText already declared above for CTA validation
    
    // Count H2 sections
    const h2Count = (contentText.match(/^## /gm) || []).length;
    if (h2Count < modelConfig.sections.min || h2Count > modelConfig.sections.max) {
      console.warn(`EDITORIAL MODEL WARNING: Article has ${h2Count} H2s, model ${editorial_model} expects ${modelConfig.sections.min}-${modelConfig.sections.max}`);
    }
    
    // Count visual blocks
    const blockMatches = contentText.match(/^[💡⚠️📌✅❝]/gm) || [];
    const blockCount = blockMatches.length;
    
    if (blockCount < modelConfig.visualBlocks.min) {
      console.warn(`EDITORIAL MODEL WARNING: Article has ${blockCount} visual blocks, minimum for ${editorial_model} is ${modelConfig.visualBlocks.min}`);
    }
    if (blockCount > modelConfig.visualBlocks.max) {
      console.warn(`EDITORIAL MODEL WARNING: Article has ${blockCount} visual blocks, maximum for ${editorial_model} is ${modelConfig.visualBlocks.max}`);
    }
    
    // Check for forbidden block types
    const allowedTypes = new Set(modelConfig.visualBlocks.types);
    for (const block of blockMatches) {
      if (!allowedTypes.has(block)) {
        console.warn(`EDITORIAL MODEL WARNING: Block type "${block}" is not allowed for model ${editorial_model}. Allowed: ${modelConfig.visualBlocks.types.join(', ')}`);
      }
    }
    
    // Check for forbidden words
    if (/conclusão|considerações finais/i.test(contentText)) {
      console.warn('EDITORIAL MODEL WARNING: Article contains "Conclusão" or "Considerações Finais" - should use "Direto ao ponto"');
    }
    
    console.log(`EDITORIAL MODEL VALIDATION: Model=${editorial_model}, H2s=${h2Count}, Blocks=${blockCount}`);

    // Validate word count using generation_mode rules (NUNCA sourceValidationRules)
    const rules = generationRules[generation_mode];
    
    let generatedWordCount = (articleData.content as string).split(/\s+/).filter(Boolean).length;
    const minAcceptableWords = Math.max(targetWordCount * rules.minPercent, rules.minWords);
    
    console.log(`Generation Mode: ${generation_mode}, Generated: ${generatedWordCount} words, Min acceptable: ${minAcceptableWords}, Max: ${rules.maxWords}`);
    
    // Apply maximum word limit based on generation_mode
    if (rules.maxWords && generatedWordCount > rules.maxWords) {
      console.log(`Truncating article from ${generatedWordCount} to ${rules.maxWords} words for ${generation_mode} mode`);
      const words = (articleData.content as string).split(/\s+/);
      articleData.content = words.slice(0, rules.maxWords).join(' ');
      generatedWordCount = rules.maxWords;
    }
    
    // Word Count Enforcer: Validate and expand if needed
    if (generatedWordCount < minAcceptableWords && rules.autoRetry && rules.maxRetries > 0) {
      console.warn(`AI_OUTPUT_TOO_SHORT: ${generatedWordCount} words < ${minAcceptableWords} minimum for ${generation_mode} mode`);
      console.log(`Word Count Enforcer: Starting expansion with max ${rules.maxRetries} retries...`);

      // Preserve the original images block before expansion (expansion doesn't regenerate it)
      const originalImagesBlock = articleData.images;
      const originalFaq = articleData.faq;
      const originalImagePrompts = articleData.image_prompts;

      // Run Word Count Enforcer
      const expansion = await expandArticleContent(
        articleData.content as string,
        articleData.title as string,
        targetWordCount,
        generatedWordCount,
        textModel,
        LOVABLE_API_KEY,
        rules.maxRetries
      );

      // Update article content with expanded version
      articleData.content = expansion.content;
      generatedWordCount = expansion.wordCount;

      // Restore preserved blocks (expansion only changes content)
      articleData.images = originalImagesBlock;
      articleData.faq = originalFaq;
      articleData.image_prompts = originalImagePrompts;

      console.log(`Word Count Enforcer: Complete - ${generatedWordCount} words after ${expansion.retries} expansion attempts`);
    }

    // Final validation after expansion attempts
    if (generatedWordCount < minAcceptableWords) {
      const errorData = {
        code: 'AI_OUTPUT_TOO_SHORT',
        message: `O artigo gerado tem ${generatedWordCount} palavras após ${rules.maxRetries || 0} tentativas de expansão. Mínimo: ${Math.round(minAcceptableWords)} palavras.`,
        suggestion: generation_mode === 'fast'
          ? 'Para artigos mais extensos (1500-3000 palavras), utilize o modo Profundo ou importação de PDF, YouTube ou URL.'
          : 'Tente novamente ou forneça mais conteúdo de referência sobre o tema.',
        generatedWords: generatedWordCount,
        requiredWords: Math.round(minAcceptableWords),
        generationMode: generation_mode,
        expansionAttempts: rules.maxRetries || 0
      };
      
      throw new Error(JSON.stringify(errorData));
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
      image_prompts: imagePrompts,
      images: articleData.images // NEW: Bloco obrigatório de descrições de imagens
    };

    console.log(`Article generated successfully: "${article.title}" (${article.content.length} chars, ${article.image_prompts.length} image prompts)`);

    // Log consumption if user_id provided
    const inputTokens = Math.ceil((theme.length + keywords.join(' ').length + 2000) / 4);
    const outputTokens = Math.ceil(article.content.length / 4);
    const estimatedCost = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

    // ========================================================================
    // VALIDAÇÃO DE QUALIDADE PÓS-GERAÇÃO (OBRIGATÓRIA)
    // ========================================================================
    const qualityValidation = validateArticleQuality(article.content, funnel_mode as FunnelMode);
    console.log(`[QUALITY V1.0] Score: ${qualityValidation.score}/100, Passed: ${qualityValidation.passed}`);
    
    if (!qualityValidation.passed) {
      console.warn(`[QUALITY V1.0] Failures: ${qualityValidation.failures.join(' | ')}`);
      // Log warning but don't block - future: implement retry
    }

    if (user_id) {
      try {
        // ========================================================================
        // LOG UNIVERSAL OBRIGATÓRIO - Rastreabilidade completa
        // ========================================================================
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
          metadata: { 
            theme, 
            keywords,
            // CAMPOS OBRIGATÓRIOS - RASTREABILIDADE UNIVERSAL
            prompt_system: 'universal_v1',
            generation_mode: generation_mode, // NOVO - fast ou deep
            funnel_mode: funnel_mode,
            article_goal: article_goal || null,
            strategy_id: strategyId,
            is_default_strategy: isDefaultStrategy,
            quality_passed: qualityValidation.passed,
            quality_score: qualityValidation.score,
            quality_failures: qualityValidation.failures,
            source: source
          },
        });
        console.log("[UNIVERSAL V1.0] Consumption logged with full metadata");
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
