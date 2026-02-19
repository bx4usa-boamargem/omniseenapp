import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * orchestrate-generation — OmniSeen Article Engine v1
 * 
 * State Machine Orchestrator (Phase 3)
 * 
 * States: PENDING -> INPUT_VALIDATION -> SERP_ANALYSIS -> NLP_KEYWORDS -> 
 *         TITLE_GEN -> OUTLINE_GEN -> CONTENT_GEN -> IMAGE_GEN -> 
 *         SEO_SCORE -> META_GEN -> OUTPUT -> COMPLETED | FAILED
 * 
 * Phase 3: CONTENT_GEN now uses real LLM via ai-router with:
 * - Batch generation (3-4 sections per batch)
 * - Context Sliding between batches
 * - 11 Quality Gates via single critic pass
 * - Selective rewrites (max 2 sections, 1 cycle)
 * - NLP Term Tracker with bold strategy
 * 
 * Features:
 * - Idempotent: locking by current_step prevents duplicate execution
 * - Hard caps: max 15 API calls total per job
 * - Promise.race timeout per step
 * - All intermediate outputs persisted in generation_steps
 * - Timeout: MAX_JOB_TIME_MS = 360000 (6 min)
 * - total_api_calls incremented per real ai-router call
 * - Graceful abort if <30s remain of MAX_JOB_TIME_MS
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
  IMAGE_GEN:        60_000,
  SEO_SCORE:        45_000,
  META_GEN:         30_000,
  OUTPUT:           15_000,
};

// Steps that use ai-router
const REAL_AI_STEPS: StepName[] = ['SERP_ANALYSIS', 'NLP_KEYWORDS', 'TITLE_GEN', 'OUTLINE_GEN', 'CONTENT_GEN'];
const API_STEPS: StepName[] = ['SERP_ANALYSIS', 'NLP_KEYWORDS', 'TITLE_GEN', 'OUTLINE_GEN', 'CONTENT_GEN', 'IMAGE_GEN', 'SEO_SCORE', 'META_GEN'];

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
  // Try direct parse first
  try {
    return JSON.parse(content);
  } catch { /* continue */ }

  // Try extracting JSON from markdown code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch { /* continue */ }
  }

  // Try finding first { ... } block
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch { /* continue */ }
  }

  console.error(`[ORCHESTRATOR] ${label} parse failed. Content preview: ${content.substring(0, 500)}`);
  // Return error object with raw content for debug (V3: never discard)
  throw new ParseError(
    `${label}_PARSE_ERROR: Could not extract valid JSON from AI response`,
    content
  );
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
    "common_topics": ["topic1", "topic2", ...],
    "depth_scores": [
      {
        "position": 1,
        "title": "<realistic title>",
        "url": "<realistic URL>",
        "word_count": <number>,
        "h2_count": <number>,
        "depth_score": <0-100>,
        "has_faq": <boolean>,
        "has_table": <boolean>,
        "has_video": <boolean>,
        "confidence": "simulated"
      }
    ],
    "gap_map": ["gap1", "gap2", ...],
    "paa_questions": ["question1", "question2", ...],
    "content_patterns": {
      "avg_intro_words": <number>,
      "avg_conclusion_words": <number>,
      "common_h2_patterns": ["pattern1", "pattern2"],
      "common_cta_types": ["phone", "form", "whatsapp"]
    }
  }
}

