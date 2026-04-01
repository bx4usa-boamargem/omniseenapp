// ============================================================================
// GEO WRITER CORE V2.0 - OmniCore GEO Authority Engine
// ============================================================================
// Motor de geração de Artigos de Autoridade GEO para 2026+
// Otimizado para Google SGE, Perplexity, Gemini, GPT
// ============================================================================

// REGRAS ABSOLUTAS DO GEO WRITER
export const GEO_WRITER_RULES = {
  word_count: { min: 1000, max: 3000 },
  max_retries: 3,
  
  structure: {
    h1_unique: true,
    h2_ultra_specific: true,  // Nunca genéricos
    h3_actionable: true
  },
  
  style: {
    answer_first: true,       // Resposta principal no 1º parágrafo
    paragraphs_max_lines: 4,
    lists_required: true,
    snippetable_blocks: true
  },
  
  semantic_density: {
    name_technologies: true,
    include_dates: true,
    cite_standards: true,
    use_technical_terms: true
  },
  
  eeat: {
    expert_voice: true,
    causal_explanations: true,  // Não apenas descritivo
    depth_over_breadth: true
  },
  
  // V2.0: Regras de linkagem obrigatória
  linking: {
    internal_min: 2,
    external_min: 2
  }
};

// Fontes externas de autoridade aprovadas
export const GEO_EXTERNAL_SOURCES = [
  'support.google.com',
  'developers.google.com',
  'thinkwithgoogle.com',
  'moz.com',
  'ahrefs.com',
  'semrush.com',
  'searchengineland.com',
  'sba.gov',
  'sebrae.com.br',
  'ibge.gov.br',
  'gov.br',
  'census.gov',
  'statista.com',
  'forbes.com',
  'hbr.org'
];

// Regras de linkagem para prompt
export const GEO_LINKING_RULES = `
## REGRAS DE LINKAGEM (OBRIGATÓRIAS - SEM EXCEÇÃO)

📌 LINKS INTERNOS (mínimo 2):
- Use o formato: [texto âncora relevante](/blog/slug-do-artigo)
- Links devem ser contextualmente relevantes
- Distribua ao longo do artigo (não apenas no final)

📌 LINKS EXTERNOS (mínimo 2):
- Cite fontes de autoridade: Google, Moz, Ahrefs, Sebrae, IBGE, etc.
- Use o formato: [fonte](https://url-completa.com)
- Sempre abra em nova aba (adicionar target="_blank" no frontend)

⛔ ARTIGOS SEM LINKS SERÃO AUTOMATICAMENTE REJEITADOS
`;

// Prompt de CTA WhatsApp obrigatório
export function buildWhatsAppCTABlock(whatsapp: string | null): string {
  if (!whatsapp) return '';
  
  const cleanNumber = whatsapp.replace(/\D/g, '');
  return `
## CTA WHATSAPP OBRIGATÓRIO (SEÇÃO FINAL)

O artigo DEVE terminar com um CTA direto para WhatsApp.
Use este formato exato no parágrafo final:

**[Fale agora pelo WhatsApp](https://wa.me/${cleanNumber})**

Ou variação:
**Entre em contato agora: [WhatsApp](https://wa.me/${cleanNumber})**

O número é: ${whatsapp}
`;
}

// Prompt de links internos
export function buildInternalLinksBlock(links: Array<{ title: string; url: string }> | undefined): string {
  if (!links || links.length === 0) return '';
  
  const formattedLinks = links.slice(0, 5).map(l => `- [${l.title}](${l.url})`).join('\n');
  
  return `
## LINKS INTERNOS DISPONÍVEIS (USE PELO MENOS 2)

${formattedLinks}

📌 Insira estes links de forma NATURAL no texto, onde fizerem sentido contextual.
Distribua ao longo do artigo, não concentre no final.
`;
}

// Prompt de fontes externas
export function buildExternalSourcesBlock(sources: Array<{ title: string; url: string }> | undefined): string {
  if (!sources || sources.length === 0) {
    // Default: instrução para usar fontes de autoridade
    return `
## FONTES EXTERNAS (CITE PELO MENOS 2)

Use fontes de autoridade como:
- Google Search Central (support.google.com)
- Moz (moz.com)
- Ahrefs (ahrefs.com)
- Sebrae (sebrae.com.br)
- IBGE (ibge.gov.br)
- Gov.br (gov.br)

Cite dados e estatísticas reais com links para as fontes originais.
`;
  }
  
  const formattedSources = sources.slice(0, 5).map(s => `- ${s.title}: ${s.url}`).join('\n');
  
  return `
## FONTES EXTERNAS PARA CITAR (USE PELO MENOS 2)

${formattedSources}

📌 Cite estas fontes como autoridade quando mencionar dados ou tendências.
`;
}

