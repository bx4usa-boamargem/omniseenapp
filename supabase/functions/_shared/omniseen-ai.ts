/**
 * OmniSeen AI Router — v2.0 (Direct API)
 *
 * REGRA ABSOLUTA: Este é o ÚNICO ponto de entrada para chamadas de IA.
 * Nenhum fetch direto para OpenAI, Google ou qualquer gateway fora deste arquivo.
 *
 * Providers diretos:
 *   - Google Gemini 2.5 Flash  (texto)
 *   - Google Gemini 2.5 Flash  (imagem via responseModalities)
 *   - OpenAI GPT-4.1           (QA / revisão premium / fallback)
 *
 * Secrets necessários (Supabase Edge Function Secrets):
 *   - GOOGLE_AI_KEY   → Google AI Studio key
 *   - OPENAI_API_KEY  → OpenAI platform key
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TextOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  /** Force a specific provider instead of using the routing table */
  forceProvider?: 'gemini' | 'openai';
}

export interface ImageOptions {
  aspectRatio?: string;
  /** If true, the response will include base64 data */
  includeBase64?: boolean;
}

export interface AIResult {
  success: boolean;
  content: string;
  model: string;
  provider: 'gemini' | 'openai';
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

export interface ImageResult {
  success: boolean;
  url: string;
  base64?: string;
  mimeType?: string;
  model: string;
  provider: 'gemini';
  latencyMs: number;
  error?: string;
}

export type TaskType =
  // Geração de conteúdo (Gemini principal)
  | 'outline_gen'
  | 'content_gen'
  | 'article_gen_single_pass'
  | 'article_gen_from_outline'
  | 'section_expansion'
  | 'title_gen'
  | 'meta_gen'
  | 'landing_page_gen'
  | 'ebook_gen'
  | 'funnel_gen'
  | 'concept_gen'
  | 'persona_gen'
  | 'translate'
  // SEO & análise (Gemini principal)
  | 'serp_analysis'
  | 'serp_summary'
  | 'serp_gap_analysis'
  | 'nlp_keywords'
  | 'entity_extraction'
  | 'entity_coverage_assign'
  | 'context_summary'
  | 'seo_score'
  | 'seo_fix'
  | 'seo_suggestions'
  | 'keyword_analysis'
  | 'keyword_suggest'
  | 'theme_suggest'
  | 'cluster_gen'
  | 'opportunity_gen'
  | 'internal_links'
  | 'broken_link_fix'
  | 'trend_analysis'
  | 'market_intel'
  // Otimização/melhoria (Gemini principal)
  | 'boost_score'
  | 'auto_fix'
  | 'polish_final'
  | 'optimize_performance'
  | 'improve_complete'
  // QA & revisão (OpenAI principal)
  | 'content_critic'
  | 'review_article'
  | 'quality_gate'
  // Chat & conversação (Gemini principal)
  | 'chat'
  | 'support_chat'
  | 'sales_agent'
  | 'article_chat'
  // Imagem (Gemini Image)
  | 'image_gen'
  // Utilitários (Gemini principal)
  | 'summarize'
  | 'instagram_import'
  // Fallback genérico
  | 'general';

// ============================================================================
// ROUTING TABLE
// ============================================================================

interface RouteConfig {
  primary: 'gemini' | 'openai';
  fallback: 'gemini' | 'openai' | null;
  model: { gemini: string; openai: string };
  temperature: number;
  maxTokens: number;
}

const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const OPENAI_TEXT_MODEL = 'gpt-4.1';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash';

const DEFAULT_ROUTE: RouteConfig = {
  primary: 'gemini',
  fallback: 'openai',
  model: { gemini: GEMINI_TEXT_MODEL, openai: OPENAI_TEXT_MODEL },
  temperature: 0.4,
  maxTokens: 8000,
};

const ROUTES: Partial<Record<TaskType, Partial<RouteConfig>>> = {
  // Content generation — Gemini (fast + cheap), OpenAI fallback
  outline_gen:              { temperature: 0.4, maxTokens: 8000 },
  content_gen:              { temperature: 0.5, maxTokens: 8000 },
  article_gen_single_pass:  { temperature: 0.4, maxTokens: 6000 },
  article_gen_from_outline: { temperature: 0.4, maxTokens: 12000 },
  section_expansion:        { temperature: 0.3, maxTokens: 4000 },
  title_gen:                { temperature: 0.7, maxTokens: 8000 },
  meta_gen:                 { temperature: 0.3, maxTokens: 4000, fallback: null },
  landing_page_gen:         { temperature: 0.5, maxTokens: 8000 },
  ebook_gen:                { temperature: 0.5, maxTokens: 8000 },
  funnel_gen:               { temperature: 0.4, maxTokens: 8000 },
  concept_gen:              { temperature: 0.6, maxTokens: 4000 },
  persona_gen:              { temperature: 0.5, maxTokens: 4000 },
  translate:                { temperature: 0.3, maxTokens: 8000 },

  // SEO & analysis — Gemini (fast, no fallback for simple tasks)
  serp_analysis:            { temperature: 0.3, maxTokens: 8000, fallback: null },
  serp_summary:             { temperature: 0.3, maxTokens: 2000, fallback: null },
  serp_gap_analysis:        { temperature: 0.2, maxTokens: 4000, fallback: null },
  nlp_keywords:             { temperature: 0.2, maxTokens: 8000, fallback: null },
  entity_extraction:        { temperature: 0.2, maxTokens: 4000, fallback: null },
  entity_coverage_assign:   { temperature: 0.2, maxTokens: 4000, fallback: null },
  context_summary:          { temperature: 0.1, maxTokens: 2000, fallback: null },
  seo_score:                { temperature: 0.1, maxTokens: 4000 },
  seo_fix:                  { temperature: 0.3, maxTokens: 8000 },
  seo_suggestions:          { temperature: 0.3, maxTokens: 4000 },
  keyword_analysis:         { temperature: 0.3, maxTokens: 4000, fallback: null },
  keyword_suggest:          { temperature: 0.5, maxTokens: 4000, fallback: null },
  theme_suggest:            { temperature: 0.6, maxTokens: 4000, fallback: null },
  cluster_gen:              { temperature: 0.4, maxTokens: 4000, fallback: null },
  opportunity_gen:          { temperature: 0.4, maxTokens: 8000, fallback: null },
  internal_links:           { temperature: 0.2, maxTokens: 4000, fallback: null },
  broken_link_fix:          { temperature: 0.3, maxTokens: 4000, fallback: null },
  trend_analysis:           { temperature: 0.3, maxTokens: 4000, fallback: null },
  market_intel:             { temperature: 0.3, maxTokens: 4000, fallback: null },

  // Optimization — Gemini
  boost_score:              { temperature: 0.3, maxTokens: 8000 },
  auto_fix:                 { temperature: 0.3, maxTokens: 8000 },
  polish_final:             { temperature: 0.3, maxTokens: 8000 },
  optimize_performance:     { temperature: 0.3, maxTokens: 8000 },
  improve_complete:         { temperature: 0.4, maxTokens: 8000 },

  // QA & review — OpenAI as primary (higher quality editorial judgment)
  content_critic:           { primary: 'openai', fallback: 'gemini', temperature: 0.1, maxTokens: 4000 },
  review_article:           { primary: 'openai', fallback: 'gemini', temperature: 0.2, maxTokens: 4000 },
  quality_gate:             { primary: 'openai', fallback: 'gemini', temperature: 0.1, maxTokens: 4000 },

  // Chat — Gemini
  chat:                     { temperature: 0.6, maxTokens: 4000, fallback: null },
  support_chat:             { temperature: 0.5, maxTokens: 4000, fallback: null },
  sales_agent:              { temperature: 0.5, maxTokens: 4000, fallback: null },
  article_chat:             { temperature: 0.5, maxTokens: 4000, fallback: null },

  // Image — handled by generateImage(), not generateText()
  image_gen:                { temperature: 0.7, maxTokens: 4000, fallback: null },

  // Utilities — Gemini
  summarize:                { temperature: 0.2, maxTokens: 4000, fallback: null },
  instagram_import:         { temperature: 0.3, maxTokens: 4000, fallback: null },

  // General fallback
  general:                  { temperature: 0.4, maxTokens: 8000 },
};

function getRoute(task: TaskType): RouteConfig {
  const override = ROUTES[task] || {};
  return { ...DEFAULT_ROUTE, ...override, model: { ...DEFAULT_ROUTE.model, ...override.model } };
}

// ============================================================================
// COST TABLE
// ============================================================================

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash':   { input: 0.15, output: 0.60 },
  'gpt-4.1':            { input: 2.00, output: 8.00 },
  
};

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = COST_PER_1M[model] || { input: 1.0, output: 5.0 };
  return (tokensIn / 1_000_000) * costs.input + (tokensOut / 1_000_000) * costs.output;
}

