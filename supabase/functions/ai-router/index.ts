import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersForRequest } from "../_shared/httpCors.ts";

/**
 * AI Router — OmniSeen Article Engine v1
 * 
 * Abstraction layer for LLM calls.
 * - Single provider (Lovable AI Gateway / Gemini) for v1
 * - Interface prepared for multi-provider (Claude/GPT) in future
 * - Tracks tokens, cost, latency per call
 * - Rate limit handling with retry
 * 
 * CRITICAL: This is the ONLY file that calls the AI gateway.
 * All step functions call this router instead.
 */

// ============================================================
// INTERFACES (prepared for multi-provider future)
// ============================================================

export interface ModelProvider {
  type: 'lovable-gateway';
  call(params: AICallParams): Promise<AICallResult>;
}

export interface SerpProvider {
  type: 'llm-simulated' | 'dataforseo' | 'serpapi';
  analyze(keyword: string, locale: Locale): Promise<unknown>;
}

export interface Locale {
  country: string;
  city?: string;
  state?: string;
  language: string;
}

export interface AICallParams {
  task: TaskType;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  tools?: unknown[];
  toolChoice?: unknown;
}

export interface AICallResult {
  success: boolean;
  content: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
  rawResponse?: unknown;
}

type TaskType =
  | 'serp_analysis'
  | 'nlp_keywords'
  | 'title_gen'
  | 'outline_gen'
  | 'content_gen'
  | 'content_critic'
  | 'context_summary'
  | 'image_gen'
  | 'seo_score'
  | 'meta_gen'
  | 'serp_summary'
  | 'article_gen_single_pass'
  | 'entity_extraction'
  | 'article_gen_from_outline'
  | 'serp_gap_analysis'
  | 'section_expansion'
  | 'entity_coverage_assign';

// ============================================================
// MODEL ROUTING TABLE (v1: Gemini only via Lovable Gateway)
// ============================================================

const MODEL_ROUTING: Record<TaskType, { model: string; temperature: number; maxTokens: number }> = {
  serp_analysis:           { model: 'google/gemini-2.5-flash',       temperature: 0.3, maxTokens: 8000 },
  nlp_keywords:            { model: 'google/gemini-2.5-flash',       temperature: 0.2, maxTokens: 8000 },
  title_gen:               { model: 'google/gemini-2.5-flash',       temperature: 0.7, maxTokens: 8000 },
  outline_gen:             { model: 'google/gemini-2.5-flash',       temperature: 0.4, maxTokens: 8000 },
  content_gen:             { model: 'google/gemini-2.5-flash',       temperature: 0.5, maxTokens: 8000 },
  content_critic:          { model: 'google/gemini-2.5-flash',       temperature: 0.1, maxTokens: 4000 },
  context_summary:         { model: 'google/gemini-2.5-flash',       temperature: 0.1, maxTokens: 2000 },
  image_gen:               { model: 'google/gemini-2.5-flash-image', temperature: 0.7, maxTokens: 4000 },
  seo_score:               { model: 'google/gemini-2.5-flash',       temperature: 0.1, maxTokens: 4000 },
  meta_gen:                { model: 'google/gemini-2.5-flash',       temperature: 0.3, maxTokens: 4000 },
  serp_summary:            { model: 'google/gemini-2.5-flash',       temperature: 0.3, maxTokens: 2000 },
  article_gen_single_pass: { model: 'google/gemini-2.5-flash',       temperature: 0.4, maxTokens: 6000 },
  entity_extraction:       { model: 'google/gemini-2.5-flash',       temperature: 0.2, maxTokens: 4000 },
  article_gen_from_outline:{ model: 'google/gemini-2.5-flash',       temperature: 0.4, maxTokens: 12000 },
  serp_gap_analysis:      { model: 'google/gemini-2.5-flash',       temperature: 0.2, maxTokens: 4000 },
  section_expansion:      { model: 'google/gemini-2.5-flash',       temperature: 0.3, maxTokens: 4000 },
  entity_coverage_assign:  { model: 'google/gemini-2.5-flash',       temperature: 0.2, maxTokens: 4000 },
};

// Cost per 1M tokens (Lovable Gateway estimates)
const COST_TABLE: Record<string, { input: number; output: number }> = {
  'google/gemini-2.5-pro':         { input: 1.25, output: 10.0 },
  'google/gemini-2.5-flash':       { input: 0.15, output: 0.60 },
  'google/gemini-2.5-flash-image': { input: 0.15, output: 0.60 },
};

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = COST_TABLE[model] || { input: 1.0, output: 5.0 };
  return (tokensIn / 1_000_000) * costs.input + (tokensOut / 1_000_000) * costs.output;
}

// ============================================================
// CORE: Call Lovable AI Gateway
// ============================================================