// Frases de autoridade GEO obrigatórias (usar 3-5 ao longo do texto)
export const GEO_AUTHORITY_PHRASES = [
  "Segundo as atualizações de 2026",
  "Motores generativos priorizam",
  "O consenso técnico atual aponta que",
  "Dados recentes indicam que",
  "A tendência identificada para 2026 é",
  "Conforme padrões atuais de IA",
  "Análises de mercado de Janeiro de 2026 mostram",
  "De acordo com as melhores práticas de 2026"
];

// Padrões de frases proibidas (marcadores de IA genérica)
export const FORBIDDEN_PATTERNS = [
  /^(No mundo de hoje|Atualmente|É comum que|Em um cenário)/i,
  /^(É inegável|É fundamental|É importante|Sabemos que)/i,
  /^(Vivemos em|Estamos em|Em uma era|No contexto)/i,
  /^(Quando falamos|Não é segredo|Com o avanço)/i
];

// Padrões de frases GEO para validação
export const GEO_PHRASE_PATTERNS = [
  /segundo as atualiza/i,
  /motores generativos/i,
  /consenso técnico/i,
  /dados recentes/i,
  /tendência.*202[4-9]/i,
  /conforme padrões/i,
  /análises de mercado/i,
  /melhores práticas de 202[4-9]/i,
  /janeiro de 2026/i,
  /atualização de 2026/i
];

// Identidade do GEO Writer para prompts
export const GEO_WRITER_IDENTITY = `SISTEMA: Você é o Arquiteto de Conteúdo Sênior da Omniseen. Seu objetivo é redigir artigos de dominação de SERP (Google Top 10) e Alta Citabilidade por IA (GEO). Você opera como um especialista de campo, não como um acadêmico.

O motor está expressamente proibido de operar como uma "apostila burocrática".
- Fim da Enrolação Enciclopédica: É proibido gastar parágrafos mastigando "o que é X". O leitor não quer o dicionário; ele quer saber por que usar, quando usar, como aplicar, qual a prioridade e qual erro evitar.
- Fim do Inchaço Artifical: Um texto longo não é um texto profundo. Proibido repetir ideias com palavras diferentes só para bater volume.
- Fim da Abertura Tépida: Proibido começar introduções com "Neste artigo vamos falar sobre...".
- Fim do "Generalismo Robótico": O texto não pode soar como uma IA resumindo a internet. Tem que soar como um operador experiente do mercado, reportando do campo de batalha para resolver a dor do usuário.

SUA REGRA DE OURO (DENSIDADE POR SEÇÃO):
Cada H2 (subtítulo) que você criar deve, obrigatoriamente, cumprir pelo menos UMA das 5 funções abaixo. Se um H2 não fizer isso, ELE DEVE SER CORTADO:
1. Responder uma pergunta real do usuário diretamente.
2. Orientar uma decisão comercial/prática.
3. Comparar opções claramente (Prós/Contras/Casos de uso).
4. Mostrar um erro comum de mercado e como evitá-lo.
5. Trazer uma aplicação prática / passo a passo acionável.

DIRETRIZES DE TOM E ESTILO:
- Answer-First: A introdução deve entregar valor nos primeiros 10 segundos. Mostre a quem serve o texto e a dor resolvida imediatamente.
- Autoridade de Campo: Soe prático. Substitua jargões vazios por exemplos concretos e dados. Mostre que você conhece o cenário operacional.
- AI Readiness: Construa blocos citáveis. Use listas claras, markdowns bem definidos e parágrafos de "definição cirúrgica" que IAs (SGE, ChatGPT) absorvem com facilidade.
- E-E-A-T: Traga explicações causais, não apenas descritivas. Nomeie tecnologias, datas, e cite padrões reais baseados na atualização de 2026.

FLUXO OBRIGATÓRIO DE GERAÇÃO:
Você receberá os metadados da pesquisa (Research Pack), a Keyword Principal e parâmetros de região. Aja com foco na INSTRUÇÃO DE CONTEXTO VISUAL e REGIONAL que receber.
- NORMAL: Mante-se preferencialmente entre 1.000 e 1.300 palavras (teto de 1.500 só se justificado). Texto limpo, prático, tático.
- PREMIUM: Mante-se preferencialmente entre 1.800 e 2.600 palavras (teto de 3.000). Rico em tabelas, metodologias comparativas e detalhamento aprofundado.

ARQUITETURA SEO & GEO OBRIGATÓRIA:
- H1 Magnético e Específico.
- H2 e H3 conduzidos estritamente pelas métricas de busca e SERP real. Nada decorativo.
- Alta densidade de Entidades Nomeadas (termos técnicos do nicho e localismo).
- Incorporação de Contexto Local natural, provando autoridade na região informada, mencionando CEP, bairros ou proximidade contextual.
- LINKAGEM OBRIGATÓRIA: Mínimo 2 links internos e 2 links externos distribuídos de forma orgânica ao longo do texto.`;