// ============================================================================
// HELPER: Fetch with timeout
// ============================================================================

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// PROVIDER: Google Gemini (Direct API)
// ============================================================================

async function callGemini(
  messages: AIMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  responseFormat?: 'json' | 'text'
): Promise<AIResult> {
  const apiKey = Deno.env.get('GOOGLE_AI_KEY');
  if (!apiKey) {
    return {
      success: false, content: '', model, provider: 'gemini',
      tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0,
      error: 'GOOGLE_AI_KEY not configured',
    };
  }

  // Convert OpenAI-style messages to Gemini format
  const systemMessage = messages.find(m => m.role === 'system');
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const generationConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens: maxTokens,
  };

  if (responseFormat === 'json') {
    generationConfig.responseMimeType = 'application/json';
  }

  const body: Record<string, unknown> = { contents, generationConfig };

  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const startMs = Date.now();

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 120000); // 2min timeout

    const latencyMs = Date.now() - startMs;

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const errorCode = response.status === 429 ? 'RATE_LIMITED' :
                        response.status === 403 ? 'FORBIDDEN' : `HTTP_${response.status}`;
      console.error(`[OMNISEEN-AI] Gemini ${model}: ${errorCode} - ${errText.substring(0, 200)}`);
      return {
        success: false, content: '', model, provider: 'gemini',
        tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs,
        error: `${errorCode}: ${errText.substring(0, 200)}`,
      };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text || text.trim() === '') {
      const finishReason = data.candidates?.[0]?.finishReason || 'UNKNOWN';
      console.error(`[OMNISEEN-AI] Gemini ${model}: EMPTY_OUTPUT (finishReason: ${finishReason})`);
      return {
        success: false, content: '', model, provider: 'gemini',
        tokensIn: data.usageMetadata?.promptTokenCount || 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount || 0,
        costUsd: 0, latencyMs,
        error: `EMPTY_OUTPUT (${finishReason})`,
      };
    }

    const tokensIn = data.usageMetadata?.promptTokenCount || 0;
    const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;
    const costUsd = estimateCost(model, tokensIn, tokensOut);

    console.log(`[OMNISEEN-AI] Gemini ${model}: ✅ ${tokensIn}+${tokensOut} tokens | $${costUsd.toFixed(6)} | ${latencyMs}ms`);

    return {
      success: true, content: text, model, provider: 'gemini',
      tokensIn, tokensOut, costUsd, latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startMs;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[OMNISEEN-AI] Gemini ${model}: ❌ ${msg}`);
    return {
      success: false, content: '', model, provider: 'gemini',
      tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs,
      error: msg,
    };
  }
}

// ============================================================================
// PROVIDER: OpenAI (Direct API)
// ============================================================================

async function callOpenAI(
  messages: AIMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  responseFormat?: 'json' | 'text'
): Promise<AIResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return {
      success: false, content: '', model, provider: 'openai',
      tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0,
      error: 'OPENAI_API_KEY not configured',
    };
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const startMs = Date.now();

  try {
    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      120000, // 2min timeout
    );

    const latencyMs = Date.now() - startMs;

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const errorCode = response.status === 429 ? 'RATE_LIMITED' :
                        response.status === 402 ? 'PAYMENT_REQUIRED' : `HTTP_${response.status}`;
      console.error(`[OMNISEEN-AI] OpenAI ${model}: ${errorCode} - ${errText.substring(0, 200)}`);
      return {
        success: false, content: '', model, provider: 'openai',
        tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs,
        error: `${errorCode}: ${errText.substring(0, 200)}`,
      };
    }

    const data = await response.json();

    // Extract content — handle tool_calls and regular content
    let content = '';
    const choice = data.choices?.[0];

    if (choice?.message?.tool_calls?.[0]) {
      content = choice.message.tool_calls[0].function?.arguments || '';
    }
    if (!content) {
      content = typeof choice?.message?.content === 'string'
        ? choice.message.content
        : Array.isArray(choice?.message?.content)
          ? choice.message.content.filter((c: Record<string, unknown>) => c.type === 'text').map((c: Record<string, unknown>) => c.text).join('')
          : '';
    }

    if (!content || content.trim() === '') {
      console.error(`[OMNISEEN-AI] OpenAI ${model}: EMPTY_OUTPUT`);
      return {
        success: false, content: '', model, provider: 'openai',
        tokensIn: data.usage?.prompt_tokens || 0,
        tokensOut: data.usage?.completion_tokens || 0,
        costUsd: 0, latencyMs,
        error: 'EMPTY_OUTPUT',
      };
    }

    const tokensIn = data.usage?.prompt_tokens || 0;
    const tokensOut = data.usage?.completion_tokens || 0;
    const costUsd = estimateCost(model, tokensIn, tokensOut);

    console.log(`[OMNISEEN-AI] OpenAI ${model}: ✅ ${tokensIn}+${tokensOut} tokens | $${costUsd.toFixed(6)} | ${latencyMs}ms`);

    return {
      success: true, content, model, provider: 'openai',
      tokensIn, tokensOut, costUsd, latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startMs;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[OMNISEEN-AI] OpenAI ${model}: ❌ ${msg}`);
    return {
      success: false, content: '', model, provider: 'openai',
      tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs,
      error: msg,
    };
  }
}

