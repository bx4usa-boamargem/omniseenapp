import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { QUALITY_GATE, getMinWordCount } from "../_shared/superPageEngine.ts";
import { corsHeadersForRequest } from "../_shared/httpCors.ts";
import { validateGenerationJobInput } from "../_shared/pipelineInputValidation.ts";
import { generateText, generateImage } from '../_shared/omniseen-ai.ts';


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
    // Allow ±20% tolerance so model has room, but stays close to target
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
  'SERP_GAP_ANALYSIS':    { stage: 'ANALYZING_MARKET', progress: 14, message: 'Detectando lacunas semânticas...' },
  'OUTLINE_GEN':          { stage: 'ANALYZING_MARKET', progress: 20, message: 'Criando estrutura...' },
  'AUTO_SECTION_EXPANSION': { stage: 'ANALYZING_MARKET', progress: 26, message: 'Expandindo seções...' },
  'ENTITY_EXTRACTION':    { stage: 'WRITING_CONTENT',  progress: 32, message: 'Extraindo entidades...' },
  'ENTITY_COVERAGE':      { stage: 'WRITING_CONTENT',  progress: 38, message: 'Distribuindo entidades...' },
  'CONTENT_GEN':          { stage: 'WRITING_CONTENT',  progress: 55, message: 'Criando conteúdo...' },
  'SAVE_ARTICLE':         { stage: 'FINALIZING',      progress: 72, message: 'Salvando artigo...' },
  'IMAGE_GEN':            { stage: 'FINALIZING',      progress: 82, message: 'Gerando imagens (hero + seções)...' },
  'INTERNAL_LINK_ENGINE': { stage: 'FINALIZING',      progress: 88, message: 'Gerando links internos...' },
  'SEO_SCORE':            { stage: 'FINALIZING',      progress: 93, message: 'Calculando score SEO...' },
  'QUALITY_GATE':         { stage: 'FINALIZING',      progress: 98, message: 'Verificando qualidade...' },
};