// Interface para dados de pesquisa do Perplexity
export interface GeoResearchData {
  facts: string[];
  trends: string[];
  sources: string[];
  rawQuery: string;
  fetchedAt: string;
}

// Interface para território
export interface TerritoryData {
  official_name: string | null;
  neighborhood_tags: string[] | null;
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
}

// Interface para validação GEO completa
export interface GeoValidationResult {
  passed: boolean;
  issues: string[];
  metrics: {
    wordCount: number;
    geoPhrasesCount: number;
    hasAnswerFirst: boolean;
    hasTerritorialMentions: boolean;
    internalLinksCount: number;
    externalLinksCount: number;
    hasWhatsAppCTA: boolean;
  };
}

// V3.1: Refactored to use AI Provider Layer
// REGRA: Todas as chamadas de IA passam pelo aiProviders.ts
import { callResearch } from './aiProviders.ts';

// Função para buscar dados de pesquisa via Provider Layer
// Primary: Perplexity Sonar-Pro → Fallback: Google Gemini with Grounding
export async function fetchGeoResearchData(
  theme: string,
  territory: TerritoryData | null,
  _PERPLEXITY_API_KEY: string,  // Deprecated: now uses aiProviders internally
  _GOOGLE_AI_KEY?: string,     // Deprecated: now uses aiProviders internally
  supabaseClient?: any,  // Cliente Supabase para logging
  blogId?: string,       // Blog ID para correlação
  articleId?: string     // Article ID para correlação direta
): Promise<GeoResearchData | null> {
  const territorialContext = territory?.official_name 
    ? ` na região de ${territory.official_name}` 
    : '';
  
  const query = `${theme}${territorialContext} tendências 2026 dados estatísticas Brasil`;
  
  const systemPrompt = `Você é um pesquisador especializado em coletar dados factuais e tendências de mercado.
Retorne APENAS um JSON válido no formato:
{
  "facts": ["fato 1", "fato 2", ...],
  "trends": ["tendência 1", "tendência 2", ...],
  "sources": ["fonte 1", "fonte 2", ...]
}

Regras:
- Fatos devem ser dados específicos, números, estatísticas
- Tendências devem ser insights de mercado para 2026
- Fontes devem ser URLs ou nomes de instituições citadas
- Máximo 5 itens por categoria`;

  console.log(`[GEO RESEARCH] Fetching research data for theme: "${theme}" via AI Provider Layer`);

  // V3.1: Use unified provider layer (Primary: Perplexity, Fallback: Gemini)
  const result = await callResearch({
    query: `Pesquise dados factuais sobre: ${query}`,
    systemPrompt,
    maxTokens: 1000
  });

  if (!result.success || !result.data) {
    console.warn('[GEO RESEARCH] Provider layer returned no data');
    return null;
  }

  const { data, provider, usedFallback, fallbackReason } = result;

  console.log(`[GEO RESEARCH] ✅ Data received from ${provider}${usedFallback ? ' (FALLBACK)' : ''}`);
  if (fallbackReason) {
    console.log(`[GEO RESEARCH] Fallback reason: ${fallbackReason}`);
  }

  // Log usage to ai_usage_logs
  if (supabaseClient && blogId) {
    try {
      await supabaseClient.from('ai_usage_logs').insert({
        blog_id: blogId,
        provider: provider,
        endpoint: 'geo-research',
        cost_usd: provider === 'perplexity' ? 0.015 : 0.002,
        tokens_used: 1000,
        success: true,
        metadata: {
          phase: 'geo_research',
          model: provider === 'perplexity' ? 'sonar-pro' : 'gemini-2.0-flash-exp',
          source: 'PromptPy',
          theme,
          territory: territory?.official_name || null,
          article_id: articleId || null,
          facts_count: (data.facts || []).length,
          trends_count: (data.trends || []).length,
          used_fallback: usedFallback,
          fallback_reason: fallbackReason || null,
          duration_ms: result.durationMs
        }
      });
      console.log('[GEO RESEARCH] Usage logged to ai_usage_logs');
    } catch (logError) {
      console.error('[GEO RESEARCH] Failed to log usage:', logError);
    }
  }
  
  return {
    facts: data.facts || [],
    trends: data.trends || [],
    sources: data.sources || data.citations || [],
    rawQuery: query,
    fetchedAt: new Date().toISOString()
  };
}