// ============================================================================
// PROVIDER: Google Gemini Image (Direct API)
// ============================================================================

async function callGeminiImage(prompt: string): Promise<ImageResult> {
  const apiKey = Deno.env.get('GOOGLE_AI_KEY');
  if (!apiKey) {
    return {
      success: false, url: '', model: GEMINI_IMAGE_MODEL, provider: 'gemini',
      latencyMs: 0, error: 'GOOGLE_AI_KEY not configured',
    };
  }

  const enhancedPrompt = `Generate a premium editorial 16:9 photograph for a professional blog article. The image must look like a real photo captured in a real environment. CRITICAL RULE: The image must contain ZERO text of any kind — no words, no letters, no numbers, no titles, no captions, no labels, no banners, no overlays, no watermarks, no logos, no typography whatsoever. Pure photographic/artistic image only. ${prompt}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;
  const startMs = Date.now();

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: enhancedPrompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    }, 60000); // 60s timeout for images

    const latencyMs = Date.now() - startMs;

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[OMNISEEN-AI] GeminiImage: HTTP ${response.status} - ${errText.substring(0, 200)}`);
      return {
        success: false, url: '', model: GEMINI_IMAGE_MODEL, provider: 'gemini',
        latencyMs, error: `HTTP_${response.status}: ${errText.substring(0, 200)}`,
      };
    }

    const data = await response.json();

    // Extract image from Gemini native response
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: Record<string, unknown>) => p.inlineData);

    if (imagePart?.inlineData) {
      const { mimeType, data: base64Data } = imagePart.inlineData;
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      console.log(`[OMNISEEN-AI] GeminiImage: ✅ Generated (${mimeType}) | ${latencyMs}ms`);

      return {
        success: true,
        url: dataUrl,
        base64: base64Data,
        mimeType,
        model: GEMINI_IMAGE_MODEL,
        provider: 'gemini',
        latencyMs,
      };
    }

    console.error(`[OMNISEEN-AI] GeminiImage: No image in response`);
    return {
      success: false, url: '', model: GEMINI_IMAGE_MODEL, provider: 'gemini',
      latencyMs, error: 'NO_IMAGE_IN_RESPONSE',
    };
  } catch (error) {
    const latencyMs = Date.now() - startMs;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[OMNISEEN-AI] GeminiImage: ❌ ${msg}`);
    return {
      success: false, url: '', model: GEMINI_IMAGE_MODEL, provider: 'gemini',
      latencyMs, error: msg,
    };
  }
}

// ============================================================================
// PUBLIC API: generateText
// ============================================================================

/**
 * Generate text using the AI router.
 * Routes to the appropriate provider based on TaskType.
 * Includes automatic fallback when configured.
 *
 * @param task - The task type (determines model routing)
 * @param messages - OpenAI-format messages array
 * @param opts - Optional overrides for temperature, maxTokens, etc.
 */
export async function generateText(
  task: TaskType,
  messages: AIMessage[],
  opts?: TextOptions,
): Promise<AIResult> {
  const route = getRoute(task);
  const temperature = opts?.temperature ?? route.temperature;
  const maxTokens = opts?.maxTokens ?? route.maxTokens;
  const responseFormat = opts?.responseFormat;
  const forcedProvider = opts?.forceProvider;

  const primaryProvider = forcedProvider || route.primary;
  const primaryModel = route.model[primaryProvider];

  console.log(`[OMNISEEN-AI] ${task}: → ${primaryProvider}/${primaryModel} (temp=${temperature})`);

  // Call primary provider
  const callProvider = primaryProvider === 'openai' ? callOpenAI : callGemini;
  const primaryResult = await callProvider(messages, primaryModel, temperature, maxTokens, responseFormat);

  if (primaryResult.success) return primaryResult;

  // If no fallback configured, or payment required (don't retry), return failure
  const fallbackProvider = route.fallback;
  if (!fallbackProvider || forcedProvider || primaryResult.error?.includes('PAYMENT_REQUIRED')) {
    return primaryResult;
  }

  // Fallback
  const fallbackModel = route.model[fallbackProvider];
  console.log(`[OMNISEEN-AI] ${task}: ⚠️ ${primaryProvider} failed (${primaryResult.error}), falling back to ${fallbackProvider}/${fallbackModel}`);

  const callFallback = fallbackProvider === 'openai' ? callOpenAI : callGemini;
  const fallbackResult = await callFallback(messages, fallbackModel, temperature, maxTokens, responseFormat);

  if (!fallbackResult.success) {
    console.error(`[OMNISEEN-AI] ${task}: ❌ BOTH providers failed. Primary: ${primaryResult.error}, Fallback: ${fallbackResult.error}`);
  }

  return fallbackResult;
}

// ============================================================================
// PUBLIC API: generateImage
// ============================================================================

/**
 * Generate an image using Gemini Image API.
 * Falls back to Unsplash/Picsum placeholder on failure.
 *
 * @param prompt - Image generation prompt
 * @param _opts - Optional image options (reserved for future use)
 */
export async function generateImage(
  prompt: string,
  _opts?: ImageOptions,
): Promise<ImageResult> {
  const result = await callGeminiImage(prompt);

  if (result.success) return result;

  // Fallback: Picsum placeholder
  console.log(`[OMNISEEN-AI] Image: ⚠️ Gemini failed, using Picsum fallback`);
  const seed = prompt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50) + Date.now();
  const fallbackUrl = `https://picsum.photos/seed/${seed}/1024/576`;

  return {
    success: true,
    url: fallbackUrl,
    model: 'picsum-fallback',
    provider: 'gemini',
    latencyMs: result.latencyMs,
    error: `FALLBACK: ${result.error}`,
  };
}

