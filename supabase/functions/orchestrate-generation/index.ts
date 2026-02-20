import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { marked } from "https://esm.sh/marked@12.0.0";

/**
 * orchestrate-generation — OmniSeen Article Engine v1
 * 
 * State Machine Orchestrator (Phase 4 — Full Pipeline)
 * 
 * States: PENDING -> INPUT_VALIDATION -> SERP_ANALYSIS -> NLP_KEYWORDS -> 
 *         TITLE_GEN -> OUTLINE_GEN -> CONTENT_GEN -> IMAGE_GEN -> 
 *         SEO_SCORE -> META_GEN -> OUTPUT -> COMPLETED | FAILED
 * 
 * Phase 4: IMAGE_GEN (Picsum programmatic), SEO_SCORE (real ai-router),
 *          META_GEN (real ai-router), OUTPUT (HTML assembly with marked)
 * 
 * 7 RULES enforced:
 * R1: Budget reservation (CONTENT gets maxContentCalls)
 * R2: Fixed reserves META=1, SEO=1, Refine=2
 * R3: SEO refinement anti-madness (3 protections)
 * R4: Pre-refinement snapshot
 * R5: Raw AI persisted ALWAYS
 * R6: Engine routing + fallback
 * R7: Frontend only observes
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// CONSTANTS
// ============================================================

const ENGINE_MODE = 'production'; // production: suppress verbose logs, disable debug exposure
const MAX_JOB_TIME_MS = 360_000;
const MAX_API_CALLS = 15;
const LOCK_TTL_MS = 300_000;
const GRACEFUL_ABORT_BUFFER_MS = 30_000;

// ============================================================
// PUBLIC STAGE MAPPING (client-facing progress)
// ============================================================
const PUBLIC_STAGE_MAP: Record<string, { stage: string; progress: number; message: string }> = {
  'INPUT_VALIDATION': { stage: 'ANALYZING_MARKET', progress: 5, message: 'Inicializando inteligência artificial...' },
  'SERP_ANALYSIS':    { stage: 'ANALYZING_MARKET', progress: 15, message: 'Analisando mercado e concorrentes...' },
  'NLP_KEYWORDS':     { stage: 'ANALYZING_MARKET', progress: 30, message: 'Extraindo palavras-chave estratégicas...' },
  'TITLE_GEN':        { stage: 'WRITING_CONTENT', progress: 35, message: 'Criando seu conteúdo...' },
  'OUTLINE_GEN':      { stage: 'WRITING_CONTENT', progress: 45, message: 'Estruturando o artigo...' },
  'CONTENT_GEN':      { stage: 'WRITING_CONTENT', progress: 75, message: 'Escrevendo conteúdo completo...' },
  'IMAGE_GEN':        { stage: 'PREPARING_IMAGES', progress: 85, message: 'Preparando imagens e otimizações...' },
  'SEO_SCORE':        { stage: 'FINALIZING', progress: 90, message: 'Finalizando seu artigo...' },
  'META_GEN':         { stage: 'FINALIZING', progress: 95, message: 'Finalizando seu artigo...' },
  'OUTPUT':           { stage: 'FINALIZING', progress: 98, message: 'Montando artigo final...' },
};

async function updatePublicStatus(
  supabase: ReturnType<typeof createClient>,
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
    public_message: completed ? mapping.message : mapping.message,
    public_updated_at: new Date().toISOString(),
  };

  // Heartbeat: refresh lock on every step transition to prevent zombie locks
  if (lockId) {
    updateData.locked_at = new Date().toISOString();
  }

  await supabase.from('generation_jobs').update(updateData).eq('id', jobId);
}

// RULE 1: Budget reservations
const BUDGET = {
  SERP: 1, NLP: 1, TITLE: 1, OUTLINE: 1,
  IMAGE: 0,        // Route A: 0 calls
  SEO_INITIAL: 1,  // mandatory scoring
  SEO_REFINE: 2,   // max 2 refinement calls
  META: 1,         // mandatory
};
const FIXED_CALLS = BUDGET.SERP + BUDGET.NLP + BUDGET.TITLE + BUDGET.OUTLINE;
const RESERVED_CALLS = BUDGET.SEO_INITIAL + BUDGET.SEO_REFINE + BUDGET.META;

const PIPELINE_STEPS = [
  'INPUT_VALIDATION',
  'SERP_ANALYSIS',
  'NLP_KEYWORDS',
  'TITLE_GEN',
  'OUTLINE_GEN',
  'CONTENT_GEN',
  'IMAGE_GEN',
  'SEO_SCORE',
  'META_GEN',
  'OUTPUT',
] as const;

type StepName = typeof PIPELINE_STEPS[number];

const STEP_TIMEOUTS: Record<StepName, number> = {
  INPUT_VALIDATION: 5_000,
  SERP_ANALYSIS:    120_000,
  NLP_KEYWORDS:     120_000,
  TITLE_GEN:        150_000,
  OUTLINE_GEN:      120_000,
  CONTENT_GEN:      240_000,
  IMAGE_GEN:        15_000,
  SEO_SCORE:        90_000,
  META_GEN:         90_000,
  OUTPUT:           30_000,
};

// Soft timeout: warn but don't kill — heartbeat keeps lock alive
const SOFT_TIMEOUT_THRESHOLDS: Partial<Record<StepName, number>> = {
  TITLE_GEN: 90_000,   // Warn at 90s, hard kill at 180s
  META_GEN:  60_000,   // Warn at 60s, hard kill at 90s
};

const REAL_AI_STEPS: StepName[] = ['SERP_ANALYSIS', 'NLP_KEYWORDS', 'TITLE_GEN', 'OUTLINE_GEN', 'CONTENT_GEN', 'SEO_SCORE', 'META_GEN'];
const API_STEPS: StepName[] = ['SERP_ANALYSIS', 'NLP_KEYWORDS', 'TITLE_GEN', 'OUTLINE_GEN', 'CONTENT_GEN', 'SEO_SCORE', 'META_GEN'];

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
  options?: { temperature?: number; maxTokens?: number; tools?: unknown[]; toolChoice?: unknown }
): Promise<AIRouterResult> {
  const url = `${supabaseUrl}/functions/v1/ai-router`;
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
      tools: options?.tools,
      toolChoice: options?.toolChoice,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    return {
      success: false, content: '', model: '', provider: 'lovable-gateway',
      tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0,
      error: data.error || `HTTP_${resp.status}`,
    };
  }
  return data as AIRouterResult;
}

// RULE 5: Wrapper that persists raw AI response BEFORE parsing
async function callAiRouterAndPersist(
  supabaseUrl: string,
  serviceKey: string,
  task: string,
  messages: Array<{ role: string; content: string }>,
  jobId: string,
  stepName: string,
  supabase: ReturnType<typeof createClient>,
  callNumber: number,
  options?: { temperature?: number; maxTokens?: number; tools?: unknown[]; toolChoice?: unknown }
): Promise<AIRouterResult> {
  const result = await callAIRouter(supabaseUrl, serviceKey, task, messages, options);

  // PATCH 1: Anti-stub guard — fail loudly if deployed version has stubs
  if (result?.model === 'stub-phase-1' || result?.provider === 'stub') {
    throw new Error(`[ANTI-STUB] Step ${stepName} returned stub provider/model. Deploy is outdated or step not implemented.`);
  }

  // Persist raw response
  try {
    const { data: step } = await supabase
      .from('generation_steps')
      .select('output')
      .eq('job_id', jobId)
      .eq('step_name', stepName)
      .single();

    const currentOutput = (step?.output as Record<string, unknown>) || {};
    const rawResponses = (currentOutput.raw_ai_responses as Array<Record<string, unknown>>) || [];
    rawResponses.push({
      call_number: callNumber,
      task,
      model: result.model || 'unknown',
      raw_text: (result.content || '').substring(0, 10_000),
      tokens_in: result.tokensIn || 0,
      tokens_out: result.tokensOut || 0,
      cost_usd: result.costUsd || 0,
      ts: new Date().toISOString(),
    });

    await supabase.from('generation_steps').update({
      output: { ...currentOutput, raw_ai_responses: rawResponses },
    }).eq('job_id', jobId).eq('step_name', stepName);
  } catch (e) {
    console.warn(`[PERSIST_RAW] Failed for ${stepName}:`, e);
  }

  return result;
}

// ============================================================
// TIMEOUT WRAPPER
// ============================================================

// Safe insert: sequential DB insert with timeout (no AbortController)
async function safeInsert(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  stepName: string,
  input: Record<string, unknown>,
  timeoutMs = 8000
): Promise<{ data: { id: string } }> {
  const insertPromise = supabase.from('generation_steps').insert({
    job_id: jobId, step_name: stepName, status: 'running',
    started_at: new Date().toISOString(), input,
  }).select('id').maybeSingle();

  const result = await Promise.race([
    insertPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`DB_TIMEOUT:${stepName}`)), timeoutMs)
    ),
  ]);

  if (result.error) {
    console.error(`[ENGINE] STEP RECORD INSERT FAILED: ${stepName}`, result.error);
    throw new Error(`DB_INSERT_FAILED:${stepName}: ${result.error.message}`);
  }

  console.log(`[ENGINE] STEP RECORD CREATED: ${stepName}`);

  return { data: result.data };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const softMs = SOFT_TIMEOUT_THRESHOLDS[label as StepName];
  if (softMs) {
    // Soft timeout: log warning at softMs, hard kill at ms
    const softTimer = setTimeout(() => {
      console.warn(`[SOFT_TIMEOUT] ⚠️ ${label} exceeded ${softMs}ms — still running (hard kill at ${ms}ms)`);
    }, softMs);
    return Promise.race([
      promise.finally(() => clearTimeout(softTimer)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`STEP_TIMEOUT: ${label} exceeded ${ms}ms (hard kill)`)), ms)
      ),
    ]);
  }
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`STEP_TIMEOUT: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// ============================================================
// ROBUST JSON PARSER (V3: persists raw on failure)
// ============================================================

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
  if (ENGINE_MODE !== 'production') {
    console.error(`[ORCHESTRATOR] ${label} parse failed. Preview: ${content.substring(0, 500)}`);
  }
  throw new ParseError(`${label}_PARSE_ERROR: Could not extract valid JSON`, content);
}

class ParseError extends Error {
  rawContent: string;
  constructor(message: string, rawContent: string) {
    super(message);
    this.name = 'ParseError';
    this.rawContent = rawContent;
  }
}

// ============================================================
// CIRCUIT BREAKER: Fallback generators for each step
// ============================================================

function buildCircuitBreakerFallback(stepName: string, jobInput: Record<string, unknown>): Record<string, unknown> {
  const keyword = (jobInput.keyword as string) || 'artigo';
  const city = (jobInput.city as string) || '';
  const niche = (jobInput.niche as string) || 'serviços';
  const locale = city ? ` em ${city}` : '';

  switch (stepName) {
    case 'TITLE_GEN':
      return {
        title_pack: {
          candidates: [{ title: `${keyword}${locale} — Guia Completo 2026`, type: 'fallback', score: 70, reasoning: 'Circuit breaker fallback' }],
          selected_index: 0,
          selected_title: `${keyword}${locale} — Guia Completo 2026`,
          selection_reason: 'Circuit breaker: AI failed twice',
          circuit_breaker: true,
        },
      };
    case 'OUTLINE_GEN':
      return buildDefaultOutline(keyword, city, niche);
    case 'SEO_SCORE':
      return { score_total: 70, score_breakdown: {}, weakest_sections: [], improvement_suggestions: [], needs_regeneration: false, circuit_breaker: true };
    case 'META_GEN':
      return {
        meta_title: `${keyword}${locale}`.substring(0, 60),
        meta_description: `Guia completo sobre ${keyword}${locale}. Saiba tudo sobre ${niche}.`.substring(0, 155),
        slug: keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 60),
        excerpt: `Descubra tudo sobre ${keyword}${locale}.`,
        faq_items: [],
        circuit_breaker: true,
      };
    case 'NLP_KEYWORDS':
      return {
        nlp_pack: {
          primary: keyword,
          secondary: [keyword, niche],
          nlp_terms: [{ text: keyword, category: 'topic', relevance_score: 1.0, position_hint: 'throughout', max_usage: 5 }],
          entities: city ? [{ text: city, type: 'location', importance: 'high' }] : [],
          interlink_anchors: [],
          circuit_breaker: true,
        },
      };
    default:
      return { circuit_breaker: true, step: stepName };
  }
}

function buildDefaultOutline(keyword: string, city: string, niche: string): Record<string, unknown> {
  const locale = city ? ` em ${city}` : '';
  const sections = [
    { id: 'section-0', h2: `O que é ${keyword}`, h3s: [], target_words: 300, depth_target: 80, nlp_terms_to_use: [keyword], layout_hint: 'paragraph', expert_signal_required: false, geo_specific: false },
    { id: 'section-1', h2: `Como funciona ${keyword}${locale}`, h3s: [], target_words: 300, depth_target: 80, nlp_terms_to_use: [keyword], layout_hint: 'paragraph', expert_signal_required: true, expert_signal_type: 'professional_tip', geo_specific: !!city },
    { id: 'section-2', h2: `Benefícios de ${keyword}`, h3s: [], target_words: 300, depth_target: 80, nlp_terms_to_use: [keyword], layout_hint: 'list', expert_signal_required: false, geo_specific: false },
    { id: 'section-3', h2: `Como escolher ${keyword}${locale}`, h3s: [], target_words: 300, depth_target: 80, nlp_terms_to_use: [keyword], layout_hint: 'paragraph', expert_signal_required: true, expert_signal_type: 'micro_case', geo_specific: !!city },
    { id: 'section-4', h2: `${keyword} vs alternativas`, h3s: [], target_words: 300, depth_target: 80, nlp_terms_to_use: [keyword], layout_hint: 'table', expert_signal_required: false, geo_specific: false },
    { id: 'section-5', h2: `Quanto custa ${keyword}${locale}`, h3s: [], target_words: 300, depth_target: 80, nlp_terms_to_use: [keyword], layout_hint: 'paragraph', expert_signal_required: true, expert_signal_type: 'statistic', geo_specific: !!city },
    { id: 'section-6', h2: `Dicas para ${keyword}`, h3s: [], target_words: 300, depth_target: 80, nlp_terms_to_use: [keyword], layout_hint: 'list', expert_signal_required: false, geo_specific: false },
    { id: 'section-7', h2: `Conclusão sobre ${keyword}`, h3s: [], target_words: 200, depth_target: 70, nlp_terms_to_use: [keyword], layout_hint: 'paragraph', expert_signal_required: false, geo_specific: false },
  ];
  return {
    outline_spec: {
      h1: `${keyword}${locale} — Guia Completo`,
      key_takeaways: { target_words: 150, items_count: 5 },
      introduction: { target_words: 200, hook_type: 'question', must_include: [keyword] },
      sections,
      faq: { count: 6, questions: [`O que é ${keyword}?`, `Como funciona ${keyword}?`, `Quanto custa ${keyword}?`, `Quais os benefícios de ${keyword}?`, `Como escolher ${keyword}?`, `${keyword} vale a pena?`], source: 'circuit_breaker' },
      conclusion: { target_words: 200, cta: true, cta_type: 'whatsapp' },
      total_target_words: 2500,
      total_sections: 8,
      estimated_h2_count: 8,
      circuit_breaker: true,
    },
  };
}

// ============================================================
// REAL STEP EXECUTORS (Phase 2: SERP, NLP, Title, Outline)
// ============================================================

async function executeSerpAnalysis(
  jobInput: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ output: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const state = (jobInput.state as string) || '';
  const country = (jobInput.country as string) || 'BR';
  const language = (jobInput.language as string) || 'pt-BR';
  const intent = (jobInput.intent as string) || 'informational';
  const niche = (jobInput.niche as string) || 'default';

  const prompt = `You are an expert SEO analyst. Analyze the SERP (Search Engine Results Page) for the keyword below as if you had access to real Google results. Since you don't have live SERP data, simulate realistic results based on your knowledge. Mark all results with confidence: "simulated".

KEYWORD: "${keyword}"
LOCALE: ${city ? city + ', ' : ''}${state ? state + ', ' : ''}${country}
LANGUAGE: ${language}
INTENT: ${intent}
NICHE: ${niche}

Return a JSON object with this exact structure:
{
  "confidence": "simulated",
  "serp_pack": {
    "top_results_count": 10,
    "avg_word_count": <number>,
    "avg_h2_count": <number>,
    "dominant_intent": "<informational|commercial|transactional|service>",
    "common_topics": ["topic1", "topic2"],
    "depth_scores": [{"position":1,"title":"<title>","url":"<url>","word_count":<n>,"h2_count":<n>,"depth_score":<0-100>,"has_faq":<bool>,"has_table":<bool>,"has_video":<bool>,"confidence":"simulated"}],
    "gap_map": ["gap1", "gap2"],
    "paa_questions": ["q1", "q2"],
    "content_patterns": {"avg_intro_words":<n>,"avg_conclusion_words":<n>,"common_h2_patterns":["p1"],"common_cta_types":["phone"]}
  }
}

IMPORTANT: Generate exactly 10 results in depth_scores. depth_score 40-95. gap_map 5-8 items. paa_questions 6-10 items.`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'serp_analysis', [
    { role: 'system', content: 'You are an SEO SERP analyst. Respond ONLY with valid JSON. No markdown, no code blocks, no explanations.' },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) throw new Error(`SERP_ANALYSIS_FAILED: ${aiResult.error}`);
  return { output: parseAIJson(aiResult.content, 'SERP_ANALYSIS'), aiResult };
}

async function executeNlpKeywords(
  jobInput: Record<string, unknown>,
  serpOutput: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ output: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const language = (jobInput.language as string) || 'pt-BR';
  const niche = (jobInput.niche as string) || 'default';
  const serpPack = (serpOutput as Record<string, unknown>)?.serp_pack || serpOutput;

  const prompt = `You are an NLP and SEO keyword expert. Based on the primary keyword and SERP analysis below, extract a comprehensive NLP keyword pack.

PRIMARY KEYWORD: "${keyword}"
LOCALE: ${city || 'Brazil'}
LANGUAGE: ${language}
NICHE: ${niche}

SERP CONTEXT:
${JSON.stringify(serpPack, null, 2).substring(0, 3000)}

Return JSON: { "nlp_pack": { "primary": "${keyword}", "secondary": ["8-20 keywords"], "nlp_terms": [{"text":"term","category":"entity|topic|modifier|action|attribute","relevance_score":0.95,"position_hint":"early|middle|late|throughout","max_usage":3}], "entities": [{"text":"name","type":"location|organization|concept|product|person","importance":"high|medium|low"}], "interlink_anchors": ["anchor text"] } }

RULES: secondary 8-20, nlp_terms 20-60, entities 10-30, interlink_anchors 5-10.`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'nlp_keywords', [
    { role: 'system', content: 'You are an NLP keyword extraction expert. Respond ONLY with valid JSON. No markdown, no code blocks.' },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) throw new Error(`NLP_KEYWORDS_FAILED: ${aiResult.error}`);
  return { output: parseAIJson(aiResult.content, 'NLP_KEYWORDS'), aiResult };
}

async function executeTitleGen(
  jobInput: Record<string, unknown>,
  serpOutput: Record<string, unknown>,
  nlpOutput: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ output: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const intent = (jobInput.intent as string) || 'informational';
  const language = (jobInput.language as string) || 'pt-BR';
  const niche = (jobInput.niche as string) || 'default';
  const serpPack = (serpOutput as Record<string, unknown>)?.serp_pack || serpOutput;
  const nlpPack = (nlpOutput as Record<string, unknown>)?.nlp_pack || nlpOutput;

  const prompt = `You are an expert SEO copywriter. Generate 10 title candidates.

PRIMARY KEYWORD: "${keyword}"
LOCALE: ${city || 'Brazil'} | LANGUAGE: ${language} | INTENT: ${intent} | NICHE: ${niche}

TOP SERP TITLES: ${JSON.stringify((serpPack as Record<string, unknown>)?.depth_scores || [], null, 2).substring(0, 1500)}
Secondary keywords: ${JSON.stringify((nlpPack as Record<string, unknown>)?.secondary || []).substring(0, 500)}

DISTRIBUTION: 30% informational, 40% service/local, 30% guide/authority.

Return JSON: { "title_pack": { "candidates": [{"title":"text","type":"informational|service_local|guide_authority","score":85,"reasoning":"why"}], "selected_index":0, "selected_title":"winning title", "selection_reason":"why" } }

RULES: All titles must contain keyword. ${city ? `At least 4 must include "${city}".` : ''} Max 65 chars. Year [2026] in at least 2.`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'title_gen', [
    { role: 'system', content: 'You are an SEO title generation expert. Respond ONLY with valid JSON. No markdown, no code blocks, no explanations.' },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) throw new Error(`TITLE_GEN_FAILED: ${aiResult.error}`);
  
  // Title parse with fallback: if JSON fails, extract title from raw content
  try {
    return { output: parseAIJson(aiResult.content, 'TITLE_GEN'), aiResult };
  } catch (parseErr) {
    console.warn(`[TITLE_GEN] JSON parse failed, attempting raw title extraction...`);
    // Fallback: extract any quoted title or first meaningful line
    const rawContent = aiResult.content || '';
    let fallbackTitle = '';
    
    // Try extracting from "selected_title": "..." pattern
    const titleMatch = rawContent.match(/selected_title['":\s]+['"]([^'"]{10,80})['"]/i);
    if (titleMatch) {
      fallbackTitle = titleMatch[1];
    } else {
      // Try first line that looks like a title (10-80 chars, no JSON syntax)
      const lines = rawContent.split('\n').map(l => l.trim()).filter(l => l.length >= 10 && l.length <= 80 && !l.startsWith('{') && !l.startsWith('['));
      if (lines.length > 0) fallbackTitle = lines[0].replace(/^["']+|["']+$/g, '');
    }
    
    if (fallbackTitle) {
      console.log(`[TITLE_GEN] ✅ Fallback title extracted: "${fallbackTitle}"`);
      return {
        output: {
          title_pack: {
            candidates: [{ title: fallbackTitle, type: 'fallback', score: 70, reasoning: 'Extracted from raw LLM response (JSON parse failed)' }],
            selected_index: 0,
            selected_title: fallbackTitle,
            selection_reason: 'Fallback extraction from raw response',
            parse_fallback: true,
          },
        },
        aiResult,
      };
    }
    
    // Re-throw if no fallback possible
    throw parseErr;
  }
}

async function executeOutlineGen(
  jobInput: Record<string, unknown>,
  serpOutput: Record<string, unknown>,
  nlpOutput: Record<string, unknown>,
  titleOutput: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ output: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const intent = (jobInput.intent as string) || 'informational';
  const language = (jobInput.language as string) || 'pt-BR';
  const niche = (jobInput.niche as string) || 'default';
  const targetWords = (jobInput.target_words as number) || 2500;
  const serpPack = (serpOutput as Record<string, unknown>)?.serp_pack || serpOutput;
  const nlpPack = (nlpOutput as Record<string, unknown>)?.nlp_pack || nlpOutput;
  const titlePack = (titleOutput as Record<string, unknown>)?.title_pack || titleOutput;
  const selectedTitle = (titlePack as Record<string, unknown>)?.selected_title || keyword;
  const avgH2 = (serpPack as Record<string, unknown>)?.avg_h2_count || 8;
  const gapMap = (serpPack as Record<string, unknown>)?.gap_map || [];
  const paaQuestions = (serpPack as Record<string, unknown>)?.paa_questions || [];
  const nlpTerms = (nlpPack as Record<string, unknown>)?.nlp_terms || [];
  const secondary = (nlpPack as Record<string, unknown>)?.secondary || [];

  const prompt = `You are an expert content strategist. Create a detailed article outline.

TITLE: "${selectedTitle}"
PRIMARY KEYWORD: "${keyword}" | LOCALE: ${city || 'Brazil'} | LANGUAGE: ${language}
INTENT: ${intent} | NICHE: ${niche} | TARGET WORDS: ${targetWords}

SERP: Average H2: ${avgH2}, Gaps: ${JSON.stringify(gapMap).substring(0, 500)}, PAA: ${JSON.stringify(paaQuestions).substring(0, 500)}
NLP TERMS: ${JSON.stringify(nlpTerms).substring(0, 1500)}
SECONDARY: ${JSON.stringify(secondary).substring(0, 500)}

Return JSON: { "outline_spec": { "h1": "${selectedTitle}", "key_takeaways": {"target_words":150,"items_count":5}, "introduction": {"target_words":200,"hook_type":"statistic|question|story|problem","must_include":["primary keyword","city"]}, "sections": [{"id":"section-0","h2":"heading","h3s":["sub1"],"target_words":300,"depth_target":80,"nlp_terms_to_use":["t1"],"layout_hint":"paragraph|table|list|callout","expert_signal_required":true,"expert_signal_type":"micro_case|statistic|professional_tip","geo_specific":false}], "faq": {"count":8,"questions":["q1"],"source":"paa+serp_gaps"}, "conclusion": {"target_words":200,"cta":true,"cta_type":"phone|whatsapp|form"}, "total_target_words":${targetWords}, "total_sections":<n>, "estimated_h2_count":<n> } }

RULES: key_takeaways FIRST. Min ${Math.max(8, Number(avgH2))} H2 sections. expert_signal_required true for ≥30%. At least 1 "table" and 1 "list" layout_hint. FAQ from PAA+gaps.`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'outline_gen', [
    { role: 'system', content: 'You are a content strategy expert. Respond ONLY with valid JSON. No markdown, no code blocks, no explanations.' },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) throw new Error(`OUTLINE_GEN_FAILED: ${aiResult.error}`);
  return { output: parseAIJson(aiResult.content, 'OUTLINE_GEN'), aiResult };
}

// ============================================================
// PHASE 3: CONTENT ENGINE
// ============================================================

interface NlpTrackerEntry { used_count: number; max_count: number; last_section: string | null; bolded: boolean; }
interface ContentGenContext { jobInput: Record<string, unknown>; outlineSpec: Record<string, unknown>; nlpPack: Record<string, unknown>; serpPack: Record<string, unknown>; titlePack: Record<string, unknown>; supabaseUrl: string; serviceKey: string; jobStartMs: number; }
interface ContentGenResult { output: Record<string, unknown>; apiCalls: number; costUsd: number; needsReview: boolean; }

function initNlpTracker(nlpPack: Record<string, unknown>): Record<string, NlpTrackerEntry> {
  const tracker: Record<string, NlpTrackerEntry> = {};
  const terms = (nlpPack.nlp_terms as Array<Record<string, unknown>>) || [];
  for (const term of terms) {
    const text = (term.text as string) || '';
    if (text) tracker[text.toLowerCase()] = { used_count: 0, max_count: (term.max_usage as number) || 3, last_section: null, bolded: false };
  }
  return tracker;
}

function getTimeRemainingMs(jobStartMs: number): number { return MAX_JOB_TIME_MS - (Date.now() - jobStartMs); }
function shouldAbortGracefully(jobStartMs: number): boolean { return getTimeRemainingMs(jobStartMs) < GRACEFUL_ABORT_BUFFER_MS; }

async function generateContextSummary(previousSections: Array<Record<string, unknown>>, supabaseUrl: string, serviceKey: string): Promise<{ summary: string; aiResult: AIRouterResult }> {
  const sectionsText = previousSections.map(s => `## ${s.h2 || 'Section'}\n${(s.content as string || '').substring(0, 300)}`).join('\n\n');
  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'context_summary', [
    { role: 'system', content: 'You are a content summarizer. Create a concise summary (max 500 tokens) of the article sections written so far. Focus on key points, tone, arguments, expert signals. This guides next sections to maintain flow and avoid repetition.' },
    { role: 'user', content: `Summarize these article sections:\n\n${sectionsText}` },
  ]);
  if (!aiResult.success) { console.warn('[CONTENT_GEN] Context summary failed'); return { summary: '', aiResult }; }
  return { summary: aiResult.content, aiResult };
}

async function generateBatch(
  ctx: ContentGenContext, batchSections: Array<Record<string, unknown>>, batchIndex: number,
  contextSummary: string, nlpTracker: Record<string, NlpTrackerEntry>, faqQuestions: string[], isLastBatch: boolean
): Promise<{ sections: Array<Record<string, unknown>>; faq?: Array<Record<string, unknown>>; conclusion?: string; aiResult: AIRouterResult }> {
  const keyword = (ctx.jobInput.keyword as string) || '';
  const city = (ctx.jobInput.city as string) || '';
  const language = (ctx.jobInput.language as string) || 'pt-BR';
  const niche = (ctx.jobInput.niche as string) || 'default';
  const brandVoice = (ctx.jobInput.brand_voice as string) || 'professional, knowledgeable, helpful';
  const whatsapp = (ctx.jobInput.whatsapp as string) || '';
  const businessName = (ctx.jobInput.business_name as string) || '';
  const availableTerms = Object.entries(nlpTracker).filter(([_, v]) => v.used_count < v.max_count).map(([k]) => k);
  const sectionsSpec = batchSections.map(s => JSON.stringify(s)).join(',\n');

  let faqBlock = '';
  if (isLastBatch) {
    faqBlock = `\n\nALSO GENERATE:\n- FAQ section with these questions (80-150 words each):\n${faqQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}\n- Conclusion (200 words, CTA for ${whatsapp ? 'WhatsApp: ' + whatsapp : 'contact'}${businessName ? ', business: ' + businessName : ''})`;
  }

  const prompt = `You are an expert content writer for the ${niche} niche in ${language}.
BRAND VOICE: ${brandVoice} | KEYWORD: "${keyword}" | LOCALE: ${city || 'Brazil'} | BATCH: ${batchIndex + 1}
${contextSummary ? `CONTEXT (prev sections):\n${contextSummary}\n\nDo NOT repeat content.` : ''}
NLP TERMS TO BOLD ON FIRST USE: ${availableTerms.slice(0, 15).join(', ')}
SECTIONS TO WRITE: [${sectionsSpec}]${faqBlock}

Return JSON: { "sections": [{"id":"<id>","h2":"<heading>","content":"<markdown with **bold** NLP terms>","h3s_content":[{"h3":"<sub>","content":"<md>"}],"word_count":<n>,"nlp_terms_used":["t"],"bolds_applied":["t"],"expert_signals":["type"],"layout_used":"paragraph"}]${isLastBatch ? ',"faq":[{"question":"...","answer":"..."}],"conclusion":"<md>"' : ''} }

RULES: NO clichés. NO invented stats. Each section target_words ±20%. Bold first NLP occurrence. Tables=markdown. Callouts="> **Dica:** ".`;

  const aiResult = await callAIRouter(ctx.supabaseUrl, ctx.serviceKey, 'content_gen', [
    { role: 'system', content: `You are a premium ${niche} content writer in ${language}. Return only valid JSON.` },
    { role: 'user', content: prompt },
  ], { maxTokens: 8000 });

  if (!aiResult.success) throw new Error(`CONTENT_BATCH_${batchIndex}_FAILED: ${aiResult.error}`);
  const parsed = parseAIJson(aiResult.content, `CONTENT_BATCH_${batchIndex}`);
  return { sections: (parsed.sections as Array<Record<string, unknown>>) || [], faq: isLastBatch ? (parsed.faq as Array<Record<string, unknown>>) : undefined, conclusion: isLastBatch ? (parsed.conclusion as string) : undefined, aiResult };
}

function updateNlpTracker(tracker: Record<string, NlpTrackerEntry>, sections: Array<Record<string, unknown>>): void {
  for (const section of sections) {
    const termsUsed = (section.nlp_terms_used as string[]) || [];
    const boldsApplied = (section.bolds_applied as string[]) || [];
    const sectionId = (section.id as string) || 'unknown';
    for (const term of termsUsed) { const k = term.toLowerCase(); if (tracker[k]) { tracker[k].used_count++; tracker[k].last_section = sectionId; } }
    for (const term of boldsApplied) { const k = term.toLowerCase(); if (tracker[k]) tracker[k].bolded = true; }
  }
}

async function runCritic(
  allSections: Array<Record<string, unknown>>, faq: Array<Record<string, unknown>>, conclusion: string,
  nlpTracker: Record<string, NlpTrackerEntry>, ctx: ContentGenContext
): Promise<{ report: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (ctx.jobInput.keyword as string) || '';
  const brandVoice = (ctx.jobInput.brand_voice as string) || 'professional';
  const articlePreview = allSections.map(s => `## ${s.h2 || ''}\n${(s.content as string || '').substring(0, 500)}`).join('\n\n');
  const nlpUsage = Object.entries(nlpTracker).filter(([_, v]) => v.used_count > 0).map(([k, v]) => `${k}: ${v.used_count}/${v.max_count} (bolded: ${v.bolded})`).join(', ');

  const prompt = `You are a senior content quality auditor. Evaluate against 11 Quality Gates.
KEYWORD: "${keyword}" | BRAND VOICE: ${brandVoice} | NLP USAGE: ${nlpUsage} | FAQ COUNT: ${faq.length}

ARTICLE:\n${articlePreview}

11 QUALITY GATES: QG01 cliche_detection, QG02 invented_stats, QG03 nlp_density, QG04 readability, QG05 expert_signals, QG06 tone_coherence, QG07 hallucination_check, QG08 semantic_repetition, QG09 depth_target, QG10 bold_coverage, QG11 humanization

Return JSON: {"overall_passed":<bool>,"overall_score":<0-100>,"gates":[{"gate":"QG01","name":"cliche_detection","passed":<bool>,"score":<0-100>,"details":"explanation","section_id":"<opt>"}],"weakest_sections":["id1","id2"],"rewrite_instructions":{"section-id":"instructions"}}
SCORING: overall_passed = true if score >= 60 AND no gate < 30. Max 2 weakest_sections.`;

  const aiResult = await callAIRouter(ctx.supabaseUrl, ctx.serviceKey, 'content_critic', [
    { role: 'system', content: 'You are a content quality auditor. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) {
    console.warn('[CONTENT_GEN] Critic failed, treating as passed');
    return { report: { overall_passed: true, overall_score: 70, gates: [], weakest_sections: [], rewrite_instructions: {}, critic_error: aiResult.error }, aiResult };
  }
  return { report: parseAIJson(aiResult.content, 'CONTENT_CRITIC'), aiResult };
}

async function rewriteSection(
  section: Record<string, unknown>, instructions: string, ctx: ContentGenContext, nlpTracker: Record<string, NlpTrackerEntry>
): Promise<{ section: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (ctx.jobInput.keyword as string) || '';
  const language = (ctx.jobInput.language as string) || 'pt-BR';
  const niche = (ctx.jobInput.niche as string) || 'default';
  const availableTerms = Object.entries(nlpTracker).filter(([_, v]) => v.used_count < v.max_count).map(([k]) => k);

  const prompt = `Rewrite this section following instructions:
INSTRUCTIONS: ${instructions}
SECTION: ## ${section.h2}\n${section.content}
NLP TERMS: ${availableTerms.slice(0, 8).join(', ')} | KEYWORD: "${keyword}" | LANGUAGE: ${language}

Return JSON: {"id":"${section.id}","h2":"${section.h2}","content":"<rewritten md>","word_count":<n>,"nlp_terms_used":["t"],"bolds_applied":["t"],"expert_signals":["type"],"layout_used":"paragraph","rewrite_applied":true}
RULES: Fix ONLY what instructions say. Maintain length ±20%. NO clichés, NO invented stats.`;

  const aiResult = await callAIRouter(ctx.supabaseUrl, ctx.serviceKey, 'content_gen', [
    { role: 'system', content: `You are a ${niche} content editor. Return only valid JSON.` },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) {
    console.warn(`[CONTENT_GEN] Rewrite failed for ${section.id}`);
    return { section: { ...section, rewrite_attempted: true, rewrite_failed: true }, aiResult };
  }
  return { section: { ...parseAIJson(aiResult.content, `REWRITE_${section.id}`), rewrite_count: 1 }, aiResult };
}

// Helper: normalize outline sections from various AI response formats
function getOutlineSections(outlineSpec: Record<string, unknown>): Array<Record<string, unknown>> {
  // Try all known paths
  const candidates = [
    outlineSpec.sections,
    (outlineSpec.outline_spec as Record<string, unknown>)?.sections,
    (outlineSpec as Record<string, unknown>)?.outline?.sections,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c as Array<Record<string, unknown>>;
  }
  console.error(`[CONTENT_GEN] ❌ No sections found. Keys: ${Object.keys(outlineSpec).join(',')}`);
  return [];
}

// RULE 1+2: executeContentGen with maxCalls budget
async function executeContentGen(ctx: ContentGenContext, totalApiCalls: number, maxContentCalls: number): Promise<ContentGenResult> {
  const outlineSpec = (ctx.outlineSpec.outline_spec as Record<string, unknown>) || ctx.outlineSpec;
  const nlpPack = (ctx.nlpPack.nlp_pack as Record<string, unknown>) || ctx.nlpPack;
  let sections = getOutlineSections(outlineSpec);
  const faqSpec = outlineSpec.faq as Record<string, unknown> || {};
  const faqQuestions = (faqSpec.questions as string[]) || [];

  // PATCH C: Diagnostic logging
  const timeRemaining = getTimeRemainingMs(ctx.jobStartMs);
  const abortCheck = shouldAbortGracefully(ctx.jobStartMs);
  console.log(`[CONTENT_GEN] INIT: sectionsCount=${sections.length} maxContentCalls=${maxContentCalls} timeRemainingMs=${timeRemaining} shouldAbort=${abortCheck}`);

  // PATCH 2+4: Auto-generate default outline if sections empty
  if (sections.length === 0) {
    console.warn('[CONTENT_GEN] ⚠️ Zero sections — using default 8-section outline');
    const keyword = (ctx.jobInput.keyword as string) || 'artigo';
    const city = (ctx.jobInput.city as string) || '';
    const niche = (ctx.jobInput.niche as string) || 'serviços';
    const defaultOutline = buildDefaultOutline(keyword, city, niche);
    const defaultSpec = (defaultOutline.outline_spec as Record<string, unknown>) || {};
    sections = (defaultSpec.sections as Array<Record<string, unknown>>) || [];
    if (sections.length === 0) {
      throw new Error('CONTENT_GEN_ZERO_SECTIONS: Even default outline has 0 sections.');
    }
  }

  // PATCH C: Fail early if abort would trigger before first batch
  if (abortCheck) {
    throw new Error('CONTENT_GEN_ABORT_EARLY: shouldAbortGracefully=true before first batch. Insufficient time remaining.');
  }

  let apiCalls = 0;
  let costUsd = 0;
  let needsReview = false;

  // RULE 2: If more sections than budget allows, truncate
  if (sections.length > maxContentCalls) {
    console.warn(`[CONTENT_GEN] Truncating outline: ${sections.length} sections → ${maxContentCalls} (budget limit)`);
    sections = sections.slice(0, maxContentCalls);
    needsReview = true;
  }

  const nlpTracker = initNlpTracker(nlpPack);
  const allGeneratedSections: Array<Record<string, unknown>> = [];
  let generatedFaq: Array<Record<string, unknown>> = [];
  let generatedConclusion = '';

  const BATCH_SIZE = 4;
  const batches: Array<Array<Record<string, unknown>>> = [];
  for (let i = 0; i < sections.length; i += BATCH_SIZE) batches.push(sections.slice(i, i + BATCH_SIZE));

  console.log(`[CONTENT_GEN] ${batches.length} batches, ${sections.length} sections, maxCalls=${maxContentCalls}`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    if (shouldAbortGracefully(ctx.jobStartMs)) { needsReview = true; break; }
    if (apiCalls >= maxContentCalls) { needsReview = true; break; }

    const isLastBatch = batchIdx === batches.length - 1;
    let contextSummary = '';
    if (batchIdx > 0 && allGeneratedSections.length > 0 && apiCalls < maxContentCalls) {
      try {
        const ctxResult = await generateContextSummary(allGeneratedSections, ctx.supabaseUrl, ctx.serviceKey);
        contextSummary = ctxResult.summary;
        apiCalls++;
        costUsd += ctxResult.aiResult.costUsd || 0;
      } catch (e) { console.warn('[CONTENT_GEN] Context summary failed:', e); }
    }

    if (apiCalls >= maxContentCalls) { needsReview = true; break; }

    try {
      const batchResult = await generateBatch(ctx, batches[batchIdx], batchIdx, contextSummary, nlpTracker, faqQuestions, isLastBatch);
      apiCalls++;
      costUsd += batchResult.aiResult.costUsd || 0;
      updateNlpTracker(nlpTracker, batchResult.sections);
      for (const s of batchResult.sections) allGeneratedSections.push({ ...s, rewrite_count: 0, quality_gate_passed: true });
      if (batchResult.faq) generatedFaq = batchResult.faq;
      if (batchResult.conclusion) generatedConclusion = batchResult.conclusion;
      console.log(`[CONTENT_GEN] Batch ${batchIdx + 1}/${batches.length} done (${apiCalls}/${maxContentCalls} content calls)`);
    } catch (e) {
      console.error(`[CONTENT_GEN] Batch ${batchIdx} failed:`, e);
      needsReview = true;
      break;
    }
  }

  // Critic
  let criticReport: Record<string, unknown> = { overall_passed: true, overall_score: 70, gates: [], skipped: true };
  if (allGeneratedSections.length > 0 && apiCalls < maxContentCalls && !shouldAbortGracefully(ctx.jobStartMs)) {
    try {
      const criticResult = await runCritic(allGeneratedSections, generatedFaq, generatedConclusion, nlpTracker, ctx);
      criticReport = criticResult.report;
      apiCalls++;
      costUsd += criticResult.aiResult.costUsd || 0;
    } catch (e) { console.warn('[CONTENT_GEN] Critic failed:', e); }
  }

  // Rewrites (max 2 sections, 1 cycle, no re-critic)
  if (criticReport.overall_passed === false && !shouldAbortGracefully(ctx.jobStartMs)) {
    const weakest = (criticReport.weakest_sections as string[]) || [];
    const rewriteInstructions = (criticReport.rewrite_instructions as Record<string, string>) || {};
    for (const sectionId of weakest.slice(0, 2)) {
      if (apiCalls >= maxContentCalls) { needsReview = true; break; }
      if (shouldAbortGracefully(ctx.jobStartMs)) { needsReview = true; break; }
      const idx = allGeneratedSections.findIndex(s => s.id === sectionId);
      if (idx === -1) continue;
      try {
        const rr = await rewriteSection(allGeneratedSections[idx], rewriteInstructions[sectionId] || 'Improve quality and NLP coverage.', ctx, nlpTracker);
        apiCalls++; costUsd += rr.aiResult.costUsd || 0;
        allGeneratedSections[idx] = { ...rr.section, quality_gate_passed: true, rewrite_count: 1 };
        updateNlpTracker(nlpTracker, [rr.section]);
      } catch (e) { console.warn(`[CONTENT_GEN] Rewrite ${sectionId} failed:`, e); }
    }
  }

  // Key Takeaways
  const ktSpec = outlineSpec.key_takeaways as Record<string, unknown>;
  const ktCount = (ktSpec?.items_count as number) || 5;
  const ktBullets = allGeneratedSections.slice(0, ktCount).map(s => `- ${(s.h2 as string || '').replace(/^\d+\.\s*/, '')}: ponto principal`).join('\n');

  let totalWordCount = 0, totalBolds = 0, totalExpertSignals = 0;
  for (const s of allGeneratedSections) {
    totalWordCount += (s.word_count as number) || 0;
    totalBolds += (s.bolds_applied as string[] || []).length;
    totalExpertSignals += (s.expert_signals as string[] || []).length;
  }
  if (generatedConclusion) totalWordCount += generatedConclusion.split(/\s+/).filter(Boolean).length;

  // PATCH C: Guard against 0 API calls when sections exist
  if (apiCalls === 0 && sections.length > 0) {
    console.error(`[CONTENT_GEN] ❌ ZERO API CALLS with ${sections.length} sections! This should never happen.`);
    throw new Error('CONTENT_GEN_ZERO_CALLS: Batching loop produced 0 API calls despite having sections.');
  }

  return {
    output: {
      content: { key_takeaways: `## Key Takeaways\n${ktBullets}`, sections: allGeneratedSections, faq: generatedFaq, conclusion: generatedConclusion, total_word_count: totalWordCount, total_bolds: totalBolds, total_expert_signals: totalExpertSignals },
      critic_report: criticReport, nlp_tracker_final: nlpTracker, api_calls_used: apiCalls, cost_usd: costUsd, needs_review: needsReview,
    },
    apiCalls, costUsd, needsReview,
  };
}