// Função para injetar dados de pesquisa no prompt
export function buildResearchInjection(researchData: GeoResearchData | null): string {
  // SECURITY/GOVERNANCE: Do NOT allow "generic" research. If research is missing,
  // the pipeline must abort upstream.
  if (!researchData) {
    return `\n## DADOS DE PESQUISA\n\n⛔ Pesquisa real não disponível. O pipeline deve BLOQUEAR a geração.\n`;
  }

  return `
## DADOS DE PESQUISA REAL (USE OBRIGATORIAMENTE)

📊 FATOS VERIFICADOS:
${researchData.facts.map(f => `- ${f}`).join('\n')}

📈 TENDÊNCIAS 2026:
${researchData.trends.map(t => `- ${t}`).join('\n')}

📚 FONTES CITÁVEIS:
${researchData.sources.map(s => `- ${s}`).join('\n')}

⛔ VOCÊ DEVE incorporar estes dados no artigo de forma natural.
Use as estatísticas para dar autoridade ao conteúdo.
Cite as fontes quando mencionar dados específicos.
`;
}

// Função para construir contexto territorial
export function buildTerritorialContext(territory: TerritoryData | null): string {
  if (!territory || !territory.official_name) {
    return '';
  }

  const neighborhoods = territory.neighborhood_tags?.slice(0, 5) || [];
  const neighborhoodList = neighborhoods.length > 0 
    ? neighborhoods.join(', ')
    : 'bairros da região';

  return `
## ANCORAGEM TERRITORIAL OBRIGATÓRIA

🌍 REGIÃO: ${territory.official_name}
📍 BAIRROS: ${neighborhoodList}
${territory.lat && territory.lng ? `🗺️ COORDENADAS: ${territory.lat}, ${territory.lng}` : ''}

INSTRUÇÕES:
1. MENCIONE a região e/ou bairros pelo menos 2x no artigo
2. Use contexto local para exemplos práticos
3. Integre os nomes naturalmente, sem forçar
4. Posicione a empresa como autoridade LOCAL

Exemplo de menção natural:
"Empresas em ${neighborhoods[0] || territory.official_name} que adotaram..."
"Clientes da região de ${territory.official_name} frequentemente..."

---

`;
}

// Função para contar palavras limpas (sem markdown)
export function countGeoWords(content: string): number {
  const cleaned = content
    .replace(/#+\s/g, '')        // Remove headings
    .replace(/\*\*|__/g, '')     // Remove bold
    .replace(/\*|_/g, '')        // Remove italic
    .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`.*?`/g, '')       // Remove inline code
    .replace(/>/g, '')           // Remove blockquotes
    .replace(/[-*]\s/g, '');     // Remove list markers
  
  return cleaned.split(/\s+/).filter(w => w.length > 0).length;
}

// Função para validar se o artigo tem frases GEO suficientes
export function countGeoPhrasesInContent(content: string): number {
  let count = 0;
  for (const pattern of GEO_PHRASE_PATTERNS) {
    if (pattern.test(content)) {
      count++;
    }
  }
  return count;
}

// Função para verificar padrão answer-first
export function hasAnswerFirstPattern(content: string): boolean {
  const lines = content.split('\n');
  
  // Skip H1 and empty lines to find first paragraph
  let firstParagraph = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;  // Skip headings
    if (trimmed.length === 0) continue;     // Skip empty lines
    firstParagraph = trimmed;
    break;
  }

  if (!firstParagraph || firstParagraph.length < 50) return false;

  // Check for forbidden intro patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(firstParagraph)) {
      return false;
    }
  }

  // Check for answer-first indicators (contains direct information)
  const answerIndicators = /\d+|como|o que|por que|quando|onde|quem|qual|existem|são|é|pode|deve/i;
  return answerIndicators.test(firstParagraph);
}

// Função para verificar menções territoriais
export function hasTerritorialMentions(content: string, neighborhoods: string[]): boolean {
  if (!neighborhoods || neighborhoods.length === 0) return true; // Pass if no territory
  
  const contentLower = content.toLowerCase();
  return neighborhoods.some(n => contentLower.includes(n.toLowerCase()));
}

// V2.0: Função para contar links internos
export function countInternalLinks(content: string): number {
  // Match markdown links that start with / (internal paths)
  const internalLinkPattern = /\[.+?\]\(\/.+?\)/g;
  const matches = content.match(internalLinkPattern);
  return matches?.length || 0;
}

// V2.0: Função para contar links externos
export function countExternalLinks(content: string): number {
  // Match markdown links that start with http:// or https://
  const externalLinkPattern = /\[.+?\]\(https?:\/\/.+?\)/g;
  const matches = content.match(externalLinkPattern);
  return matches?.length || 0;
}

// V2.0: Função para verificar CTA WhatsApp
export function hasWhatsAppCTA(content: string): boolean {
  // Check for WhatsApp links
  const whatsappPattern = /wa\.me\/|whatsapp\.com\/|whatsapp/i;
  return whatsappPattern.test(content);
}

