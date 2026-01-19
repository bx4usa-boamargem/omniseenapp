// ============================================================================
// GEO WRITER CORE V1.0 - OmniCore GEO Authority Engine
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
  }
};

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

// Função para buscar dados de pesquisa via Perplexity (pré-geração)
export async function fetchGeoResearchData(
  theme: string,
  territory: TerritoryData | null,
  PERPLEXITY_API_KEY: string
): Promise<GeoResearchData | null> {
  try {
    console.log(`[GEO RESEARCH] Fetching research data for theme: "${theme}"`);
    
    const territorialContext = territory?.official_name 
      ? `\n- Contexto local: ${territory.official_name}${territory.neighborhood_tags?.length ? ` (bairros: ${territory.neighborhood_tags.join(', ')})` : ''}`
      : '';

    const researchPrompt = `Pesquise dados atualizados sobre: "${theme}"

Foco (retorne informações FACTUAIS e ATUAIS):
- Tendências GEO 2026 relevantes para o tema
- Como IAs (Google SGE, Perplexity) avaliam autoridade em conteúdo sobre este assunto
- Mudanças recentes em SEO generativo relacionadas ao tema
- Estatísticas ou dados de mercado relevantes${territorialContext}

Retorne um JSON estruturado com:
{
  "facts": ["fato 1", "fato 2", ...],   // 3-5 fatos verificáveis
  "trends": ["tendência 1", ...],        // 2-3 tendências de 2026
  "sources": ["fonte 1", ...]            // URLs ou referências
}

IMPORTANTE: Retorne APENAS o JSON válido, sem texto adicional.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um pesquisador especializado em buscar dados atuais e factuais. Retorne apenas JSON válido com fatos verificáveis, tendências de 2026 e fontes.' 
          },
          { role: 'user', content: researchPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`[GEO RESEARCH] Perplexity API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('[GEO RESEARCH] Empty response from Perplexity');
      return null;
    }

    // Parse JSON response
    try {
      // Extract JSON from potential markdown code blocks
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      
      const parsed = JSON.parse(jsonContent.trim());
      
      const researchData: GeoResearchData = {
        facts: Array.isArray(parsed.facts) ? parsed.facts.slice(0, 5) : [],
        trends: Array.isArray(parsed.trends) ? parsed.trends.slice(0, 3) : [],
        sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 3) : [],
        rawQuery: theme,
        fetchedAt: new Date().toISOString()
      };

      console.log(`[GEO RESEARCH] ✅ Fetched ${researchData.facts.length} facts, ${researchData.trends.length} trends`);
      return researchData;
    } catch (parseError) {
      console.error('[GEO RESEARCH] Failed to parse Perplexity response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[GEO RESEARCH] Error fetching research data:', error);
    return null;
  }
}

// Função para construir injeção de dados de pesquisa no prompt
export function buildResearchInjection(researchData: GeoResearchData | null): string {
  if (!researchData || (researchData.facts.length === 0 && researchData.trends.length === 0)) {
    return '';
  }

  const factsSection = researchData.facts.length > 0
    ? `📊 DADOS ATUALIZADOS PARA USAR (fonte: pesquisa em tempo real):
${researchData.facts.map(f => `- ${f}`).join('\n')}`
    : '';

  const trendsSection = researchData.trends.length > 0
    ? `🔥 TENDÊNCIAS 2026:
${researchData.trends.map(t => `- ${t}`).join('\n')}`
    : '';

  const sourcesSection = researchData.sources.length > 0
    ? `📎 FONTES PARA CITAR:
${researchData.sources.join('\n')}`
    : '';

  return `

---
## DADOS DE PESQUISA REAL-TIME (OBRIGATÓRIO USAR NO ARTIGO)

${factsSection}

${trendsSection}

${sourcesSection}

⚠️ USE ESTES DADOS NATURALMENTE NO TEXTO para aumentar autoridade factual.
Integre pelo menos 2-3 destes fatos/tendências ao longo do artigo.
---

`;
}

// Função para construir prompt territorial
export function buildTerritorialContext(territory: TerritoryData | null): string {
  if (!territory?.official_name) return '';

  const neighborhoods = territory.neighborhood_tags?.length 
    ? territory.neighborhood_tags.join(', ')
    : '';

  const coords = territory.lat && territory.lng
    ? `(${territory.lat.toFixed(4)}, ${territory.lng.toFixed(4)})`
    : '';

  return `

---
## CONTEXTO TERRITORIAL (AUTORIDADE LOCAL OBRIGATÓRIA)

📍 **Localidade Principal:** ${territory.official_name}
${neighborhoods ? `🏘️ **Bairros/Áreas:** ${neighborhoods}` : ''}
${coords ? `📐 **Coordenadas:** ${coords}` : ''}
${territory.radius_km ? `📏 **Raio de Atuação:** ${territory.radius_km}km` : ''}

### REGRAS TERRITORIAIS:
- Mencione a localidade (${territory.official_name}) naturalmente 2-3 vezes no texto
${neighborhoods ? `- Cite pelo menos 1 bairro específico (${neighborhoods.split(',')[0].trim()})` : ''}
- Use expressões como "na região de ${territory.official_name}" ou "moradores de ${territory.official_name}"
- Conecte o tema do artigo com a realidade local
- Isso gera JSON-LD GeoCoordinates automático para SEO local

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

// Função para gerar instruções de correção GEO
export function generateGeoCorrectionInstructions(
  wordCount: number,
  geoPhrasesCount: number,
  hasAnswerFirst: boolean,
  hasTerritorial: boolean,
  territoriesAvailable: boolean
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

⚠️ SE ESTAS CORREÇÕES NÃO FOREM APLICADAS, O ARTIGO SERÁ REJEITADO NOVAMENTE.
`;
}