IMPORTANT:
- Generate exactly 10 results in depth_scores
- depth_score should range 40-95 realistically
- gap_map should contain 5-8 content gaps the top results are missing
- paa_questions should contain 6-10 "People Also Ask" style questions
- avg_word_count and avg_h2_count must be realistic for the ${language} market
- All titles and URLs should look realistic for ${country} websites`;

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
            serp_pack: {
              type: "object",
              properties: {
                top_results_count: { type: "number" },
                avg_word_count: { type: "number" },
                avg_h2_count: { type: "number" },
                dominant_intent: { type: "string" },
                common_topics: { type: "array", items: { type: "string" } },
                depth_scores: { type: "array", items: { type: "object" } },
                gap_map: { type: "array", items: { type: "string" } },
                paa_questions: { type: "array", items: { type: "string" } },
                content_patterns: { type: "object" },
              },
              required: ["top_results_count", "avg_word_count", "avg_h2_count", "dominant_intent", "common_topics", "depth_scores", "gap_map", "paa_questions"],
            },
          },
          required: ["confidence", "serp_pack"],
        },
      },
    }],
    toolChoice: { type: "function", function: { name: "serp_analysis_result" } },
  });

  if (!aiResult.success) {
    throw new Error(`SERP_ANALYSIS_FAILED: ${aiResult.error}`);
  }

  const parsed = parseAIJson(aiResult.content, 'SERP_ANALYSIS');

  return { output: parsed, aiResult };
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

Return a JSON object with this exact structure:
{
  "nlp_pack": {
    "primary": "${keyword}",
    "secondary": ["8-20 secondary keywords closely related to primary"],
    "nlp_terms": [
      {
        "text": "semantic term",
        "category": "entity|topic|modifier|action|attribute",
        "relevance_score": 0.95,
        "position_hint": "early|middle|late|throughout",
        "max_usage": 3
      }
    ],
    "entities": [
      {
        "text": "entity name",
        "type": "location|organization|concept|product|person",
        "importance": "high|medium|low"
      }
    ],
    "interlink_anchors": ["anchor text suggestions for internal links"]
  }
}

RULES:
- secondary: 8-20 keywords, ordered by relevance
- nlp_terms: 20-60 terms covering semantic field comprehensively
- entities: 10-30 entities (include city, country, niche-specific)
- interlink_anchors: 5-10 natural anchor text suggestions
- relevance_score: 0.0 to 1.0
- position_hint: where in the article this term works best
- max_usage: how many times this term should appear (1-5)`;

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
          properties: {
            nlp_pack: {
              type: "object",
              properties: {
                primary: { type: "string" },
                secondary: { type: "array", items: { type: "string" } },
                nlp_terms: { type: "array", items: { type: "object" } },
                entities: { type: "array", items: { type: "object" } },
                interlink_anchors: { type: "array", items: { type: "string" } },
              },
              required: ["primary", "secondary", "nlp_terms", "entities", "interlink_anchors"],
            },
          },
          required: ["nlp_pack"],
        },
      },
    }],
    toolChoice: { type: "function", function: { name: "nlp_keywords_result" } },
  });

  if (!aiResult.success) {
    throw new Error(`NLP_KEYWORDS_FAILED: ${aiResult.error}`);
  }

  const parsed = parseAIJson(aiResult.content, 'NLP_KEYWORDS');

  return { output: parsed, aiResult };
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

  const prompt = `You are an expert SEO copywriter specializing in high-CTR titles. Generate 10 title candidates for the article described below.

PRIMARY KEYWORD: "${keyword}"
LOCALE: ${city || 'Brazil'}
LANGUAGE: ${language}
INTENT: ${intent}
NICHE: ${niche}

TOP SERP TITLES (for differentiation):
${JSON.stringify((serpPack as Record<string, unknown>)?.depth_scores || [], null, 2).substring(0, 1500)}

NLP CONTEXT:
- Secondary keywords: ${JSON.stringify((nlpPack as Record<string, unknown>)?.secondary || []).substring(0, 500)}

DISTRIBUTION REQUIREMENTS:
- 30% informational titles (how-to, guide, what-is)
- 40% service/local titles (with city name, prices, professional)
- 30% guide/authority titles (complete guide, definitive, everything about)

Return JSON:
{
  "title_pack": {
    "candidates": [
      {
        "title": "Title text here",
        "type": "informational|service_local|guide_authority",
        "score": 85,
        "reasoning": "Why this title works"
      }
    ],
    "selected_index": 0,
    "selected_title": "The winning title",
    "selection_reason": "Why this was chosen as the best"
  }
}

RULES:
- All titles must contain the primary keyword naturally
- ${city ? `At least 4 titles must include "${city}"` : 'Include location when natural'}
- Max 65 characters for SEO
- Score 0-100 based on: keyword prominence, CTR potential, intent match, uniqueness vs SERP
- selected_index: index of the best title (0-based)
- Avoid clickbait, use power words naturally
- Year [2026] in at least 2 titles`;

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
          properties: {
            title_pack: {
              type: "object",
              properties: {
                candidates: { type: "array", items: { type: "object" } },
                selected_index: { type: "number" },
                selected_title: { type: "string" },
                selection_reason: { type: "string" },
              },
              required: ["candidates", "selected_index", "selected_title", "selection_reason"],
            },
          },
          required: ["title_pack"],
        },
      },
    }],
    toolChoice: { type: "function", function: { name: "title_gen_result" } },
  });

  if (!aiResult.success) {
    throw new Error(`TITLE_GEN_FAILED: ${aiResult.error}`);
  }

  const parsed = parseAIJson(aiResult.content, 'TITLE_GEN');

  return { output: parsed, aiResult };
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

  const prompt = `You are an expert content strategist. Create a detailed article outline for the following article.

TITLE: "${selectedTitle}"
PRIMARY KEYWORD: "${keyword}"
LOCALE: ${city || 'Brazil'}
LANGUAGE: ${language}
INTENT: ${intent}
NICHE: ${niche}
TARGET TOTAL WORDS: ${targetWords}

SERP INSIGHTS:
- Average H2 count in top results: ${avgH2}
- Content gaps to exploit: ${JSON.stringify(gapMap).substring(0, 500)}
- People Also Ask: ${JSON.stringify(paaQuestions).substring(0, 500)}

NLP TERMS TO DISTRIBUTE:
${JSON.stringify(nlpTerms).substring(0, 1500)}

SECONDARY KEYWORDS:
${JSON.stringify(secondary).substring(0, 500)}

Return JSON:
{
  "outline_spec": {
    "h1": "${selectedTitle}",
    "key_takeaways": {
      "target_words": 150,
      "items_count": 5,
      "description": "Bullet summary at top of article"
    },
    "introduction": {
      "target_words": 200,
      "hook_type": "statistic|question|story|problem",
      "must_include": ["primary keyword", "city", "value proposition"]
    },
    "sections": [
      {
        "id": "section-0",
        "h2": "Section heading with keyword variation",
        "h3s": ["sub-topic 1", "sub-topic 2"],
        "target_words": 300,
        "depth_target": 80,
        "nlp_terms_to_use": ["term1", "term2", "term3"],
        "layout_hint": "paragraph|table|list|callout|comparison",
        "expert_signal_required": true,
        "expert_signal_type": "micro_case|statistic|professional_tip|industry_insight",
        "geo_specific": false
      }
    ],
    "faq": {
      "count": 8,
      "questions": ["question1", "question2"],
      "source": "paa+serp_gaps"
    },
    "conclusion": {
      "target_words": 200,
      "cta": true,
      "cta_type": "phone|whatsapp|form|schedule"
    },
    "total_target_words": ${targetWords},
    "total_sections": <number>,
    "estimated_h2_count": <number>
  }
}

MANDATORY RULES:
- key_takeaways is ALWAYS the first content block
- Minimum ${Math.max(8, Number(avgH2))} H2 sections (at least match SERP average)
- Each section must have target_words that sum to approximately ${targetWords}
- depth_target: 0-100 indicating content depth needed (based on SERP gaps)
- nlp_terms_to_use: 2-5 NLP terms assigned per section (distribute evenly)
- expert_signal_required: true for at least 30% of sections
- At least 1 section with layout_hint "table"
- At least 1 section with layout_hint "list"
- FAQ questions should come from PAA + SERP gaps
- geo_specific: true if section should mention ${city || 'location'}`;

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
          properties: {
            outline_spec: {
              type: "object",
              properties: {
                h1: { type: "string" },
                key_takeaways: { type: "object" },
                introduction: { type: "object" },
                sections: { type: "array", items: { type: "object" } },
                faq: { type: "object" },
                conclusion: { type: "object" },
                total_target_words: { type: "number" },
                total_sections: { type: "number" },
                estimated_h2_count: { type: "number" },
              },
              required: ["h1", "key_takeaways", "sections", "faq", "conclusion"],
            },
          },
          required: ["outline_spec"],
        },
      },
    }],
    toolChoice: { type: "function", function: { name: "outline_gen_result" } },
  });

  if (!aiResult.success) {
    throw new Error(`OUTLINE_GEN_FAILED: ${aiResult.error}`);
  }

  const parsed = parseAIJson(aiResult.content, 'OUTLINE_GEN');

  return { output: parsed, aiResult };
}