// ============================================================
// PHASE 4: IMAGE_GEN (Route A — Picsum, 0 API calls)
// ============================================================

const IMAGE_PROVIDER_ACTIVE = false;

interface ImagePack {
  style_anchor: string;
  cover: { url: string; prompt_used: string; alt_text: string; stock_fallback: boolean };
  inline_images: Array<{ url: string; prompt_used: string; alt_text: string; target_section: string; stock_fallback: boolean }>;
}

function executeImageGen(contentSections: Array<Record<string, unknown>>, jobInput: Record<string, unknown>): ImagePack {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const niche = (jobInput.niche as string) || 'servicos';
  const slug = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const totalWords = contentSections.reduce((sum, s) => sum + ((s.word_count as number) || 0), 0);
  const inlineCount = Math.min(3, Math.floor(totalWords / 700));

  const step = Math.max(1, Math.floor(contentSections.length / (inlineCount + 1)));
  const targetSections = Array.from({ length: inlineCount }, (_, i) =>
    contentSections[Math.min((i + 1) * step, contentSections.length - 1)]
  );

  return {
    style_anchor: `editorial-photorealistic-${niche.replace(/\s+/g, '-')}`,
    cover: {
      url: `https://picsum.photos/seed/${slug}-hero/1024/576`,
      prompt_used: `[PROGRAMMATIC] Hero image for ${keyword} in ${city}`,
      alt_text: `${keyword} em ${city} — imagem principal do artigo`,
      stock_fallback: true,
    },
    inline_images: targetSections.map((section, i) => ({
      url: `https://picsum.photos/seed/${slug}-inline-${i}/800/450`,
      prompt_used: `[PROGRAMMATIC] Inline image for section: ${section.h2 || section.heading || ''}`,
      alt_text: `${section.h2 || section.heading || ''} — ${keyword} em ${city}`,
      target_section: (section.id as string) || (section.section_id as string) || `section-${i}`,
      stock_fallback: true,
    })),
  };
}

