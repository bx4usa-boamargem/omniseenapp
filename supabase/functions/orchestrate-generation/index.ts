import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { QUALITY_GATE, getMinWordCount } from "../_shared/superPageEngine.ts";
import { corsHeadersForRequest } from "../_shared/httpCors.ts";
import { validateGenerationJobInput } from "../_shared/pipelineInputValidation.ts";
import { generateText, generateImage } from '../_shared/omniseen-ai.ts';
import { 
  fetchGeoResearchData, 
  buildTerritorialContext, 
  buildResearchInjection, 
  NICHE_EAT_PHRASES,
  type GeoResearchData
} from "../_shared/geoWriterCore.ts";


/**
 * orchestrate-generation — OmniSeen TRUE SUPER PAGE ENGINE
 *
 * Pipeline: INPUT_VALIDATION -> SERP_ANALYSIS -> SERP_GAP_ANALYSIS -> OUTLINE_GEN ->
 *   AUTO_SECTION_EXPANSION -> ENTITY_EXTRACTION -> ENTITY_COVERAGE -> CONTENT_GEN ->
 *   SAVE_ARTICLE -> IMAGE_GEN (Gemini Nano Banana: hero + section + contextual) ->
 *   INTERNAL_LINK_ENGINE -> SEO_SCORE -> QUALITY_GATE -> COMPLETED
 *
 * Super pages: SERP gap analysis, entity coverage, auto section expansion, internal links, quality gate blocks publish.
 */

// ============================================================
// CONSTANTS
// ============================================================

const MAX_JOB_TIME_MS = 240_000;
const MAX_API_CALLS = 10;
const LOCK_TTL_MS = 120_000;

// ============================================================
// CONTENT TYPE HELPERS & AI DETECTION
// ============================================================

function getContentTypeTemplate(contentType: string): string {
  switch (contentType) {
    case 'como_fazer': return '[ANSWER-FIRST] Inicie com a resposta ou sumário direto. Cada passo do guia deve trazer [INFO-GAIN] prático e evitar introduções longas. Inclua sessão de erros comuns e FAQ.';
    case 'lista': return '[ANSWER-FIRST] O primeiro H2 deve responder "Qual o melhor/top 1" diretamente. Cada item da lista deve focar em [INFO-GAIN] sobre benefícios e diferenciais claros.';
    case 'faq': return 'Use estrutura de Pergunta e Resposta direta. Comece respondendo a dúvida principal [ANSWER-FIRST]. Cada resposta deve ser 100% útil e trazer [INFO-GAIN] em vez de enrolação.';
    case 'comparativo': return '[ANSWER-FIRST] O primeiro H2 já deve dar o Veredicto Final. Faça um comparativo de critérios com prós, contras e cenário ideal para cada opção [INFO-GAIN].';
    case 'seo_local': return 'Foco forte na geolocalização. Cite bairros, ruas de referência, tempo de deslocamento ou contexto hiperlocal [INFO-GAIN]. Use [INTERNAL-LINK] para áreas de atuação.';
    case 'pagina_pilar': return 'Megaestrutura cobrindo 360 graus do tema. [ANSWER-FIRST] Explique "O que é" no começo. APROFUNDAMENTO progressivo. Use marcações para [INTERNAL-LINK] para posts satélites.';
    case 'caso_de_sucesso': return 'Estrutura narrativa: Contexto, Desafio, Solução Aplicada (em detalhes - [INFO-GAIN]), Resultados Quantitativos, Depoimento. Seja realista e não promocional exagerado.';
    case 'industry_roundup': return 'Agrupamento e curadoria das melhores práticas ou ferramentas do setor. Divida as categorias em clusters, destacando tendências e por que elas importam agora [INFO-GAIN].';
    case 'news_analysis': return 'Cobertura jornalística analítica. [ANSWER-FIRST] O que aconteceu? Por que isso importa hoje? E o que significa para o futuro? Use uma voz crítica e traga dados frescos [E-E-A-T].';
    case 'product_review': return 'Análise isolada e profunda de um produto/serviço único. Comece com "Nota Final / Veredito". Liste prós/contras, e quem deve NÃO comprar esse produto [INFO-GAIN].';
    case 'data_research': return 'Artigo quantitativo focado em apresentar pesquisas do mercado. Use muitos dados, estatísticas, listas numeradas e insights baseados em fatos [E-E-A-T].';
    case 'thought_leadership': return 'Ensaio opinativo de autoridade. Escreva em primeira pessoa do plural com opiniões contundentes sobre o futuro. Sem clichês. Vá contra o senso comum e traga sua vivência [INFO-GAIN].';
    default: return '[ANSWER-FIRST] Responda rápido à intenção de busca. Traga valor real e não óbvio [INFO-GAIN]. Seja direto e escaneável.';
  }
}

const contentTypeOutlineHint: Record<string, string> = {
  faq: 'H2 = categoria de dúvida, H3 = pergunta individual',
  comparativo: 'H2 = critério de comparação (ex: Preço, Funcionalidades) + 1 H2 de "Veredicto Final"',
  lista: 'H2 = Item da lista numérico focado em benefício descritivo (ex: "1. Tênis X - O mais leve")',
  pagina_pilar: '7 a 9 H2s cobrindo o tópico de ponta a ponta',
  caso_de_sucesso: 'H2s fixos recomendados: Contexto, Desafio, Solução, Resultados, Depoimento, Próximos Passos',
  seo_local: 'H2s incluem áreas de atendimento local, bairros de referência, e como contratar',
  como_fazer: 'H2s: O que é/Resposta Direta, Passo a Passo (H3 para passos), Erros Comuns, Dicas Extras, FAQ',
  industry_roundup: 'H2 = Categorias do setor, H3 = Entidade/Ferramenta citada com diferencial',
  news_analysis: 'H2s: Resumo do Fato, O Impacto Genuíno, Como se Preparar (Ações Práticas)',
  product_review: 'H2s: Veredicto, Prós e Contras, Para Quem É/Não É, Funcionalidades Chave, Conclusão',
  data_research: 'H2s: Metodologia, Descoberta 1, Descoberta 2, Implicações para o Setor',
  thought_leadership: 'Estrutura fluida de ensaio, H2s como reflexões baseadas no problema atual vs solução invisível',
};

function detectAiPatterns(html: string): { score: number; flags: string[]; passed: boolean } {
  const pureText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const patterns = [
    'é importante ressaltar', 'diante do exposto', 'in conclusion', 'furthermore',
    'em resumo', 'vale lembrar que', 'crucial entender', 'mergulhar fundo',
    'desvendar os segredos', 'panorama completo', 'teia complexa', 'é fundamental notar',
    'desta forma', 'sendo assim', 'em suma', 'por outro lado', 'no entanto, é importante',
    'landscape', 'testament to', 'seamless', 'delve into', 'tailored', 'embark on', 'treasure trove',
    'em última análise', 'ficar claro que'
  ];
  const flags: string[] = [];
  let score = 0;
  for (const p of patterns) {
    if (pureText.includes(p)) {
      flags.push(p);
      score += 6;
    }
  }
  return { score, flags, passed: score < 36 };
}

// ============================================================
// WORD RANGE RESOLVER — uses target_words from job input
// ============================================================

/**
 * Resolves the word range for content generation.
 * Priority: job input target_words > job_type default.
 * For article: default 1500-2500. For super_page: default 3000-6000.
 */
function resolveWordRange(jobInput: Record<string, unknown>, jobType: 'article' | 'super_page'): string {
  const targetWords = jobInput.target_words ? Number(jobInput.target_words) : null;

  if (jobType === 'super_page') {
    if (targetWords && targetWords >= 2000) {
      const upper = Math.round(targetWords * 1.2);
      return `${targetWords}-${upper}`;
    }
    return '3000-6000';
  }

  // article
  if (targetWords && targetWords >= 500 && targetWords <= 5000) {
    // Allow ±15% tolerance so model has room, but stays close to target
    const lower = Math.max(500, Math.round(targetWords * 0.85));
    const upper = Math.round(targetWords * 1.15);
    return `${lower}-${upper}`;
  }

  return '1500-2500';
}

// ============================================================
// PUBLIC STAGE MAPPING (client-facing progress)
// ============================================================
const PUBLIC_STAGE_MAP: Record<string, { stage: string; progress: number; message: string }> = {
  'INPUT_VALIDATION':      { stage: 'ANALYZING_MARKET', progress: 2,  message: 'Inicializando...' },
  'SERP_ANALYSIS':         { stage: 'ANALYZING_MARKET', progress: 8,  message: 'Analisando SERP...' },
  'GEO_RESEARCH':          { stage: 'ANALYZING_MARKET', progress: 11, message: 'Pesquisando dados reais da cidade...' },
  'SERP_GAP_ANALYSIS':    { stage: 'ANALYZING_MARKET', progress: 14, message: 'Detectando lacunas semânticas...' },
  'OUTLINE_GEN':          { stage: 'ANALYZING_MARKET', progress: 20, message: 'Criando estrutura...' },
  'AUTO_SECTION_EXPANSION': { stage: 'ANALYZING_MARKET', progress: 26, message: 'Expandindo seções...' },
  'ENTITY_EXTRACTION':    { stage: 'WRITING_CONTENT',  progress: 32, message: 'Extraindo entidades...' },
  'ENTITY_COVERAGE':      { stage: 'WRITING_CONTENT',  progress: 38, message: 'Distribuindo entidades...' },
  'CONTENT_GEN':          { stage: 'WRITING_CONTENT',  progress: 55, message: 'Criando conteúdo...' },
  'SCHEMA_GEN':           { stage: 'FINALIZING',      progress: 60, message: 'Gerando schema markup...' },
  'SAVE_ARTICLE':         { stage: 'FINALIZING',      progress: 72, message: 'Salvando artigo...' },
  'IMAGE_GEN':            { stage: 'FINALIZING',      progress: 82, message: 'Gerando imagens (hero + seções)...' },
  'INTERNAL_LINK_ENGINE': { stage: 'FINALIZING',      progress: 88, message: 'Gerando links internos...' },
  'SEO_SCORE':            { stage: 'FINALIZING',      progress: 93, message: 'Calculando score SEO...' },
  'QUALITY_GATE':         { stage: 'FINALIZING',      progress: 98, message: 'Verificando qualidade...' },
};

const PIPELINE_STEPS = [
  'INPUT_VALIDATION',
  'SERP_ANALYSIS',
  'GEO_RESEARCH',
  'SERP_GAP_ANALYSIS',
  'OUTLINE_GEN',
  'AUTO_SECTION_EXPANSION',
  'ENTITY_EXTRACTION',
  'ENTITY_COVERAGE',
  'CONTENT_GEN',
  'SCHEMA_GEN',
  'SAVE_ARTICLE',
  'IMAGE_GEN',
  'INTERNAL_LINK_ENGINE',
  'SEO_SCORE',
  'QUALITY_GATE',
] as const;

type StepName = typeof PIPELINE_STEPS[number];

async function updatePublicStatus(
  supabase: any,
  jobId: string,
  stepName: string,
  completed: boolean,
  lockId?: string,
) {
  const mapping = PUBLIC_STAGE_MAP[stepName];
  if (!mapping) return;

  const updateData: Record<string, unknown> = {
    public_stage: mapping.stage,
    public_progress: mapping.progress,
    public_message: mapping.message,
    public_updated_at: new Date().toISOString(),
  };

  if (lockId) {
    updateData.locked_at = new Date().toISOString();
  }

  await supabase.from('generation_jobs').update(updateData).eq('id', jobId);
}

// ============================================================
// SAFE STEP INSERT — createStepOrFail
// ============================================================

async function createStepOrFail(
  supabase: any,
  jobId: string,
  stepName: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from('generation_steps')
    .insert({
      job_id: jobId,
      step_name: stepName,
      status: 'running',
      started_at: new Date().toISOString(),
      input,
    })
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    console.error(`[STEP_INSERT_FAILED] ${stepName} job=${jobId}`, error);
    throw new Error(`STEP_INSERT_RETURNED_NULL:${stepName}:${error?.message || 'no_id'}`);
  }
  return data.id;
}

// ============================================================
// RESEARCH FAILED POLICY
// ============================================================
/**
 * Determine o comportamento quando o passo de pesquisa falha.
 * Regra definida por tipo de geração:
 *
 * | Contexto          | ao_falhar               | Publicar?  |
 * |-------------------|-------------------------|------------|
 * | article (normal)  | gera com SERP apenas    | sim        |
 * | article (premium) | aborta — qualidade > vel| não        |
 * | auto_publish      | gera com SERP apenas    | sim + log  |
 * | preview           | gera sem bloquear       | sim        |
 */
type ResearchFailedBehavior = {
  shouldAbort: boolean;
  fallbackLabel: string;
  logLevel: 'warn' | 'error';
  noteForQualityGate: string;
};

function getResearchFailedPolicy(
  generationMode: string,
  isAutoPublish: boolean,
  isPreview: boolean,
): ResearchFailedBehavior {
  if (isPreview) {
    return {
      shouldAbort: false,
      fallbackLabel: 'serp_only_preview',
      logLevel: 'warn',
      noteForQualityGate: 'research_skipped:preview',
    };
  }
  if (isAutoPublish) {
    return {
      shouldAbort: false,
      fallbackLabel: 'serp_only_auto',
      logLevel: 'warn',
      noteForQualityGate: 'research_failed:auto_publish',
    };
  }
  if (generationMode === 'premium') {
    return {
      shouldAbort: true,
      fallbackLabel: 'blocked_premium',
      logLevel: 'error',
      noteForQualityGate: 'research_failed:premium_blocked',
    };
  }
  // default: article normal
  return {
    shouldAbort: false,
    fallbackLabel: 'serp_only_normal',
    logLevel: 'warn',
    noteForQualityGate: 'research_failed:serp_fallback',
  };
}

// ============================================================
// GEO SCORE — 5 critérios simples e auditáveis
// ============================================================
/**
 * Calcula GEO Readiness Score (0–100) com 5 sinais claros.
 * Não usa IA. Cada critério tem peso fixo e justificativa.
 *
 * | Critério             | Peso  | Sinal medido                           |
 * |----------------------|-------|----------------------------------------|
 * | city_in_title        | 20pts | Cidade/território no H1 do artigo      |
 * | faq_present          | 20pts | Pelo menos 3 perguntas de FAQ          |
 * | citation_blocks      | 20pts | Presença de [CITE] ou fonte citável    |
 * | entity_density       | 20pts | ≥ 5 entidades locais/nicho no texto    |
 * | word_count_ok        | 20pts | Mínimo de 800 palavras                 |
 */