// V2.0: Validação GEO completa
export function validateGeoArticleFull(
  content: string,
  territory: TerritoryData | null,
  whatsapp: string | null
): GeoValidationResult {
  const wordCount = countGeoWords(content);
  const geoPhrasesCount = countGeoPhrasesInContent(content);
  const answerFirst = hasAnswerFirstPattern(content);
  const territorialMentions = territory?.neighborhood_tags?.length 
    ? hasTerritorialMentions(content, territory.neighborhood_tags)
    : true;
  const internalLinks = countInternalLinks(content);
  const externalLinks = countExternalLinks(content);
  const whatsappCTA = whatsapp ? hasWhatsAppCTA(content) : true;

  const issues: string[] = [];

  // Word count validation
  if (wordCount < GEO_WRITER_RULES.word_count.min) {
    issues.push(`Word count: ${wordCount}/${GEO_WRITER_RULES.word_count.min} mínimo`);
  }
  if (wordCount > GEO_WRITER_RULES.word_count.max) {
    issues.push(`Word count: ${wordCount}/${GEO_WRITER_RULES.word_count.max} máximo`);
  }

  // Answer-first validation
  if (!answerFirst) {
    issues.push('Falta padrão Answer-First no primeiro parágrafo');
  }

  // GEO phrases validation (minimum 2)
  if (geoPhrasesCount < 2) {
    issues.push(`Frases GEO: ${geoPhrasesCount}/2 mínimo`);
  }

  // Territorial mentions validation
  if (territory?.neighborhood_tags?.length && !territorialMentions) {
    issues.push('Falta menção ao território/bairros');
  }

  // Internal links validation
  if (internalLinks < GEO_WRITER_RULES.linking.internal_min) {
    issues.push(`Links internos: ${internalLinks}/${GEO_WRITER_RULES.linking.internal_min} mínimo`);
  }

  // External links validation
  if (externalLinks < GEO_WRITER_RULES.linking.external_min) {
    issues.push(`Links externos: ${externalLinks}/${GEO_WRITER_RULES.linking.external_min} mínimo`);
  }

  // WhatsApp CTA validation
  if (whatsapp && !whatsappCTA) {
    issues.push('Falta CTA com WhatsApp na seção final');
  }

  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      wordCount,
      geoPhrasesCount,
      hasAnswerFirst: answerFirst,
      hasTerritorialMentions: territorialMentions,
      internalLinksCount: internalLinks,
      externalLinksCount: externalLinks,
      hasWhatsAppCTA: whatsappCTA
    }
  };
}

// Função para gerar instruções de correção GEO
export function generateGeoCorrectionInstructions(
  wordCount: number,
  geoPhrasesCount: number,
  hasAnswerFirst: boolean,
  hasTerritorial: boolean,
  territoriesAvailable: boolean,
  internalLinksCount: number = 0,
  externalLinksCount: number = 0,
  hasWhatsApp: boolean = true
): string {
  const corrections: string[] = [];

  if (wordCount < GEO_WRITER_RULES.word_count.min) {
    corrections.push(`⛔ WORD COUNT: O artigo tem ${wordCount} palavras, mas PRECISA ter no mínimo ${GEO_WRITER_RULES.word_count.min}. EXPANDA cada seção com mais exemplos, dados e explicações causais.`);
  }

  if (wordCount > GEO_WRITER_RULES.word_count.max) {
    corrections.push(`⛔ WORD COUNT: O artigo tem ${wordCount} palavras, mas não deve ultrapassar ${GEO_WRITER_RULES.word_count.max}. CONDENSE mantendo autoridade e removendo redundâncias.`);
  }

  if (geoPhrasesCount < 2) {
    corrections.push(`⛔ GEO PHRASES: O artigo tem apenas ${geoPhrasesCount} frases de autoridade temporal. ADICIONE pelo menos 2 frases como "Segundo as atualizações de 2026..." ou "Motores generativos priorizam..."`);
  }

  if (!hasAnswerFirst) {
    corrections.push(`⛔ ANSWER-FIRST: O primeiro parágrafo NÃO segue o padrão answer-first. REESCREVA a introdução para entregar a resposta principal imediatamente, sem preâmbulos genéricos.`);
  }

  if (territoriesAvailable && !hasTerritorial) {
    corrections.push(`⛔ TERRITORIAL: O artigo NÃO menciona a localidade/bairros especificados. ADICIONE menções naturais à região no texto.`);
  }

  if (internalLinksCount < GEO_WRITER_RULES.linking.internal_min) {
    corrections.push(`⛔ LINKS INTERNOS: O artigo tem apenas ${internalLinksCount} links internos. ADICIONE pelo menos ${GEO_WRITER_RULES.linking.internal_min} links para outros artigos do blog usando o formato [texto âncora](/blog/slug).`);
  }

  if (externalLinksCount < GEO_WRITER_RULES.linking.external_min) {
    corrections.push(`⛔ LINKS EXTERNOS: O artigo tem apenas ${externalLinksCount} links externos. ADICIONE pelo menos ${GEO_WRITER_RULES.linking.external_min} links para fontes de autoridade (Google, Moz, Sebrae, IBGE, etc.) usando o formato [fonte](https://url).`);
  }

  if (!hasWhatsApp) {
    corrections.push(`⛔ CTA WHATSAPP: A seção final NÃO contém um CTA com WhatsApp. ADICIONE um link direto para WhatsApp no formato [Fale conosco](https://wa.me/NUMERO).`);
  }

  if (corrections.length === 0) return '';

  return `
⛔ O ARTIGO ANTERIOR FOI REJEITADO PELO OMNICORE GEO QUALITY GATE.

## CORREÇÕES OBRIGATÓRIAS:

${corrections.join('\n\n')}

## LEMBRE-SE:
- Cada artigo deve parecer "Um guia oficial que uma IA confiaria"
- Use frases de autoridade temporal (2026)
- Mantenha answer-first pattern
- Word count: ${GEO_WRITER_RULES.word_count.min}-${GEO_WRITER_RULES.word_count.max} palavras
- Mínimo 2 links internos + 2 links externos
- CTA com WhatsApp obrigatório

⚠️ SE ESTAS CORREÇÕES NÃO FOREM APLICADAS, O ARTIGO SERÁ REJEITADO NOVAMENTE.
`;
}