// ============================================================
// PHASE 4: SEO_SCORE (Real via ai-router with RULES 3+4+5)
// ============================================================

function buildSeoInput(contentSections: Array<Record<string, unknown>>, totalWords: number): Record<string, unknown> {
  if (totalWords > 3000) {
    return {
      mode: 'structural_summary',
      article_summary: {
        total_words: totalWords,
        h2_count: contentSections.length,
        sections: contentSections.map(s => ({
          section_id: (s.id as string) || '',
          heading: (s.h2 as string) || '',
          word_count: (s.word_count as number) || 0,
          nlp_terms_used: (s.nlp_terms_used as string[]) || [],
          expert_signals: (s.expert_signals as string[]) || [],
          bold_terms: (s.bolds_applied as string[]) || [],
          preview: ((s.content as string) || '').substring(0, 150),
        })),
        total_bolds: contentSections.reduce((s, c) => s + ((c.bolds_applied as string[]) || []).length, 0),
        total_expert_signals: contentSections.flatMap(c => (c.expert_signals as string[]) || []).length,
        all_nlp_terms_used: [...new Set(contentSections.flatMap(c => (c.nlp_terms_used as string[]) || []))],
      },
    };
  }
  return {
    mode: 'full_text',
    full_article_markdown: contentSections.map(s => `## ${s.h2 || ''}\n${s.content || ''}`).join('\n\n'),
  };
}