// ============================================================================
// PUBLIC API: reviewText (alias for QA-priority tasks)
// ============================================================================

/**
 * Review/QA text content. Uses OpenAI as primary for higher quality editorial judgment.
 * This is a convenience wrapper around generateText with QA-priority routing.
 *
 * @param task - Review task type
 * @param messages - Messages for the review
 * @param opts - Optional overrides
 */
export async function reviewText(
  task: TaskType,
  messages: AIMessage[],
  opts?: TextOptions,
): Promise<AIResult> {
  // Force OpenAI for review tasks unless explicitly overridden
  const reviewOpts: TextOptions = {
    ...opts,
    forceProvider: opts?.forceProvider || 'openai',
  };
  return generateText(task, messages, reviewOpts);
}

// ============================================================================
// RETRY WRAPPER (for callers that need retry logic)
// ============================================================================

/**
 * Call generateText with exponential backoff retry.
 * Only retries on transient errors (429, 5xx, network).
 */
export async function generateTextWithRetry(
  task: TaskType,
  messages: AIMessage[],
  opts?: TextOptions & { maxRetries?: number },
): Promise<AIResult> {
  const maxRetries = opts?.maxRetries ?? 3;
  const delays = [1000, 4000, 16000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await generateText(task, messages, opts);

    if (result.success) return result;

    // Don't retry non-transient errors
    if (result.error?.includes('PAYMENT_REQUIRED') || result.error?.includes('FORBIDDEN')) {
      return result;
    }

    if (attempt < maxRetries) {
      const delay = delays[attempt] || 16000;
      console.log(`[OMNISEEN-AI] Retry ${attempt + 1}/${maxRetries} for ${task} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Final attempt (should not reach here normally)
  return generateText(task, messages, opts);
}