const PIPELINE_STEPS = [
  'INPUT_VALIDATION',
  'SERP_ANALYSIS',
  'SERP_GAP_ANALYSIS',
  'OUTLINE_GEN',
  'AUTO_SECTION_EXPANSION',
  'ENTITY_EXTRACTION',
  'ENTITY_COVERAGE',
  'CONTENT_GEN',
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

  // Use target_words to calibrate outline size
  const wordRange = resolveWordRange(jobInput, jobType);
  const targetWords = jobInput.target_words ? Number(jobInput.target_words) : null;

  let wordHint: string;
  if (jobType === 'super_page') {
    wordHint = 'Support 3000-6000 words: 6-10 H2 sections, 2-4 H3 per H2.';
  } else if (targetWords && targetWords <= 1600) {
    wordHint = `Support ~${targetWords} words: 3-4 H2 sections, 1-2 H3 per H2. Keep sections focused and concise.`;
  } else if (targetWords && targetWords <= 2200) {
    wordHint = `Support ~${targetWords} words: 4-5 H2 sections, 2 H3 per H2.`;
  } else {
    wordHint = `Support ~${targetWords || 2500} words: 5-6 H2 sections, 2-3 H3 per H2.`;
  }

  const typeHint = contentTypeOutlineHint[cType] || contentTypeOutlineHint.como_fazer;
  wordHint += `\nStructure hint based on Content Type (${cType}): ${typeHint}`;

  const prompt = `You are an SEO content architect. Create a strict outline for a blog article.

Keyword: ${keyword}
City/region: ${city || 'Brazil'}
Niche: ${niche}
Language: ${language}
Content type: ${jobType}
Target word count: ${wordRange} words

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
  // Check if HTML already has proper headings
  const hasH1 = /<h1[\s>]/i.test(html);
  const hasH2 = /<h2[\s>]/i.test(html);

  if (hasH1 && hasH2) {
    // Already structured, just ensure <style> exists
    if (!html.includes('<style>')) {
      html = '<style>h1{font-size:2em;margin-bottom:0.5em;font-weight:700}h2{font-size:1.5em;margin-top:1.5em;margin-bottom:0.5em;font-weight:600}h3{font-size:1.2em;margin-top:1em;margin-bottom:0.4em;font-weight:600}p{line-height:1.8;margin-bottom:1em}</style>' + html;
    }
    return html;
  }

  console.warn('[enforceHeadingStructure] HTML missing proper headings, attempting fix...');

  let fixed = html;

  // Convert <p><strong>Title Text</strong></p> patterns to headings
  // Match outline H2 titles in bold paragraphs
  for (const section of outline.h2) {
    const escapedTitle = section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match bold-only paragraphs that contain the section title
    const boldPattern = new RegExp(
      `<p[^>]*>\\s*<(?:strong|b)>\\s*${escapedTitle}\\s*</(?:strong|b)>\\s*</p>`,
      'gi'
    );
    fixed = fixed.replace(boldPattern, `<h2>${section.title}</h2>`);

    // Also try without <p> wrapping
    const loosePattern = new RegExp(
      `<(?:strong|b)>\\s*${escapedTitle}\\s*</(?:strong|b)>`,
      'gi'
    );
    // Only replace if not already inside an h2/h3
    fixed = fixed.replace(loosePattern, (match) => {
      // Check if already inside a heading
      const idx = fixed.indexOf(match);
      const before = fixed.substring(Math.max(0, idx - 10), idx);
      if (/<h[1-6][^>]*>$/i.test(before)) return match;
      return `<h2>${section.title}</h2>`;
    });

    // Convert H3s
    for (const h3Title of section.h3) {
      const escapedH3 = h3Title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const h3Pattern = new RegExp(
        `<p[^>]*>\\s*<(?:strong|b)>\\s*${escapedH3}\\s*</(?:strong|b)>\\s*</p>`,
        'gi'
      );
      fixed = fixed.replace(h3Pattern, `<h3>${h3Title}</h3>`);
    }
  }

  // If still no H1, inject one from the outline
  if (!/<h1[\s>]/i.test(fixed)) {
    fixed = `<h1>${outline.h1}</h1>\n` + fixed;
  }

  // Ensure <style> tag
  if (!fixed.includes('<style>')) {
    fixed = '<style>h1{font-size:2em;margin-bottom:0.5em;font-weight:700}h2{font-size:1.5em;margin-top:1.5em;margin-bottom:0.5em;font-weight:600}h3{font-size:1.2em;margin-top:1em;margin-bottom:0.4em;font-weight:600}p{line-height:1.8;margin-bottom:1em}</style>' + fixed;
  }

  const newH2Count = (fixed.match(/<h2[\s>]/gi) || []).length;
  console.log(`[enforceHeadingStructure] Fixed: hasH1=${/<h1[\s>]/i.test(fixed)}, h2Count=${newH2Count}`);

  return fixed;
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

  // *** FIX: use target_words from job input, not hardcoded range ***
  const wordRange = resolveWordRange(jobInput, jobType);
  const targetWords = jobInput.target_words ? Number(jobInput.target_words) : null;

  console.log(`[CONTENT_GEN] wordRange=${wordRange} target_words=${targetWords} job_type=${jobType}`);

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
- serp_summary: ${serpSummary || 'No competitive data'}

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
    { role: 'system', content: `You are an elite premium SEO content writer for ${niche} in ${language}. You produce articles with EXACTLY ${wordRange} words. CRITICAL: Do NOT exceed the upper word limit. You MUST return valid JSON with html_article containing proper semantic HTML: <h1> for title, <h2> for sections, <h3> for subsections, <p> for paragraphs, <ul>/<ol> for lists. Every paragraph must be short (2-5 lines). NEVER write headings as plain text. Return ONLY valid JSON. No markdown, no code blocks.` },
    { role: 'user', content: prompt },
  ], { useGrounding });

  if (!aiResult.success) throw new Error(`CONTENT_GEN_FAILED: ${aiResult.error}`);
  const parsed = parseAIJson(aiResult.content, 'CONTENT_GEN');
  if (!parsed.title) throw new Error('CONTENT_GEN: missing title');
  if (!parsed.html_article) throw new Error('CONTENT_GEN: missing html_article');

  // Post-process: enforce heading structure if AI returned plain text headings
  parsed.html_article = enforceHeadingStructure(parsed.html_article as string, outline);

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

  // Validate HTML
  if (!htmlArticle || htmlArticle.length < 200) {
    throw new Error('SAVE_ARTICLE: HTML content too short');
  }

  // Generate unique slug (with timestamp suffix to avoid duplicates)
  const baseSlug = title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 70);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  // Generate excerpt
  const excerpt = metaDescription || title;

  // Calculate word count and target
  const textContent = htmlArticle.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 200);
  const wordCountTarget = jobInput.target_words ? Number(jobInput.target_words) : (contentType === 'super_page' ? 4500 : 2250);

  // Fetch CTA config from blog
  const { data: blogData } = await supabase
    .from('blogs')
    .select('cta_type, cta_url, cta_text, header_cta_text, header_cta_url, city')
    .eq('id', blogId)
    .single();

  // Build CTA: prioritize job input, fallback to blog config
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

  // Inject CTA into HTML
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

  // 3x retry insert
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

  // Update generation_jobs with article_id
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
  const usedImageUrls = new Set<string>(); // Dedup: track all generated URLs
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
        usedImageUrls.add(heroUrl); // Track hero URL to prevent reuse
      }
    }
    if (!heroUrl) {
      heroUrl = `https://picsum.photos/seed/${slug}-hero/1024/576`;
      heroAlt = `${keyword} — imagem ilustrativa`;
      usedImageUrls.add(heroUrl);
    }
    await supabase.from("articles").update({ featured_image_url: heroUrl, featured_image_alt: heroAlt }).eq("id", articleId);

    const html = (articleData.html_article as string) || "";
    const sectionCount = (html.match(/<h2[^>]*>/gi) || []).length;
    const articleWordCount = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    // Limit images based on word count. 
    // Small articles (<1200) get max 3 images, larger articles get max 6 images.
    const maxTotalImages = articleWordCount >= 1200 ? 6 : 3;
    const maxSectionImages = Math.min(sectionCount, Math.max(0, maxTotalImages - 1));
    for (let i = 0; i < maxSectionImages; i++) {
      const sectionTitle = outline.h2[i]?.title || `Section ${i + 1}`;
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
          const fname = `${articleId}-section-${i + 1}-${Date.now()}.${fmt}`;
          await supabase.storage.from("article-images").upload(fname, bin, { contentType: `image/${fmt}`, upsert: true });
          const { data: pub } = supabase.storage.from("article-images").getPublicUrl(fname);
          url = pub.publicUrl;
        } else continue;
      } else url = `https://picsum.photos/seed/${slug}-sec-${i}/800/450`;
      // Skip if this URL is already used (dedup)
      if (usedImageUrls.has(url)) continue;
      usedImageUrls.add(url);
      contentImages.push({ context: sectionTitle, url, alt: sectionTitle, after_section: i + 1 });
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
// STEP: INTERNAL_LINK_ENGINE (cluster links between articles/super pages)
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
    const words = (keyword + " " + title).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
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
// STEP: QUALITY_GATE (block publish if thresholds not met)
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
  const entityOk = entityCoverageScore >= QUALITY_GATE.ENTITY_COVERAGE_MIN;
  const wordOk = wordCount >= minWords;
  const faqOk = faqCount >= QUALITY_GATE.FAQ_MIN_ITEMS;
  const scoreOk = contentScore >= QUALITY_GATE.SEMANTIC_SCORE_MIN;
  const aiOk = aiScan.passed;

  const passed = entityOk && wordOk && faqOk && scoreOk && aiOk;
  const reasons: string[] = [];
  if (!entityOk) reasons.push(`entity_coverage ${entityCoverageScore} < ${QUALITY_GATE.ENTITY_COVERAGE_MIN}`);
  if (!wordOk) reasons.push(`word_count ${wordCount} < ${minWords}`);
  if (!faqOk) reasons.push(`faq_items ${faqCount} < ${QUALITY_GATE.FAQ_MIN_ITEMS}`);
  if (!scoreOk) reasons.push(`semantic_score ${contentScore} < ${QUALITY_GATE.SEMANTIC_SCORE_MIN}`);
  if (!aiOk) reasons.push(`ai_voice_detected score=${aiScan.score} flags=[${aiScan.flags.slice(0, 3).join(',')}]`);

  const qualityGateStatus = passed ? "approved" : "blocked";
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
  });

  return { passed, entityOk, wordOk, faqOk, scoreOk, aiOk, reasons, quality_gate_status: qualityGateStatus, aiDetection: aiScan };
}