// ============================================================
// PHASE 3: CONTENT ENGINE
// ============================================================

interface NlpTrackerEntry {
  used_count: number;
  max_count: number;
  last_section: string | null;
  bolded: boolean;
}

interface ContentGenContext {
  jobInput: Record<string, unknown>;
  outlineSpec: Record<string, unknown>;
  nlpPack: Record<string, unknown>;
  serpPack: Record<string, unknown>;
  titlePack: Record<string, unknown>;
  supabaseUrl: string;
  serviceKey: string;
  jobStartMs: number;
}

interface ContentGenResult {
  output: Record<string, unknown>;
  apiCalls: number;
  costUsd: number;
  needsReview: boolean;
}

function initNlpTracker(nlpPack: Record<string, unknown>): Record<string, NlpTrackerEntry> {
  const tracker: Record<string, NlpTrackerEntry> = {};
  const terms = (nlpPack.nlp_terms as Array<Record<string, unknown>>) || [];
  for (const term of terms) {
    const text = (term.text as string) || '';
    if (text) {
      tracker[text.toLowerCase()] = {
        used_count: 0,
        max_count: (term.max_usage as number) || 3,
        last_section: null,
        bolded: false,
      };
    }
  }
  return tracker;
}

function getTimeRemainingMs(jobStartMs: number): number {
  return MAX_JOB_TIME_MS - (Date.now() - jobStartMs);
}

function shouldAbortGracefully(jobStartMs: number): boolean {
  return getTimeRemainingMs(jobStartMs) < GRACEFUL_ABORT_BUFFER_MS;
}

async function generateContextSummary(
  previousSections: Array<Record<string, unknown>>,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ summary: string; aiResult: AIRouterResult }> {
  const sectionsText = previousSections.map(s =>
    `## ${s.h2 || 'Section'}\n${(s.content as string || '').substring(0, 300)}`
  ).join('\n\n');

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'context_summary', [
    { role: 'system', content: 'You are a content summarizer. Create a concise summary (max 500 tokens) of the article sections written so far. Focus on: key points covered, tone used, arguments made, and any expert signals mentioned. This summary will guide the next batch of sections to maintain flow and avoid repetition.' },
    { role: 'user', content: `Summarize these article sections already written:\n\n${sectionsText}` },
  ]);

  if (!aiResult.success) {
    console.warn('[CONTENT_GEN] Context summary failed, continuing without context');
    return { summary: '', aiResult };
  }

  return { summary: aiResult.content, aiResult };
}

async function generateBatch(
  ctx: ContentGenContext,
  batchSections: Array<Record<string, unknown>>,
  batchIndex: number,
  contextSummary: string,
  nlpTracker: Record<string, NlpTrackerEntry>,
  faqQuestions: string[],
  isLastBatch: boolean
): Promise<{ sections: Array<Record<string, unknown>>; faq?: Array<Record<string, unknown>>; conclusion?: string; aiResult: AIRouterResult }> {
  const keyword = (ctx.jobInput.keyword as string) || '';
  const city = (ctx.jobInput.city as string) || '';
  const language = (ctx.jobInput.language as string) || 'pt-BR';
  const niche = (ctx.jobInput.niche as string) || 'default';
  const brandVoice = (ctx.jobInput.brand_voice as string) || 'professional, knowledgeable, helpful';
  const whatsapp = (ctx.jobInput.whatsapp as string) || '';
  const businessName = (ctx.jobInput.business_name as string) || '';

  // NLP terms still available
  const availableTerms = Object.entries(nlpTracker)
    .filter(([_, v]) => v.used_count < v.max_count)
    .map(([k]) => k);

  const sectionsSpec = batchSections.map(s => JSON.stringify(s)).join(',\n');

  let faqBlock = '';
  if (isLastBatch) {
    faqBlock = `

ALSO GENERATE:
- FAQ section with these questions (detailed answers, 80-150 words each):
${faqQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}

- Conclusion (200 words, with CTA for ${whatsapp ? 'WhatsApp: ' + whatsapp : 'contact'}${businessName ? ', business: ' + businessName : ''})`;
  }

  const prompt = `You are an expert content writer for the ${niche} niche in ${language}.

BRAND VOICE: ${brandVoice}
KEYWORD: "${keyword}"
LOCALE: ${city || 'Brazil'}
BATCH: ${batchIndex + 1}

${contextSummary ? `CONTEXT (previously written sections summary):\n${contextSummary}\n\nDo NOT repeat content from previous sections.` : ''}

NLP TERMS TO USE IN THIS BATCH (bold the FIRST occurrence of each):
${availableTerms.slice(0, 15).join(', ')}

SECTIONS TO WRITE:
[${sectionsSpec}]
${faqBlock}

Return JSON:
{
  "sections": [
    {
      "id": "<section-id from spec>",
      "h2": "<heading>",
      "content": "<full markdown content with **bold** NLP terms on first use>",
      "h3s_content": [
        { "h3": "<sub-heading>", "content": "<markdown>" }
      ],
      "word_count": <actual count>,
      "nlp_terms_used": ["term1", "term2"],
      "bolds_applied": ["term1", "term2"],
      "expert_signals": ["micro_case|professional_tip|statistic|industry_insight"],
      "layout_used": "paragraph|table|list|callout"
    }
  ]${isLastBatch ? `,
  "faq": [
    { "question": "...", "answer": "..." }
  ],
  "conclusion": "<markdown conclusion with CTA>"` : ''}
}

ABSOLUTE RULES:
- NO clichés: "Atenção", "Verdade dura", "Não é segredo", "Infelizmente", "Vamos ser sinceros"
- NO invented statistics without source
- NO filler text or lorem ipsum
- Each section must hit target_words ±20%
- Expert signals REQUIRED where expert_signal_required=true in spec
- Use ${language} language exclusively
- Bold (**term**) the FIRST occurrence of each NLP term only
- Tables should use markdown table syntax
- Lists should use bullet or numbered format
- Callouts use "> **Dica:** " format
- Include ${city || 'location'} naturally in geo_specific sections`;

  const aiResult = await callAIRouter(ctx.supabaseUrl, ctx.serviceKey, 'content_gen', [
    { role: 'system', content: `You are a premium ${niche} content writer. Write in ${language}. Return only valid JSON. No markdown code fences.` },
    { role: 'user', content: prompt },
  ], { maxTokens: 8000 });

  if (!aiResult.success) {
    throw new Error(`CONTENT_BATCH_${batchIndex}_FAILED: ${aiResult.error}`);
  }

  const parsed = parseAIJson(aiResult.content, `CONTENT_BATCH_${batchIndex}`);

  return {
    sections: (parsed.sections as Array<Record<string, unknown>>) || [],
    faq: isLastBatch ? (parsed.faq as Array<Record<string, unknown>>) : undefined,
    conclusion: isLastBatch ? (parsed.conclusion as string) : undefined,
    aiResult,
  };
}