// =============================================================================
// NICHE E-E-A-T PHRASES (ADIÇÃO V2.1 - Sprint 3)
// Motor de Artigos de Autoridade Local
// =============================================================================

/**
 * Frases de E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
 * contextualizadas por nicho
 * 
 * Placeholders disponíveis:
 * - {{business_name}} - Nome da empresa
 * - {{city}} - Cidade
 * - {{years}} - Anos de experiência
 * - {{neighborhood}} - Bairro 1
 * - {{other_neighborhood}} - Bairro 2
 */
export const NICHE_EAT_PHRASES: Record<string, string[]> = {
  
  // ========== PEST CONTROL ==========
  pest_control: [
    "Na {{business_name}}, vemos diariamente como o clima de {{city}} afeta infestações de pragas.",
    "Com {{years}} anos atendendo {{city}}, nossa equipe aprendeu que tratamentos preventivos são essenciais.",
    "{{city}} tem características únicas de clima e urbanização que exigem abordagem específica no controle de pragas.",
    "Nossos técnicos conhecem profundamente os desafios de {{city}}, desde {{neighborhood}} até {{other_neighborhood}}.",
    "A {{business_name}} já eliminou pragas em mais de 5.000 imóveis em {{city}}.",
    "Em {{city}}, o período de chuvas intensifica a presença de cupins e baratas - estamos preparados."
  ],
  
  // ========== PLUMBING ==========
  plumbing: [
    "A {{business_name}} atende {{city}} há {{years}} anos e conhece cada peculiaridade da rede de esgoto da região.",
    "Em {{city}}, problemas de entupimento variam por bairro devido à idade das tubulações.",
    "Atendemos emergências 24h em toda {{city}}, de {{neighborhood}} a {{other_neighborhood}}.",
    "Nossa experiência em {{city}} nos ensinou que manutenção preventiva evita 80% dos problemas hidráulicos.",
    "Conhecemos a infraestrutura de {{city}} como a palma da nossa mão - cada rua tem suas particularidades.",
    "A {{business_name}} já desentupiu mais de 10.000 residências em {{city}}."
  ],
  
  // ========== ROOFING ==========
  roofing: [
    "{{city}} tem clima que exige cuidados específicos com telhados.",
    "Com {{years}} anos de experiência em {{city}}, sabemos quais telhas funcionam melhor na região.",
    "A {{business_name}} já instalou mais de 2.000 telhados em {{city}} e conhece cada desafio local.",
    "{{city}} tem regulamentações específicas para telhados que respeitamos rigorosamente.",
    "De {{neighborhood}} a {{other_neighborhood}}, atendemos toda {{city}} com qualidade garantida.",
    "Nossos profissionais são treinados para as condições climáticas de {{city}}."
  ],
  
  // ========== IMAGE CONSULTING ==========
  image_consulting: [
    "Em {{city}}, tendências de moda variam entre {{neighborhood}} e {{other_neighborhood}}.",
    "A {{business_name}} conhece o perfil de cada bairro de {{city}} e adapta consultoria ao contexto local.",
    "{{city}} tem eventos corporativos com dress codes específicos que dominamos.",
    "Atendemos {{city}} há {{years}} anos e conhecemos as principais boutiques e fornecedores da região.",
    "Nossa expertise em {{city}} inclui conhecimento de lojas, personal shoppers e tendências locais.",
    "Cada cliente de {{city}} recebe consultoria personalizada para seu estilo de vida na cidade."
  ],
  
  // ========== DENTAL ==========
  dental: [
    "A {{business_name}} é referência em odontologia em {{city}} com mais de {{years}} anos de atuação.",
    "Atendemos famílias de toda {{city}}, de {{neighborhood}} a {{other_neighborhood}}.",
    "{{city}} tem perfil demográfico único que influencia nos tratamentos mais procurados.",
    "Nossa equipe está registrada no CRO e atualizada com últimas técnicas disponíveis em {{city}}.",
    "Já realizamos mais de 50.000 atendimentos em {{city}}, sempre com excelência.",
    "Conhecemos as necessidades odontológicas específicas da população de {{city}}."
  ],
  
  // ========== LEGAL ==========
  legal: [
    "O escritório {{business_name}} atua em {{city}} há {{years}} anos e conhece particularidades da Justiça local.",
    "Tribunais de {{city}} têm procedimentos específicos que dominamos.",
    "Já representamos centenas de clientes em {{city}}, de {{neighborhood}} a {{other_neighborhood}}.",
    "{{city}} tem legislação municipal que pode afetar seu caso - estamos sempre atualizados.",
    "Nossa expertise em {{city}} inclui relacionamento com cartórios e fóruns da região.",
    "Conhecemos cada vara e cada procedimento dos tribunais de {{city}}."
  ],
  
  // ========== ACCOUNTING ==========
  accounting: [
    "A {{business_name}} atende empresas de {{city}} há {{years}} anos com excelência contábil.",
    "Conhecemos a legislação tributária municipal de {{city}} em detalhes.",
    "De {{neighborhood}} a {{other_neighborhood}}, atendemos empreendedores de toda {{city}}.",
    "{{city}} tem incentivos fiscais específicos que ajudamos nossos clientes a aproveitar.",
    "Nossa equipe domina as particularidades tributárias da Prefeitura de {{city}}.",
    "Já ajudamos mais de 500 empresas de {{city}} a otimizar sua contabilidade."
  ],
  
  // ========== REAL ESTATE ==========
  real_estate: [
    "A {{business_name}} conhece cada bairro de {{city}} como ninguém.",
    "Com {{years}} anos no mercado imobiliário de {{city}}, sabemos onde estão as melhores oportunidades.",
    "De {{neighborhood}} a {{other_neighborhood}}, acompanhamos a valorização de toda {{city}}.",
    "{{city}} tem dinâmica imobiliária única que exige expertise local.",
    "Já realizamos mais de 1.000 negócios imobiliários em {{city}}.",
    "Conhecemos cada rua, cada condomínio e cada tendência de {{city}}."
  ],
  
  // ========== AUTOMOTIVE ==========
  automotive: [
    "A {{business_name}} atende motoristas de {{city}} há {{years}} anos.",
    "Conhecemos os desafios do trânsito de {{city}} e como isso afeta os veículos.",
    "De {{neighborhood}} a {{other_neighborhood}}, atendemos toda {{city}} com qualidade.",
    "{{city}} tem condições de estradas que exigem manutenção específica.",
    "Já atendemos mais de 20.000 veículos em {{city}}.",
    "Nossa equipe conhece os problemas mais comuns dos carros de {{city}}."
  ],
  
  // ========== CONSTRUCTION ==========
  construction: [
    "A {{business_name}} construiu mais de 500 projetos em {{city}}.",
    "Com {{years}} anos de experiência, conhecemos cada regulamentação de {{city}}.",
    "De {{neighborhood}} a {{other_neighborhood}}, já atuamos em toda {{city}}.",
    "{{city}} tem solo e clima que exigem técnicas construtivas específicas.",
    "Conhecemos cada processo de aprovação na Prefeitura de {{city}}.",
    "Nossa expertise inclui projetos residenciais e comerciais em toda {{city}}."
  ],
  
  // ========== BEAUTY ==========
  beauty: [
    "A {{business_name}} é referência em beleza em {{city}} há {{years}} anos.",
    "Conhecemos as tendências e preferências estéticas de {{city}}.",
    "De {{neighborhood}} a {{other_neighborhood}}, atendemos clientes exigentes de toda {{city}}.",
    "{{city}} tem perfil de beleza único que nossa equipe domina.",
    "Já realizamos mais de 100.000 atendimentos em {{city}}.",
    "Nossa equipe está sempre atualizada com as últimas tendências de {{city}}."
  ],
  
  // ========== EDUCATION ==========
  education: [
    "A {{business_name}} forma alunos em {{city}} há {{years}} anos.",
    "Conhecemos as exigências educacionais específicas de {{city}}.",
    "De {{neighborhood}} a {{other_neighborhood}}, atendemos estudantes de toda {{city}}.",
    "{{city}} tem demandas educacionais únicas que nossa metodologia atende.",
    "Já formamos mais de 10.000 alunos em {{city}}.",
    "Nossa expertise inclui preparação para vestibulares e concursos locais de {{city}}."
  ],
  
  // ========== TECHNOLOGY ==========
  technology: [
    "A {{business_name}} atende empresas de tecnologia de {{city}} há {{years}} anos.",
    "Conhecemos o ecossistema tech de {{city}} e suas particularidades.",
    "De {{neighborhood}} a {{other_neighborhood}}, atendemos startups e empresas de toda {{city}}.",
    "{{city}} tem polo tecnológico crescente que acompanhamos de perto.",
    "Já implementamos soluções em mais de 500 empresas de {{city}}.",
    "Nossa equipe domina as tendências tecnológicas do mercado de {{city}}."
  ],
  
  // ========== DEFAULT (FALLBACK) ==========
  default: [
    "A {{business_name}} é referência em {{city}} com mais de {{years}} anos de atuação.",
    "Atendemos clientes de toda {{city}}, de {{neighborhood}} a {{other_neighborhood}}.",
    "Com {{years}} anos de experiência, conhecemos as necessidades específicas de {{city}}.",
    "Nossa equipe está preparada para atender qualquer demanda em {{city}}.",
    "Já realizamos milhares de atendimentos em {{city}} com excelência.",
    "Conhecemos {{city}} como a palma da nossa mão."
  ]
};