async function callGateway(params: AICallParams): Promise<AICallResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return {
      success: false, content: '', model: '', provider: 'lovable-gateway',
      tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0,
      error: 'LOVABLE_API_KEY not configured',
    };
  }

  const routing = MODEL_ROUTING[params.task];
  const model = routing.model;
  const temperature = params.temperature ?? routing.temperature;
  const maxTokens = params.maxTokens ?? routing.maxTokens;

  // Production mode: single provider (Gemini), no tools/function calling
  const body: Record<string, unknown> = {
    model,
    messages: params.messages,
    temperature,
    max_tokens: maxTokens,
  };

  const startMs = Date.now();

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - startMs;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI_ROUTER] ${params.task}: HTTP ${response.status} - ${errText}`);

      if (response.status === 429) {
        return {
          success: false, content: '', model, provider: 'lovable-gateway',
          tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs,
          error: `RATE_LIMITED: ${response.status}`,
        };
      }
      if (response.status === 402) {
        return {
          success: false, content: '', model, provider: 'lovable-gateway',
          tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs,
          error: `PAYMENT_REQUIRED: ${response.status}`,
        };
      }

      return {
        success: false, content: '', model, provider: 'lovable-gateway',
        tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs,
        error: `HTTP_${response.status}: ${errText.substring(0, 200)}`,
      };
    }

    const data = await response.json();
    
    // PATCH B: Robust content extraction with multiple fallbacks
    let content = '';
    const choice = data.choices?.[0];
    
    // Path 1: tool_calls (function calling)
    if (choice?.message?.tool_calls?.[0]) {
      const tc = choice.message.tool_calls[0];
      content = tc.function?.arguments || tc?.args || '';
      // Fallback: if tool_calls returned empty, try message.content
      if (!content && choice.message?.content) {
        console.warn(`[AI_ROUTER] ${params.task}: tool_calls.arguments empty, falling back to message.content`);
        content = choice.message.content;
      }
    }
    // Path 2: regular content
    if (!content) {
      // Handle string content
      if (typeof choice?.message?.content === 'string') {
        content = choice.message.content;
      }
      // Handle array content (some models return [{type:"text", text:"..."}])
      else if (Array.isArray(choice?.message?.content)) {
        content = choice.message.content
          .filter((c: Record<string, unknown>) => c.type === 'text')
          .map((c: Record<string, unknown>) => c.text)
          .join('');
      }
    }
    
    // Path 3: If still empty, log warning with safe dump
    if (!content || content.trim() === '') {
      const safeDump = JSON.stringify({
        has_tool_calls: !!choice?.message?.tool_calls,
        tool_calls_length: choice?.message?.tool_calls?.length || 0,
        content_type: typeof choice?.message?.content,
        content_preview: typeof choice?.message?.content === 'string' 
          ? choice.message.content.substring(0, 200) 
          : JSON.stringify(choice?.message?.content)?.substring(0, 200),
        finish_reason: choice?.finish_reason,
      });
      console.error(`[AI_ROUTER] ${params.task}: ⚠️ EMPTY_MODEL_OUTPUT | dump=${safeDump}`);
      
      return {
        success: false, content: '', model, provider: 'lovable-gateway',
        tokensIn: data.usage?.prompt_tokens || 0,
        tokensOut: data.usage?.completion_tokens || 0,
        costUsd: estimateCost(model, data.usage?.prompt_tokens || 0, data.usage?.completion_tokens || 0),
        latencyMs,
        error: 'EMPTY_MODEL_OUTPUT',
      };
    }

    const tokensIn = data.usage?.prompt_tokens || 0;
    const tokensOut = data.usage?.completion_tokens || 0;
    const costUsd = estimateCost(model, tokensIn, tokensOut);

    console.log(`[AI_ROUTER] ${params.task}: ✅ ${model} | ${tokensIn}+${tokensOut} tokens | $${costUsd.toFixed(6)} | ${latencyMs}ms`);

    return {
      success: true,
      content,
      model,
      provider: 'lovable-gateway',
      tokensIn,
      tokensOut,
      costUsd,
      latencyMs,
      rawResponse: data,
    };
  } catch (error) {
    const latencyMs = Date.now() - startMs;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AI_ROUTER] ${params.task}: ❌ ${errorMsg}`);
    return {
      success: false, content: '', model, provider: 'lovable-gateway',
      tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs,
      error: errorMsg,
    };
  }
}

// ============================================================
// RETRY LOGIC with exponential backoff
// ============================================================

async function callWithRetry(params: AICallParams, maxRetries = 3): Promise<AICallResult> {
  const delays = [1000, 4000, 16000]; // 1s, 4s, 16s

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await callGateway(params);

    if (result.success) return result;

    // Don't retry payment errors
    if (result.error?.startsWith('PAYMENT_REQUIRED')) return result;

    // Retry on rate limit or transient errors
    if (attempt < maxRetries) {
      const delay = delays[attempt] || 16000;
      console.log(`[AI_ROUTER] Retry ${attempt + 1}/${maxRetries} for ${params.task} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Should not reach here, but safety net
  return callGateway(params);
}

// ============================================================
// HTTP Handler
// ============================================================

serve(async (req) => {
  const cors = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.json();
    const { task, messages, temperature, maxTokens, tools, toolChoice } = body;

    if (!task || !messages) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: task, messages" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!MODEL_ROUTING[task as TaskType]) {
      return new Response(
        JSON.stringify({ error: `Unknown task: ${task}. Valid: ${Object.keys(MODEL_ROUTING).join(', ')}` }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const result = await callWithRetry({
      task: task as TaskType,
      messages,
      temperature,
      maxTokens,
      tools,
      toolChoice,
    });

    const status = result.success ? 200 : (result.error?.includes('RATE_LIMITED') ? 429 : result.error?.includes('PAYMENT_REQUIRED') ? 402 : 500);

    return new Response(
      JSON.stringify(result),
      { status, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[AI_ROUTER] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