export type GeoScoreResult = {
  score: number;       // 0-100
  breakdown: {
    city_in_title: boolean;
    faq_present: boolean;
    citation_blocks: boolean;
    entity_density: boolean;
    word_count_ok: boolean;
  };
  passed: boolean;     // score >= 60
  label: 'excellent' | 'good' | 'needs_work' | 'poor';
};

export function calculateGeoScore(params: {
  title: string;
  htmlContent: string;
  city: string;
  faqCount: number;
  entities: { topics?: string[]; terms?: string[] };
}): GeoScoreResult {
  const { title, htmlContent, city, faqCount, entities } = params;
  const text = htmlContent.replace(/<[^>]*>/g, ' ').toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const cityLower = (city || '').toLowerCase().trim();

  const city_in_title = cityLower.length > 0 && title.toLowerCase().includes(cityLower);
  const faq_present = faqCount >= 3;
  const citation_blocks = text.includes('[cite]') || /\b(segundo|fonte|pesquisa|estudo|dados de|ibge|statista)\b/.test(text);
  const allEntities = [...(entities.topics || []), ...(entities.terms || [])];
  const entity_density = allEntities.filter(e => text.includes(e.toLowerCase())).length >= 5;
  const word_count_ok = wordCount >= 800;

  const breakdown = { city_in_title, faq_present, citation_blocks, entity_density, word_count_ok };
  const score = Object.values(breakdown).filter(Boolean).length * 20;
  const passed = score >= 60;
  const label: GeoScoreResult['label'] =
    score >= 100 ? 'excellent' :
    score >= 80  ? 'good'      :
    score >= 60  ? 'needs_work': 'poor';

  return { score, breakdown, passed, label };
}

// ============================================================
// AI ROUTER CALLER
// ============================================================

interface AIRouterResult {
  success: boolean;
  content: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

async function callAIRouter(
  supabaseUrl: string,
  serviceKey: string,
  task: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number; retries?: number; useGrounding?: boolean }
): Promise<AIRouterResult> {
  const url = `${supabaseUrl}/functions/v1/ai-router`;
  const maxRetries = options?.retries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task,
        messages,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        useGrounding: options?.useGrounding,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const errMsg = data.error || `HTTP_${resp.status}`;
      // Retry on 429 rate limit with exponential backoff
      if (resp.status === 429 && attempt < maxRetries) {
        const delay = Math.min(3000 * Math.pow(2, attempt), 15000);
        console.log(`[callAIRouter] Rate limited (429) on ${task}, retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return {
        success: false, content: '', model: '', provider: 'lovable-gateway',
        tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0,
        error: errMsg,
      };
    }
    return data as AIRouterResult;
  }

  // Should not reach here, but safety fallback
  return {
    success: false, content: '', model: '', provider: 'lovable-gateway',
    tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0,
    error: 'MAX_RETRIES_EXHAUSTED',
  };
}

// ============================================================
// ROBUST JSON PARSER
// ============================================================

class ParseError extends Error {
  rawContent: string;
  constructor(message: string, rawContent: string) {
    super(message);
    this.name = 'ParseError';
    this.rawContent = rawContent;
  }
}

function parseAIJson(content: string, label: string): Record<string, unknown> {
  try { return JSON.parse(content); } catch { /* continue */ }
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch { /* continue */ }
  }
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* continue */ }
  }
  throw new ParseError(`${label}_PARSE_ERROR: Could not extract valid JSON`, content);
}

// ============================================================
// TIMEOUT WRAPPER
// ============================================================

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`STEP_TIMEOUT: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// ============================================================
// STEP 1: INPUT_VALIDATION
// ============================================================

function executeInputValidation(jobInput: Record<string, unknown>): Record<string, unknown> {
  const v = validateGenerationJobInput(jobInput);
  return { validated: v.validated, keyword: v.keyword, city: v.city, niche: v.niche };
}

// ============================================================
// STEP 2: SERP_SUMMARY (lightweight, optional)
// ============================================================

async function executeSerpSummary(
  jobInput: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
  useGrounding?: boolean
): Promise<{ output: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const niche = (jobInput.niche as string) || '';
  const language = (jobInput.language as string) || 'pt-BR';

  const prompt = `Provide a brief competitive landscape summary for the keyword "${keyword}" in ${city || 'Brazil'}, niche: ${niche}, language: ${language}.

Include:
- Average word count of top results (estimate)
- Common topics covered
- Content gaps you can identify
- Dominant search intent

Keep it under 300 words. This will be used as context for article generation.`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'serp_summary', [
    { role: 'system', content: 'You are an SEO analyst. Provide concise competitive analysis.' },
    { role: 'user', content: prompt },
  ], { useGrounding });

  if (!aiResult.success) throw new Error(`SERP_SUMMARY_FAILED: ${aiResult.error}`);
  return { output: { serp_summary: aiResult.content }, aiResult };
}

// ============================================================
// STEP: SERP_GAP_ANALYSIS (compare competitors, missing semantic topics)
// ============================================================

interface SerpGapResult {
  semantic_gaps: string[];
  competitor_topics: string[];
  missing_in_outline?: string[];
}

async function executeSerpGapAnalysis(
  jobInput: Record<string, unknown>,
  serpSummary: string,
  supabaseUrl: string,
  serviceKey: string,
  useGrounding?: boolean
): Promise<{ output: SerpGapResult; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const niche = (jobInput.niche as string) || '';
  const language = (jobInput.language as string) || 'pt-BR';

  const prompt = `You are an SEO analyst. Compare top ranking competitors for the keyword "${keyword}" (niche: ${niche}, language: ${language}).

SERP/Competitor context:
${serpSummary?.slice(0, 2000) || 'No data.'}

Identify:
1) semantic_gaps: Topics or subtopics that competitors cover but are often missing in thin content (list 4-8 short phrases).
2) competitor_topics: Main themes that top 10 results typically cover (list 5-10 short phrases).

Return ONLY valid JSON (no markdown):
{
  "semantic_gaps": ["gap1", "gap2", ...],
  "competitor_topics": ["topic1", "topic2", ...]
}`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'serp_gap_analysis', [
    { role: 'system', content: 'You are an SEO analyst. Return ONLY valid JSON with semantic_gaps and competitor_topics arrays.' },
    { role: 'user', content: prompt },
  ], { useGrounding });

  if (!aiResult.success) throw new Error(`SERP_GAP_ANALYSIS_FAILED: ${aiResult.error}`);
  const parsed = parseAIJson(aiResult.content, 'SERP_GAP_ANALYSIS');
  const output: SerpGapResult = {
    semantic_gaps: Array.isArray(parsed.semantic_gaps) ? parsed.semantic_gaps.map(String) : [],
    competitor_topics: Array.isArray(parsed.competitor_topics) ? parsed.competitor_topics.map(String) : [],
  };
  return { output, aiResult };
}

// ============================================================
// STEP: OUTLINE_GEN (mandatory before content)
// ============================================================

interface OutlineSection {
  title: string;
  h3: string[];
}
interface OutlineData {
  h1: string;
  h2: OutlineSection[];
  meta_description?: string;
  cta?: string;
}

// ============================================================
// CONTENT TYPE TEMPLATES (inspired by claude-blog framework)
// Templates define structure, markers and quality rules per type
// ============================================================

type ContentTypeKey = 'how-to' | 'listicle' | 'faq' | 'comparison' | 'local-seo' | 'pillar' | 'case-study' | 'article';

interface ContentTypeTemplate {
  structureHint: string;
  answerFirstRule: string;
  qualityMarkers: string;
  outlineSizeHint: string;
}

function getContentTypeTemplate(contentType: ContentTypeKey, language: string): ContentTypeTemplate {
  const isPtBr = language === 'pt-BR' || language.startsWith('pt');

  const templates: Record<ContentTypeKey, ContentTypeTemplate> = {
    'how-to': {
      structureHint: isPtBr
        ? 'Estrutura: Introdução com problema → Por que isso importa → Passo 1 → Passo 2 → ... → Erros comuns → Conclusão → FAQ'
        : 'Structure: Intro with problem → Why it matters → Step 1 → Step 2 → ... → Common mistakes → Conclusion → FAQ',
      answerFirstRule: isPtBr
        ? '[ANSWER-FIRST] A primeira frase da introdução DEVE responder diretamente "como fazer X". Não comece com contexto — comece com a resposta.'
        : '[ANSWER-FIRST] The first sentence MUST directly answer "how to do X". Do not start with context — start with the answer.',
      qualityMarkers: isPtBr
        ? '- [NUMBERED-STEPS] Cada passo deve ter número, título em H3 e pelo menos 2 parágrafos de instrução real\n- [INFO-GAIN] Inclua ao menos 1 dado ou dica que não aparece nos primeiros resultados do Google\n- [INTERNAL-LINK] Reserve 1 H2 para "Veja também" com links para artigos relacionados\n- Proibido passos vazios como "Verifique o resultado" sem instrução concreta'
        : '- [NUMBERED-STEPS] Each step must have number, H3 title and at least 2 paragraphs\n- [INFO-GAIN] Include at least 1 data point not in top Google results\n- [INTERNAL-LINK] Reserve 1 H2 for related articles\n- No empty steps',
      outlineSizeHint: '5-7 H2 sections with numbered steps as H3',
    },
    'listicle': {
      structureHint: isPtBr
        ? 'Estrutura: Introdução com número + promessa → Item 1 (H2) com subtópicos (H3) → ... → Comparativo final → Conclusão → FAQ'
        : 'Structure: Intro with number + promise → Item 1 (H2) with subtopics (H3) → ... → Final comparison → Conclusion → FAQ',
      answerFirstRule: isPtBr
        ? '[ANSWER-FIRST] O título H1 DEVE conter o número exato de itens. A introdução deve revelar o critério de seleção na primeira frase.'
        : '[ANSWER-FIRST] The H1 MUST contain the exact number of items. The intro reveals the selection criteria in the first sentence.',
      qualityMarkers: isPtBr
        ? '- [CADA-ITEM] Cada item da lista deve ter: título H2 com o nome, 3-4 parágrafos de análise, prós e contras se aplicável\n- [INFO-GAIN] Ao menos 3 itens devem ter dado concreto (preço, estatística, caso real)\n- [RANKING-LOGIC] Explique brevemente por que cada item está na posição que está\n- Proibido itens com apenas 1 parágrafo genérico'
        : '- [EACH-ITEM] Each item: H2 title, 3-4 analysis paragraphs, pros/cons if applicable\n- [INFO-GAIN] At least 3 items with concrete data\n- [RANKING-LOGIC] Brief explanation of ranking position',
      outlineSizeHint: '6-10 H2 sections (one per item) with H3 for sub-analysis',
    },
    'faq': {
      structureHint: isPtBr
        ? 'Estrutura: Introdução temática → Grupo 1 de perguntas (H2) com perguntas individuais (H3) → Grupo 2 → ... → FAQ Rápido → Conclusão'
        : 'Structure: Thematic intro → Question group 1 (H2) with individual questions (H3) → Group 2 → ... → Quick FAQ → Conclusion',
      answerFirstRule: isPtBr
        ? '[ANSWER-FIRST] Cada resposta (H3) DEVE começar com a resposta direta em 1-2 frases, DEPOIS o contexto e detalhes.'
        : '[ANSWER-FIRST] Each answer (H3) MUST start with the direct answer in 1-2 sentences, THEN context and details.',
      qualityMarkers: isPtBr
        ? '- [SCHEMA-READY] Cada par pergunta/resposta deve ser marcado claramente — será transformado em FAQPage schema\n- [INFO-GAIN] Ao menos 30% das perguntas devem abordar dúvidas que não aparecem na primeira página do Google\n- [CONCISE] Respostas entre 80-200 palavras — diretas, sem enrolação\n- [AGRUPAMENTO] Agrupe perguntas por tema em H2, não coloque todas as perguntas soltas'
        : '- [SCHEMA-READY] Clear Q&A pairs for FAQPage schema\n- [INFO-GAIN] 30% of questions covering gaps not in top Google results\n- [CONCISE] 80-200 word answers\n- [GROUPING] Group questions by theme in H2',
      outlineSizeHint: '4-6 H2 topic groups, each with 3-5 H3 question-answer pairs',
    },
    'comparison': {
      structureHint: isPtBr
        ? 'Estrutura: Introdução com contexto da escolha → Opção A (H2) detalhada → Opção B (H2) detalhada → Comparativo direto (H2) → Quando escolher cada um (H2) → Veredicto → FAQ'
        : 'Structure: Intro with decision context → Option A (H2) detailed → Option B (H2) detailed → Direct comparison (H2) → When to choose each (H2) → Verdict → FAQ',
      answerFirstRule: isPtBr
        ? '[ANSWER-FIRST] O veredicto final deve estar visível já na introdução (1-2 frases). O leitor não precisa ler o artigo inteiro para saber a resposta.'
        : '[ANSWER-FIRST] The final verdict must be visible in the intro (1-2 sentences). Reader should not need to read the whole article for the answer.',
      qualityMarkers: isPtBr
        ? '- [TABELA-COMPARATIVA] Inclua uma tabela HTML (<table>) com os critérios de comparação lado a lado\n- [INFO-GAIN] Ao menos 2 critérios de comparação que concorrentes no Google ignoram\n- [BALANCED] Dê o mesmo nível de profundidade para cada opção — não favoreça artificialmente\n- [CENARIOS] A seção "quando escolher cada um" deve ter cenários REAIS e específicos, não genéricos'
        : '- [COMPARISON-TABLE] Include HTML table with side-by-side criteria\n- [INFO-GAIN] At least 2 comparison criteria competitors ignore\n- [BALANCED] Equal depth for each option\n- [SCENARIOS] Real and specific use cases',
      outlineSizeHint: '6-8 H2 sections with balanced analysis for each option',
    },
    'local-seo': {
      structureHint: isPtBr
        ? 'Estrutura: Introdução com cidade/região → O que é o serviço (H2) → Como funciona na região (H2) → Melhores opções/bairros (H2) → Preços locais (H2) → Como contratar (H2) → FAQ local'
        : 'Structure: Intro with city/region → What is the service (H2) → How it works in the region (H2) → Best options/areas (H2) → Local prices (H2) → How to hire (H2) → Local FAQ',
      answerFirstRule: isPtBr
        ? '[ANSWER-FIRST] O H1 DEVE conter o nome da cidade/região. A introdução deve mencionar bairros, referências geográficas ou características locais reais nos primeiros 2 parágrafos.'
        : '[ANSWER-FIRST] The H1 MUST contain the city/region name. Intro must mention neighborhoods or local geographic references in the first 2 paragraphs.',
      qualityMarkers: isPtBr
        ? '- [LOCAL-SIGNALS] Mencione pelo menos 3 referências geográficas locais reais (bairros, monumentos, vias)\n- [INFO-GAIN] Inclua informações específicas da cidade que não aparecem em guias genéricos\n- [PRICE-RANGE] Se possível, mencione faixas de preço típicas da região\n- [CTA-LOCAL] O CTA deve mencionar o serviço específico + cidade + forma de contato local\n- [SCHEMA] O artigo será marcado com LocalBusiness schema — estruture para isso'
        : '- [LOCAL-SIGNALS] Mention at least 3 real local geographic references\n- [INFO-GAIN] City-specific info not in generic guides\n- [PRICE-RANGE] Include typical local price ranges\n- [CTA-LOCAL] CTA with service + city + local contact\n- [SCHEMA] Structured for LocalBusiness schema',
      outlineSizeHint: '6-8 H2 sections with strong local geographic context throughout',
    },
    'pillar': {
      structureHint: isPtBr
        ? 'Estrutura: Introdução completa → Definição/conceito (H2) → Histórico/contexto (H2) → Como funciona (H2) com subtópicos H3 → Tipos/variações (H2) → Aplicações práticas (H2) → Erros/mitos (H2) → Recursos avançados (H2) → FAQ completo → Conclusão'
        : 'Structure: Full intro → Definition/concept (H2) → Background (H2) → How it works (H2) with H3 → Types (H2) → Practical applications (H2) → Myths/mistakes (H2) → Advanced resources (H2) → Complete FAQ → Conclusion',
      answerFirstRule: isPtBr
        ? '[ANSWER-FIRST] A introdução deve ter um TL;DR (resumo em 3-5 pontos) após o primeiro parágrafo para leitores que querem o essencial rapidamente.'
        : '[ANSWER-FIRST] The intro must have a TL;DR (3-5 bullet summary) after the first paragraph for quick readers.',
      qualityMarkers: isPtBr
        ? '- [COMPREHENSIVE] Página pilar deve cobrir o tema exaustivamente — mínimo 7 H2 com conteúdo substantivo\n- [INFO-GAIN] Ao menos 3 informações avançadas que artigos básicos sobre o tema não cobrem\n- [INTERNAL-LINKS] Crie ancoras H2 com IDs para linking interno\n- [TL;DR] Inclua sumário executivo após a introdução\n- [VISUAL] Descreva pelo menos 2 imagens/diagramas que ilustrariam conceitos complexos'
        : '- [COMPREHENSIVE] Pillar must cover topic exhaustively — minimum 7 H2 sections\n- [INFO-GAIN] At least 3 advanced facts not in basic articles\n- [INTERNAL-LINKS] H2 anchors with IDs for internal linking\n- [TL;DR] Executive summary after intro\n- [VISUAL] Describe at least 2 diagrams for complex concepts',
      outlineSizeHint: '8-12 H2 sections covering the topic comprehensively',
    },
    'case-study': {
      structureHint: isPtBr
        ? 'Estrutura: Contexto do cliente/situação (H2) → O problema enfrentado (H2) → A solução implementada (H2) → Resultados mensuráveis (H2) → Lições aprendidas (H2) → Como replicar (H2) → FAQ'
        : 'Structure: Client/situation context (H2) → The problem faced (H2) → Solution implemented (H2) → Measurable results (H2) → Lessons learned (H2) → How to replicate (H2) → FAQ',
      answerFirstRule: isPtBr
        ? '[ANSWER-FIRST] O resultado principal (ex: "aumento de 40% em vendas") deve aparecer no H1 e no primeiro parágrafo. Não esconda o resultado no final.'
        : '[ANSWER-FIRST] The main result (e.g., "40% increase in sales") must appear in H1 and first paragraph. Do not hide the result at the end.',
      qualityMarkers: isPtBr
        ? '- [METRICAS] Resultados DEVEM ser expressos em números concretos — porcentagens, valores, tempo economizado\n- [CREDIBILIDADE] Inclua detalhes específicos (setor, porte da empresa, período) mesmo que fictícios mas verossímeis\n- [REPLICAVEL] A seção "como replicar" deve ter passos acionáveis\n- [QUOTES] Inclua 1-2 citações atribuídas (mesmo que representativas, não inventadas por completo)'
        : '- [METRICS] Results MUST be in concrete numbers\n- [CREDIBILITY] Specific details (industry, company size, period)\n- [REPLICABLE] "How to replicate" section with actionable steps\n- [QUOTES] 1-2 attributed quotes',
      outlineSizeHint: '6-8 H2 sections following the case study narrative arc',
    },
    'article': {
      structureHint: 'Standard article structure with introduction, main sections, conclusion and FAQ',
      answerFirstRule: '[ANSWER-FIRST] The first sentence must directly address the main topic.',
      qualityMarkers: '- [INFO-GAIN] Include at least 1 unique insight or data point\n- [FAQ] End with 3-5 relevant questions',
      outlineSizeHint: '4-6 H2 sections',
    },
  };

  return templates[contentType] || templates['article'];
}

// ============================================================
// AI WRITING PATTERN DETECTOR (post-generation quality check)
// Based on claude-blog burstiness analysis — detects AI phrases
// ============================================================

const AI_WRITING_PATTERNS = [
  // Common AI filler phrases (EN)
  'it is worth noting', 'it is important to note', 'it is crucial to',
  'in conclusion,', 'in summary,', 'to summarize,',
  'delve into', 'dive into', 'let us explore',
  'in the realm of', 'in the world of', 'landscape of',
  'it goes without saying', 'needless to say',
  'as an ai', 'as a language model',
  // Portuguese patterns (PT-BR)
  'é importante ressaltar', 'é fundamental destacar', 'cabe ressaltar',
  'nesse contexto,', 'neste contexto,', 'no contexto atual',
  'é válido mencionar', 'vale mencionar que', 'vale ressaltar',
  'em suma,', 'em resumo,', 'concluindo,',
  'no âmbito', 'no universo', 'no mundo do',
  'mergulhar em', 'explorar a fundo',
];

function detectAiPatterns(html: string): { score: number; flaggedPhrases: string[]; passed: boolean } {
  const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
  const flaggedPhrases: string[] = [];

  for (const pattern of AI_WRITING_PATTERNS) {
    if (text.includes(pattern.toLowerCase())) {
      flaggedPhrases.push(pattern);
    }
  }

  // Burstiness proxy: sentence length variance (higher = more human-like)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const avgLen = sentences.reduce((a, s) => a + s.length, 0) / Math.max(sentences.length, 1);
  const variance = sentences.reduce((a, s) => a + Math.pow(s.length - avgLen, 2), 0) / Math.max(sentences.length, 1);
  const burstinessScore = Math.sqrt(variance) / Math.max(avgLen, 1);

  // Score: 0-100, higher = more human-like
  const patternPenalty = Math.min(flaggedPhrases.length * 8, 50);
  const burstinessBonus = Math.min(burstinessScore * 30, 30);
  const score = Math.max(0, Math.min(100, 70 - patternPenalty + burstinessBonus));

  return {
    score: Math.round(score),
    flaggedPhrases,
    passed: flaggedPhrases.length <= 2 && score >= 45,
  };
}

async function executeOutlineGen(
  jobInput: Record<string, unknown>,
  serpSummary: string,
  supabaseUrl: string,
  serviceKey: string,
  useGrounding?: boolean
): Promise<{ output: { outline: OutlineData }; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const niche = (jobInput.niche as string) || '';
  const language = (jobInput.language as string) || 'pt-BR';
  const jobType = ((jobInput.job_type as string) || 'article') as 'article' | 'super_page';
  const cType = (jobInput.content_type as string) || 'como_fazer';

  // Use target_words and content_type template to calibrate outline
  const wordRange = resolveWordRange(jobInput, jobType);
  const targetWords = jobInput.target_words ? Number(jobInput.target_words) : null;
  const template = getContentTypeTemplate(contentType, language);

  let wordHint: string;
  if (jobType === 'super_page') {
    wordHint = `Support 3000-6000 words. Outline: ${template.outlineSizeHint}`;
  } else if (targetWords && targetWords <= 1600) {
    wordHint = `Support ~${targetWords} words. Outline: ${template.outlineSizeHint}. Keep sections concise.`;
  } else if (targetWords && targetWords <= 2200) {
    wordHint = `Support ~${targetWords} words. Outline: ${template.outlineSizeHint}.`;
  } else {
    wordHint = `Support ~${targetWords || 2500} words. Outline: ${template.outlineSizeHint}.`;
  }

  const typeHint = contentTypeOutlineHint[cType] || contentTypeOutlineHint.como_fazer;
  wordHint += `\nStructure hint based on Content Type (${cType}): ${typeHint}`;

  const prompt = `You are an SEO content architect. Create a strict outline for a blog article.

Keyword: ${keyword}
City/region: ${city || 'Brazil'}
Niche: ${niche}
Language: ${language}
Content type: ${contentType}
Target word count: ${wordRange} words

CONTENT TYPE STRUCTURE (${contentType.toUpperCase()}):
${template.structureHint}

SERP context (use to inform structure and gaps):
${serpSummary || 'No SERP data.'}

${wordHint}
Include a clear CTA idea at the end.
Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "outline": {
    "h1": "Main title with keyword and locale",
    "h2": [
      { "title": "Section title", "h3": ["Subsection 1", "Subsection 2"] }
    ],
    "meta_description": "Optional meta description max 155 chars",
    "cta": "Optional CTA message"
  }
}`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'outline_gen', [
    { role: 'system', content: 'You are an SEO architect. Return ONLY valid JSON with an "outline" object. No other text.' },
    { role: 'user', content: prompt },
  ], { useGrounding });

  if (!aiResult.success) throw new Error(`OUTLINE_GEN_FAILED: ${aiResult.error}`);
  const parsed = parseAIJson(aiResult.content, 'OUTLINE_GEN');
  const outlineObj = (parsed.outline ?? parsed) as Record<string, unknown>;
  if (!outlineObj?.h1 || !Array.isArray(outlineObj.h2)) {
    throw new Error('OUTLINE_GEN: invalid outline (missing h1 or h2 array)');
  }
  const outline: OutlineData = {
    h1: String(outlineObj.h1),
    h2: (outlineObj.h2 as Array<{ title: string; h3: string[] }>).map((s) => ({
      title: s.title || '',
      h3: Array.isArray(s.h3) ? s.h3.map(String) : [],
    })),
    meta_description: outlineObj.meta_description != null ? String(outlineObj.meta_description) : undefined,
    cta: outlineObj.cta != null ? String(outlineObj.cta) : undefined,
  };
  return { output: { outline }, aiResult };
}