// =============================================================================
// FUNÇÃO: INJECT LOCAL EXPERIENCE
// =============================================================================

/**
 * Injeta frases de experiência local (E-E-A-T) contextualizadas
 * 
 * @param niche - Nicho do negócio
 * @param city - Cidade
 * @param businessName - Nome da empresa
 * @param yearsInBusiness - Anos de experiência (opcional, default: 10)
 * @param neighborhoods - Array de bairros (opcional)
 * @returns String com 1-2 frases de E-E-A-T para inserir no artigo
 * 
 * @example
 * injectLocalExperience('plumbing', 'São Paulo', 'Desentup Rápido', 15, ['Pinheiros', 'Vila Madalena'])
 * // "A Desentup Rápido atende São Paulo há 15 anos e conhece cada peculiaridade da rede de esgoto da região. Em São Paulo, problemas de entupimento variam por bairro devido à idade das tubulações."
 */
export function injectLocalExperience(
  niche: string,
  city: string,
  businessName: string,
  yearsInBusiness?: number,
  neighborhoods?: string[]
): string {
  console.log(`[geoWriterCore] Injetando E-E-A-T para nicho: ${niche}, cidade: ${city}`);
  
  // Obter frases do nicho ou usar default
  const phrases = NICHE_EAT_PHRASES[niche] || NICHE_EAT_PHRASES['default'];
  
  // Selecionar 1-2 frases aleatórias
  const selectedPhrases = pickRandomEatPhrases(phrases, 2);
  
  // Valores default para placeholders
  const years = yearsInBusiness || 10;
  const neighborhood = neighborhoods?.[0] || 'centro';
  const otherNeighborhood = neighborhoods?.[1] || 'região metropolitana';
  
  // Substituir placeholders
  const processedPhrases = selectedPhrases.map(phrase => 
    phrase
      .replace(/\{\{business_name\}\}/g, businessName)
      .replace(/\{\{city\}\}/g, city)
      .replace(/\{\{years\}\}/g, String(years))
      .replace(/\{\{neighborhood\}\}/g, neighborhood)
      .replace(/\{\{other_neighborhood\}\}/g, otherNeighborhood)
  );
  
  const result = processedPhrases.join(' ');
  
  console.log(`[geoWriterCore] E-E-A-T gerado: ${result.substring(0, 100)}...`);
  
  return result;
}

/**
 * Seleciona frases aleatórias sem repetição
 */
function pickRandomEatPhrases(phrases: string[], count: number): string[] {
  if (phrases.length <= count) return phrases;
  
  const shuffled = [...phrases].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Retorna lista de nichos com E-E-A-T configurado
 */
export function getAvailableNichesWithEat(): string[] {
  return Object.keys(NICHE_EAT_PHRASES);
}

/**
 * Verifica se nicho tem frases E-E-A-T específicas
 */
export function hasNicheSpecificEat(niche: string): boolean {
  return niche in NICHE_EAT_PHRASES && niche !== 'default';
}