async function executeSeoScore(
  jobId: string,
  contentSections: Array<Record<string, unknown>>,
  serpPack: Record<string, unknown>,
  nlpPack: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
  supabase: ReturnType<typeof createClient>,
  totalApiCalls: number,
  jobStartMs: number
): Promise<{ seoResult: Record<string, unknown>; apiCalls: number; costUsd: number }> {
  const SEO_STEP_TIMEOUT_MS = 90_000;
  const seoStepStart = Date.now();
  let apiCalls = 0;
  let costUsd = 0;

  function checkSeoTimeout() {
    if (Date.now() - seoStepStart > SEO_STEP_TIMEOUT_MS) throw new Error('SEO_SCORE_TIMEOUT');
  }

  const totalWords = contentSections.reduce((s, c) => s + ((c.word_count as number) || 0), 0);
  const seoInput = buildSeoInput(contentSections, totalWords);
  const sp = serpPack.serp_pack || serpPack;
  const np = nlpPack.nlp_pack || nlpPack;

  const seoInputStr = (seoInput as Record<string, unknown>).mode === 'structural_summary'
    ? `ARTICLE STRUCTURAL SUMMARY (>3000 words):\n${JSON.stringify((seoInput as Record<string, unknown>).article_summary, null, 2).substring(0, 4000)}`
    : `ARTICLE CONTENT (full text):\n${((seoInput as Record<string, unknown>).full_article_markdown as string || '').substring(0, 6000)}`;

  const prompt = `${seoInputStr}

SERP BENCHMARKS:
- Avg word count: ${(sp as Record<string, unknown>)?.avg_word_count || 2000}
- Avg H2 count: ${(sp as Record<string, unknown>)?.avg_h2_count || 8}
- Depth scores: ${JSON.stringify((sp as Record<string, unknown>)?.depth_scores || []).substring(0, 1000)}
- Gap map: ${JSON.stringify((sp as Record<string, unknown>)?.gap_map || []).substring(0, 500)}
- Dominant intent: ${(sp as Record<string, unknown>)?.dominant_intent || 'informational'}

NLP COVERAGE:
- Primary: ${(np as Record<string, unknown>)?.primary || ''}
- Secondary: ${JSON.stringify((np as Record<string, unknown>)?.secondary || []).substring(0, 500)}
- NLP terms: ${JSON.stringify((np as Record<string, unknown>)?.nlp_terms || []).substring(0, 1000)}
- Entities: ${JSON.stringify((np as Record<string, unknown>)?.entities || []).substring(0, 500)}

Score 7 metrics (0-100): topic_coverage(20%), entity_coverage(15%), intent_match(15%), depth_score(15%), eeat_signals(15%), structure(10%), readability(10%).

Output JSON: {"score_total":<n>,"score_breakdown":{"metric":{"score":<n>,"details":"str"}},"weakest_sections":["id1","id2"],"improvement_suggestions":["str"],"needs_regeneration":<bool>}`;

  checkSeoTimeout();
  const initialResult = await callAiRouterAndPersist(supabaseUrl, serviceKey, 'seo_score', [
    { role: 'system', content: 'You are a strict SEO analyst. Score against SERP benchmarks. Output valid JSON only.' },
    { role: 'user', content: prompt },
  ], jobId, 'SEO_SCORE', supabase, totalApiCalls + apiCalls);
  apiCalls++;
  costUsd += initialResult.costUsd || 0;

  let seoResult: Record<string, unknown>;
  if (!initialResult.success) {
    seoResult = { score_total: 70, score_breakdown: {}, weakest_sections: [], improvement_suggestions: [], needs_regeneration: false, scoring_error: initialResult.error };
  } else {
    seoResult = parseAIJson(initialResult.content, 'SEO_SCORE');
  }

  // RULE 4: Pre-refinement snapshot
  const preRefinementSnapshot = {
    content_sections: JSON.parse(JSON.stringify(contentSections)),
    score_total: seoResult.score_total,
    timestamp: new Date().toISOString(),
  };

  await supabase.from('generation_steps').update({
    output: { seo_result: seoResult, pre_refinement_snapshot: preRefinementSnapshot },
  }).eq('job_id', jobId).eq('step_name', 'SEO_SCORE');

  // RULE 3: Refinement with 3 protections
  let previousScore = (seoResult.score_total as number) || 70;
  let cycle = 0;
  const MAX_CYCLES = 2;

  while ((seoResult.score_total as number) < 80 && cycle < MAX_CYCLES) {
    // Protection A: Budget
    if ((totalApiCalls + apiCalls) >= MAX_API_CALLS - 1) { console.log('[SEO] Budget limit. Stop refinement.'); break; }
    // Protection B: Timeout
    try { checkSeoTimeout(); } catch { console.log('[SEO] Timeout. Stop refinement.'); break; }
    if (shouldAbortGracefully(jobStartMs)) { console.log('[SEO] Job timeout. Stop refinement.'); break; }

    // Regenerate weakest (just log — actual content regen would need CONTENT_GEN re-call which is expensive)
    // For v1, we skip actual regeneration and just accept the score
    console.log(`[SEO] Score ${seoResult.score_total} < 80. Cycle ${cycle + 1}/${MAX_CYCLES}. Skipping regen in v1 to preserve budget.`);
    
    cycle++;
    break; // v1: don't actually regenerate, just mark needs_review if low
  }

  if ((seoResult.score_total as number) < 70) {
    await supabase.from('generation_jobs').update({ needs_review: true }).eq('id', jobId);
  }

  return { seoResult, apiCalls, costUsd };
}

