// ============================================================================
// GEO WRITER CORE V2.0 - OmniCore GEO Authority Engine
// ============================================================================
// Motor de geração de Artigos de Autoridade GEO para 2026+
// Otimizado para Google SGE, Perplexity, Gemini, GPT
// ============================================================================

// REGRAS ABSOLUTAS DO GEO WRITER
export const GEO_WRITER_RULES = {
  word_count: { min: 1200, max: 3000 },
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
export const GEO_WRITER_IDENTITY = `Você é o OmniCore GEO Writer da plataforma Omniseen.

Sua função é gerar ARTIGOS DE AUTORIDADE GEO para 2026+, otimizados
tanto para humanos quanto para motores generativos (Google SGE, Perplexity, Gemini, GPT).

REGRAS ABSOLUTAS:

1. O artigo final DEVE ter entre 1.200 e 3.000 palavras.

2. Estrutura obrigatória:
   - H1 único, direto e informativo
   - Múltiplos H2 ultra-específicos (nunca genéricos)
   - H3 explicativos e acionáveis

3. Estilo:
   - Answer-first (a resposta principal já no primeiro parágrafo)
   - Parágrafos curtos (2–4 linhas)
   - Listas, bullets e blocos "snippetáveis"

4. GEO-first:
   - Escreva como se o texto fosse ser resumido por IA
   - Use frases como:
     "Segundo as atualizações de 2026…"
     "Motores generativos priorizam…"
     "O consenso técnico atual aponta que…"

5. Densidade semântica:
   - Nomeie tecnologias, datas, conceitos e padrões reais
   - Use termos técnicos com clareza

6. E-E-A-T:
   - Trate o texto como escrito por um especialista real
   - Traga explicações causais, não apenas descritivas

7. Territorialização (quando houver):
   - Incluir menções naturais a bairros e áreas reais
   - Inserir contexto local como prova de autoridade

8. LINKAGEM OBRIGATÓRIA:
   - Mínimo 2 links internos para outros artigos do blog
   - Mínimo 2 links externos para fontes de autoridade
   - Distribuir links ao longo do texto, não concentrar no final

O objetivo não é "criar um post".
É criar um ATIVO DE AUTORIDADE que possa ser:
- Citado por IAs
- Resumido pelo Google SGE
- Usado como base factual por motores generativos
- Envelhecer bem ao longo dos anos

Cada artigo deve parecer:
"Um guia oficial que uma IA confiaria para responder uma pergunta complexa."`;

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

// Função para buscar dados de pesquisa via Perplexity (pré-geração)
export async function fetchGeoResearchData(
  theme: string,
  territory: TerritoryData | null,
  PERPLEXITY_API_KEY: string
): Promise<GeoResearchData | null> {
  try {
    console.log(`[GEO RESEARCH] Fetching research data for theme: "${theme}"`);
    
    const territorialContext = territory?.official_name 
      ? ` na região de ${territory.official_name}` 
      : '';
    
    const query = `${theme}${territorialContext} tendências 2026 dados estatísticas Brasil`;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `Você é um pesquisador especializado em coletar dados factuais e tendências de mercado.
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
- Máximo 5 itens por categoria`
          },
          {
            role: 'user',
            content: `Pesquise dados factuais sobre: ${query}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      console.warn(`[GEO RESEARCH] Perplexity API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[GEO RESEARCH] No valid JSON in response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      facts: parsed.facts || [],
      trends: parsed.trends || [],
      sources: parsed.sources || [],
      rawQuery: query,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[GEO RESEARCH] Error fetching data:', error);
    return null;
  }
}

// Função para injetar dados de pesquisa no prompt
export function buildResearchInjection(researchData: GeoResearchData | null): string {
  if (!researchData) {
    return `
## DADOS DE PESQUISA (GENÉRICO)
Use dados e estatísticas plausíveis para 2026.
Cite tendências de mercado atuais.
Mencione fontes como Sebrae, IBGE, Google quando aplicável.
`;
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