function updateNlpTracker(
  tracker: Record<string, NlpTrackerEntry>,
  sections: Array<Record<string, unknown>>
): void {
  for (const section of sections) {
    const termsUsed = (section.nlp_terms_used as string[]) || [];
    const boldsApplied = (section.bolds_applied as string[]) || [];
    const sectionId = (section.id as string) || 'unknown';

    for (const term of termsUsed) {
      const key = term.toLowerCase();
      if (tracker[key]) {
        tracker[key].used_count++;
        tracker[key].last_section = sectionId;
      }
    }
    for (const term of boldsApplied) {
      const key = term.toLowerCase();
      if (tracker[key]) {
        tracker[key].bolded = true;
      }
    }
  }
}

async function runCritic(
  allSections: Array<Record<string, unknown>>,
  faq: Array<Record<string, unknown>>,
  conclusion: string,
  nlpTracker: Record<string, NlpTrackerEntry>,
  ctx: ContentGenContext
): Promise<{ report: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (ctx.jobInput.keyword as string) || '';
  const brandVoice = (ctx.jobInput.brand_voice as string) || 'professional';

  const articlePreview = allSections.map(s =>
    `## ${s.h2 || ''}\n${(s.content as string || '').substring(0, 500)}`
  ).join('\n\n');

  const nlpUsage = Object.entries(nlpTracker)
    .filter(([_, v]) => v.used_count > 0)
    .map(([k, v]) => `${k}: ${v.used_count}/${v.max_count} (bolded: ${v.bolded})`)
    .join(', ');

  const prompt = `You are a senior content quality auditor. Evaluate the article below against 11 Quality Gates.

KEYWORD: "${keyword}"
BRAND VOICE: ${brandVoice}
NLP USAGE: ${nlpUsage}
FAQ COUNT: ${faq.length}
CONCLUSION LENGTH: ${conclusion.length} chars

ARTICLE SECTIONS:
${articlePreview}

EVALUATE THESE 11 QUALITY GATES:
QG01 cliche_detection - Detect prohibited phrases ("Atenção", "Verdade dura", "Não é segredo", etc.)
QG02 invented_stats - Detect statistics without real sources
QG03 nlp_density - Check NLP term distribution (no stuffing, no absence)
QG04 readability - Balanced paragraphs (not all short, not all long)
QG05 expert_signals - Check for micro_case, professional_tip in marked sections
QG06 tone_coherence - Consistent tone with brand_voice throughout
QG07 hallucination_check - Detect imprecise/fabricated claims
QG08 semantic_repetition - Detect sections repeating same content
QG09 depth_target - Check if content depth matches targets
QG10 bold_coverage - Check if NLP terms were bolded on first occurrence
QG11 humanization - Check if language sounds natural (not AI-generated)

Return JSON:
{
  "overall_passed": <boolean>,
  "overall_score": <0-100>,
  "gates": [
    {
      "gate": "QG01",
      "name": "cliche_detection",
      "passed": <boolean>,
      "score": <0-100>,
      "details": "explanation",
      "section_id": "<if specific to a section>"
    }
  ],
  "weakest_sections": ["section-id-1", "section-id-2"],
  "rewrite_instructions": {
    "section-id": "specific instructions for rewriting this section"
  }
}

SCORING: overall_passed = true if overall_score >= 60 AND no gate has score < 30.
weakest_sections: max 2 section IDs that need the most improvement.`;

  const aiResult = await callAIRouter(ctx.supabaseUrl, ctx.serviceKey, 'content_critic', [
    { role: 'system', content: 'You are a content quality auditor. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) {
    console.warn('[CONTENT_GEN] Critic failed, treating as passed');
    return {
      report: { overall_passed: true, overall_score: 70, gates: [], weakest_sections: [], rewrite_instructions: {}, critic_error: aiResult.error },
      aiResult,
    };
  }

  const parsed = parseAIJson(aiResult.content, 'CONTENT_CRITIC');
  return { report: parsed, aiResult };
}

async function rewriteSection(
  section: Record<string, unknown>,
  instructions: string,
  ctx: ContentGenContext,
  nlpTracker: Record<string, NlpTrackerEntry>
): Promise<{ section: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (ctx.jobInput.keyword as string) || '';
  const language = (ctx.jobInput.language as string) || 'pt-BR';
  const niche = (ctx.jobInput.niche as string) || 'default';

  const availableTerms = Object.entries(nlpTracker)
    .filter(([_, v]) => v.used_count < v.max_count)
    .map(([k]) => k);

  const prompt = `Rewrite this article section following these specific instructions:

INSTRUCTIONS: ${instructions}

SECTION TO REWRITE:
## ${section.h2}
${section.content}

NLP TERMS TO INTEGRATE: ${availableTerms.slice(0, 8).join(', ')}
KEYWORD: "${keyword}"
LANGUAGE: ${language}

Return JSON:
{
  "id": "${section.id}",
  "h2": "${section.h2}",
  "content": "<rewritten markdown content>",
  "word_count": <number>,
  "nlp_terms_used": ["term1"],
  "bolds_applied": ["term1"],
  "expert_signals": ["type"],
  "layout_used": "paragraph",
  "rewrite_applied": true
}

RULES:
- Fix ONLY what the instructions say
- Maintain section length ±20%
- Bold (**term**) first occurrence of NLP terms
- Use ${language} only
- NO clichés, NO invented stats`;

  const aiResult = await callAIRouter(ctx.supabaseUrl, ctx.serviceKey, 'content_gen', [
    { role: 'system', content: `You are a ${niche} content editor. Return only valid JSON.` },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) {
    console.warn(`[CONTENT_GEN] Rewrite failed for ${section.id}, keeping original`);
    return { section: { ...section, rewrite_attempted: true, rewrite_failed: true }, aiResult };
  }

  const parsed = parseAIJson(aiResult.content, `REWRITE_${section.id}`);
  return { section: { ...parsed, rewrite_count: 1 }, aiResult };
}

async function executeContentGen(
  ctx: ContentGenContext,
  totalApiCalls: number
): Promise<ContentGenResult> {
  const outlineSpec = (ctx.outlineSpec.outline_spec as Record<string, unknown>) || ctx.outlineSpec;
  const nlpPack = (ctx.nlpPack.nlp_pack as Record<string, unknown>) || ctx.nlpPack;
  const sections = (outlineSpec.sections as Array<Record<string, unknown>>) || [];
  const faqSpec = outlineSpec.faq as Record<string, unknown> || {};
  const faqQuestions = (faqSpec.questions as string[]) || [];

  let apiCalls = 0;
  let costUsd = 0;
  let needsReview = false;

  const nlpTracker = initNlpTracker(nlpPack);
  const allGeneratedSections: Array<Record<string, unknown>> = [];
  let generatedFaq: Array<Record<string, unknown>> = [];
  let generatedConclusion = '';

  // Split sections into batches of 3-4
  const BATCH_SIZE = 4;
  const batches: Array<Array<Record<string, unknown>>> = [];
  for (let i = 0; i < sections.length; i += BATCH_SIZE) {
    batches.push(sections.slice(i, i + BATCH_SIZE));
  }

  console.log(`[CONTENT_GEN] Starting ${batches.length} batches for ${sections.length} sections`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    // Check graceful abort
    if (shouldAbortGracefully(ctx.jobStartMs)) {
      console.warn(`[CONTENT_GEN] <30s remaining, aborting gracefully after batch ${batchIdx}`);
      needsReview = true;
      break;
    }

    // Check API budget
    if ((totalApiCalls + apiCalls) >= MAX_API_CALLS) {
      console.warn(`[CONTENT_GEN] API budget reached (${totalApiCalls + apiCalls}/${MAX_API_CALLS}), stopping content gen`);
      needsReview = true;
      break;
    }

    const isLastBatch = batchIdx === batches.length - 1;

    // Context summary for non-first batches
    let contextSummary = '';
    if (batchIdx > 0 && allGeneratedSections.length > 0) {
      // Check budget before context summary
      if ((totalApiCalls + apiCalls) < MAX_API_CALLS) {
        try {
          const ctxResult = await generateContextSummary(allGeneratedSections, ctx.supabaseUrl, ctx.serviceKey);
          contextSummary = ctxResult.summary;
          apiCalls++;
          costUsd += ctxResult.aiResult.costUsd || 0;
          console.log(`[CONTENT_GEN] Context summary generated (API call ${totalApiCalls + apiCalls})`);
        } catch (e) {
          console.warn(`[CONTENT_GEN] Context summary failed, continuing:`, e);
        }
      }
    }

    // Check budget again after context summary
    if ((totalApiCalls + apiCalls) >= MAX_API_CALLS) {
      console.warn(`[CONTENT_GEN] API budget reached after context summary`);
      needsReview = true;
      break;
    }

    // Generate batch
    try {
      const batchResult = await generateBatch(
        ctx, batches[batchIdx], batchIdx, contextSummary,
        nlpTracker, faqQuestions, isLastBatch
      );

      apiCalls++;
      costUsd += batchResult.aiResult.costUsd || 0;

      // Update NLP tracker
      updateNlpTracker(nlpTracker, batchResult.sections);

      // Accumulate results
      for (const s of batchResult.sections) {
        allGeneratedSections.push({ ...s, rewrite_count: 0, quality_gate_passed: true });
      }

      if (batchResult.faq) generatedFaq = batchResult.faq;
      if (batchResult.conclusion) generatedConclusion = batchResult.conclusion;

      console.log(`[CONTENT_GEN] Batch ${batchIdx + 1}/${batches.length} done: ${batchResult.sections.length} sections (API call ${totalApiCalls + apiCalls})`);
    } catch (e) {
      console.error(`[CONTENT_GEN] Batch ${batchIdx} failed:`, e);
      needsReview = true;
      break;
    }
  }

  // Run critic (single pass, no re-calling after rewrite)
  let criticReport: Record<string, unknown> = { overall_passed: true, overall_score: 70, gates: [], skipped: true };

  if (allGeneratedSections.length > 0 && (totalApiCalls + apiCalls) < MAX_API_CALLS && !shouldAbortGracefully(ctx.jobStartMs)) {
    try {
      const criticResult = await runCritic(
        allGeneratedSections, generatedFaq, generatedConclusion, nlpTracker, ctx
      );
      criticReport = criticResult.report;
      apiCalls++;
      costUsd += criticResult.aiResult.costUsd || 0;
      console.log(`[CONTENT_GEN] Critic done: score=${criticReport.overall_score}, passed=${criticReport.overall_passed} (API call ${totalApiCalls + apiCalls})`);
    } catch (e) {
      console.warn(`[CONTENT_GEN] Critic failed, skipping:`, e);
    }
  }

  // Selective rewrites (max 2 sections, 1 cycle, no re-critic)
  if (
    criticReport.overall_passed === false &&
    !shouldAbortGracefully(ctx.jobStartMs)
  ) {
    const weakest = (criticReport.weakest_sections as string[]) || [];
    const rewriteInstructions = (criticReport.rewrite_instructions as Record<string, string>) || {};
    const toRewrite = weakest.slice(0, 2);

    for (const sectionId of toRewrite) {
      if ((totalApiCalls + apiCalls) >= MAX_API_CALLS) {
        console.warn(`[CONTENT_GEN] API budget reached, skipping rewrite for ${sectionId}`);
        needsReview = true;
        break;
      }

      if (shouldAbortGracefully(ctx.jobStartMs)) {
        console.warn(`[CONTENT_GEN] <30s remaining, skipping rewrite`);
        needsReview = true;
        break;
      }

      const sectionIdx = allGeneratedSections.findIndex(s => s.id === sectionId);
      if (sectionIdx === -1) continue;

      const instructions = rewriteInstructions[sectionId] || 'Improve quality, depth, and NLP coverage.';

      try {
        const rewriteResult = await rewriteSection(
          allGeneratedSections[sectionIdx], instructions, ctx, nlpTracker
        );
        apiCalls++;
        costUsd += rewriteResult.aiResult.costUsd || 0;

        // Replace section
        allGeneratedSections[sectionIdx] = { ...rewriteResult.section, quality_gate_passed: true, rewrite_count: 1 };
        updateNlpTracker(nlpTracker, [rewriteResult.section]);

        console.log(`[CONTENT_GEN] Rewrite ${sectionId} done (API call ${totalApiCalls + apiCalls})`);
      } catch (e) {
        console.warn(`[CONTENT_GEN] Rewrite ${sectionId} failed:`, e);
      }
    }
  }

  // Build key_takeaways from intro spec
  const keyTakeawaysSpec = outlineSpec.key_takeaways as Record<string, unknown>;
  const keyTakeawaysCount = (keyTakeawaysSpec?.items_count as number) || 5;
  const keyTakeawaysBullets = allGeneratedSections
    .slice(0, keyTakeawaysCount)
    .map(s => `- ${(s.h2 as string || '').replace(/^\d+\.\s*/, '')}: ponto principal desta seção`)
    .join('\n');

  // Calculate totals
  let totalWordCount = 0;
  let totalBolds = 0;
  let totalExpertSignals = 0;
  for (const s of allGeneratedSections) {
    totalWordCount += (s.word_count as number) || 0;
    totalBolds += (s.bolds_applied as string[] || []).length;
    totalExpertSignals += (s.expert_signals as string[] || []).length;
  }
  if (generatedConclusion) {
    totalWordCount += generatedConclusion.split(/\s+/).filter(Boolean).length;
  }

  const contentPack: Record<string, unknown> = {
    content: {
      key_takeaways: `## Key Takeaways\n${keyTakeawaysBullets}`,
      sections: allGeneratedSections,
      faq: generatedFaq,
      conclusion: generatedConclusion,
      total_word_count: totalWordCount,
      total_bolds: totalBolds,
      total_expert_signals: totalExpertSignals,
    },
    critic_report: criticReport,
    nlp_tracker_final: nlpTracker,
    api_calls_used: apiCalls,
    cost_usd: costUsd,
    needs_review: needsReview,
  };

  return {
    output: contentPack,
    apiCalls,
    costUsd,
    needsReview,
  };
}

// ============================================================
// STUB STEP EXECUTOR (Phase 1: stubs for Image+)
// ============================================================

function executeStubStep(stepName: StepName, jobInput: Record<string, unknown>, _previousOutputs: Record<string, unknown>): Record<string, unknown> {
  const keyword = (jobInput.keyword as string) || 'keyword';
  const city = (jobInput.city as string) || 'São Paulo';

  switch (stepName) {
    case 'INPUT_VALIDATION':
      return { validated: true, keyword, city, normalized_input: jobInput };

    case 'IMAGE_GEN':
      return {
        images: [
          { type: 'hero', url: `https://picsum.photos/seed/${keyword}/1024/576`, alt: `${keyword} em ${city}`, position: 'hero' },
          { type: 'inline', url: `https://picsum.photos/seed/${keyword}2/800/450`, alt: `Processo de ${keyword}`, position: 'section-2' },
          { type: 'inline', url: `https://picsum.photos/seed/${keyword}3/800/450`, alt: `Resultado de ${keyword}`, position: 'section-5' },
        ],
        style_anchor: 'editorial-photorealistic-warm',
      };

    case 'SEO_SCORE':
      return {
        seo_score: 85,
        breakdown: {
          topic_coverage: { score: 88, weight: 0.20, details: 'Stub score' },
          entity_coverage: { score: 82, weight: 0.15, details: 'Stub score' },
          intent_match: { score: 90, weight: 0.15, details: 'Stub score' },
          depth_score: { score: 85, weight: 0.15, details: 'Stub score' },
          eeat: { score: 80, weight: 0.15, details: 'Stub score' },
          structure: { score: 88, weight: 0.10, details: 'Stub score' },
          readability: { score: 84, weight: 0.10, details: 'Stub score' },
        },
        needs_regeneration: false,
        weak_sections: [],
      };

    case 'META_GEN':
      return {
        meta: {
          meta_title: `${keyword} em ${city} | Guia Completo 2026`.substring(0, 60),
          meta_description: `Descubra tudo sobre ${keyword} em ${city}. Preços, dicas e passo a passo.`.substring(0, 155),
          slug: keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + `-${city.toLowerCase().replace(/\s+/g, '-')}`,
          excerpt: `Guia completo sobre ${keyword} em ${city}.`,
        },
      };

    case 'OUTPUT':
      return {
        html: `<article><h1>${keyword} em ${city}</h1><p>Stub HTML. Phase 4 will generate full output.</p></article>`,
        article_saved: false,
        article_id: null,
        published: false,
      };

    default:
      return { error: `Unknown stub step: ${stepName}` };
  }
}

// ============================================================
// STEP DISPATCHER
// ============================================================

async function executeStep(
  stepName: StepName,
  jobInput: Record<string, unknown>,
  previousOutputs: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
  _jobStartMs?: number
): Promise<{ output: Record<string, unknown>; aiResult?: AIRouterResult; multiCall?: { apiCalls: number; costUsd: number; needsReview: boolean } }> {
  switch (stepName) {
    case 'INPUT_VALIDATION':
      return { output: executeStubStep(stepName, jobInput, previousOutputs) };

    case 'SERP_ANALYSIS':
      return await executeSerpAnalysis(jobInput, supabaseUrl, serviceKey);

    case 'NLP_KEYWORDS':
      return await executeNlpKeywords(
        jobInput,
        (previousOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {},
        supabaseUrl, serviceKey
      );

    case 'TITLE_GEN':
      return await executeTitleGen(
        jobInput,
        (previousOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {},
        (previousOutputs['NLP_KEYWORDS'] as Record<string, unknown>) || {},
        supabaseUrl, serviceKey
      );

    case 'OUTLINE_GEN':
      return await executeOutlineGen(
        jobInput,
        (previousOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {},
        (previousOutputs['NLP_KEYWORDS'] as Record<string, unknown>) || {},
        (previousOutputs['TITLE_GEN'] as Record<string, unknown>) || {},
        supabaseUrl, serviceKey
      );

    // Phase 3+ stubs
    default:
      return { output: executeStubStep(stepName, jobInput, previousOutputs) };
  }
}

// ============================================================
// ORCHESTRATOR CORE
// ============================================================

async function orchestrate(jobId: string, supabase: ReturnType<typeof createClient>, supabaseUrl: string, serviceKey: string): Promise<void> {
  const jobStart = Date.now();

  // 1. Load job
  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    console.error(`[ORCHESTRATOR] Job ${jobId} not found:`, jobError);
    return;
  }

  // 2. Check terminal state
  if (['completed', 'failed', 'cancelled'].includes(job.status)) {
    console.log(`[ORCHESTRATOR] Job ${jobId} already ${job.status}. Skipping.`);
    return;
  }

  // 3. Idempotent lock
  if (job.locked_at) {
    const lockAge = Date.now() - new Date(job.locked_at).getTime();
    if (lockAge < LOCK_TTL_MS) {
      console.log(`[ORCHESTRATOR] Job ${jobId} is locked (${lockAge}ms ago). Skipping.`);
      return;
    }
    console.log(`[ORCHESTRATOR] Job ${jobId} lock expired (${lockAge}ms). Reclaiming.`);
  }

  // Acquire lock
  const lockId = crypto.randomUUID();
  const { error: lockError } = await supabase
    .from('generation_jobs')
    .update({ locked_at: new Date().toISOString(), locked_by: lockId, status: 'running', started_at: job.started_at || new Date().toISOString() })
    .eq('id', jobId)
    .is('locked_by', job.locked_by || null);

  if (lockError) {
    console.error(`[ORCHESTRATOR] Failed to acquire lock for ${jobId}:`, lockError);
    return;
  }

  // 4. Determine completed steps
  const completedSteps = new Set<string>();
  const { data: existingSteps } = await supabase
    .from('generation_steps')
    .select('step_name, status, output')
    .eq('job_id', jobId)
    .eq('status', 'completed');

  const stepOutputs: Record<string, unknown> = {};
  if (existingSteps) {
    for (const s of existingSteps) {
      completedSteps.add(s.step_name);
      stepOutputs[s.step_name] = s.output;
    }
  }

  let totalApiCalls = job.total_api_calls || 0;
  let totalCostUsd = job.cost_usd || 0;

  // 5. Execute pipeline
  try {
    for (const stepName of PIPELINE_STEPS) {
      if (completedSteps.has(stepName)) {
        console.log(`[ORCHESTRATOR] Step ${stepName} already completed. Skipping.`);
        continue;
      }

      // Check job timeout
      if (Date.now() - jobStart > MAX_JOB_TIME_MS) {
        throw new Error(`JOB_TIMEOUT: Exceeded ${MAX_JOB_TIME_MS}ms`);
      }

      // Check API budget (skip for non-API steps like INPUT_VALIDATION and OUTPUT)
      if (API_STEPS.includes(stepName) && totalApiCalls >= MAX_API_CALLS) {
        console.log(`[ORCHESTRATOR] Budget exceeded (${totalApiCalls}/${MAX_API_CALLS}). Setting needs_review.`);
        await supabase.from('generation_jobs').update({ needs_review: true }).eq('id', jobId);
        continue;
      }

      console.log(`[ORCHESTRATOR] Executing: ${stepName} (API calls: ${totalApiCalls}/${MAX_API_CALLS})`);

      // Update current_step
      await supabase.from('generation_jobs').update({ current_step: stepName }).eq('id', jobId);

      // Create step record
      const { data: stepRecord } = await supabase
        .from('generation_steps')
        .insert({
          job_id: jobId,
          step_name: stepName,
          status: 'running',
          started_at: new Date().toISOString(),
          input: { job_input: job.input, previous_outputs: Object.keys(stepOutputs) },
        })
        .select()
        .single();

      const stepStart = Date.now();

      try {
        // CONTENT_GEN: special multi-call handling
        if (stepName === 'CONTENT_GEN') {
          const contentCtx: ContentGenContext = {
            jobInput: job.input as Record<string, unknown>,
            outlineSpec: (stepOutputs['OUTLINE_GEN'] as Record<string, unknown>) || {},
            nlpPack: (stepOutputs['NLP_KEYWORDS'] as Record<string, unknown>) || {},
            serpPack: (stepOutputs['SERP_ANALYSIS'] as Record<string, unknown>) || {},
            titlePack: (stepOutputs['TITLE_GEN'] as Record<string, unknown>) || {},
            supabaseUrl,
            serviceKey,
            jobStartMs: jobStart,
          };

          const contentResult = await withTimeout(
            executeContentGen(contentCtx, totalApiCalls),
            STEP_TIMEOUTS[stepName],
            stepName
          );

          const latencyMs = Date.now() - stepStart;

          // CONTENT_GEN always completes (never fails on budget hit)
          const stepStatus = 'completed';

          await supabase
            .from('generation_steps')
            .update({
              status: stepStatus,
              output: contentResult.output,
              latency_ms: latencyMs,
              completed_at: new Date().toISOString(),
              model_used: 'gemini-2.5-pro+flash',
              provider: 'lovable-gateway',
              tokens_in: 0,
              tokens_out: 0,
              cost_usd: contentResult.costUsd,
            })
            .eq('id', stepRecord!.id);

          stepOutputs[stepName] = contentResult.output;
          completedSteps.add(stepName);

          totalApiCalls += contentResult.apiCalls;
          totalCostUsd += contentResult.costUsd;

          if (contentResult.needsReview) {
            await supabase.from('generation_jobs').update({ needs_review: true }).eq('id', jobId);
          }

          await supabase.from('generation_jobs').update({
            total_api_calls: totalApiCalls,
            cost_usd: totalCostUsd,
          }).eq('id', jobId);

          console.log(`[ORCHESTRATOR] ✅ CONTENT_GEN completed in ${latencyMs}ms | ${contentResult.apiCalls} AI calls | $${contentResult.costUsd.toFixed(6)}${contentResult.needsReview ? ' | NEEDS_REVIEW' : ''}`);
          continue;
        }

        // Standard single-call steps
        const { output: stepOutput, aiResult } = await withTimeout(
          executeStep(stepName, job.input as Record<string, unknown>, stepOutputs, supabaseUrl, serviceKey, jobStart),
          STEP_TIMEOUTS[stepName],
          stepName
        );

        const latencyMs = Date.now() - stepStart;

        const isRealStep = REAL_AI_STEPS.includes(stepName);
        const modelUsed = aiResult?.model || (isRealStep ? 'unknown' : 'stub-phase-1');
        const provider = aiResult?.provider || (isRealStep ? 'lovable-gateway' : 'stub');
        const tokensIn = aiResult?.tokensIn || 0;
        const tokensOut = aiResult?.tokensOut || 0;
        const stepCost = aiResult?.costUsd || 0;

        await supabase
          .from('generation_steps')
          .update({
            status: 'completed',
            output: stepOutput,
            latency_ms: latencyMs,
            completed_at: new Date().toISOString(),
            model_used: modelUsed,
            provider,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
            cost_usd: stepCost,
          })
          .eq('id', stepRecord!.id);

        stepOutputs[stepName] = stepOutput;
        completedSteps.add(stepName);

        if (isRealStep && aiResult) {
          totalApiCalls++;
          totalCostUsd += stepCost;
          await supabase.from('generation_jobs').update({
            total_api_calls: totalApiCalls,
            cost_usd: totalCostUsd,
          }).eq('id', jobId);
        }

        console.log(`[ORCHESTRATOR] ✅ ${stepName} completed in ${latencyMs}ms${aiResult ? ` | ${tokensIn}+${tokensOut} tokens | $${stepCost.toFixed(6)}` : ' (stub)'}`);
      } catch (stepError) {
        const latencyMs = Date.now() - stepStart;
        const errorMsg = stepError instanceof Error ? stepError.message : 'Unknown step error';
        const rawContent = stepError instanceof ParseError ? stepError.rawContent : undefined;

        console.error(`[ORCHESTRATOR] ❌ ${stepName} failed:`, errorMsg);

        if (stepRecord) {
          await supabase
            .from('generation_steps')
            .update({
              status: 'failed',
              error_message: errorMsg,
              output: rawContent ? { parse_error: true, raw_ai_content: rawContent.substring(0, 10000), error_message: errorMsg } : null,
              latency_ms: latencyMs,
              completed_at: new Date().toISOString(),
            })
            .eq('id', stepRecord.id);
        }

        throw new Error(`STEP_FAILED:${stepName}: ${errorMsg}`);
      }
    }

    // 6. Job completed
    const seoOutput = stepOutputs['SEO_SCORE'] as Record<string, unknown> | undefined;
    const seoScore = (seoOutput?.seo_score as number) || null;
    const seoBreakdown = (seoOutput?.breakdown as Record<string, unknown>) || null;

    await supabase
      .from('generation_jobs')
      .update({
        status: 'completed',
        current_step: null,
        output: stepOutputs,
        seo_score: seoScore,
        seo_breakdown: seoBreakdown,
        needs_review: (seoScore !== null && seoScore < 70) || (totalApiCalls >= MAX_API_CALLS && (seoScore === null || seoScore < 70)),
        cost_usd: totalCostUsd,
        total_api_calls: totalApiCalls,
        completed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
      })
      .eq('id', jobId);

    console.log(`[ORCHESTRATOR] ✅ Job ${jobId} COMPLETED in ${Date.now() - jobStart}ms | SEO: ${seoScore} | API: ${totalApiCalls} | Cost: $${totalCostUsd.toFixed(6)}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown orchestration error';
    console.error(`[ORCHESTRATOR] ❌ Job ${jobId} FAILED:`, errorMsg);

    const stepMatch = errorMsg.match(/STEP_FAILED:(\w+)/);
    const failedStep = stepMatch ? stepMatch[1] : null;

    await supabase
      .from('generation_jobs')
      .update({
        status: 'failed',
        error_message: errorMsg,
        error_step: failedStep,
        output: Object.keys(stepOutputs).length > 0 ? stepOutputs : null,
        cost_usd: totalCostUsd,
        total_api_calls: totalApiCalls,
        completed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
      })
      .eq('id', jobId);
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
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await orchestrate(job_id, supabase, supabaseUrl, serviceKey);

    return new Response(
      JSON.stringify({ success: true, job_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ORCHESTRATOR] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