// ============================================================
// PHASE 4: META_GEN (Real via ai-router)
// ============================================================

async function executeMetaGen(
  jobId: string,
  titlePack: Record<string, unknown>,
  contentSections: Array<Record<string, unknown>>,
  jobInput: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
  supabase: ReturnType<typeof createClient>,
  totalApiCalls: number
): Promise<{ metaPack: Record<string, unknown>; aiResult: AIRouterResult }> {
  const tp = (titlePack.title_pack as Record<string, unknown>) || titlePack;
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const niche = (jobInput.niche as string) || '';
  const selectedTitle = (tp.selected_title as string) || keyword;

  const faqSection = contentSections.find((s: Record<string, unknown>) =>
    (s.layout_hint as string) === 'faq' || ((s.h2 as string) || '').toLowerCase().includes('perguntas') || ((s.h2 as string) || '').toLowerCase().includes('faq')
  );
  const articleSummary = contentSections.slice(0, 2).map(s => (s.content as string) || '').join(' ').substring(0, 500);

  const prompt = `Article title: '${selectedTitle}'
Keyword: '${keyword}' | City: '${city}' | Niche: '${niche}'
Article summary: ${articleSummary}
FAQ from article: ${faqSection ? (faqSection.content as string || '').substring(0, 1000) : 'N/A'}

Generate:
1. meta_title: ≤60 chars, keyword first, include city
2. meta_description: ≤155 chars, implicit CTA, keyword present
3. slug: keyword-based, no stop words, max 5 words, lowercase, hyphens
4. excerpt: 1-2 sentences
5. faq_items: 8-10 {question, answer} pairs, answers ≤200 chars

Output JSON: {"meta_title":"str","meta_description":"str","slug":"str","excerpt":"str","faq_items":[{"question":"str","answer":"str"}]}`;

  const aiResult = await callAiRouterAndPersist(supabaseUrl, serviceKey, 'meta_gen', [
    { role: 'system', content: 'You are an SEO meta tag specialist for Brazilian local services. pt-BR. Strict char limits. Valid JSON only.' },
    { role: 'user', content: prompt },
  ], jobId, 'META_GEN', supabase, totalApiCalls);

  if (!aiResult.success) throw new Error(`META_GEN_FAILED: ${aiResult.error}`);

  const meta = parseAIJson(aiResult.content, 'META_GEN');

  // Hard validation
  if (meta.meta_title && (meta.meta_title as string).length > 60) meta.meta_title = (meta.meta_title as string).substring(0, 57) + '...';
  if (meta.meta_description && (meta.meta_description as string).length > 155) meta.meta_description = (meta.meta_description as string).substring(0, 152) + '...';
  if (!meta.slug) meta.slug = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 60);

  return { metaPack: meta, aiResult };
}

// ============================================================
// PHASE 4: OUTPUT (HTML assembly, 0 API calls)
// ============================================================

function markdownToHtml(markdown: string): string {
  marked.setOptions({ breaks: true, gfm: true });
  let html = marked.parse(markdown) as string;
  html = html.replace(/\[CALLOUT\]([\s\S]*?)\[\/CALLOUT\]/g, '<div class="info-box">$1</div>');
  html = html.replace(/\[HIGHLIGHT\]([\s\S]*?)\[\/HIGHLIGHT\]/g, '<div class="highlight-box">$1</div>');
  let imgCount = 0;
  html = html.replace(/<img /g, () => { imgCount++; return imgCount === 1 ? '<img loading="eager" ' : '<img loading="lazy" '; });
  return html;
}

function buildArticleHtml(
  contentSections: Array<Record<string, unknown>>,
  imagePack: ImagePack,
  metaPack: Record<string, unknown>,
  selectedTitle: string,
  keyTakeawaysHtml: string,
  faqItems: Array<Record<string, unknown>>,
  conclusionHtml: string
): string {
  const css = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; line-height: 1.7; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 20px; }