// ============================================================
// ORCHESTRATOR CORE (TRUE SUPER PAGE ENGINE)
// ============================================================

async function orchestrate(jobId: string, supabase: any, supabaseUrl: string, serviceKey: string): Promise<void> {
 try { // TOP-LEVEL SAFETY NET
  const jobStart = Date.now();

  const { data: job, error: jobError } = await supabase.from('generation_jobs').select('*').eq('id', jobId).single();
  if (jobError || !job) { console.error(`[ORCHESTRATOR] Job ${jobId} not found:`, jobError); return; }
  if (['completed', 'failed', 'cancelled'].includes(job.status)) { console.log(`[ORCHESTRATOR] Job ${jobId} already ${job.status}.`); return; }

  const jobType = ((job.job_type ?? job.input?.job_type) || 'article') as 'article' | 'super_page';

  // Signal boot
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

  console.log(`[ORCHESTRATOR:V2] job_id=${jobId} input=${JSON.stringify({ keyword: jobInput.keyword, city: jobInput.city, niche: jobInput.niche, job_type: jobType, target_words: jobInput.target_words })}`);
  console.log(`[ORCHESTRATOR:V2] Modes: gen=${generationMode}, res=${researchMode}, rew=${rewriteModel}, grd=${useGrounding}`);

  // Lock
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

  // Heartbeat
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
    // ============================================================
    // STEP 1: INPUT_VALIDATION (programmatic)
    // ============================================================
    console.log(`[V2] Step 1/8: INPUT_VALIDATION`);
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

    // ============================================================
    // STEP 2: SERP_ANALYSIS
    // ============================================================
    console.log(`[V2] Step 2/8: SERP_ANALYSIS`);
    await updatePublicStatus(supabase, jobId, 'SERP_ANALYSIS', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SERP_ANALYSIS' }).eq('id', jobId);

    let serpStepId: string | null = null;
    let serpSummaryText = '';
    const serpStart = Date.now();
    try {
      serpStepId = await createStepOrFail(supabase, jobId, 'SERP_ANALYSIS', { keyword: jobInput.keyword, city: jobInput.city });
      const serpResult = await withTimeout(
        executeSerpSummary(jobInput, supabaseUrl, serviceKey, useGrounding),
        30_000, 'SERP_ANALYSIS'
      );
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
      console.warn(`[V2] ⚠️ SERP_ANALYSIS failed (non-fatal): ${errMsg}`);
      if (serpStepId) {
        await supabase.from('generation_steps').update({
          status: 'completed', output: { serp_summary: '', error: errMsg }, latency_ms: Date.now() - serpStart,
          completed_at: new Date().toISOString(), model_used: 'fallback', provider: 'fallback', error_message: errMsg,
        }).eq('id', serpStepId);
      }
    }
    await updatePublicStatus(supabase, jobId, 'SERP_ANALYSIS', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);

    // ============================================================
    // STEP: SERP_GAP_ANALYSIS
    // ============================================================
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
        status: 'completed', output: gapResult.output, completed_at: new Date().toISOString(), model_used: gapResult.aiResult.model, provider: gapResult.aiResult.provider, cost_usd: gapResult.aiResult.costUsd,
      }).eq('id', gapStepId);
    } catch (_) { /* non-fatal */ }
    await updatePublicStatus(supabase, jobId, 'SERP_GAP_ANALYSIS', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);

    // ============================================================
    // STEP: OUTLINE_GEN (mandatory)
    // ============================================================
    console.log(`[V2] Step: OUTLINE_GEN`);
    await updatePublicStatus(supabase, jobId, 'OUTLINE_GEN', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'OUTLINE_GEN' }).eq('id', jobId);

    const outlineStepId = await createStepOrFail(supabase, jobId, 'OUTLINE_GEN', { keyword: jobInput.keyword });
    const outlineStart = Date.now();
    const outlineResult = await withTimeout(
      executeOutlineGen(jobInput, serpSummaryText, supabaseUrl, serviceKey, useGrounding),
      45_000, 'OUTLINE_GEN'
    );
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

    // ============================================================
    // STEP: AUTO_SECTION_EXPANSION
    // ============================================================
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
        status: 'completed', output: { outline: expandedOutline }, completed_at: new Date().toISOString(), model_used: expResult.aiResult.model || 'none', provider: expResult.aiResult.provider || 'none',
      }).eq('id', expStepId);
    } catch (_) { /* non-fatal, use original outline */ }
    await updatePublicStatus(supabase, jobId, 'AUTO_SECTION_EXPANSION', true, lockId);
    outline = expandedOutline;

    // ============================================================
    // STEP: ENTITY_EXTRACTION
    // ============================================================
    console.log(`[V2] Step: ENTITY_EXTRACTION`);
    await updatePublicStatus(supabase, jobId, 'ENTITY_EXTRACTION', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'ENTITY_EXTRACTION' }).eq('id', jobId);

    const entityStepId = await createStepOrFail(supabase, jobId, 'ENTITY_EXTRACTION', { keyword: jobInput.keyword });
    const entityStart = Date.now();
    const entityResult = await withTimeout(
      executeEntityExtraction(jobInput, serpSummaryText, outline, supabaseUrl, serviceKey),
      30_000, 'ENTITY_EXTRACTION'
    );
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

    // ============================================================
    // STEP: ENTITY_COVERAGE (distribute entities, score)
    // ============================================================
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

    // ============================================================
    // STEP: CONTENT_GEN (outline-driven + entity coverage)
    // ============================================================
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

    // ============================================================
    // STEP: REWRITE_PREMIUM (only in premium mode — GPT-4.1)
    // Runs BEFORE SAVE_ARTICLE so the final saved content is the
    // humanised, quality-reviewed version.
    // ============================================================
    if (generationMode === 'premium') {
      console.log(`[V2] Step: REWRITE_PREMIUM | mode=${generationMode} | model=${rewriteModel} | provider=openai`);
      await updatePublicStatus(supabase, jobId, 'REWRITE_PREMIUM', false, lockId);
      await supabase.from('generation_jobs').update({ current_step: 'REWRITE_PREMIUM' }).eq('id', jobId);

      const rwStepId = await createStepOrFail(supabase, jobId, 'REWRITE_PREMIUM', {
        keyword: jobInput.keyword, model: rewriteModel, provider: 'openai',
      });
      const rwStart = Date.now();

      try {
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

        const draftHtml = (articleData!.html_article as string) || (articleData!.content as string) || '';
        const rewritePrompt = `You are an elite editorial writer and SEO expert. Your task is to humanise and elevate the following article draft. Rules:
1. Preserve ALL factual information, structure, headings, and HTML tags.
2. Make the prose natural, direct, and authoritative — NOT robotic or generic.
3. Add answer-first structuring: the first paragraph after each H2 must state the answer clearly.
4. Ensure named entities, local context, and brand references are used precisely.
5. Do NOT truncate. Return the FULL revised HTML article.
6. Return ONLY the revised HTML. No markdown, no code block.

DRAFT ARTICLE:
${draftHtml.slice(0, 30000)}`;

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
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
        const costUsd = (tokensIn * 0.000002) + (tokensOut * 0.000008); // GPT-4.1 pricing estimate

        if (revisedHtml && revisedHtml.length > 500) {
          // Patch articleData with the premium-rewritten HTML
          articleData!.html_article = revisedHtml;
          articleData!.rewrite_premium_applied = true;
          articleData!.rewrite_model_used = rewriteModel;
        }

        totalApiCalls++;
        totalCostUsd += costUsd;

        await supabase.from('generation_steps').update({
          status: 'completed',
          output: {
            model: rewriteModel, provider: 'openai',
            tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: costUsd,
            rewrite_applied: true,
          },
          latency_ms: Date.now() - rwStart,
          completed_at: new Date().toISOString(),
          model_used: rewriteModel, provider: 'openai',
          cost_usd: costUsd, tokens_in: tokensIn, tokens_out: tokensOut,
        }).eq('id', rwStepId);

        console.log(`[V2] ✅ REWRITE_PREMIUM ${Date.now() - rwStart}ms | model=${rewriteModel} | tokens_in=${tokensIn} tokens_out=${tokensOut} | cost=$${costUsd.toFixed(4)}`);

      } catch (rwErr) {
        // Fallback: keep original Gemini draft, log the error, continue
        const errMsg = rwErr instanceof Error ? rwErr.message : 'REWRITE_PREMIUM failed';
        console.warn(`[V2] ⚠️ REWRITE_PREMIUM failed (non-fatal, keeping Gemini draft): ${errMsg}`);
        await supabase.from('generation_steps').update({
          status: 'failed',
          output: { error: errMsg, fallback: 'gemini_draft_kept', rewrite_applied: false },
          latency_ms: Date.now() - rwStart,
          completed_at: new Date().toISOString(),
          model_used: rewriteModel, provider: 'openai',
          error_message: errMsg,
        }).eq('id', rwStepId);
      }

      await updatePublicStatus(supabase, jobId, 'REWRITE_PREMIUM', true, lockId);
      await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);

    } else {
      // Explicit skip log for economic mode — visible in Supabase logs
      console.log(`[V2] ⏭️ REWRITE_PREMIUM skipped (mode=${generationMode}) — economic path uses Gemini draft directly`);
    }

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

    // ============================================================
    // STEP: IMAGE_GEN (ASYNC — fire-and-forget to avoid timeout)
    // ============================================================
    console.log(`[V2] Step: IMAGE_GEN`);
    await updatePublicStatus(supabase, jobId, 'IMAGE_GEN', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'IMAGE_GEN' }).eq('id', jobId);
    try {
      const imgStepId = await createStepOrFail(supabase, jobId, 'IMAGE_GEN', { article_id: saveOutput.article_id });

      // Mark article as images_pending so the UI knows to poll
      await supabase.from('articles').update({ images_pending: true, images_total: 1 + (outline?.h2?.length || 0), images_completed: 0 }).eq('id', saveOutput.article_id);

      // Run image generation inline (wait for it) to ensure images are ready before completing
      console.log(`[V2] IMAGE_GEN starting inline for article ${saveOutput.article_id}...`);
      const imgResult = await withTimeout(
        executeImageGenGeminiNanoBanana(
          saveOutput.article_id as string,
          articleData!,
          outline,
          jobInput,
          supabase
        ),
        90_000,
        'IMAGE_GEN'
      );

      // Mark images done
      await supabase.from('articles').update({ images_pending: false }).eq('id', saveOutput.article_id);

      await supabase.from('articles').update({ images_pending: false }).eq('id', saveOutput.article_id);

      await supabase.from('generation_steps').update({
        status: 'completed', output: imgResult, completed_at: new Date().toISOString(),
        model_used: GEMINI_IMAGE_MODEL, provider: 'gemini',
      }).eq('id', imgStepId);

      console.log(`[V2] ✅ IMAGE_GEN completed: hero=${imgResult.heroUrl ? 'yes' : 'no'}, sections=${imgResult.sectionCount || 0}`);
    } catch (imgErr) {
      const imgErrMsg = imgErr instanceof Error ? imgErr.message : 'Image gen failed';
      console.warn(`[V2] ⚠️ IMAGE_GEN failed (non-fatal): ${imgErrMsg}`);
      // Ensure images_pending is cleared even on failure
      await supabase.from('articles').update({ images_pending: false }).eq('id', saveOutput.article_id);
    }
    await updatePublicStatus(supabase, jobId, 'IMAGE_GEN', true, lockId);

    // ============================================================
    // STEP: INTERNAL_LINK_ENGINE
    // ============================================================
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

    // ============================================================
    // STEP: SEO_SCORE (non-fatal)
    // ============================================================
    console.log(`[V2] Step: SEO_SCORE`);
    await updatePublicStatus(supabase, jobId, 'SEO_SCORE', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SEO_SCORE' }).eq('id', jobId);
    let seoStepId: string | null = null;
    try {
      seoStepId = await createStepOrFail(supabase, jobId, 'SEO_SCORE', { article_id: saveOutput.article_id });
      const htmlForScore = (articleData!.html_article as string) || '';
      const seoOutput = await executeSeoScoreStep(
        saveOutput.article_id as string | null,
        (articleData!.title as string) || '',
        htmlForScore,
        (jobInput.keyword as string) || '',
        (jobInput.blog_id as string) || '',
        supabaseUrl,
        serviceKey
      );
      await supabase.from('generation_steps').update({
        status: 'completed', output: seoOutput, completed_at: new Date().toISOString(), model_used: 'calculate-content-score', provider: 'programmatic',
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

    // ============================================================
    // STEP: QUALITY_GATE (block publish if thresholds not met)
    // ============================================================
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
      status: 'completed', output: qgOutput, completed_at: new Date().toISOString(), model_used: 'programmatic', provider: 'quality_gate',
    }).eq('id', qgStepId);
    await updatePublicStatus(supabase, jobId, 'QUALITY_GATE', true, lockId);
    console.log(`[V2] ✅ QUALITY_GATE passed=${qgOutput.passed} ${!qgOutput.passed ? `reasons=${(qgOutput.reasons as string[])?.join('; ')}` : ''}`);

    // ============================================================
    // COMPLETED
    // ============================================================
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

    console.log(`[ORCHESTRATOR:V2:FAILED] job_id=${jobId} error=${errorMsg} api_calls=${totalApiCalls} duration=${Date.now() - jobStart}ms`);
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

    // Idempotency guard
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