// ============================================================
// STEP: AUTO_SECTION_EXPANSION (add H2 for semantic gaps)
// ============================================================

async function executeAutoSectionExpansion(
  outline: OutlineData,
  gapAnalysis: SerpGapResult,
  jobType: 'article' | 'super_page',
  supabaseUrl: string,
  serviceKey: string
): Promise<{ output: { outline: OutlineData }; aiResult: AIRouterResult }> {
  if (!gapAnalysis.semantic_gaps?.length) {
    return { output: { outline }, aiResult: { success: true, content: '', model: '', provider: '', tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0 } };
  }
  const prompt = `You are an SEO architect. Expand the outline by adding new H2 sections for semantic gaps. Content type: ${jobType}.

Current outline (JSON):
${JSON.stringify(outline, null, 0)}

Semantic gaps to cover (add 1 H2 per gap if not already covered):
${JSON.stringify(gapAnalysis.semantic_gaps)}

Competitor topics for reference: ${(gapAnalysis.competitor_topics || []).slice(0, 6).join(', ')}

Rules: Add only new H2 sections that address gaps. Each new H2 must have 2-3 H3 subsections. Do not remove existing sections. Return the FULL outline (existing + new sections) in the same JSON format: { "outline": { "h1": "...", "h2": [ { "title": "...", "h3": ["..."] }, ... ], "meta_description": "...", "cta": "..." } }.`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'section_expansion', [
    { role: 'system', content: 'Return ONLY valid JSON with an "outline" object. No markdown.' },
    { role: 'user', content: prompt },
  ], { useGrounding: false });

  if (!aiResult.success) return { output: { outline }, aiResult };
  const parsed = parseAIJson(aiResult.content, 'AUTO_SECTION_EXPANSION');
  const outlineObj = (parsed.outline ?? parsed) as Record<string, unknown>;
  if (!outlineObj?.h1 || !Array.isArray(outlineObj.h2)) return { output: { outline }, aiResult };
  const expanded: OutlineData = {
    h1: String(outlineObj.h1),
    h2: (outlineObj.h2 as Array<{ title: string; h3: string[] }>).map((s) => ({
      title: s.title || '',
      h3: Array.isArray(s.h3) ? s.h3.map(String) : [],
    })),
    meta_description: outlineObj.meta_description != null ? String(outlineObj.meta_description) : undefined,
    cta: outlineObj.cta != null ? String(outlineObj.cta) : undefined,
  };
  return { output: { outline: expanded }, aiResult };
}

// ============================================================
// STEP: ENTITY_EXTRACTION
// ============================================================

interface EntityData {
  topics: string[];
  terms: string[];
  places?: string[];
}