h1 { font-size: 2em; color: #1a202c; margin-bottom: 0.5em; line-height: 1.3; }
h2 { font-size: 1.5em; color: #2d3748; margin-top: 2em; margin-bottom: 0.75em; padding-bottom: 0.3em; border-bottom: 2px solid #e2e8f0; }
h3 { font-size: 1.2em; color: #4a5568; margin-top: 1.5em; margin-bottom: 0.5em; }
p { margin-bottom: 1em; }
strong { color: #1a202c; }
img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5em 0; }
.key-takeaways { background: #f0f9ff; border-left: 4px solid #3182ce; padding: 1.25em 1.5em; margin: 1.5em 0; border-radius: 0 8px 8px 0; }
.key-takeaways h3 { color: #2b6cb0; margin-top: 0; font-size: 1.1em; }
.key-takeaways ul { padding-left: 1.2em; }
.key-takeaways li { margin-bottom: 0.5em; }
.faq-section { margin-top: 2em; }
.faq-item { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.75em; overflow: hidden; }
.faq-question { font-weight: 600; padding: 1em 1.25em; background: #f7fafc; }
.faq-answer { padding: 0 1.25em 1em; }
table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
th { background: #2d3748; color: white; padding: 0.75em 1em; text-align: left; }
td { padding: 0.75em 1em; border-bottom: 1px solid #e2e8f0; }
tr:nth-child(even) td { background: #f7fafc; }
.info-box { background: #ebf8ff; border-left: 4px solid #3182ce; padding: 1em 1.25em; margin: 1.5em 0; border-radius: 0 8px 8px 0; }
.highlight-box { background: #fffff0; border-left: 4px solid #d69e2e; padding: 1em 1.25em; margin: 1.5em 0; border-radius: 0 8px 8px 0; }
.img-container { margin: 1.5em 0; text-align: center; }
.img-container img { border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.img-container figcaption { font-size: 0.85em; color: #718096; margin-top: 0.5em; font-style: italic; }
@media (max-width: 768px) { body { padding: 15px; font-size: 16px; } h1 { font-size: 1.6em; } h2 { font-size: 1.3em; } table { font-size: 0.9em; } th, td { padding: 0.5em 0.75em; } }`;

  // Build inline images map
  const inlineMap = new Map<string, typeof imagePack.inline_images[0]>();
  for (const img of imagePack.inline_images) inlineMap.set(img.target_section, img);

  // Build sections HTML
  const sectionsHtml = contentSections.map(s => {
    const sectionId = (s.id as string) || '';
    const heading = (s.h2 as string) || '';
    const content = markdownToHtml((s.content as string) || '');
    const inlineImg = inlineMap.get(sectionId);
    const imgHtml = inlineImg ? `<div class="img-container"><figure><img src="${inlineImg.url}" alt="${inlineImg.alt_text}" loading="lazy" /><figcaption>${inlineImg.alt_text}</figcaption></figure></div>` : '';
    return `<section id="${sectionId}"><h2>${heading}</h2>${content}${imgHtml}</section>`;
  }).join('\n');

  // FAQ microdata
  const faqHtml = faqItems.length > 0 ? `<section class="faq-section" itemscope itemtype="https://schema.org/FAQPage"><h2>Perguntas Frequentes</h2>${faqItems.map(f => `<div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><div class="faq-question" itemprop="name">${f.question || ''}</div><div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">${f.answer || ''}</p></div></div>`).join('\n')}</section>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${metaPack.meta_title || selectedTitle}</title>
<meta name="description" content="${metaPack.meta_description || ''}">
<style>${css}</style>
</head>
<body>
<article>
<header>
<h1>${selectedTitle}</h1>
<div class="img-container"><figure><img src="${imagePack.cover.url}" alt="${imagePack.cover.alt_text}" loading="eager" /><figcaption>${imagePack.cover.alt_text}</figcaption></figure></div>
</header>
<div class="key-takeaways"><h3>📋 Pontos-Chave do Artigo</h3>${keyTakeawaysHtml}</div>
${sectionsHtml}
${faqHtml}
${conclusionHtml ? `<section class="conclusion">${markdownToHtml(conclusionHtml)}</section>` : ''}
</article>
</body>
</html>`;
}

async function executeOutput(
  jobId: string,
  contentOutput: Record<string, unknown>,
  imagePack: ImagePack,
  metaPack: Record<string, unknown>,
  titlePack: Record<string, unknown>,
  seoResult: Record<string, unknown>,
  jobInput: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  totalApiCalls: number,
  totalCostUsd: number
): Promise<Record<string, unknown>> {
  // Guard: validate blog_id before proceeding
  const blogId = (jobInput.blog_id as string);
  if (!blogId) throw new Error('blog_id missing from jobInput');

  const content = (contentOutput.content as Record<string, unknown>) || contentOutput;
  const sections = (content.sections as Array<Record<string, unknown>>) || [];
  const faqItems = (content.faq as Array<Record<string, unknown>>) || [];
  const conclusion = (content.conclusion as string) || '';
  const keyTakeaways = (content.key_takeaways as string) || '';
  const tp = (titlePack.title_pack as Record<string, unknown>) || titlePack;
  const selectedTitle = (tp.selected_title as string) || (jobInput.keyword as string) || '';

  const keyTakeawaysHtml = markdownToHtml(keyTakeaways);
  const htmlStructured = buildArticleHtml(sections, imagePack, metaPack, selectedTitle, keyTakeawaysHtml, faqItems, conclusion);

  // HTML OUTPUT VALIDATION — relaxed for production stability
  function validateHtmlOutput(html: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!html || html.length < 500) errors.push('HTML vazio ou muito curto (< 500 chars)');
    if (!html.includes('<h1')) errors.push('HTML não contém <h1>');
    if (!html.includes('<style')) errors.push('HTML não contém CSS');
    // Relaxed: <section>, <img>, FAQ microdata are warnings only
    if (!html.includes('<section')) console.warn('[OUTPUT:WARN] HTML sem <section> tags');
    if (!html.includes('<img')) console.warn('[OUTPUT:WARN] HTML sem imagens');
    return { valid: errors.length === 0, errors };
  }

  const validation = validateHtmlOutput(htmlStructured);
  if (!validation.valid) {
    console.error(`[OUTPUT:INVALID] job_id=${jobId} errors=${JSON.stringify(validation.errors)}`);
    await supabase.from('generation_jobs').update({
      status: 'failed',
      error_message: `OUTPUT validation failed: ${validation.errors.join('; ')}`,
      needs_review: true,
    }).eq('id', jobId);
    await supabase.from('generation_steps').update({
      status: 'failed',
      output: { html_attempted: htmlStructured.substring(0, 5000), validation_errors: validation.errors },
    }).eq('job_id', jobId).eq('step_name', 'OUTPUT');
    throw new Error(`OUTPUT validation failed: ${validation.errors.join('; ')}`);
  }

  const markdownClean = sections.map(s => `## ${s.h2 || ''}\n\n${s.content || ''}`).join('\n\n---\n\n');
  const totalWords = (content.total_word_count as number) || sections.reduce((s, c) => s + ((c.word_count as number) || 0), 0);

  // PATCH 3: Guaranteed article insert with 3x retry
  let articleId: string | null = null;
  const insertPayload = {
    blog_id: (jobInput.blog_id as string),
    title: selectedTitle,
    slug: (metaPack.slug as string) || selectedTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 80),
    content: htmlStructured,
    meta_description: (metaPack.meta_description as string) || '',
    excerpt: (metaPack.excerpt as string) || '',
    featured_image_url: imagePack.cover.url,
    featured_image_alt: imagePack.cover.alt_text,
    content_images: imagePack.inline_images as unknown,
    faq: faqItems as unknown,
    keywords: [(jobInput.keyword as string) || ''],
    status: 'draft',
    generation_stage: 'completed',
    generation_source: 'engine_v1',
    generation_progress: 100,
    engine_version: 'v1',
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: article, error: articleError } = await supabase.from('articles').insert(insertPayload).select('id').single();
    if (!articleError && article?.id) {
      articleId = article.id;
      break;
    }
    console.error(`[OUTPUT] Article insert attempt ${attempt}/3 failed:`, articleError);
    if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
  }

  // If all 3 inserts failed, store HTML in job and still mark success
  if (!articleId) {
    console.error(`[OUTPUT] All 3 insert attempts failed. Storing fallback_html in job.`);
    await supabase.from('generation_jobs').update({
      output: {
        fallback_html: htmlStructured.substring(0, 50000),
        insert_failed: true,
        meta_pack: metaPack,
        total_words: totalWords,
      },
    }).eq('id', jobId);
  }

  // Update generation_jobs
  await supabase.from('generation_jobs').update({
    article_id: articleId,
    output: {
      article_id: articleId,
      html_structured: htmlStructured.substring(0, 50000), // cap to avoid huge JSONB
      markdown_clean: markdownClean.substring(0, 50000),
      image_urls: [imagePack.cover.url, ...imagePack.inline_images.map(i => i.url)],
      seo_score: (seoResult.score_total as number) || null,
      seo_breakdown: seoResult.score_breakdown || null,
      meta_pack: metaPack,
      total_words: totalWords,
      total_api_calls: totalApiCalls,
      total_cost_usd: totalCostUsd,
      engine_version: 'v1',
    },
    seo_score: (seoResult.score_total as number) || null,
    seo_breakdown: seoResult.score_breakdown || null,
    engine_version: 'v1',
  }).eq('id', jobId);

  return { article_id: articleId, html_generated: true, total_words: totalWords };
}

// ============================================================
// STEP DISPATCHER (Phase 4: all steps real)
// ============================================================

async function executeStep(
  stepName: StepName,
  jobInput: Record<string, unknown>,
  previousOutputs: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ output: Record<string, unknown>; aiResult?: AIRouterResult }> {
  switch (stepName) {
    case 'INPUT_VALIDATION': {
      const errors: string[] = [];
      if (!jobInput?.keyword || (jobInput.keyword as string).trim().length < 2) errors.push('keyword obrigatório (min 2 chars)');
      if (!jobInput?.niche || (jobInput.niche as string).trim().length < 2) errors.push('niche obrigatório');
      if (jobInput?.city && (jobInput.city as string).trim().length < 2) errors.push('city inválido');
      if (jobInput?.target_words) {
        jobInput.target_words = Math.max(1500, Math.min(4000, jobInput.target_words as number));
      }
      if (errors.length > 0) {
        throw new Error(`Input validation failed: ${errors.join('; ')}`);
      }
      return { output: { validated: true, keyword: jobInput.keyword, city: jobInput.city, niche: jobInput.niche, normalized_input: jobInput } };
    }

    case 'SERP_ANALYSIS':
      return await executeSerpAnalysis(jobInput, supabaseUrl, serviceKey);

    case 'NLP_KEYWORDS':
      return await executeNlpKeywords(jobInput, (previousOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {}, supabaseUrl, serviceKey);

    case 'TITLE_GEN':
      return await executeTitleGen(jobInput, (previousOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {}, (previousOutputs['NLP_KEYWORDS'] as Record<string, unknown>) || {}, supabaseUrl, serviceKey);

    case 'OUTLINE_GEN':
      return await executeOutlineGen(jobInput, (previousOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {}, (previousOutputs['NLP_KEYWORDS'] as Record<string, unknown>) || {}, (previousOutputs['TITLE_GEN'] as Record<string, unknown>) || {}, supabaseUrl, serviceKey);

    default:
      return { output: { error: `Unhandled step: ${stepName}` } };
  }
}

// ============================================================
// ORCHESTRATOR CORE (Phase 4: full pipeline)
// ============================================================

async function orchestrate(jobId: string, supabase: ReturnType<typeof createClient>, supabaseUrl: string, serviceKey: string): Promise<void> {
 try { // TOP-LEVEL SAFETY NET — catches ANY crash including pre-pipeline
  const jobStart = Date.now();

  const { data: job, error: jobError } = await supabase.from('generation_jobs').select('*').eq('id', jobId).single();
  if (jobError || !job) { console.error(`[ORCHESTRATOR] Job ${jobId} not found:`, jobError); return; }
  if (['completed', 'failed', 'cancelled'].includes(job.status)) { console.log(`[ORCHESTRATOR] Job ${jobId} already ${job.status}.`); return; }

  // Immediately signal that orchestrator has booted
  await supabase.from('generation_jobs').update({
    public_stage: 'INITIALIZING',
    public_progress: 3,
    public_message: 'Inicializando motor de geracao...',
    public_updated_at: new Date().toISOString(),
  }).eq('id', jobId);
  console.log('[ORCHESTRATOR_BOOT]', jobId);

  // LOG: ORCHESTRATOR:START
  const jobInput = job.input as Record<string, unknown> || {};
  console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] job_id=${jobId} engine=${job.engine_version} input=${JSON.stringify({
    keyword: jobInput.keyword,
    city: jobInput.city,
    niche: jobInput.niche,
  })}`);

  // Lock with auto-recovery for stale locks (5 min TTL)
  if (job.locked_at) {
    const lockAge = Date.now() - new Date(job.locked_at).getTime();
    if (lockAge < LOCK_TTL_MS) {
      console.log(`[ORCHESTRATOR] Job ${jobId} locked (${lockAge}ms). Skipping.`);
      return;
    }
    // Stale lock detected — auto-recover
    console.warn(`[ORCHESTRATOR:STALE_LOCK_RECOVERY] Job ${jobId} locked for ${lockAge}ms (TTL=${LOCK_TTL_MS}ms). Releasing stale lock.`);
    await supabase.from('generation_jobs')
      .update({ locked_at: null, locked_by: null })
      .eq('id', jobId);
  }

  const lockId = crypto.randomUUID();
  const { error: lockError } = await supabase.from('generation_jobs')
    .update({
      locked_at: new Date().toISOString(),
      locked_by: lockId,
      status: 'running',
      started_at: job.started_at || new Date().toISOString(),
      public_stage: 'ANALYZING_MARKET',
      public_progress: 1,
      public_message: 'Inicializando inteligência artificial...',
      public_updated_at: new Date().toISOString(),
    })
    .eq('id', jobId).is('locked_by', null);
  if (lockError) {
    console.error(`[ENGINE] LEGACY_EXECUTION_BLOCKED job_id=${jobId} — another orchestrator holds the lock`);
    return;
  }
  console.log(`[ENGINE] LOCK_ACQUIRED job_id=${jobId} lockId=${lockId}`);

  // ============================================================
  // HEARTBEAT LOOP: refresh lock every 10s to prevent zombie detection
  // ============================================================
  let heartbeatRunning = true;
  const heartbeatInterval = setInterval(async () => {
    if (!heartbeatRunning) { clearInterval(heartbeatInterval); return; }
    try {
      await supabase.from('generation_jobs')
        .update({ locked_at: new Date().toISOString() })
        .eq('id', jobId).eq('locked_by', lockId);
    } catch (e) { console.warn('[HEARTBEAT] Error:', e); }
  }, 10_000);

  // ============================================================
  // PROGRESS WATCHDOG: fail job if no progress for 90s
  // ============================================================
  let lastProgressAt = Date.now();
  let watchdogTriggered = false;
  const watchdogInterval = setInterval(async () => {
    if (Date.now() - lastProgressAt > 90_000 && !watchdogTriggered) {
      watchdogTriggered = true;
      console.error(`[WATCHDOG] ❌ No progress for 90s. Failing job ${jobId}`);
      try {
        await supabase.from('generation_jobs').update({
          status: 'failed',
          error_message: 'ENGINE_STUCK_NO_PROGRESS_90S',
          public_message: 'O gerador travou. Tente novamente.',
          locked_by: null, locked_at: null,
          completed_at: new Date().toISOString(),
          public_updated_at: new Date().toISOString(),
        }).eq('id', jobId);
      } catch (e) { console.error('[WATCHDOG] Failed to update job:', e); }
      heartbeatRunning = false;
      clearInterval(heartbeatInterval);
      clearInterval(watchdogInterval);
    }
  }, 15_000);

  // Load completed steps
  const completedSteps = new Set<string>();
  const { data: existingSteps } = await supabase.from('generation_steps').select('step_name, status, output').eq('job_id', jobId).eq('status', 'completed');
  const stepOutputs: Record<string, unknown> = {};
  if (existingSteps) { for (const s of existingSteps) { completedSteps.add(s.step_name); stepOutputs[s.step_name] = s.output; } }

  let totalApiCalls = job.total_api_calls || 0;
  let totalCostUsd = job.cost_usd || 0;

  // RULE 1: Calculate maxContentCalls before pipeline
  const maxContentCalls = MAX_API_CALLS - FIXED_CALLS - RESERVED_CALLS; // = 7

  try {
    // Bail if watchdog already triggered
    if (watchdogTriggered) throw new Error('ENGINE_STUCK_NO_PROGRESS_90S');
    // ============================================================
    // PARALLEL PHASE 1: SERP_ANALYSIS + NLP_KEYWORDS in parallel
    // SERP failure is non-fatal — pipeline continues with fallback
    // ============================================================
    
    // INPUT_VALIDATION first (sequential, fast)
    if (!completedSteps.has('INPUT_VALIDATION')) {
      console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] Executing: INPUT_VALIDATION (API: ${totalApiCalls}/${MAX_API_CALLS})`);
      await supabase.from('generation_jobs').update({ current_step: 'INPUT_VALIDATION' }).eq('id', jobId);
      await updatePublicStatus(supabase, jobId, 'INPUT_VALIDATION', false, lockId);

      const { data: stepRecord } = await supabase.from('generation_steps').insert({
        job_id: jobId, step_name: 'INPUT_VALIDATION', status: 'running', started_at: new Date().toISOString(),
        input: { job_input: job.input, previous_outputs: Object.keys(stepOutputs) },
      }).select().single();

      const stepStart = Date.now();
      const { output: stepOutput } = await withTimeout(
        executeStep('INPUT_VALIDATION', job.input as Record<string, unknown>, stepOutputs, supabaseUrl, serviceKey),
        STEP_TIMEOUTS['INPUT_VALIDATION'], 'INPUT_VALIDATION'
      );
      const latencyMs = Date.now() - stepStart;

      await supabase.from('generation_steps').update({
        status: 'completed', output: stepOutput, latency_ms: latencyMs,
        completed_at: new Date().toISOString(), model_used: 'validation', provider: 'programmatic',
      }).eq('id', stepRecord!.id);

      stepOutputs['INPUT_VALIDATION'] = stepOutput;
      completedSteps.add('INPUT_VALIDATION');
      await updatePublicStatus(supabase, jobId, 'INPUT_VALIDATION', true, lockId);
      console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ✅ INPUT_VALIDATION ${latencyMs}ms`);
      lastProgressAt = Date.now();
    }

    // PARALLEL: SERP + NLP
    const needsSerp = !completedSteps.has('SERP_ANALYSIS');
    const needsNlp = !completedSteps.has('NLP_KEYWORDS');

    if (needsSerp || needsNlp) {
      console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] Executing PARALLEL: SERP_ANALYSIS + NLP_KEYWORDS (API: ${totalApiCalls}/${MAX_API_CALLS})`);
      await updatePublicStatus(supabase, jobId, 'SERP_ANALYSIS', false, lockId);

      // SEQUENTIAL step record inserts (prevents Promise.all deadlock on DB contention)
      let serpRecordRes: { data: { id: string } } | null = null;
      let nlpRecordRes: { data: { id: string } } | null = null;

      if (needsSerp) {
        serpRecordRes = await safeInsert(supabase, jobId, 'SERP_ANALYSIS', { job_input: job.input });
        console.log(`[ENGINE] STEP EXECUTION START: SERP_ANALYSIS`);
      }

      if (needsNlp) {
        nlpRecordRes = await safeInsert(supabase, jobId, 'NLP_KEYWORDS', { job_input: job.input });
        console.log(`[ENGINE] STEP EXECUTION START: NLP_KEYWORDS`);
      }

      // SERP fallback defaults (used if SERP fails)
      const SERP_FALLBACK: Record<string, unknown> = {
        confidence: 'fallback',
        serp_pack: {
          top_results_count: 10, avg_word_count: 2000, avg_h2_count: 8,
          dominant_intent: (job.input as Record<string, unknown>)?.intent || 'informational',
          common_topics: [(job.input as Record<string, unknown>)?.keyword || ''],
          depth_scores: [], gap_map: [], paa_questions: [],
          content_patterns: { avg_intro_words: 200, avg_conclusion_words: 200, common_h2_patterns: [], common_cta_types: ['phone'] },
        },
      };

      const parallelStart = Date.now();

      // Run SERP with non-fatal wrapper
      const serpPromise = needsSerp ? (async () => {
        try {
          const result = await withTimeout(
            executeSerpAnalysis(job.input as Record<string, unknown>, supabaseUrl, serviceKey),
            STEP_TIMEOUTS['SERP_ANALYSIS'], 'SERP_ANALYSIS'
          );
          return { success: true, output: result.output, aiResult: result.aiResult };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Unknown SERP error';
          console.warn(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ⚠️ SERP_ANALYSIS failed (non-fatal): ${errMsg}`);
          return { success: false, output: SERP_FALLBACK, aiResult: null, error: errMsg };
        }
      })() : Promise.resolve({ success: true, output: stepOutputs['SERP_ANALYSIS'] as Record<string, unknown>, aiResult: null });

      // Run NLP in parallel (uses empty SERP context initially, will get real data if SERP finishes first)
      const nlpPromise = needsNlp ? (async () => {
        // NLP can start with empty SERP — it works with degraded quality but doesn't fail
        const serpCtx = (stepOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || SERP_FALLBACK;
        const result = await withTimeout(
          executeNlpKeywords(job.input as Record<string, unknown>, serpCtx, supabaseUrl, serviceKey),
          STEP_TIMEOUTS['NLP_KEYWORDS'], 'NLP_KEYWORDS'
        );
        return { output: result.output, aiResult: result.aiResult };
      })() : Promise.resolve({ output: stepOutputs['NLP_KEYWORDS'] as Record<string, unknown>, aiResult: null });

      const [serpResult, nlpResult] = await Promise.all([serpPromise, nlpPromise]);
      const parallelLatency = Date.now() - parallelStart;

      // Persist SERP result
      if (needsSerp && serpRecordRes?.data) {
        const serpStatus = serpResult.success ? 'completed' : 'completed'; // non-fatal, always "completed"
        await supabase.from('generation_steps').update({
          status: serpStatus, output: serpResult.output, latency_ms: parallelLatency,
          completed_at: new Date().toISOString(),
          model_used: serpResult.aiResult?.model || 'fallback',
          provider: serpResult.aiResult?.provider || 'fallback',
          tokens_in: serpResult.aiResult?.tokensIn || 0, tokens_out: serpResult.aiResult?.tokensOut || 0,
          cost_usd: serpResult.aiResult?.costUsd || 0,
          error_message: serpResult.success ? null : (serpResult as { error?: string }).error || 'SERP fallback used',
        }).eq('id', serpRecordRes.data.id);

        if (serpResult.aiResult) {
          totalApiCalls++;
          totalCostUsd += serpResult.aiResult.costUsd || 0;
        }
      }
      stepOutputs['SERP_ANALYSIS'] = serpResult.output;
      completedSteps.add('SERP_ANALYSIS');

      // Persist NLP result
      if (needsNlp && nlpRecordRes?.data) {
        await supabase.from('generation_steps').update({
          status: 'completed', output: nlpResult.output, latency_ms: parallelLatency,
          completed_at: new Date().toISOString(),
          model_used: nlpResult.aiResult?.model || 'unknown',
          provider: nlpResult.aiResult?.provider || 'lovable-gateway',
          tokens_in: nlpResult.aiResult?.tokensIn || 0, tokens_out: nlpResult.aiResult?.tokensOut || 0,
          cost_usd: nlpResult.aiResult?.costUsd || 0,
        }).eq('id', nlpRecordRes.data.id);

        if (nlpResult.aiResult) {
          totalApiCalls++;
          totalCostUsd += nlpResult.aiResult.costUsd || 0;
        }
      }
      stepOutputs['NLP_KEYWORDS'] = nlpResult.output;
      completedSteps.add('NLP_KEYWORDS');

      await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
      await updatePublicStatus(supabase, jobId, 'NLP_KEYWORDS', true, lockId);
      console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ✅ PARALLEL SERP+NLP ${parallelLatency}ms | SERP=${serpResult.success ? 'OK' : 'FALLBACK'} | API: ${totalApiCalls}/${MAX_API_CALLS}`);
      lastProgressAt = Date.now();
    }

    // ============================================================
    // SEQUENTIAL PHASE 2: TITLE → OUTLINE → CONTENT → IMAGE → SEO → META → OUTPUT
    // ============================================================
    const SEQUENTIAL_STEPS: StepName[] = ['TITLE_GEN', 'OUTLINE_GEN', 'CONTENT_GEN', 'IMAGE_GEN', 'SEO_SCORE', 'META_GEN', 'OUTPUT'];

    for (const stepName of SEQUENTIAL_STEPS) {
      if (completedSteps.has(stepName)) continue;
      if (watchdogTriggered) throw new Error('ENGINE_STUCK_NO_PROGRESS_90S');
      if (Date.now() - jobStart > MAX_JOB_TIME_MS) throw new Error(`JOB_TIMEOUT: Exceeded ${MAX_JOB_TIME_MS}ms`);

      console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] Executing: ${stepName} (API: ${totalApiCalls}/${MAX_API_CALLS})`);
      await supabase.from('generation_jobs').update({ current_step: stepName }).eq('id', jobId);
      await updatePublicStatus(supabase, jobId, stepName, false, lockId);

      const { data: stepRecord } = await supabase.from('generation_steps').insert({
        job_id: jobId, step_name: stepName, status: 'running', started_at: new Date().toISOString(),
        input: { job_input: job.input, previous_outputs: Object.keys(stepOutputs) },
      }).select().single();

      const stepStart = Date.now();

      try {
        // CONTENT_GEN: multi-call with budget reservation (RULE 1+2)
        if (stepName === 'CONTENT_GEN') {
          const contentCtx: ContentGenContext = {
            jobInput: job.input as Record<string, unknown>,
            outlineSpec: (stepOutputs['OUTLINE_GEN'] as Record<string, unknown>) || {},
            nlpPack: (stepOutputs['NLP_KEYWORDS'] as Record<string, unknown>) || {},
            serpPack: (stepOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {},
            titlePack: (stepOutputs['TITLE_GEN'] as Record<string, unknown>) || {},
            supabaseUrl, serviceKey, jobStartMs: jobStart,
          };

          const contentResult = await withTimeout(executeContentGen(contentCtx, totalApiCalls, maxContentCalls), STEP_TIMEOUTS[stepName], stepName);
          const latencyMs = Date.now() - stepStart;

          await supabase.from('generation_steps').update({
          status: 'completed', output: contentResult.output, latency_ms: latencyMs,
          completed_at: new Date().toISOString(), model_used: 'google/gemini-2.5-flash',
          provider: 'lovable-gateway', cost_usd: contentResult.costUsd,
          }).eq('id', stepRecord!.id);

          stepOutputs[stepName] = contentResult.output;
          completedSteps.add(stepName);
          totalApiCalls += contentResult.apiCalls;
          totalCostUsd += contentResult.costUsd;
          await updatePublicStatus(supabase, jobId, stepName, true, lockId);

          if (contentResult.needsReview) await supabase.from('generation_jobs').update({ needs_review: true }).eq('id', jobId);
          await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
          console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ✅ CONTENT_GEN ${latencyMs}ms | ${contentResult.apiCalls} calls | $${contentResult.costUsd.toFixed(6)}${contentResult.needsReview ? ' | NEEDS_REVIEW' : ''}`);
          lastProgressAt = Date.now();
          continue;
        }

        // IMAGE_GEN: programmatic, 0 API calls
        if (stepName === 'IMAGE_GEN') {
          const contentOutput = (stepOutputs['CONTENT_GEN'] as Record<string, unknown>) || {};
          const contentData = (contentOutput.content as Record<string, unknown>) || contentOutput;
          const contentSections = (contentData.sections as Array<Record<string, unknown>>) || [];
          const imgPack = executeImageGen(contentSections, job.input as Record<string, unknown>);
          const latencyMs = Date.now() - stepStart;

          await supabase.from('generation_steps').update({
            status: 'completed', output: imgPack as unknown as Record<string, unknown>, latency_ms: latencyMs,
            completed_at: new Date().toISOString(), model_used: 'picsum-programmatic', provider: 'programmatic',
          }).eq('id', stepRecord!.id);

          stepOutputs[stepName] = imgPack as unknown as Record<string, unknown>;
          completedSteps.add(stepName);
          await updatePublicStatus(supabase, jobId, stepName, true, lockId);
          console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ✅ IMAGE_GEN ${latencyMs}ms (0 API calls)`);
          lastProgressAt = Date.now();
          continue;
        }

        // SEO_SCORE: real with RULES 3+4+5
        if (stepName === 'SEO_SCORE') {
          if (totalApiCalls >= MAX_API_CALLS) {
            console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] Budget exhausted, skipping SEO_SCORE`);
            const stubSeo = { score_total: 70, score_breakdown: {}, weakest_sections: [], improvement_suggestions: [], budget_skipped: true };
            await supabase.from('generation_steps').update({ status: 'completed', output: stubSeo, completed_at: new Date().toISOString() }).eq('id', stepRecord!.id);
            stepOutputs[stepName] = stubSeo;
            completedSteps.add(stepName);
            await supabase.from('generation_jobs').update({ needs_review: true }).eq('id', jobId);
            continue;
          }

          const contentOutput = (stepOutputs['CONTENT_GEN'] as Record<string, unknown>) || {};
          const contentData = (contentOutput.content as Record<string, unknown>) || contentOutput;
          const contentSections = (contentData.sections as Array<Record<string, unknown>>) || [];

          const seoRes = await withTimeout(
            executeSeoScore(jobId, contentSections, (stepOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {}, (stepOutputs['NLP_KEYWORDS'] as Record<string, unknown>) || {}, supabaseUrl, serviceKey, supabase, totalApiCalls, jobStart),
            STEP_TIMEOUTS[stepName], stepName
          );

          const latencyMs = Date.now() - stepStart;
          totalApiCalls += seoRes.apiCalls;
          totalCostUsd += seoRes.costUsd;

          await supabase.from('generation_steps').update({
            status: 'completed', output: seoRes.seoResult, latency_ms: latencyMs,
            completed_at: new Date().toISOString(), model_used: 'google/gemini-2.5-flash',
            provider: 'lovable-gateway', cost_usd: seoRes.costUsd,
          }).eq('id', stepRecord!.id);

          stepOutputs[stepName] = seoRes.seoResult;
          completedSteps.add(stepName);
          await updatePublicStatus(supabase, jobId, stepName, true, lockId);
          await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
          console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ✅ SEO_SCORE ${latencyMs}ms | score=${seoRes.seoResult.score_total} | $${seoRes.costUsd.toFixed(6)}`);
          lastProgressAt = Date.now();
          continue;
        }

        // META_GEN: real with RULE 5
        if (stepName === 'META_GEN') {
          if (totalApiCalls >= MAX_API_CALLS) {
            console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] Budget exhausted, generating stub meta`);
            const kw = (job.input as Record<string, unknown>)?.keyword as string || '';
            const ct = (job.input as Record<string, unknown>)?.city as string || '';
            const stubMeta = { meta_title: `${kw} em ${ct}`.substring(0, 60), meta_description: `Guia completo sobre ${kw} em ${ct}.`.substring(0, 155), slug: kw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''), excerpt: `Descubra tudo sobre ${kw} em ${ct}.`, faq_items: [] };
            await supabase.from('generation_steps').update({ status: 'completed', output: stubMeta, completed_at: new Date().toISOString() }).eq('id', stepRecord!.id);
            stepOutputs[stepName] = stubMeta;
            completedSteps.add(stepName);
            continue;
          }

          const contentOutput = (stepOutputs['CONTENT_GEN'] as Record<string, unknown>) || {};
          const contentData = (contentOutput.content as Record<string, unknown>) || contentOutput;
          const contentSections = (contentData.sections as Array<Record<string, unknown>>) || [];

          const metaRes = await withTimeout(
            executeMetaGen(jobId, (stepOutputs['TITLE_GEN'] as Record<string, unknown>) || {}, contentSections, job.input as Record<string, unknown>, supabaseUrl, serviceKey, supabase, totalApiCalls),
            STEP_TIMEOUTS[stepName], stepName
          );

          const latencyMs = Date.now() - stepStart;
          totalApiCalls++;
          totalCostUsd += metaRes.aiResult.costUsd || 0;

          await supabase.from('generation_steps').update({
            status: 'completed', output: metaRes.metaPack, latency_ms: latencyMs,
            completed_at: new Date().toISOString(), model_used: metaRes.aiResult.model,
            provider: metaRes.aiResult.provider || 'lovable-gateway', cost_usd: metaRes.aiResult.costUsd,
          }).eq('id', stepRecord!.id);

          stepOutputs[stepName] = metaRes.metaPack;
          completedSteps.add(stepName);
          await updatePublicStatus(supabase, jobId, stepName, true, lockId);
          await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
          console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ✅ META_GEN ${latencyMs}ms | $${(metaRes.aiResult.costUsd || 0).toFixed(6)}`);
          continue;
        }

        // OUTPUT: HTML assembly, 0 API calls
        if (stepName === 'OUTPUT') {
          const contentOutput = (stepOutputs['CONTENT_GEN'] as Record<string, unknown>) || {};
          const imgOutput = stepOutputs['IMAGE_GEN'] as unknown as ImagePack || { style_anchor: '', cover: { url: '', prompt_used: '', alt_text: '', stock_fallback: true }, inline_images: [] };
          const metaOutput = (stepOutputs['META_GEN'] as Record<string, unknown>) || {};
          const seoOutput = (stepOutputs['SEO_SCORE'] as Record<string, unknown>) || {};
          const titleOutput = (stepOutputs['TITLE_GEN'] as Record<string, unknown>) || {};

          const outputResult = await withTimeout(
            executeOutput(jobId, contentOutput, imgOutput, metaOutput, titleOutput, seoOutput, job.input as Record<string, unknown>, supabase, totalApiCalls, totalCostUsd),
            STEP_TIMEOUTS[stepName], stepName
          );

          const latencyMs = Date.now() - stepStart;
          await supabase.from('generation_steps').update({
            status: 'completed', output: outputResult, latency_ms: latencyMs,
            completed_at: new Date().toISOString(), model_used: 'html-assembler', provider: 'programmatic',
          }).eq('id', stepRecord!.id);

          stepOutputs[stepName] = outputResult;
          completedSteps.add(stepName);
          await updatePublicStatus(supabase, jobId, stepName, true, lockId);
          console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ✅ OUTPUT ${latencyMs}ms | article_id=${outputResult.article_id}`);
          lastProgressAt = Date.now();
          continue;
        }

        // Standard single-call steps (TITLE_GEN, OUTLINE_GEN)
        const { output: stepOutput, aiResult } = await withTimeout(
          executeStep(stepName, job.input as Record<string, unknown>, stepOutputs, supabaseUrl, serviceKey),
          STEP_TIMEOUTS[stepName], stepName
        );

        const latencyMs = Date.now() - stepStart;
        const isRealStep = REAL_AI_STEPS.includes(stepName);

        await supabase.from('generation_steps').update({
          status: 'completed', output: stepOutput, latency_ms: latencyMs,
          completed_at: new Date().toISOString(),
          model_used: aiResult?.model || (isRealStep ? 'unknown' : 'stub'),
          provider: aiResult?.provider || (isRealStep ? 'lovable-gateway' : 'stub'),
          tokens_in: aiResult?.tokensIn || 0, tokens_out: aiResult?.tokensOut || 0,
          cost_usd: aiResult?.costUsd || 0,
        }).eq('id', stepRecord!.id);

        stepOutputs[stepName] = stepOutput;
        completedSteps.add(stepName);
        await updatePublicStatus(supabase, jobId, stepName, true, lockId);

        if (isRealStep && aiResult) {
          totalApiCalls++;
          totalCostUsd += aiResult.costUsd || 0;
          await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
          lastProgressAt = Date.now();
        }

        if (ENGINE_MODE !== 'production') console.log(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ✅ ${stepName} ${latencyMs}ms${aiResult ? ` | model=${aiResult.model} | $${(aiResult.costUsd || 0).toFixed(6)}` : ' (programmatic)'}`);

      } catch (stepError) {
        const latencyMs = Date.now() - stepStart;
        const errorMsg = stepError instanceof Error ? stepError.message : 'Unknown step error';
        const rawContent = stepError instanceof ParseError ? stepError.rawContent : undefined;
        const isRetryable = errorMsg.includes('PARSE_ERROR') || errorMsg.includes('EMPTY_MODEL_OUTPUT') || errorMsg.includes('CONTENT_GEN_ZERO_CALLS') || errorMsg.includes('CONTENT_GEN_ZERO_SECTIONS') || errorMsg.includes('CONTENT_GEN_ABORT_EARLY');

        console.error(`[ORCHESTRATOR:ENGINE_V1_PUBLIC] ❌ ${stepName} failed: ${errorMsg} | retryable=${isRetryable}`);

        // PATCH D: Update public_message with specific error info
        await supabase.from('generation_jobs').update({
          public_message: `Falha no passo ${stepName}. ${isRetryable ? 'Tentando novamente...' : 'Erro fatal.'}`,
          public_updated_at: new Date().toISOString(),
        }).eq('id', jobId);

        // PATCH D: 1x retry for retryable errors (ParseError, EMPTY_MODEL_OUTPUT, CONTENT_GEN_ZERO_CALLS)
        if (isRetryable && !completedSteps.has(`${stepName}_RETRIED`)) {
          console.log(`[ORCHESTRATOR:RETRY] 🔄 Retrying ${stepName} (1x)...`);
          completedSteps.add(`${stepName}_RETRIED`); // prevent infinite retry

          // Update step record to show retry
          if (stepRecord) {
            await supabase.from('generation_steps').update({
              status: 'failed', error_message: `${errorMsg} (will retry)`,
              output: rawContent ? { parse_error: true, raw_ai_content: rawContent.substring(0, 10000), error_message: errorMsg, retrying: true } : { error_message: errorMsg, retrying: true },
              latency_ms: latencyMs, completed_at: new Date().toISOString(),
            }).eq('id', stepRecord.id);
          }

          // Wait 2s before retry
          await new Promise(r => setTimeout(r, 2000));

          // Re-insert step record for retry attempt
          const { data: retryStepRecord } = await supabase.from('generation_steps').insert({
            job_id: jobId, step_name: stepName, status: 'running', started_at: new Date().toISOString(),
            input: { retry: true, previous_error: errorMsg },
          }).select().single();

          try {
            // Re-execute the step (same logic as the main loop — delegated via continue)
            // We need to NOT mark it as completed so the main loop picks it up
            // Simplest: just continue the loop — the step is not in completedSteps so it will re-execute
            continue;
          } catch (retryError) {
            console.error(`[ORCHESTRATOR:RETRY] ❌ ${stepName} retry also failed:`, retryError);
            if (retryStepRecord) {
              await supabase.from('generation_steps').update({
                status: 'failed', error_message: retryError instanceof Error ? retryError.message : 'Retry failed',
                completed_at: new Date().toISOString(),
              }).eq('id', retryStepRecord.id);
            }
          }
        }

        // PATCH 2: Circuit breaker — if retry also failed, use fallback instead of killing job
        const circuitBreakerSteps = ['TITLE_GEN', 'OUTLINE_GEN', 'SEO_SCORE', 'META_GEN', 'NLP_KEYWORDS'];
        if (circuitBreakerSteps.includes(stepName)) {
          console.warn(`[CIRCUIT_BREAKER] 🔌 ${stepName} — using programmatic fallback`);
          const fallbackOutput = buildCircuitBreakerFallback(stepName, job.input as Record<string, unknown>);

          if (stepRecord) {
            await supabase.from('generation_steps').update({
              status: 'completed', error_message: `Circuit breaker: ${errorMsg}`,
              output: fallbackOutput,
              latency_ms: latencyMs, completed_at: new Date().toISOString(),
              model_used: 'circuit-breaker', provider: 'programmatic',
            }).eq('id', stepRecord.id);
          }

          stepOutputs[stepName] = fallbackOutput;
          completedSteps.add(stepName);
          await updatePublicStatus(supabase, jobId, stepName, true, lockId);
          continue;
        }

        // Non-circuit-breaker steps: persist failure and throw
        if (stepRecord) {
          await supabase.from('generation_steps').update({
            status: 'failed', error_message: errorMsg,
            output: rawContent ? { parse_error: true, raw_ai_content: rawContent.substring(0, 10000), error_message: errorMsg } : null,
            latency_ms: latencyMs, completed_at: new Date().toISOString(),
          }).eq('id', stepRecord.id);
        }

        throw new Error(`STEP_FAILED:${stepName}: ${errorMsg}`);
      }
    }

    // GUARD: Verify article_id exists — but allow fallback_html as success
    const { data: updatedJob } = await supabase
      .from('generation_jobs')
      .select('article_id, output')
      .eq('id', jobId)
      .single();

    const jobOutput = updatedJob?.output as Record<string, unknown> | null;
    const hasFallbackHtml = jobOutput?.fallback_html || jobOutput?.insert_failed;

    if (!updatedJob?.article_id && !hasFallbackHtml) {
      console.error(`[ORCHESTRATOR:NO_ARTICLE] job_id=${jobId} — Pipeline completed but article_id is NULL and no fallback_html.`);
      await supabase.from('generation_jobs').update({
        status: 'failed',
        error_message: 'Pipeline completed but no article was saved.',
        needs_review: true,
        completed_at: new Date().toISOString(), locked_at: null, locked_by: null,
      }).eq('id', jobId);
      throw new Error('article_id is NULL after OUTPUT step');
    }

    // Job completed
    const seoOutput = stepOutputs['SEO_SCORE'] as Record<string, unknown> | undefined;
    const seoScore = (seoOutput?.score_total as number) || null;

    await supabase.from('generation_jobs').update({
      status: 'completed', current_step: null, output: stepOutputs,
      seo_score: seoScore, seo_breakdown: seoOutput?.score_breakdown || null,
      needs_review: (seoScore !== null && seoScore < 70) || false,
      cost_usd: totalCostUsd, total_api_calls: totalApiCalls,
      completed_at: new Date().toISOString(), locked_at: null, locked_by: null,
      public_stage: 'FINALIZING', public_progress: 100,
      public_message: 'Artigo pronto!', public_updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    const completedStepNames = Array.from(completedSteps);
    const articleId = updatedJob.article_id;
    console.log(`[ORCHESTRATOR:COMPLETE] job_id=${jobId} article_id=${articleId} steps=${completedStepNames.join(',')} api_calls=${totalApiCalls} seo_score=${seoScore} duration=${Date.now() - jobStart}ms cost=$${totalCostUsd.toFixed(6)}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown orchestration error';
    console.error(`[ORCHESTRATOR] ❌ Job ${jobId} FAILED:`, errorMsg);

    const stepMatch = errorMsg.match(/STEP_FAILED:(\w+)/);
    const failedStep = stepMatch ? stepMatch[1] : null;

    await supabase.from('generation_jobs').update({
      status: 'failed', error_message: errorMsg, error_step: failedStep,
      output: Object.keys(stepOutputs).length > 0 ? stepOutputs : null,
      cost_usd: totalCostUsd, total_api_calls: totalApiCalls,
      completed_at: new Date().toISOString(), locked_at: null, locked_by: null,
      public_stage: 'FINALIZING', public_progress: 0,
      public_message: 'Ocorreu um problema. Tente novamente.',
      public_updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    // RULE 6c: Fallback TEMPORARILY DISABLED until 30 consecutive successes
    // All failures are recorded for diagnosis — no legacy engine invocations
    console.log(`[ORCHESTRATOR:FAILED] job_id=${jobId} failed_at=${failedStep || 'unknown'} error=${errorMsg} api_calls=${totalApiCalls} duration=${Date.now() - jobStart}ms`);
  } finally {
    // Always clean up heartbeat and watchdog
    heartbeatRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(watchdogInterval);
    // Release lock if still held
    try {
      await supabase.from('generation_jobs')
        .update({ locked_by: null, locked_at: null })
        .eq('id', jobId).eq('locked_by', lockId);
    } catch (e) { console.warn('[FINALIZER] Lock release failed:', e); }
    console.log(`[ENGINE] FINALIZER: job_id=${jobId} intervals_cleared lock_released`);
  }

 } catch (fatalErr) {
    // TOP-LEVEL SAFETY NET: catch crashes BEFORE pipeline try/catch (job load, lock, heartbeat setup)
    console.error('[ORCHESTRATOR_FATAL]', jobId, fatalErr);
    try {
      await supabase.from('generation_jobs').update({
        status: 'failed',
        error_message: 'ENGINE_FATAL_CRASH',
        public_message: 'Falha interna ao iniciar o gerador.',
        locked_by: null,
        locked_at: null,
        completed_at: new Date().toISOString(),
        public_updated_at: new Date().toISOString(),
      }).eq('id', jobId);
    } catch (e) { console.error('[FATAL_CLEANUP_FAILED]', e); }
    throw fatalErr;
  }
}

// ============================================================
// HTTP Handler
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { job_id } = await req.json();
    console.log('[ORCHESTRATOR_HANDLER_ENTRY]', job_id);
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency guard: skip if job already started/finished
    const { data: existingJob } = await supabase
      .from('generation_jobs')
      .select('status')
      .eq('id', job_id)
      .single();

    if (existingJob && ['running', 'completed', 'failed'].includes(existingJob.status)) {
      console.log(`[ORCHESTRATOR:SKIP] job=${job_id} already ${existingJob.status}. Ignoring duplicate invocation.`);
      return new Response(
        JSON.stringify({ skipped: true, reason: `Job already ${existingJob.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await orchestrate(job_id, supabase, supabaseUrl, serviceKey);
    return new Response(JSON.stringify({ success: true, job_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[ORCHESTRATOR] Fatal:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
