import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersForRequest } from "../_shared/httpCors.ts";
import { generateText, generateTextWithRetry, type TaskType, type AIMessage, type AIResult } from '../_shared/omniseen-ai.ts';

/**
 * AI Router — OmniSeen v6.0 (Direct API)
 *
 * Roteador centralizado de IA. Todas as chamadas passam por omniseen-ai.ts.
 * Providers: Google Gemini (primário) + OpenAI GPT-4.1 (QA/fallback)
 *
 * ZERO dependência do Lovable AI Gateway.
 */

// ============================================================
// INTERFACES
// ============================================================

export interface AICallParams {
  task: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

// Cost per 1M tokens (for logging/accounting only)
const COST_TABLE: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash':   { input: 0.15, output: 0.60 },
  'gpt-4.1':            { input: 2.00, output: 8.00 },
};

// Valid tasks accepted by this endpoint
const VALID_TASKS: string[] = [
  'serp_analysis', 'nlp_keywords', 'title_gen', 'outline_gen',
  'content_gen', 'content_critic', 'context_summary', 'image_gen',
  'seo_score', 'meta_gen', 'serp_summary', 'article_gen_single_pass',
  'entity_extraction', 'article_gen_from_outline', 'serp_gap_analysis',
  'section_expansion', 'entity_coverage_assign', 'general',
  'review_article', 'quality_gate', 'boost_score', 'auto_fix',
  'polish_final', 'optimize_performance', 'improve_complete',
  'chat', 'support_chat', 'sales_agent', 'article_chat',
  'summarize', 'translate', 'keyword_analysis', 'keyword_suggest',
  'theme_suggest', 'cluster_gen', 'opportunity_gen', 'internal_links',
  'broken_link_fix', 'trend_analysis', 'market_intel', 'seo_fix',
  'seo_suggestions', 'landing_page_gen', 'ebook_gen', 'funnel_gen',
  'concept_gen', 'persona_gen', 'instagram_import',
];

// ============================================================
// CORE: Route to omniseen-ai.ts
// ============================================================

async function callAI(params: AICallParams): Promise<AIResult> {
  const task = (params.task as TaskType) || 'general';

  console.log(`[AI_ROUTER] ${params.task} → omniseen-ai/${task}`);

  const messages: AIMessage[] = params.messages.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }));

  const result = await generateTextWithRetry(task, messages, {
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    responseFormat: params.responseFormat,
    maxRetries: 3,
  });

  // Log cost for accounting
  if (result.success) {
    const pricing = COST_TABLE[result.model] || { input: 0.15, output: 0.60 };
    const costUsd = (result.tokensIn / 1_000_000) * pricing.input +
                    (result.tokensOut / 1_000_000) * pricing.output;
    console.log(`[AI_ROUTER] ${params.task}: ✅ ${result.provider}/${result.model} | ${result.tokensIn}+${result.tokensOut} tokens | $${costUsd.toFixed(6)} | ${result.latencyMs}ms`);
  } else {
    console.error(`[AI_ROUTER] ${params.task}: ❌ ${result.error}`);
  }

  return result;
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
    const { task, messages, temperature, maxTokens } = body;

    if (!task || !messages) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: task, messages" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_TASKS.includes(task)) {
      return new Response(
        JSON.stringify({ error: `Unknown task: ${task}. Valid: ${VALID_TASKS.join(', ')}` }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const result = await callAI({ task, messages, temperature, maxTokens });

    const status = result.success ? 200 :
      (result.error?.includes('RATE_LIMITED') ? 429 :
       result.error?.includes('PAYMENT_REQUIRED') ? 402 : 500);

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