async function executeEntityExtraction(
  jobInput: Record<string, unknown>,
  serpSummary: string,
  outline: OutlineData,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ output: { entities: EntityData }; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const niche = (jobInput.niche as string) || '';
  const language = (jobInput.language as string) || 'pt-BR';

  const outlineStr = JSON.stringify({ h1: outline.h1, h2: outline.h2 }, null, 0);

  const prompt = `Extract semantic entities for SEO content. Keyword: ${keyword}. Niche: ${niche}. Language: ${language}.

SERP context: ${serpSummary?.slice(0, 800) || 'None'}

Outline: ${outlineStr}

Return ONLY a valid JSON object:
{
  "topics": ["topic1", "topic2"],
  "terms": ["term1", "term2"],
  "places": ["place1"]
}
Topics: main themes. Terms: key phrases to include. Places: locations if relevant. Use arrays of strings.`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'entity_extraction', [
    { role: 'system', content: 'You are an SEO analyst. Return ONLY valid JSON with topics, terms, and optionally places.' },
    { role: 'user', content: prompt },
  ], { useGrounding: false });

  if (!aiResult.success) {
    // Non-fatal: use programmatic fallback entities from keyword/niche
    console.warn(`[ENTITY_EXTRACTION] AI failed (${aiResult.error}), using programmatic fallback`);
    const fallbackEntities: EntityData = {
      topics: [keyword, niche].filter(Boolean),
      terms: keyword.split(/\s+/).filter(w => w.length > 3),
      places: undefined,
    };
    return { output: { entities: fallbackEntities }, aiResult };
  }
  const parsed = parseAIJson(aiResult.content, 'ENTITY_EXTRACTION');
  const entities: EntityData = {
    topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
    terms: Array.isArray(parsed.terms) ? parsed.terms.map(String) : [],
    places: Array.isArray(parsed.places) ? parsed.places.map(String) : undefined,
  };
  return { output: { entities }, aiResult };
}

// ============================================================
// STEP: ENTITY_COVERAGE (distribute entities across sections, validate score)
// ============================================================

interface EntityAssignment {
  sectionIndex: number;
  sectionTitle: string;
  entityIds: number[];
  terms: string[];
}

interface EntityCoverageResult {
  assignment: EntityAssignment[];
  coverageScore: number;
  allEntities: string[];
}

function executeEntityCoverage(outline: OutlineData, entities: EntityData): EntityCoverageResult {
  const allTerms = [...(entities.topics || []), ...(entities.terms || []), ...(entities.places || [])].filter(Boolean);
  const assignment: EntityAssignment[] = outline.h2.map((section, i) => {
    const count = outline.h2.length;
    const start = Math.floor((i * allTerms.length) / count);
    const end = i === count - 1 ? allTerms.length : Math.floor(((i + 1) * allTerms.length) / count);
    const slice = allTerms.slice(start, end);
    return {
      sectionIndex: i + 1,
      sectionTitle: section.title,
      entityIds: slice.map((_, idx) => start + idx),
      terms: slice,
    };
  });
  const assignedCount = assignment.reduce((acc, a) => acc + a.terms.length, 0);
  const coverageScore = allTerms.length > 0 ? Math.round((assignedCount / allTerms.length) * 100) : 100;
  return { assignment, coverageScore, allEntities: allTerms };
}

// ============================================================
// ENFORCE HEADING STRUCTURE (post-processing safety net)
// ============================================================

function enforceHeadingStructure(html: string, outline: OutlineData): string {
  const hasH1 = /<h1[\s>]/i.test(html);
  const hasH2 = /<h2[\s>]/i.test(html);

  if (hasH1 && hasH2) {
    if (!html.includes('<style>')) {
      html = '<style>h1{font-size:2em;margin-bottom:0.5em;font-weight:700}h2{font-size:1.5em;margin-top:1.5em;margin-bottom:0.5em;font-weight:600}h3{font-size:1.2em;margin-top:1em;margin-bottom:0.4em;font-weight:600}p{line-height:1.8;margin-bottom:1em}</style>' + html;
    }
    return html;
  }

  console.warn('[enforceHeadingStructure] HTML missing proper headings, attempting fix...');
  let fixed = html;

  for (const section of outline.h2) {
    const escapedTitle = section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boldPattern = new RegExp(`<p[^>]*>\\s*<(?:strong|b)>\\s*${escapedTitle}\\s*</(?:strong|b)>\\s*</p>`, 'gi');
    fixed = fixed.replace(boldPattern, `<h2>${section.title}</h2>`);

    const loosePattern = new RegExp(`<(?:strong|b)>\\s*${escapedTitle}\\s*</(?:strong|b)>`, 'gi');
    fixed = fixed.replace(loosePattern, (match) => {
      const idx = fixed.indexOf(match);
      const before = fixed.substring(Math.max(0, idx - 10), idx);
      if (/<h[1-6][^>]*>$/i.test(before)) return match;
      return `<h2>${section.title}</h2>`;
    });

    for (const h3Title of section.h3) {
      const escapedH3 = h3Title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const h3Pattern = new RegExp(`<p[^>]*>\\s*<(?:strong|b)>\\s*${escapedH3}\\s*</(?:strong|b)>\\s*</p>`, 'gi');
      fixed = fixed.replace(h3Pattern, `<h3>${h3Title}</h3>`);
    }
  }

  if (!/<h1[\s>]/i.test(fixed)) {
    fixed = `<h1>${outline.h1}</h1>\n` + fixed;
  }

  if (!fixed.includes('<style>')) {
    fixed = '<style>h1{font-size:2em;margin-bottom:0.5em;font-weight:700}h2{font-size:1.5em;margin-top:1.5em;margin-bottom:0.5em;font-weight:600}h3{font-size:1.2em;margin-top:1em;margin-bottom:0.4em;font-weight:600}p{line-height:1.8;margin-bottom:1em}</style>' + fixed;
  }

  const newH2Count = (fixed.match(/<h2[\s>]/gi) || []).length;
  console.log(`[enforceHeadingStructure] Fixed: hasH1=${/<h1[\s>]/i.test(fixed)}, h2Count=${newH2Count}`);
  return fixed;
}

// ============================================================
// STEP: SCHEMA_GEN — FAQPage + Article + conditional JSON-LD
// ============================================================

/** Portuguese month names for Last-Updated timestamp */
const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Formats a Date as "DD de MÊS de YYYY" in Portuguese.
 */
function formatPtDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = PT_MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} de ${month} de ${year}`;
}

interface SchemaGenInput {
  title: string;
  meta_description: string;
  html_article: string;
  faq: Array<{ question: string; answer: string }>;
  keyword: string;
  city: string;
  niche: string;
  language: string;
  content_type: string;
  blog_name: string;
  blog_url: string;
  business_name: string;
  slug: string;
  iso_date: string;
}

/**
 * Builds the full JSON-LD schema graph for an article.
 * Non-fatal: returns null on any error.
 */
function executeSchemaGen(input: SchemaGenInput): string | null {
  try {
    const {
      title, meta_description, faq, keyword, city, niche, language,
      content_type, blog_name, blog_url, business_name, slug, iso_date,
    } = input;

    const authorName = business_name || 'Especialista OmniSeen';
    const graph: unknown[] = [];

    // ── Article schema ──────────────────────────────────────────
    graph.push({
      '@type': 'Article',
      '@id': `${blog_url}/${slug}#article`,
      headline: title.slice(0, 110),
      description: meta_description.slice(0, 160),
      datePublished: iso_date,
      dateModified: iso_date,
      author: {
        '@type': 'Person',
        name: authorName,
        url: blog_url,
      },
      publisher: {
        '@type': 'Organization',
        name: blog_name || 'OmniSeen',
        url: blog_url,
      },
      inLanguage: language || 'pt-BR',
      keywords: [keyword, niche, city].filter(Boolean),
    });

    // ── FAQPage schema (min 1 item required by Google) ──────────
    if (faq && faq.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      });
    }

    // ── HowTo schema (content_type = como_fazer) ─────────────────
    if (content_type === 'como_fazer') {
      const stepMatches = [...input.html_article.matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi)];
      const steps = stepMatches.slice(0, 10).map((m, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: m[1].trim(),
      }));
      if (steps.length > 0) {
        graph.push({
          '@type': 'HowTo',
          name: title,
          step: steps,
        });
      }
    }

    // ── LocalBusiness schema (if city present) ───────────────────
    if (city) {
      graph.push({
        '@type': 'LocalBusiness',
        name: authorName,
        url: blog_url,
        address: {
          '@type': 'PostalAddress',
          addressLocality: city,
          addressCountry: 'BR',
        },
      });
    }

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });

    return `<script type="application/ld+json">${jsonLd}</script>`;
  } catch (e) {
    console.warn('[SCHEMA_GEN] Non-fatal error building schema:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ============================================================
// STEP: CONTENT_GEN (outline-driven, multi-section)
// ============================================================

async function executeContentGenFromOutline(
  jobInput: Record<string, unknown>,
  serpSummary: string,
  outline: OutlineData,
  entities: EntityData,
  entityCoverage: EntityCoverageResult,
  jobType: 'article' | 'super_page',
  supabaseUrl: string,
  serviceKey: string,
  useGrounding?: boolean
): Promise<{ output: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const niche = (jobInput.niche as string) || '';
  const language = (jobInput.language as string) || 'pt-BR';
  const whatsapp = (jobInput.whatsapp as string) || '';
  const businessName = (jobInput.business_name as string) || '';
  const cType = (jobInput.content_type as string) || 'como_fazer';

  const ctaInfo = whatsapp
    ? `Include a WhatsApp CTA: ${whatsapp}${businessName ? ` (${businessName})` : ''}`
    : businessName ? `Include a CTA for ${businessName}` : 'Include a strong contact CTA';

  const wordRange = resolveWordRange(jobInput, jobType);
  const targetWords = jobInput.target_words ? Number(jobInput.target_words) : null;

  console.log(`[CONTENT_GEN] wordRange=${wordRange} target_words=${targetWords} job_type=${jobType} content_type=${contentType}`);

  const outlineJson = JSON.stringify(outline, null, 0);
  const entitiesJson = JSON.stringify(entities, null, 0);
  const perSectionEntities = entityCoverage.assignment.map((a) => `Section "${a.sectionTitle}": cover these terms naturally: ${a.terms.slice(0, 8).join(', ')}`).join('\n');
  const toneTemplate = getContentTypeTemplate(cType);

  const prompt = `You are an elite SEO content strategist producing premium-quality articles. Write a FULL, in-depth article following this EXACT outline. Content type: ${jobType} / ${cType}.

INPUT:
- keyword: ${keyword}
- city: ${city || 'Brazil'}
- niche: ${niche}
- language: ${language}
- content_type: ${contentType}
- serp_summary: ${serpSummary || 'No competitive data'}

=== CONTENT TYPE RULES (${contentType.toUpperCase()}) ===
${template.structureHint}

${template.answerFirstRule}

QUALITY MARKERS — apply these throughout:
${template.qualityMarkers}

MANDATORY OUTLINE (follow this structure exactly; write each H2 and H3 section with depth):
${outlineJson}

ENTITY COVERAGE - distribute and cover these per section (improves semantic score):
${perSectionEntities}

SEMANTIC ENTITIES (full list to weave in naturally):
${entitiesJson}

=== PADRAO EDITORIAL OBRIGATORIO E INTRUCOES DE ESTRUTURA ===

DIRETRIZ EDITORIAL DO FORMATO (${cType}):
${toneTemplate}

REGRA DE TAMANHO — CRITICA E INEGOCIAVEL:
- O artigo DEVE ter EXATAMENTE entre ${wordRange} palavras. NAO MAIS QUE ISSO.
- Alvo central: ${targetWords || wordRange.split('-')[0]} palavras.
- E ESTRITAMENTE PROIBIDO ultrapassar o limite superior de palavras.
- Nao expanda secoes desnecessariamente. Seja preciso e objetivo.
- Se atingiu o limite, pare de escrever e entregue o artigo.

ESTRUTURA OBRIGATORIA:
1. 1 H1 unico (primeiro elemento)
2. Introducao forte, clara e envolvente com paragrafos curtos (2-5 linhas cada)
3. Multiplos H2 bem distribuidos ao longo do texto
4. H3 subordinados aos H2 quando necessario
5. Paragrafos curtos e legiveis (maximo 5 linhas cada)
6. Listas com <ul>/<ol> e <li> quando fizer sentido
7. Conclusao estrategica
8. FAQ ao final com 3-5 perguntas

REGRAS DE FORMATACAO INEGOCIAVEIS:
- E OBRIGATORIO usar <h1>, <h2> e <h3> corretamente como tags HTML
- E PROIBIDO entregar texto em bloco unico
- E PROIBIDO usar <p><strong>Titulo</strong></p> como heading
- Todo texto deve ter separacao clara entre secoes
- Frases devem ser objetivas, fluidas e profissionais
- A leitura precisa ser escaneavel em desktop e mobile
- O artigo deve parecer publicacao premium, NAO rascunho bruto

PADRAO DE QUALIDADE:
- Responder claramente a intencao de busca
- Entregar contexto, explicacao, aplicacao e exemplos REAIS
- Evitar repeticao de ideias entre secoes
- Evitar frases genericas e afirmacoes vazias
- Linguagem natural e humana, NUNCA robotica

[CITE-ANSWER-BLOCK] REGRA CRITICA DE CITABILIDADE POR IA (GEO/AEO):
- Apos CADA H2, o PRIMEIRO paragrafo DEVE ser um bloco de resposta direta com EXATAMENTE 40-60 palavras que responde completamente a pergunta implicita do heading.
- Este bloco e o que AI engines (Perplexity, ChatGPT, Google AI Overviews) extraem como citacao.
- E PROIBIDO comecar uma secao H2 com contexto, historia ou introducao — SEMPRE comece com a resposta direta.
- Cada secao deve ser autocontida: um leitor que ler apenas aquele H2 e seu primeiro paragrafo deve entender completamente o ponto central.
- Secoes de 120-180 palavras recebem 70% mais citacoes de ChatGPT — respeite esse range por H2.

SEO ON-PAGE:
- Palavra-chave principal distribuida naturalmente (sem stuffing)
- Variacoes semanticas ao longo do texto
- Estrutura de leitura para featured snippets quando aplicavel

REQUIREMENTS:
1) Word count: EXACTLY ${wordRange} words. THIS IS MANDATORY. Do NOT exceed the upper limit.
2) Use the exact H1 and H2/H3 from the outline. Do not skip or merge sections.
3) Answer-first introduction. Real-world examples for the city.
4) ${ctaInfo}
5) FAQ section with 3-5 questions at the end.
6) Tone: authoritative, practical, human. No keyword stuffing.

CRITICAL HTML STRUCTURE RULES (MANDATORY - DO NOT IGNORE):
- The html_article MUST use proper semantic HTML heading tags: <h1>, <h2>, <h3>
- The FIRST element in html_article MUST be an <h1> tag with the main title
- Every section from the outline MUST start with an <h2> tag
- Every subsection MUST use an <h3> tag
- NEVER write headings as plain text, bold text, or <p> tags
- Paragraphs MUST use <p> tags
- Lists MUST use <ul>/<ol> and <li> tags
- Include a <style> tag at the beginning with premium typography styles
- Example correct structure:
  <style>h1{font-size:2em;margin-bottom:0.5em}h2{font-size:1.5em;margin-top:1.5em;margin-bottom:0.5em}h3{font-size:1.2em;margin-top:1em;margin-bottom:0.3em}p{line-height:1.8;margin-bottom:1em}ul,ol{margin:1em 0;padding-left:1.5em}li{margin-bottom:0.5em;line-height:1.6}</style>
  <h1>Main Title</h1>
  <p>Introduction...</p>
  <h2>Section</h2>
  <p>Content...</p>
  <h3>Subsection</h3>
  <p>Detail...</p>

HERO IMAGE: Return ONE detailed image description for the hero image. The image must be photorealistic, professional, specific to the keyword and context. IMPORTANT: NO TEXT OVERLAY, NO WORDS, NO TYPOGRAPHY on the image. Pure visual only.
Return exactly one image_prompt string for the hero image only.

OUTPUT FORMAT (STRICT JSON only):
{
  "title": "...",
  "meta_description": "... max 155 chars ...",
  "html_article": "<style>...</style><h1>Title</h1><p>...</p><h2>Section</h2><p>...</p>",
  "faq": [{"question": "...", "answer": "..."}],
  "image_prompt": "... detailed hero image description ..."
}`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'article_gen_from_outline', [
    { role: 'system', content: `You are an elite premium SEO content writer for ${niche} in ${language}. You produce articles with EXACTLY ${wordRange} words. CRITICAL: Do NOT exceed the upper word limit. You MUST return valid JSON with html_article containing proper semantic HTML: <h1> for title, <h2> for sections, <h3> for subsections, <p> for paragraphs, <ul>/<ol> for lists. Every paragraph must be short (2-5 lines). NEVER write headings as plain text. Return ONLY valid JSON. No markdown, no code blocks. MANDATORY GEO RULE: After EVERY H2 heading, write a 40-60 word direct answer block that completely answers the implicit question of that heading. This is the passage AI systems extract as a citation. Never start an H2 section with context or history — always start with the direct answer.` },
    { role: 'user', content: prompt },
  ], { useGrounding });

  if (!aiResult.success) throw new Error(`CONTENT_GEN_FAILED: ${aiResult.error}`);
  const parsed = parseAIJson(aiResult.content, 'CONTENT_GEN');
  if (!parsed.title) throw new Error('CONTENT_GEN: missing title');
  if (!parsed.html_article) throw new Error('CONTENT_GEN: missing html_article');

  parsed.html_article = enforceHeadingStructure(parsed.html_article as string, outline);

  // ── Melhoria 2: Inject "Last Updated" timestamp ─────────────────────────────
  const now = new Date();
  const isoNow = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const ptDate = formatPtDate(now);
  const timestampBlock = `<div class="article-meta" style="font-size:0.85em;color:#666;margin-bottom:1.5em;padding:8px 0;border-bottom:1px solid #eee;"><time datetime="${isoNow}" itemprop="dateModified">Atualizado em ${ptDate}</time></div>`;

  // Insert after </style> tag if present, otherwise prepend
  const htmlStr = parsed.html_article as string;
  if (htmlStr.includes('</style>')) {
    parsed.html_article = htmlStr.replace('</style>', `</style>${timestampBlock}`);
  } else {
    parsed.html_article = timestampBlock + htmlStr;
  }
  // Store ISO date for SCHEMA_GEN
  parsed._iso_date = isoNow;

  return { output: parsed, aiResult };
}

// ============================================================
// CTA HTML INJECTION
// ============================================================

function injectCtaIntoHtml(html: string, cta: Record<string, unknown> | null): string {
  if (!cta || !cta.value) return html;

  const ctaUrl = cta.type === 'whatsapp'
    ? `https://wa.me/${(cta.value as string).replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Vi seu artigo e gostaria de saber mais.')}`
    : cta.value as string;

  const ctaBlock = `
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 32px; margin: 32px 0; text-align: center;">
  <h3 style="color: white; font-size: 1.4em; margin-bottom: 12px;">Gostou do conteúdo?</h3>
  <p style="color: rgba(255,255,255,0.9); margin-bottom: 20px;">${cta.label || 'Entre em contato'}</p>
  <a href="${ctaUrl}" target="_blank" rel="noopener" style="display: inline-block; background: white; color: #667eea; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1em;">
    ${cta.type === 'whatsapp' ? '💬 Falar no WhatsApp' : cta.label || 'Saiba mais'}
  </a>
</div>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', ctaBlock + '</body>');
  }
  return html + ctaBlock;
}

// ============================================================
// STEP 4: SAVE_ARTICLE
// ============================================================

async function executeSaveArticle(
  jobId: string,
  articleData: Record<string, unknown>,
  jobInput: Record<string, unknown>,
  supabase: any,
  totalApiCalls: number,
  totalCostUsd: number,
  contentType: 'article' | 'super_page'
): Promise<Record<string, unknown>> {
  const blogId = (jobInput.blog_id as string);
  if (!blogId) throw new Error('blog_id missing from jobInput');

  const title = (articleData.title as string) || (jobInput.keyword as string) || '';
  const htmlArticle = (articleData.html_article as string) || '';
  const metaDescription = (articleData.meta_description as string) || '';
  const faqItems = (articleData.faq as Array<Record<string, unknown>>) || [];
  const imagePrompt = (articleData.image_prompt as string) || '';
  const schemaJson = (articleData.schema_faq as string) ?? null;

  if (!htmlArticle || htmlArticle.length < 200) {
    throw new Error('SAVE_ARTICLE: HTML content too short');
  }

  const baseSlug = title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 70);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const excerpt = metaDescription || title;
  const textContent = htmlArticle.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 200);
  const wordCountTarget = jobInput.target_words ? Number(jobInput.target_words) : (contentType === 'super_page' ? 4500 : 2250);

  const { data: blogData } = await supabase
    .from('blogs')
    .select('cta_type, cta_url, cta_text, header_cta_text, header_cta_url, city')
    .eq('id', blogId)
    .single();

  const whatsapp = (jobInput.whatsapp as string) || '';
  const businessName = (jobInput.business_name as string) || '';
  const city = (jobInput.city as string) || blogData?.city || '';

  let cta: Record<string, unknown> | null = null;
  if (whatsapp) {
    cta = { type: 'whatsapp', value: whatsapp, label: businessName ? `Fale com ${businessName}` : 'Fale conosco pelo WhatsApp', city };
  } else if (blogData?.cta_url || blogData?.header_cta_url) {
    cta = {
      type: blogData.cta_type || 'link',
      value: blogData.cta_url || blogData.header_cta_url,
      label: blogData.cta_text || blogData.header_cta_text || 'Saiba mais',
      city,
    };
  }

  const finalHtml = injectCtaIntoHtml(htmlArticle, cta);

  const insertPayload: Record<string, unknown> = {
    blog_id: blogId,
    title,
    slug,
    content: finalHtml,
    meta_description: metaDescription,
    excerpt,
    faq: faqItems as unknown,
    keywords: [(jobInput.keyword as string) || ''],
    status: 'draft',
    generation_stage: 'completed',
    generation_source: 'engine_v2',
    generation_progress: 100,
    engine_version: 'v2',
    reading_time: readingTime,
    cta: cta as unknown,
    source_payload: { image_prompt: imagePrompt, content_type: contentType, word_count_target: wordCountTarget, schema_json: schemaJson } as unknown,
  };

  let articleId: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: article, error: articleError } = await supabase
      .from('articles').insert(insertPayload).select('id').single();
    if (!articleError && article?.id) {
      articleId = article.id;
      break;
    }
    console.error(`[SAVE_ARTICLE] Insert attempt ${attempt}/3 failed:`, articleError);
    if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
  }

  if (!articleId) {
    console.error(`[SAVE_ARTICLE] All 3 insert attempts failed. Storing fallback in job.`);
    await supabase.from('generation_jobs').update({
      output: {
        fallback_html: htmlArticle.substring(0, 50000),
        insert_failed: true,
        title,
        meta_description: metaDescription,
      },
    }).eq('id', jobId);
  }

  await supabase.from('generation_jobs').update({
    article_id: articleId,
    output: {
      article_id: articleId,
      title,
      total_words: wordCount,
      total_api_calls: totalApiCalls,
      total_cost_usd: totalCostUsd,
      engine_version: 'v2',
      image_prompt: imagePrompt,
    },
    engine_version: 'v2',
  }).eq('id', jobId);

  return { article_id: articleId, html_generated: true, total_words: wordCount };
}

// ============================================================
// STEP: SEO_SCORE (post-save, non-fatal)
// ============================================================

async function executeSeoScoreStep(
  articleId: string | null,
  title: string,
  content: string,
  keyword: string,
  blogId: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<Record<string, unknown>> {
  if (!articleId) return { skipped: true, reason: 'no_article_id' };
  try {
    const url = `${supabaseUrl}/functions/v1/calculate-content-score`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        articleId,
        title,
        content: content.slice(0, 100_000),
        keyword,
        blogId,
        saveScore: true,
        userInitiated: false,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.warn('[SEO_SCORE] calculate-content-score failed:', resp.status, err?.slice(0, 200));
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const data = await resp.json();
    return { success: true, score: data?.score ?? data?.totalScore, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[SEO_SCORE] Error:', msg);
    return { success: false, error: msg };
  }
}

// ============================================================
// STEP: IMAGE_GEN — Gemini Nano Banana (hero + section + contextual)
// ============================================================

const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-001';
async function generateOneImage(prompt: string, apiKey: string): Promise<{ url: string; base64?: string } | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:predict`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: prompt }],
      parameters: { sampleCount: 1, aspectRatio: "16:9" }
    }),
  });
  if (!res.ok) {
    console.warn(`[IMAGE_GEN] API error: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  const base64Str = data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64Str) return null;
  const mimeType = data.predictions?.[0]?.mimeType || 'image/jpeg';
  return { url: `data:${mimeType};base64,${base64Str}`, base64: base64Str };
}

async function executeImageGenGeminiNanoBanana(
  articleId: string | null,
  articleData: Record<string, unknown>,
  outline: OutlineData,
  jobInput: Record<string, unknown>,
  supabase: any
): Promise<Record<string, unknown>> {
  if (!articleId) return { skipped: true, reason: "no_article_id" };
  const apiKey = Deno.env.get("GOOGLE_AI_KEY");
  if (!apiKey) return { skipped: true, reason: "GOOGLE_AI_KEY not set" };

  const heroPromptRaw = (articleData.image_prompt as string) || (articleData.title as string) || (jobInput.keyword as string) || "professional blog";
  const keyword = (jobInput.keyword as string) || "article";
  const niche = (jobInput.niche as string) || "";
  const city = (jobInput.city as string) || "";
  const slug = keyword.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const visualContextBrief = `[Visual Context: Topic is "${keyword}" in "${city}", niche "${niche}". Aesthetic: Premium, photorealistic, cinematic. ZERO text/words/letters/typography in image.]`;
  const heroPrompt = `${visualContextBrief} Hero scene: ${heroPromptRaw}`;

  const contentImages: { context: string; url: string; alt?: string; after_section: number }[] = [];
  const usedImageUrls = new Set<string>();
  const usedSectionPrompts = new Set<string>();
  let heroUrl: string | null = null;
  let heroAlt: string | null = null;

  try {
    const hero = await generateOneImage(heroPrompt, apiKey);
    if (hero?.url) {
      const base64Match = hero.url.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        const fmt = base64Match[1];
        const bin = Uint8Array.from(atob(base64Match[2]), (c) => c.charCodeAt(0));
        const fname = `${articleId}-hero.${fmt}`;
        await supabase.storage.from("article-images").upload(fname, bin, { contentType: `image/${fmt}`, upsert: true });
        const { data: pub } = supabase.storage.from("article-images").getPublicUrl(fname);
        heroUrl = pub.publicUrl;
        heroAlt = (articleData.title as string) || keyword;
        if (heroUrl) usedImageUrls.add(heroUrl); // Track hero URL to prevent reuse
      }
    }
    if (!heroUrl) {
      heroUrl = `https://picsum.photos/seed/${slug}-hero/1024/576`;
      heroAlt = `${keyword} — imagem ilustrativa`;
      usedImageUrls.add(heroUrl);
    }
    await supabase.from("articles").update({ featured_image_url: heroUrl, featured_image_alt: heroAlt }).eq("id", articleId);

    const html = (articleData.html_article as string) || "";
    const articleWordCount = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    
    // Limit images based on word count. 
    // Small articles (<1200) get max 3 images, larger articles get max 6 images.
    const maxTotalImages = articleWordCount >= 1200 ? 6 : 3;
    const targetImages = Math.max(0, maxTotalImages - 1);
    
    // Identificar H2 semanticamente aptos (Evitar: conclusões, repetições, "O que é")
    const validSections = (outline.h2 || [])
      .map((h: any, idx: number) => ({ title: h.title, index: idx }))
      .filter((s: { title: string }) => !/conclus(ã|a)o|resumo|o que (é|e)|introdu(ç|c)(ã|a)o|considera(ç|c)(õ|o)es|refer(ê|e)ncias/i.test(s.title));
      
    const selectedSections = [];
    if (validSections.length > 0) {
      const actualTarget = Math.min(validSections.length, targetImages);
      const step = validSections.length / actualTarget;
      for (let i = 0; i < actualTarget; i++) {
        const idx = Math.floor(i * step + step / 2);
        if (validSections[idx]) selectedSections.push(validSections[idx]);
      }
    }

    for (const sec of selectedSections) {
      const sectionTitle = sec.title || `Section ${sec.index + 1}`;
      const structuralIndex = sec.index + 1;
      const prompt = `${visualContextBrief} Section context: ${sectionTitle}. Show an editorial photograph illustrating this specific concept without repeating the hero image. NO TEXT ALLOWED.`;
      if (usedSectionPrompts.has(prompt)) continue;
      usedSectionPrompts.add(prompt);
      const img = await generateOneImage(prompt, apiKey);
      let url: string;
      if (img?.url && img.url.startsWith("data:")) {
        const base64Match = img.url.match(/^data:image\/(\w+);base64,(.+)$/);
        if (base64Match) {
          const fmt = base64Match[1];
          const bin = Uint8Array.from(atob(base64Match[2]), (c) => c.charCodeAt(0));
          const fname = `${articleId}-section-${structuralIndex}-${Date.now()}.${fmt}`;
          await supabase.storage.from("article-images").upload(fname, bin, { contentType: `image/${fmt}`, upsert: true });
          const { data: pub } = supabase.storage.from("article-images").getPublicUrl(fname);
          url = pub.publicUrl;
        } else continue;
      } else url = `https://picsum.photos/seed/${slug}-sec-${sec.index}/800/450`;
      // Skip if this URL is already used (dedup)
      if (usedImageUrls.has(url)) continue;
      usedImageUrls.add(url);
      contentImages.push({ context: sectionTitle, url, alt: sectionTitle, after_section: structuralIndex });
    }

    if (contentImages.length > 0) {
      await supabase.from("articles").update({ content_images: contentImages }).eq("id", articleId);
    }
    return { success: true, heroUrl, sectionCount: contentImages.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fallback = `https://picsum.photos/seed/${slug}-hero/1024/576`;
    await supabase.from("articles").update({ featured_image_url: fallback, featured_image_alt: `${keyword} — imagem ilustrativa` }).eq("id", articleId);
    return { success: false, fallback: true, error: msg };
  }
}

// ============================================================
// STEP: INTERNAL_LINK_ENGINE
// ============================================================

async function executeInternalLinkEngine(
  articleId: string | null,
  blogId: string,
  keyword: string,
  title: string,
  supabase: any
): Promise<Record<string, unknown>> {
  if (!articleId) return { skipped: true, reason: "no_article_id" };
  try {
    const { data: candidates } = await supabase
      .from("articles")
      .select("id, title, slug")
      .eq("blog_id", blogId)
      .neq("id", articleId)
      .in("status", ["draft", "published"])
      .limit(10);
    if (!candidates?.length) return { inserted: 0, reason: "no_candidates" };
    const links: { source_article_id: string; target_article_id: string; anchor_text: string }[] = [];
    for (const t of candidates.slice(0, 5)) {
      const anchor = t.title?.slice(0, 60) || t.slug || "";
      if (!anchor) continue;
      links.push({ source_article_id: articleId, target_article_id: t.id, anchor_text: anchor });
    }
    for (const link of links) {
      const { error } = await supabase.from("article_internal_links").insert(link);
      if (error && error.code !== '23505') console.warn("[INTERNAL_LINK_ENGINE] insert warning:", error.message);
    }
    return { inserted: links.length, candidates: candidates.length };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ============================================================
// STEP: QUALITY_GATE (with AI Detection)
// ============================================================

async function executeQualityGate(
  articleId: string | null,
  blogId: string,
  articleData: Record<string, unknown>,
  entityCoverageScore: number,
  seoScoreResult: Record<string, unknown>,
  jobType: "article" | "super_page",
  supabase: any
): Promise<Record<string, unknown>> {
  if (!articleId) return { passed: false, reason: "no_article_id" };
  const html = (articleData.html_article as string) || "";
  const wordCount = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
  const faq = (articleData.faq as Array<{ question?: string; answer?: string }>) || [];
  const faqCount = Array.isArray(faq) ? faq.length : 0;
  const contentScore = Number(seoScoreResult?.score ?? seoScoreResult?.totalScore ?? 0);

  const aiScan = detectAiPatterns(html);

  const minWords = getMinWordCount(jobType);
  const isCriticalWordCount = wordCount < (minWords * 0.6); // Abaixo de 60% do alvo
  const isCriticalAi = aiScan.score > 85;                   // AI pura e dura
  const isCriticalEntity = entityCoverageScore < (QUALITY_GATE.ENTITY_COVERAGE_MIN * 0.5);
  
  const entityOk = entityCoverageScore >= QUALITY_GATE.ENTITY_COVERAGE_MIN;
  const wordOk = wordCount >= minWords;
  const faqOk = faqCount >= QUALITY_GATE.FAQ_MIN_ITEMS;
  const scoreOk = contentScore >= QUALITY_GATE.SEMANTIC_SCORE_MIN;
  const aiOk = aiScan.passed;

  const passed = entityOk && wordOk && faqOk && scoreOk && aiOk;
  // Fallback to NEEDS_IMPROVEMENT unless the errors are CRITICAL_BLOCK
  const isCriticalBlock = !passed && (isCriticalWordCount || isCriticalAi || isCriticalEntity);

  const reasons: string[] = [];
  if (!entityOk) reasons.push(`entity_coverage ${entityCoverageScore} < ${QUALITY_GATE.ENTITY_COVERAGE_MIN}`);
  if (!wordOk) reasons.push(`word_count ${wordCount} < ${minWords}`);
  if (!faqOk) reasons.push(`faq_items ${faqCount} < ${QUALITY_GATE.FAQ_MIN_ITEMS}`);
  if (!scoreOk) reasons.push(`semantic_score ${contentScore} < ${QUALITY_GATE.SEMANTIC_SCORE_MIN}`);
  if (!aiOk) reasons.push(`ai_voice_detected score=${aiScan.score} flags=[${aiScan.flags.slice(0, 3).join(',')}]`);

  let qualityGateStatus = "approved"; // PASS
  if (!passed) {
    qualityGateStatus = isCriticalBlock ? "blocked" : "needs_improvement";
  }

  await supabase.from("articles").update({
    quality_gate_status: qualityGateStatus,
    ...(passed ? { ready_for_publish_at: new Date().toISOString() } : {}),
  }).eq("id", articleId);
  await supabase.from("quality_gate_audits").insert({
    article_id: articleId,
    blog_id: blogId,
    approved: passed,
    attempt_number: 1,
    validated_at: new Date().toISOString(),
    failures: reasons,
    word_count: wordCount,
    seo_score: Math.round(contentScore),
    ai_detection_score: aiDetection.score,
    ai_flagged_phrases: aiDetection.flaggedPhrases,
  });

  return { passed, entityOk, wordOk, faqOk, scoreOk, aiOk, reasons, quality_gate_status: qualityGateStatus, aiDetection: aiScan };
}

// ============================================================
// ORCHESTRATOR CORE
// ============================================================

async function orchestrate(jobId: string, supabase: any, supabaseUrl: string, serviceKey: string): Promise<void> {
 try {
  const jobStart = Date.now();

  const { data: job, error: jobError } = await supabase.from('generation_jobs').select('*').eq('id', jobId).single();
  if (jobError || !job) { console.error(`[ORCHESTRATOR] Job ${jobId} not found:`, jobError); return; }
  if (['completed', 'failed', 'cancelled'].includes(job.status)) { console.log(`[ORCHESTRATOR] Job ${jobId} already ${job.status}.`); return; }

  const jobType = ((job.job_type ?? job.input?.job_type) || 'article') as 'article' | 'super_page';

  await supabase.from('generation_jobs').update({
    public_stage: 'ANALYZING_MARKET',
    public_progress: 3,
    public_message: 'Inicializando motor de geração v2...',
    public_updated_at: new Date().toISOString(),
  }).eq('id', jobId);
  console.log('[ORCHESTRATOR_BOOT:V2]', jobId, 'job_type=', jobType);

  const jobInput = { ...(job.input as Record<string, unknown> || {}), job_type: jobType } as Record<string, unknown>;
  const generationMode = job.generation_mode || 'economic';
  const researchMode = job.research_mode || 'google_grounding';
  const rewriteModel = job.rewrite_model || 'gpt-4.1';
  const useGrounding = researchMode === 'google_grounding';
  const isAutoPublish = !!job.auto_publish;
  const isPreview = !!job.is_preview;

  console.log(`[ORCHESTRATOR:V2] job_id=${jobId} input=${JSON.stringify({ keyword: jobInput.keyword, city: jobInput.city, niche: jobInput.niche, job_type: jobType, target_words: jobInput.target_words, content_type: jobInput.content_type || 'article' })}`);
  console.log(`[ORCHESTRATOR:V2] Modes: gen=${generationMode}, res=${researchMode}, rew=${rewriteModel}, grd=${useGrounding}`);

  if (job.locked_at) {
    const lockAge = Date.now() - new Date(job.locked_at).getTime();
    if (lockAge < LOCK_TTL_MS) {
      console.log(`[ORCHESTRATOR] Job ${jobId} locked (${lockAge}ms). Skipping.`);
      return;
    }
    console.warn(`[ORCHESTRATOR:STALE_LOCK] Job ${jobId} locked for ${lockAge}ms. Releasing.`);
    await supabase.from('generation_jobs').update({ locked_at: null, locked_by: null }).eq('id', jobId);
  }

  const lockId = crypto.randomUUID();
  const { error: lockError } = await supabase.from('generation_jobs')
    .update({
      locked_at: new Date().toISOString(),
      locked_by: lockId,
      status: 'running',
      started_at: job.started_at || new Date().toISOString(),
      public_stage: 'ANALYZING_MARKET',
      public_progress: 5,
      public_message: 'Inicializando inteligência artificial...',
      public_updated_at: new Date().toISOString(),
    })
    .eq('id', jobId).is('locked_by', null);
  if (lockError) {
    console.error(`[ENGINE] LOCK_BLOCKED job_id=${jobId}`);
    return;
  }
  console.log(`[ENGINE] LOCK_ACQUIRED job_id=${jobId} lockId=${lockId}`);

  let heartbeatRunning = true;
  const heartbeatInterval = setInterval(async () => {
    if (!heartbeatRunning) return;
    try {
      await supabase.from('generation_jobs')
        .update({ locked_at: new Date().toISOString() })
        .eq('id', jobId).eq('locked_by', lockId);
    } catch (_) { /* ignore */ }
  }, 15_000);

  let totalApiCalls = job.total_api_calls || 0;
  let totalCostUsd = job.cost_usd || 0;

  try {
    // STEP 1: INPUT_VALIDATION
    console.log(`[V2] Step 1: INPUT_VALIDATION`);
    await updatePublicStatus(supabase, jobId, 'INPUT_VALIDATION', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'INPUT_VALIDATION' }).eq('id', jobId);
    const valStepId = await createStepOrFail(supabase, jobId, 'INPUT_VALIDATION', { job_input: job.input });
    const valStart = Date.now();
    const valOutput = executeInputValidation(jobInput);
    const valLatency = Date.now() - valStart;
    await supabase.from('generation_steps').update({
      status: 'completed', output: valOutput, latency_ms: valLatency,
      completed_at: new Date().toISOString(), model_used: 'validation', provider: 'programmatic',
    }).eq('id', valStepId);
    await updatePublicStatus(supabase, jobId, 'INPUT_VALIDATION', true, lockId);
    console.log(`[V2] ✅ INPUT_VALIDATION ${valLatency}ms`);

    // STEP 2: SERP_ANALYSIS
    console.log(`[V2] Step 2: SERP_ANALYSIS`);
    await updatePublicStatus(supabase, jobId, 'SERP_ANALYSIS', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SERP_ANALYSIS' }).eq('id', jobId);
    let serpStepId: string | null = null;
    let serpSummaryText = '';
    const serpStart = Date.now();
    try {
      serpStepId = await createStepOrFail(supabase, jobId, 'SERP_ANALYSIS', { keyword: jobInput.keyword, city: jobInput.city });
      const serpResult = await withTimeout(executeSerpSummary(jobInput, supabaseUrl, serviceKey, useGrounding), 30_000, 'SERP_ANALYSIS');
      serpSummaryText = (serpResult.output.serp_summary as string) || '';
      totalApiCalls++;
      totalCostUsd += serpResult.aiResult.costUsd || 0;
      await supabase.from('generation_steps').update({
        status: 'completed', output: serpResult.output, latency_ms: Date.now() - serpStart,
        completed_at: new Date().toISOString(), model_used: serpResult.aiResult.model,
        provider: serpResult.aiResult.provider, cost_usd: serpResult.aiResult.costUsd,
        tokens_in: serpResult.aiResult.tokensIn, tokens_out: serpResult.aiResult.tokensOut,
      }).eq('id', serpStepId);
      console.log(`[V2] ✅ SERP_ANALYSIS ${Date.now() - serpStart}ms`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'SERP failed';
      const researchPolicy = getResearchFailedPolicy(generationMode, isAutoPublish, isPreview);
      console[researchPolicy.logLevel](`[V2] ⚠️ SERP_ANALYSIS ${researchPolicy.fallbackLabel}: ${errMsg}`);
      if (serpStepId) {
        await supabase.from('generation_steps').update({
          status: 'completed',
          output: { serp_summary: '', error: errMsg, research_policy: researchPolicy.fallbackLabel },
          latency_ms: Date.now() - serpStart,
          completed_at: new Date().toISOString(), model_used: 'fallback', provider: 'fallback', error_message: errMsg,
        }).eq('id', serpStepId);
      }
      // PREMIUM: abortar pipeline se pesquisa falhou e modo premium está ativo
      if (researchPolicy.shouldAbort) {
        throw new Error(`RESEARCH_FAILED:PREMIUM_BLOCKED — ${errMsg}. Pesquisa real é obrigatória em modo premium.`);
      }
    }
    await updatePublicStatus(supabase, jobId, 'SERP_ANALYSIS', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);

    // STEP: SERP_GAP_ANALYSIS
    let gapAnalysis: SerpGapResult = { semantic_gaps: [], competitor_topics: [] };
    console.log(`[V2] Step: SERP_GAP_ANALYSIS`);
    await updatePublicStatus(supabase, jobId, 'SERP_GAP_ANALYSIS', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SERP_GAP_ANALYSIS' }).eq('id', jobId);
    try {
      const gapStepId = await createStepOrFail(supabase, jobId, 'SERP_GAP_ANALYSIS', { keyword: jobInput.keyword });
      const gapResult = await withTimeout(executeSerpGapAnalysis(jobInput, serpSummaryText, supabaseUrl, serviceKey, useGrounding), 25_000, 'SERP_GAP_ANALYSIS');
      gapAnalysis = gapResult.output;
      totalApiCalls++;
      totalCostUsd += gapResult.aiResult.costUsd || 0;
      await supabase.from('generation_steps').update({
        status: 'completed', output: gapResult.output, completed_at: new Date().toISOString(),
        model_used: gapResult.aiResult.model, provider: gapResult.aiResult.provider, cost_usd: gapResult.aiResult.costUsd,
      }).eq('id', gapStepId);
    } catch (_) { /* non-fatal */ }
    await updatePublicStatus(supabase, jobId, 'SERP_GAP_ANALYSIS', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);

    // STEP: OUTLINE_GEN
    console.log(`[V2] Step: OUTLINE_GEN`);
    await updatePublicStatus(supabase, jobId, 'OUTLINE_GEN', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'OUTLINE_GEN' }).eq('id', jobId);
    const outlineStepId = await createStepOrFail(supabase, jobId, 'OUTLINE_GEN', { keyword: jobInput.keyword, content_type: jobInput.content_type || 'article' });
    const outlineStart = Date.now();
    const outlineResult = await withTimeout(executeOutlineGen(jobInput, serpSummaryText, supabaseUrl, serviceKey, useGrounding), 45_000, 'OUTLINE_GEN');
    let outline = outlineResult.output.outline;
    totalApiCalls++;
    totalCostUsd += outlineResult.aiResult.costUsd || 0;
    await supabase.from('generation_steps').update({
      status: 'completed', output: { outline: outline }, latency_ms: Date.now() - outlineStart,
      completed_at: new Date().toISOString(), model_used: outlineResult.aiResult.model,
      provider: outlineResult.aiResult.provider, cost_usd: outlineResult.aiResult.costUsd,
    }).eq('id', outlineStepId);
    await updatePublicStatus(supabase, jobId, 'OUTLINE_GEN', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
    console.log(`[V2] ✅ OUTLINE_GEN ${Date.now() - outlineStart}ms | h1="${outline.h1?.slice(0, 40)}"`);

    // STEP: AUTO_SECTION_EXPANSION
    let expandedOutline = outline;
    console.log(`[V2] Step: AUTO_SECTION_EXPANSION`);
    await updatePublicStatus(supabase, jobId, 'AUTO_SECTION_EXPANSION', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'AUTO_SECTION_EXPANSION' }).eq('id', jobId);
    try {
      const expStepId = await createStepOrFail(supabase, jobId, 'AUTO_SECTION_EXPANSION', { gaps: gapAnalysis.semantic_gaps?.length || 0 });
      const expResult = await withTimeout(executeAutoSectionExpansion(outline, gapAnalysis, jobType, supabaseUrl, serviceKey), 35_000, 'AUTO_SECTION_EXPANSION');
      expandedOutline = expResult.output.outline;
      if (expResult.aiResult.success && expResult.aiResult.tokensOut) {
        totalApiCalls++;
        totalCostUsd += expResult.aiResult.costUsd || 0;
      }
      await supabase.from('generation_steps').update({
        status: 'completed', output: { outline: expandedOutline }, completed_at: new Date().toISOString(),
        model_used: expResult.aiResult.model || 'none', provider: expResult.aiResult.provider || 'none',
      }).eq('id', expStepId);
    } catch (_) { /* non-fatal */ }
    await updatePublicStatus(supabase, jobId, 'AUTO_SECTION_EXPANSION', true, lockId);
    outline = expandedOutline;

    // STEP: ENTITY_EXTRACTION
    console.log(`[V2] Step: ENTITY_EXTRACTION`);
    await updatePublicStatus(supabase, jobId, 'ENTITY_EXTRACTION', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'ENTITY_EXTRACTION' }).eq('id', jobId);
    const entityStepId = await createStepOrFail(supabase, jobId, 'ENTITY_EXTRACTION', { keyword: jobInput.keyword });
    const entityStart = Date.now();
    const entityResult = await withTimeout(executeEntityExtraction(jobInput, serpSummaryText, outline, supabaseUrl, serviceKey), 30_000, 'ENTITY_EXTRACTION');
    const entities = entityResult.output.entities;
    totalApiCalls++;
    totalCostUsd += entityResult.aiResult.costUsd || 0;
    await supabase.from('generation_steps').update({
      status: 'completed', output: { entities }, latency_ms: Date.now() - entityStart,
      completed_at: new Date().toISOString(), model_used: entityResult.aiResult.model,
      provider: entityResult.aiResult.provider, cost_usd: entityResult.aiResult.costUsd,
    }).eq('id', entityStepId);
    await updatePublicStatus(supabase, jobId, 'ENTITY_EXTRACTION', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
    console.log(`[V2] ✅ ENTITY_EXTRACTION ${Date.now() - entityStart}ms`);

    // STEP: ENTITY_COVERAGE
    console.log(`[V2] Step: ENTITY_COVERAGE`);
    await updatePublicStatus(supabase, jobId, 'ENTITY_COVERAGE', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'ENTITY_COVERAGE' }).eq('id', jobId);
    const covStepId = await createStepOrFail(supabase, jobId, 'ENTITY_COVERAGE', { entity_count: (entities.topics?.length || 0) + (entities.terms?.length || 0) });
    const covStart = Date.now();
    const entityCoverage = executeEntityCoverage(outline, entities);
    await supabase.from('generation_steps').update({
      status: 'completed', output: { coverageScore: entityCoverage.coverageScore, assignedSections: entityCoverage.assignment.length },
      latency_ms: Date.now() - covStart, completed_at: new Date().toISOString(), model_used: 'programmatic', provider: 'programmatic',
    }).eq('id', covStepId);
    await updatePublicStatus(supabase, jobId, 'ENTITY_COVERAGE', true, lockId);
    console.log(`[V2] ✅ ENTITY_COVERAGE score=${entityCoverage.coverageScore}`);

    // STEP: CONTENT_GEN
    console.log(`[V2] Step: CONTENT_GEN`);
    await updatePublicStatus(supabase, jobId, 'CONTENT_GEN', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'CONTENT_GEN' }).eq('id', jobId);

    const genStepId = await createStepOrFail(supabase, jobId, 'CONTENT_GEN', { keyword: jobInput.keyword, job_type: jobType, target_words: jobInput.target_words, content_type: jobInput.content_type, generation_mode: generationMode });
    const genStart = Date.now();
    let articleData: Record<string, unknown>;
    try {
      const genResult = await withTimeout(
        executeContentGenFromOutline(jobInput, serpSummaryText, outline, entities, entityCoverage, jobType, supabaseUrl, serviceKey, useGrounding),
        120_000, 'CONTENT_GEN'
      );
      articleData = genResult.output;
      totalApiCalls++;
      totalCostUsd += genResult.aiResult.costUsd || 0;
      const wordCount = ((articleData.html_article as string) || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
      await supabase.from('generation_steps').update({
        status: 'completed',
        output: { title: articleData.title, content_type: jobInput.content_type, generation_mode: generationMode, word_count: wordCount },
        latency_ms: Date.now() - genStart,
        completed_at: new Date().toISOString(), model_used: genResult.aiResult.model,
        provider: genResult.aiResult.provider, cost_usd: genResult.aiResult.costUsd,
      }).eq('id', genStepId);
    } catch (firstErr) {
      console.warn(`[V2] CONTENT_GEN first attempt failed: ${firstErr instanceof Error ? firstErr.message : 'unknown'}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
      const retryResult = await withTimeout(
        executeContentGenFromOutline(jobInput, serpSummaryText, outline, entities, entityCoverage, jobType, supabaseUrl, serviceKey, useGrounding),
        120_000, 'CONTENT_GEN_RETRY'
      );
      articleData = retryResult.output;
      totalApiCalls++;
      totalCostUsd += retryResult.aiResult.costUsd || 0;
      const wordCountRetry = ((articleData.html_article as string) || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
      await supabase.from('generation_steps').update({
        status: 'completed',
        output: { title: articleData.title, content_type: jobInput.content_type, generation_mode: generationMode, word_count: wordCountRetry, retried: true },
        latency_ms: Date.now() - genStart,
        completed_at: new Date().toISOString(), model_used: retryResult.aiResult.model, provider: retryResult.aiResult.provider, cost_usd: retryResult.aiResult.costUsd,
      }).eq('id', genStepId);
    }
    await updatePublicStatus(supabase, jobId, 'CONTENT_GEN', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
    console.log(`[V2] ✅ CONTENT_GEN ${Date.now() - genStart}ms | title="${(articleData!.title as string || '').slice(0, 50)}" | content_type=${jobInput.content_type} | mode=${generationMode}`);

    // STEP: REWRITE_PREMIUM (premium mode only)
    if (generationMode === 'premium') {
      console.log(`[V2] Step: REWRITE_PREMIUM | mode=${generationMode} | model=${rewriteModel}`);
      await updatePublicStatus(supabase, jobId, 'REWRITE_PREMIUM', false, lockId);
      await supabase.from('generation_jobs').update({ current_step: 'REWRITE_PREMIUM' }).eq('id', jobId);
      const rwStepId = await createStepOrFail(supabase, jobId, 'REWRITE_PREMIUM', { keyword: jobInput.keyword, model: rewriteModel, provider: 'openai' });
      const rwStart = Date.now();
      try {
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
        const draftHtml = (articleData!.html_article as string) || '';
        const rewritePrompt = `You are an elite editorial writer and SEO expert. Humanise and elevate the following article draft. Rules:
1. Preserve ALL factual information, structure, headings, and HTML tags.
2. Make the prose natural, direct, and authoritative — NOT robotic or generic.
3. Add answer-first structuring: the first paragraph after each H2 must state the answer clearly.
4. Do NOT truncate. Return the FULL revised HTML article.
5. Return ONLY the revised HTML. No markdown, no code block.

DRAFT ARTICLE:
${draftHtml.slice(0, 30000)}`;
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: rewriteModel,
            messages: [
              { role: 'system', content: 'You are an elite editorial writer specializing in SEO content that ranks and gets cited by AI systems.' },
              { role: 'user', content: rewritePrompt },
            ],
            temperature: 0.3,
            max_tokens: 8000,
          }),
        });
        if (!openaiRes.ok) {
          const errBody = await openaiRes.text();
          throw new Error(`OpenAI API error ${openaiRes.status}: ${errBody.slice(0, 200)}`);
        }
        const openaiData = await openaiRes.json();
        const revisedHtml = openaiData.choices?.[0]?.message?.content?.trim();
        const tokensIn = openaiData.usage?.prompt_tokens || 0;
        const tokensOut = openaiData.usage?.completion_tokens || 0;
        const costUsd = (tokensIn * 0.000002) + (tokensOut * 0.000008);
        if (revisedHtml && revisedHtml.length > 500) {
          articleData!.html_article = revisedHtml;
          articleData!.rewrite_premium_applied = true;
          articleData!.rewrite_model_used = rewriteModel;
        }
        totalApiCalls++;
        totalCostUsd += costUsd;
        await supabase.from('generation_steps').update({
          status: 'completed',
          output: { model: rewriteModel, provider: 'openai', tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: costUsd, rewrite_applied: true },
          latency_ms: Date.now() - rwStart,
          completed_at: new Date().toISOString(),
          model_used: rewriteModel, provider: 'openai', cost_usd: costUsd, tokens_in: tokensIn, tokens_out: tokensOut,
        }).eq('id', rwStepId);
        console.log(`[V2] ✅ REWRITE_PREMIUM ${Date.now() - rwStart}ms | model=${rewriteModel}`);
      } catch (rwErr) {
        const errMsg = rwErr instanceof Error ? rwErr.message : 'REWRITE_PREMIUM failed';
        console.warn(`[V2] ⚠️ REWRITE_PREMIUM failed (non-fatal): ${errMsg}`);
        await supabase.from('generation_steps').update({
          status: 'failed',
          output: { error: errMsg, fallback: 'gemini_draft_kept', rewrite_applied: false },
          latency_ms: Date.now() - rwStart,
          completed_at: new Date().toISOString(),
          model_used: rewriteModel, provider: 'openai', error_message: errMsg,
        }).eq('id', rwStepId);
      }
      await updatePublicStatus(supabase, jobId, 'REWRITE_PREMIUM', true, lockId);
      await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
    } else {
      console.log(`[V2] ⏭️ REWRITE_PREMIUM skipped (mode=${generationMode})`);
    }

    // ============================================================
    // STEP: SCHEMA_GEN (non-fatal — prepend JSON-LD to html_article)
    // ============================================================
    console.log(`[V2] Step: SCHEMA_GEN`);
    await updatePublicStatus(supabase, jobId, 'SCHEMA_GEN', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SCHEMA_GEN' }).eq('id', jobId);

    const schemaStepId = await createStepOrFail(supabase, jobId, 'SCHEMA_GEN', {
      content_type: jobInput.content_type,
      has_faq: Array.isArray(articleData!.faq) && (articleData!.faq as unknown[]).length > 0,
    });
    const schemaStart = Date.now();
    try {
      // Fetch blog metadata for schema (name, url, business_name)
      const { data: blogMeta } = await supabase
        .from('blogs')
        .select('name, url, city, business_name')
        .eq('id', (jobInput.blog_id as string))
        .maybeSingle();

      const isoDate = (articleData!._iso_date as string) || new Date().toISOString().split('T')[0];
      // Build a temporary slug preview (SAVE_ARTICLE will generate the real one)
      const rawTitle = (articleData!.title as string) || (jobInput.keyword as string) || '';
      const tempSlug = rawTitle.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 70);

      const schemaScriptTag = executeSchemaGen({
        title: rawTitle,
        meta_description: (articleData!.meta_description as string) || '',
        html_article: (articleData!.html_article as string) || '',
        faq: (articleData!.faq as Array<{ question: string; answer: string }>) || [],
        keyword: (jobInput.keyword as string) || '',
        city: (jobInput.city as string) || blogMeta?.city || '',
        niche: (jobInput.niche as string) || '',
        language: (jobInput.language as string) || 'pt-BR',
        content_type: (jobInput.content_type as string) || '',
        blog_name: blogMeta?.name || 'OmniSeen',
        blog_url: blogMeta?.url || '',
        business_name: (jobInput.business_name as string) || blogMeta?.business_name || '',
        slug: tempSlug,
        iso_date: isoDate,
      });

      if (schemaScriptTag) {
        // Prepend JSON-LD to html_article
        articleData!.html_article = schemaScriptTag + (articleData!.html_article as string);
        articleData!.schema_json = schemaScriptTag;
        console.log(`[V2] ✅ SCHEMA_GEN generated | city=${jobInput.city} | content_type=${jobInput.content_type}`);
      } else {
        console.warn('[V2] ⚠️ SCHEMA_GEN returned null (non-fatal)');
      }

      await supabase.from('generation_steps').update({
        status: 'completed',
        output: { schema_generated: !!schemaScriptTag, content_type: jobInput.content_type },
        latency_ms: Date.now() - schemaStart,
        completed_at: new Date().toISOString(),
        model_used: 'programmatic', provider: 'programmatic',
      }).eq('id', schemaStepId);
    } catch (schemaErr) {
      // SCHEMA_GEN is non-fatal — pipeline continues regardless
      const errMsg = schemaErr instanceof Error ? schemaErr.message : 'SCHEMA_GEN failed';
      console.warn(`[V2] ⚠️ SCHEMA_GEN failed (non-fatal): ${errMsg}`);
      await supabase.from('generation_steps').update({
        status: 'failed',
        output: { error: errMsg, schema_generated: false },
        latency_ms: Date.now() - schemaStart,
        completed_at: new Date().toISOString(),
        error_message: errMsg,
      }).eq('id', schemaStepId);
    }
    await updatePublicStatus(supabase, jobId, 'SCHEMA_GEN', true, lockId);

    // ============================================================
    // STEP 6: SAVE_ARTICLE
    // ============================================================
    console.log(`[V2] Step 6/8: SAVE_ARTICLE`);

    await updatePublicStatus(supabase, jobId, 'SAVE_ARTICLE', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SAVE_ARTICLE' }).eq('id', jobId);
    const saveStepId = await createStepOrFail(supabase, jobId, 'SAVE_ARTICLE', { title: articleData!.title });
    const saveStart = Date.now();
    const saveOutput = await executeSaveArticle(jobId, articleData!, jobInput, supabase, totalApiCalls, totalCostUsd, jobType);
    const saveLatency = Date.now() - saveStart;
    await supabase.from('generation_steps').update({
      status: 'completed', output: saveOutput, latency_ms: saveLatency,
      completed_at: new Date().toISOString(), model_used: 'programmatic', provider: 'programmatic',
    }).eq('id', saveStepId);
    await updatePublicStatus(supabase, jobId, 'SAVE_ARTICLE', true, lockId);
    console.log(`[V2] ✅ SAVE_ARTICLE ${saveLatency}ms | article_id=${saveOutput.article_id}`);

    // STEP: IMAGE_GEN
    console.log(`[V2] Step: IMAGE_GEN`);
    await updatePublicStatus(supabase, jobId, 'IMAGE_GEN', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'IMAGE_GEN' }).eq('id', jobId);
    try {
      const imgStepId = await createStepOrFail(supabase, jobId, 'IMAGE_GEN', { article_id: saveOutput.article_id });
      await supabase.from('articles').update({ images_pending: true, images_total: 1 + (outline?.h2?.length || 0), images_completed: 0 }).eq('id', saveOutput.article_id);
      const imgResult = await withTimeout(
        executeImageGenGeminiNanoBanana(saveOutput.article_id as string, articleData!, outline, jobInput, supabase),
        90_000, 'IMAGE_GEN'
      );
      await supabase.from('articles').update({ images_pending: false }).eq('id', saveOutput.article_id);
      await supabase.from('generation_steps').update({
        status: 'completed', output: imgResult, completed_at: new Date().toISOString(),
        model_used: GEMINI_IMAGE_MODEL, provider: 'gemini',
      }).eq('id', imgStepId);
      console.log(`[V2] ✅ IMAGE_GEN hero=${imgResult.heroUrl ? 'yes' : 'no'}, sections=${imgResult.sectionCount || 0}`);
    } catch (imgErr) {
      const imgErrMsg = imgErr instanceof Error ? imgErr.message : 'Image gen failed';
      console.warn(`[V2] ⚠️ IMAGE_GEN failed (non-fatal): ${imgErrMsg}`);
      await supabase.from('articles').update({ images_pending: false }).eq('id', saveOutput.article_id);
    }
    await updatePublicStatus(supabase, jobId, 'IMAGE_GEN', true, lockId);

    // STEP: INTERNAL_LINK_ENGINE
    console.log(`[V2] Step: INTERNAL_LINK_ENGINE`);
    await updatePublicStatus(supabase, jobId, 'INTERNAL_LINK_ENGINE', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'INTERNAL_LINK_ENGINE' }).eq('id', jobId);
    try {
      const linkOutput = await executeInternalLinkEngine(
        saveOutput.article_id as string | null,
        (jobInput.blog_id as string) || '',
        (jobInput.keyword as string) || '',
        (articleData!.title as string) || '',
        supabase
      );
      console.log(`[V2] ✅ INTERNAL_LINK_ENGINE inserted=${linkOutput.inserted ?? 0}`);
    } catch (_) { /* non-fatal */ }
    await updatePublicStatus(supabase, jobId, 'INTERNAL_LINK_ENGINE', true, lockId);

    // STEP: SEO_SCORE
    console.log(`[V2] Step: SEO_SCORE`);
    await updatePublicStatus(supabase, jobId, 'SEO_SCORE', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SEO_SCORE' }).eq('id', jobId);
    let seoStepId: string | null = null;
    try {
      seoStepId = await createStepOrFail(supabase, jobId, 'SEO_SCORE', { article_id: saveOutput.article_id });
      const seoOutput = await executeSeoScoreStep(
        saveOutput.article_id as string | null,
        (articleData!.title as string) || '',
        (articleData!.html_article as string) || '',
        (jobInput.keyword as string) || '',
        (jobInput.blog_id as string) || '',
        supabaseUrl,
        serviceKey
      );
      await supabase.from('generation_steps').update({
        status: 'completed', output: seoOutput, completed_at: new Date().toISOString(),
        model_used: 'calculate-content-score', provider: 'programmatic',
      }).eq('id', seoStepId);
      console.log(`[V2] ✅ SEO_SCORE ${seoOutput.skipped ? '(skipped)' : '(done)'}`);
    } catch (seoErr) {
      const seoErrMsg = seoErr instanceof Error ? seoErr.message : 'SEO score failed';
      console.warn(`[V2] ⚠️ SEO_SCORE failed (non-fatal): ${seoErrMsg}`);
      if (seoStepId) {
        await supabase.from('generation_steps').update({
          status: 'failed', error_message: seoErrMsg, completed_at: new Date().toISOString(),
        }).eq('id', seoStepId);
      }
    }
    await updatePublicStatus(supabase, jobId, 'SEO_SCORE', true, lockId);

    // STEP: QUALITY_GATE
    let seoScoreData: Record<string, unknown> = {};
    try {
      const scoreResp = await fetch(`${supabaseUrl}/functions/v1/calculate-content-score`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: saveOutput.article_id,
          title: articleData!.title,
          content: (articleData!.html_article as string)?.slice(0, 100_000),
          keyword: jobInput.keyword,
          blogId: jobInput.blog_id,
          saveScore: false,
        }),
      });
      if (scoreResp.ok) seoScoreData = await scoreResp.json();
    } catch (_) { /* use empty */ }
    console.log(`[V2] Step: QUALITY_GATE`);
    await updatePublicStatus(supabase, jobId, 'QUALITY_GATE', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'QUALITY_GATE' }).eq('id', jobId);
    const qgStepId = await createStepOrFail(supabase, jobId, 'QUALITY_GATE', { article_id: saveOutput.article_id });
    const qgOutput = await executeQualityGate(
      saveOutput.article_id as string | null,
      (jobInput.blog_id as string) || '',
      articleData!,
      entityCoverage.coverageScore,
      seoScoreData,
      jobType,
      supabase
    );
    await supabase.from('generation_steps').update({
      status: 'completed', output: qgOutput, completed_at: new Date().toISOString(),
      model_used: 'programmatic', provider: 'quality_gate',
    }).eq('id', qgStepId);
    await updatePublicStatus(supabase, jobId, 'QUALITY_GATE', true, lockId);
    console.log(`[V2] ✅ QUALITY_GATE passed=${qgOutput.passed} ai_score=${(qgOutput.ai_detection as any)?.score} ${!qgOutput.passed ? `reasons=${(qgOutput.reasons as string[])?.join('; ')}` : ''}`);

    // ============================================================
    // STEP: GEO_SCORE (programmatic — sem custo de IA)
    // ============================================================
    try {
      const geoScore = calculateGeoScore({
        title: (articleData!.title as string) || '',
        htmlContent: (articleData!.html_article as string) || '',
        city: (jobInput.city as string) || '',
        faqCount: Array.isArray(articleData!.faq) ? (articleData!.faq as unknown[]).length : 0,
        entities: (entities as { topics?: string[]; terms?: string[] }) || {},
      });
      await supabase.from('articles').update({
        geo_score: geoScore.score,
        geo_score_label: geoScore.label,
        geo_score_breakdown: geoScore.breakdown,
        geo_score_passed: geoScore.passed,
        geo_score_calculated_at: new Date().toISOString(),
      }).eq('id', saveOutput.article_id);
      console.log(`[V2] ✅ GEO_SCORE ${geoScore.score}/100 (${geoScore.label}) city_in_title=${geoScore.breakdown.city_in_title} faq=${geoScore.breakdown.faq_present} citations=${geoScore.breakdown.citation_blocks} entities=${geoScore.breakdown.entity_density} words=${geoScore.breakdown.word_count_ok}`);
    } catch (geoErr) {
      console.warn(`[V2] ⚠️ GEO_SCORE failed (non-fatal):`, geoErr instanceof Error ? geoErr.message : geoErr);
    }
    try {
      console.log(`[V2] Disparando evaluate-geo-readiness asincronamente...`);
      fetch(`${supabaseUrl}/functions/v1/evaluate-geo-readiness`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: saveOutput.article_id })
      }).catch(err => console.error(`[V2] ⚠️ Falha ao agendar GEO Readiness:`, err));
    } catch (_) { /* ignore synchronous errors scheduling the fetch */ }

    // ============================================================
    // COMPLETED
    const { data: updatedJob } = await supabase
      .from('generation_jobs')
      .select('article_id, output')
      .eq('id', jobId)
      .single();

    const jobOutput = updatedJob?.output as Record<string, unknown> | null;
    const hasFallbackHtml = jobOutput?.fallback_html || jobOutput?.insert_failed;

    if (!updatedJob?.article_id && !hasFallbackHtml) {
      throw new Error('Pipeline completed but no article was saved.');
    }

    await supabase.from('generation_jobs').update({
      status: 'completed', current_step: null,
      cost_usd: totalCostUsd, total_api_calls: totalApiCalls,
      completed_at: new Date().toISOString(), locked_at: null, locked_by: null,
      public_stage: 'FINALIZING', public_progress: 100,
      public_message: 'Artigo pronto!', public_updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    const duration = Date.now() - jobStart;
    console.log(`[ORCHESTRATOR:V2:COMPLETE] job_id=${jobId} article_id=${updatedJob?.article_id} api_calls=${totalApiCalls} duration=${duration}ms cost=$${totalCostUsd.toFixed(6)}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown orchestration error';
    console.error(`[ORCHESTRATOR:V2] ❌ Job ${jobId} FAILED:`, errorMsg);
    await supabase.from('generation_jobs').update({
      status: 'failed', error_message: errorMsg,
      cost_usd: totalCostUsd, total_api_calls: totalApiCalls,
      completed_at: new Date().toISOString(), locked_at: null, locked_by: null,
      public_stage: 'FINALIZING', public_progress: 0,
      public_message: 'Ocorreu um problema. Tente novamente.',
      public_updated_at: new Date().toISOString(),
    }).eq('id', jobId);
    console.log(`[ORCHESTRATOR:V2:FAILED] job_id=${jobId} error=${errorMsg} duration=${Date.now() - jobStart}ms`);
  } finally {
    heartbeatRunning = false;
    clearInterval(heartbeatInterval);
    try {
      await supabase.from('generation_jobs')
        .update({ locked_by: null, locked_at: null })
        .eq('id', jobId).eq('locked_by', lockId);
    } catch (_) { /* ignore */ }
    console.log(`[ENGINE:V2] FINALIZER: job_id=${jobId} lock_released`);
  }

 } catch (fatalErr) {
    console.error('[ORCHESTRATOR_FATAL:V2]', jobId, fatalErr);
    try {
      await supabase.from('generation_jobs').update({
        status: 'failed',
        error_message: 'ENGINE_FATAL_CRASH',
        public_message: 'Falha interna ao iniciar o gerador.',
        locked_by: null, locked_at: null,
        completed_at: new Date().toISOString(),
        public_updated_at: new Date().toISOString(),
      }).eq('id', jobId);
    } catch (_) { /* ignore */ }
    throw fatalErr;
  }
}

// ============================================================
// HTTP Handler
// ============================================================

serve(async (req) => {
  const cors = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: any = createClient(supabaseUrl, serviceKey);

  try {
    const { job_id } = await req.json();
    console.log('[ORCHESTRATOR_HANDLER_ENTRY:V2]', job_id);
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: existingJob } = await supabase
      .from('generation_jobs')
      .select('status')
      .eq('id', job_id)
      .single();

    if (existingJob && ['running', 'completed', 'failed'].includes(existingJob.status)) {
      console.log(`[ORCHESTRATOR:V2:SKIP] job=${job_id} already ${existingJob.status}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: `Job already ${existingJob.status}` }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    await orchestrate(job_id, supabase, supabaseUrl, serviceKey);
    return new Response(JSON.stringify({ success: true, job_id }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[ORCHESTRATOR:V2] Fatal:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
