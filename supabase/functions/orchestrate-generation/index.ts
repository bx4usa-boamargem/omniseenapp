import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * orchestrate-generation — OmniSeen Article Engine v2
 * 
 * Ultra Fast SEO Mode — 5-step pipeline
 * 
 * States: PENDING -> INPUT_VALIDATION -> SERP_SUMMARY -> 
 *         ARTICLE_GEN_SINGLE_PASS -> SAVE_ARTICLE -> IMAGE_GEN_ASYNC -> COMPLETED | FAILED
 * 
 * Generates complete article in 30-60 seconds with contextual AI image.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// CONSTANTS
// ============================================================

const MAX_JOB_TIME_MS = 120_000;
const MAX_API_CALLS = 5;
const LOCK_TTL_MS = 120_000;

// ============================================================
// PUBLIC STAGE MAPPING (client-facing progress)
// ============================================================
const PUBLIC_STAGE_MAP: Record<string, { stage: string; progress: number; message: string }> = {
  'INPUT_VALIDATION':         { stage: 'ANALYZING_MARKET',  progress: 5,   message: 'Inicializando inteligência artificial...' },
  'SERP_SUMMARY':             { stage: 'ANALYZING_MARKET',  progress: 20,  message: 'Analisando mercado e concorrentes...' },
  'ARTICLE_GEN_SINGLE_PASS':  { stage: 'WRITING_CONTENT',   progress: 50,  message: 'Criando seu conteúdo completo...' },
  'SAVE_ARTICLE':             { stage: 'FINALIZING',        progress: 85,  message: 'Salvando artigo...' },
  'IMAGE_GEN_ASYNC':          { stage: 'FINALIZING',        progress: 95,  message: 'Gerando imagem contextual...' },
};

const PIPELINE_STEPS = [
  'INPUT_VALIDATION',
  'SERP_SUMMARY',
  'ARTICLE_GEN_SINGLE_PASS',
  'SAVE_ARTICLE',
  'IMAGE_GEN_ASYNC',
] as const;

type StepName = typeof PIPELINE_STEPS[number];

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
  supabase: ReturnType<typeof createClient>,
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
  options?: { temperature?: number; maxTokens?: number }
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
  const errors: string[] = [];
  if (!jobInput?.keyword || (jobInput.keyword as string).trim().length < 2) errors.push('keyword obrigatório (min 2 chars)');
  if (!jobInput?.niche || (jobInput.niche as string).trim().length < 2) errors.push('niche obrigatório');
  if (errors.length > 0) {
    throw new Error(`Input validation failed: ${errors.join('; ')}`);
  }
  return { validated: true, keyword: jobInput.keyword, city: jobInput.city, niche: jobInput.niche };
}

// ============================================================
// STEP 2: SERP_SUMMARY (lightweight, optional)
// ============================================================

async function executeSerpSummary(
  jobInput: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string
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
  ]);

  if (!aiResult.success) throw new Error(`SERP_SUMMARY_FAILED: ${aiResult.error}`);
  return { output: { serp_summary: aiResult.content }, aiResult };
}

// ============================================================
// STEP 3: ARTICLE_GEN_SINGLE_PASS
// ============================================================

async function executeArticleGenSinglePass(
  jobInput: Record<string, unknown>,
  serpSummary: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ output: Record<string, unknown>; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const niche = (jobInput.niche as string) || '';
  const language = (jobInput.language as string) || 'pt-BR';
  const whatsapp = (jobInput.whatsapp as string) || '';
  const businessName = (jobInput.business_name as string) || '';

  const ctaInfo = whatsapp
    ? `Include a WhatsApp CTA: ${whatsapp}${businessName ? ` (${businessName})` : ''}`
    : businessName
      ? `Include a CTA for ${businessName}`
      : 'Include a strong contact CTA';

  const prompt = `You are a senior SEO content strategist and conversion copywriter.
Create a HIGH-QUALITY, conversion-optimized, SEO-first article.

INPUT:
- keyword: ${keyword}
- city: ${city || 'Brazil'}
- niche: ${niche}
- language: ${language}
- serp_summary: ${serpSummary || 'No competitive data available'}

REQUIREMENTS:
1) Write between 900–1500 words.
2) Strong H1, structured H2/H3.
3) Use Answer-First introduction.
4) Include real-world examples for the city.
5) ${ctaInfo}
6) Include FAQ section with 3–5 questions.
7) Avoid generic filler text.
8) Tone: authoritative but practical.
9) Optimize for semantic SEO naturally (no keyword stuffing).
10) Write in clean HTML format with inline CSS styles.
11) The HTML must include <style> tag with professional styling.
12) The HTML must start with <h1> as the first content element.

IMAGE REQUIREMENTS:
Return also an image description that matches the article topic.
The image description MUST:
- Be realistic
- Be specific to the keyword and city
- Avoid generic stock-photo clichés
- Include environment, mood, and context
- Be suitable for AI image generation

OUTPUT FORMAT (STRICT JSON):
{
  "title": "...",
  "meta_description": "... max 155 chars ...",
  "html_article": "<!DOCTYPE html><html>...",
  "faq": [
    {"question": "...", "answer": "..."}
  ],
  "image_prompt": "... detailed realistic description ..."
}`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'article_gen_single_pass', [
    { role: 'system', content: `You are a premium SEO content writer for the ${niche} niche in ${language}. Return ONLY valid JSON. No markdown, no code blocks, no explanations outside the JSON.` },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) throw new Error(`ARTICLE_GEN_FAILED: ${aiResult.error}`);

  const parsed = parseAIJson(aiResult.content, 'ARTICLE_GEN_SINGLE_PASS');

  // Validate required fields
  if (!parsed.title) throw new Error('ARTICLE_GEN: missing title');
  if (!parsed.html_article) throw new Error('ARTICLE_GEN: missing html_article');

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
  supabase: ReturnType<typeof createClient>,
  totalApiCalls: number,
  totalCostUsd: number
): Promise<Record<string, unknown>> {
  const blogId = (jobInput.blog_id as string);
  if (!blogId) throw new Error('blog_id missing from jobInput');

  const title = (articleData.title as string) || (jobInput.keyword as string) || '';
  const htmlArticle = (articleData.html_article as string) || '';
  const metaDescription = (articleData.meta_description as string) || '';
  const faqItems = (articleData.faq as Array<Record<string, unknown>>) || [];
  const imagePrompt = (articleData.image_prompt as string) || '';

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

  // Calculate word count
  const textContent = htmlArticle.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 200);

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

  const insertPayload = {
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
    source_payload: { image_prompt: imagePrompt } as unknown,
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
// STEP 5: IMAGE_GEN_ASYNC (contextual AI image)
// ============================================================

async function executeImageGenAsync(
  articleId: string | null,
  imagePrompt: string,
  jobInput: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, unknown>> {
  if (!articleId) {
    console.warn('[IMAGE_GEN_ASYNC] No article_id, skipping image generation');
    return { skipped: true, reason: 'no_article_id' };
  }

  if (!imagePrompt || imagePrompt.trim().length < 10) {
    console.warn('[IMAGE_GEN_ASYNC] No valid image_prompt, using fallback');
    const keyword = (jobInput.keyword as string) || 'article';
    const slug = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fallbackUrl = `https://picsum.photos/seed/${slug}-hero/1024/576`;
    await supabase.from('articles').update({
      featured_image_url: fallbackUrl,
      featured_image_alt: `${keyword} — imagem ilustrativa`,
    }).eq('id', articleId);
    return { fallback: true, url: fallbackUrl };
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    console.log(`[IMAGE_GEN_ASYNC] Generating image with prompt: "${imagePrompt.substring(0, 100)}..."`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `Generate a professional, realistic 16:9 aspect ratio image for a blog article. The image should be: ${imagePrompt}. Style: editorial photography, high quality, realistic lighting.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Image API HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    // Upload base64 image to storage
    const base64Match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Image URL is not base64 format');
    }

    const imageFormat = base64Match[1];
    const base64Data = base64Match[2];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const fileName = `${articleId}-hero.${imageFormat}`;

    const { error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(fileName, binaryData, {
        contentType: `image/${imageFormat}`,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('article-images')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // Update article with the image URL
    await supabase.from('articles').update({
      featured_image_url: publicUrl,
      featured_image_alt: imagePrompt.substring(0, 200),
    }).eq('id', articleId);

    console.log(`[IMAGE_GEN_ASYNC] ✅ Image generated and uploaded: ${publicUrl}`);
    return { success: true, url: publicUrl, prompt_used: imagePrompt };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown image error';
    console.error(`[IMAGE_GEN_ASYNC] ❌ Failed: ${errMsg}. Using fallback.`);

    // Fallback to picsum
    const keyword = (jobInput.keyword as string) || 'article';
    const slug = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fallbackUrl = `https://picsum.photos/seed/${slug}-hero/1024/576`;
    await supabase.from('articles').update({
      featured_image_url: fallbackUrl,
      featured_image_alt: `${keyword} — imagem ilustrativa`,
    }).eq('id', articleId);

    return { fallback: true, url: fallbackUrl, error: errMsg };
  }
}

// ============================================================
// ORCHESTRATOR CORE (v2: 5-step pipeline)
// ============================================================

async function orchestrate(jobId: string, supabase: ReturnType<typeof createClient>, supabaseUrl: string, serviceKey: string): Promise<void> {
 try { // TOP-LEVEL SAFETY NET
  const jobStart = Date.now();

  const { data: job, error: jobError } = await supabase.from('generation_jobs').select('*').eq('id', jobId).single();
  if (jobError || !job) { console.error(`[ORCHESTRATOR] Job ${jobId} not found:`, jobError); return; }
  if (['completed', 'failed', 'cancelled'].includes(job.status)) { console.log(`[ORCHESTRATOR] Job ${jobId} already ${job.status}.`); return; }

  // Signal boot
  await supabase.from('generation_jobs').update({
    public_stage: 'ANALYZING_MARKET',
    public_progress: 3,
    public_message: 'Inicializando motor de geração v2...',
    public_updated_at: new Date().toISOString(),
  }).eq('id', jobId);
  console.log('[ORCHESTRATOR_BOOT:V2]', jobId);

  const jobInput = job.input as Record<string, unknown> || {};
  console.log(`[ORCHESTRATOR:V2] job_id=${jobId} input=${JSON.stringify({ keyword: jobInput.keyword, city: jobInput.city, niche: jobInput.niche })}`);

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
    console.log(`[V2] Step 1/5: INPUT_VALIDATION`);
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
    // STEP 2: SERP_SUMMARY (optional, non-fatal)
    // ============================================================
    console.log(`[V2] Step 2/5: SERP_SUMMARY`);
    await updatePublicStatus(supabase, jobId, 'SERP_SUMMARY', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SERP_SUMMARY' }).eq('id', jobId);

    let serpStepId: string | null = null;
    let serpSummaryText = '';
    const serpStart = Date.now();
    try {
      serpStepId = await createStepOrFail(supabase, jobId, 'SERP_SUMMARY', { keyword: jobInput.keyword, city: jobInput.city });

      const serpResult = await withTimeout(
        executeSerpSummary(jobInput, supabaseUrl, serviceKey),
        30_000, 'SERP_SUMMARY'
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
      console.log(`[V2] ✅ SERP_SUMMARY ${Date.now() - serpStart}ms`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'SERP failed';
      console.warn(`[V2] ⚠️ SERP_SUMMARY failed (non-fatal): ${errMsg}`);
      if (serpStepId) {
        await supabase.from('generation_steps').update({
          status: 'completed', output: { serp_summary: '', error: errMsg }, latency_ms: Date.now() - serpStart,
          completed_at: new Date().toISOString(), model_used: 'fallback', provider: 'fallback',
          error_message: errMsg,
        }).eq('id', serpStepId);
      }
    }
    await updatePublicStatus(supabase, jobId, 'SERP_SUMMARY', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);

    // ============================================================
    // STEP 3: ARTICLE_GEN_SINGLE_PASS (core)
    // ============================================================
    console.log(`[V2] Step 3/5: ARTICLE_GEN_SINGLE_PASS`);
    await updatePublicStatus(supabase, jobId, 'ARTICLE_GEN_SINGLE_PASS', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'ARTICLE_GEN_SINGLE_PASS' }).eq('id', jobId);

    const genStepId = await createStepOrFail(supabase, jobId, 'ARTICLE_GEN_SINGLE_PASS', { keyword: jobInput.keyword, serp_summary_length: serpSummaryText.length });

    const genStart = Date.now();
    let articleData: Record<string, unknown>;

    // 1x retry for parse errors
    try {
      const genResult = await withTimeout(
        executeArticleGenSinglePass(jobInput, serpSummaryText, supabaseUrl, serviceKey),
        90_000, 'ARTICLE_GEN_SINGLE_PASS'
      );
      articleData = genResult.output;
      totalApiCalls++;
      totalCostUsd += genResult.aiResult.costUsd || 0;

      await supabase.from('generation_steps').update({
        status: 'completed', output: { title: articleData.title, word_count: ((articleData.html_article as string) || '').length },
        latency_ms: Date.now() - genStart, completed_at: new Date().toISOString(),
        model_used: genResult.aiResult.model, provider: genResult.aiResult.provider,
        cost_usd: genResult.aiResult.costUsd, tokens_in: genResult.aiResult.tokensIn,
        tokens_out: genResult.aiResult.tokensOut,
      }).eq('id', genStepId);
    } catch (firstErr) {
      console.warn(`[V2] ARTICLE_GEN first attempt failed: ${firstErr instanceof Error ? firstErr.message : 'unknown'}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));

      const retryResult = await withTimeout(
        executeArticleGenSinglePass(jobInput, serpSummaryText, supabaseUrl, serviceKey),
        90_000, 'ARTICLE_GEN_SINGLE_PASS_RETRY'
      );
      articleData = retryResult.output;
      totalApiCalls++;
      totalCostUsd += retryResult.aiResult.costUsd || 0;

      await supabase.from('generation_steps').update({
        status: 'completed', output: { title: articleData.title, retried: true },
        latency_ms: Date.now() - genStart, completed_at: new Date().toISOString(),
        model_used: retryResult.aiResult.model, provider: retryResult.aiResult.provider,
        cost_usd: retryResult.aiResult.costUsd,
      }).eq('id', genStepId);
    }

    await updatePublicStatus(supabase, jobId, 'ARTICLE_GEN_SINGLE_PASS', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
    console.log(`[V2] ✅ ARTICLE_GEN_SINGLE_PASS ${Date.now() - genStart}ms | title="${(articleData!.title as string || '').substring(0, 50)}"`);

    // ============================================================
    // STEP 4: SAVE_ARTICLE (programmatic)
    // ============================================================
    console.log(`[V2] Step 4/5: SAVE_ARTICLE`);
    await updatePublicStatus(supabase, jobId, 'SAVE_ARTICLE', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'SAVE_ARTICLE' }).eq('id', jobId);

    const saveStepId = await createStepOrFail(supabase, jobId, 'SAVE_ARTICLE', { title: articleData!.title });

    const saveStart = Date.now();
    const saveOutput = await executeSaveArticle(jobId, articleData!, jobInput, supabase, totalApiCalls, totalCostUsd);
    const saveLatency = Date.now() - saveStart;

    await supabase.from('generation_steps').update({
      status: 'completed', output: saveOutput, latency_ms: saveLatency,
      completed_at: new Date().toISOString(), model_used: 'programmatic', provider: 'programmatic',
    }).eq('id', saveStepId);
    await updatePublicStatus(supabase, jobId, 'SAVE_ARTICLE', true, lockId);
    console.log(`[V2] ✅ SAVE_ARTICLE ${saveLatency}ms | article_id=${saveOutput.article_id}`);

    // ============================================================
    // STEP 5: IMAGE_GEN_ASYNC (non-blocking)
    // ============================================================
    console.log(`[V2] Step 5/5: IMAGE_GEN_ASYNC`);
    await updatePublicStatus(supabase, jobId, 'IMAGE_GEN_ASYNC', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'IMAGE_GEN_ASYNC' }).eq('id', jobId);

    let imgStepId: string | null = null;
    try {
      imgStepId = await createStepOrFail(supabase, jobId, 'IMAGE_GEN_ASYNC', { image_prompt: ((articleData!.image_prompt as string) || '').substring(0, 200) });

      const imgStart = Date.now();
      const imgOutput = await withTimeout(
        executeImageGenAsync(
          saveOutput.article_id as string | null,
          (articleData!.image_prompt as string) || '',
          jobInput,
          supabase
        ),
        60_000, 'IMAGE_GEN_ASYNC'
      );
      const imgLatency = Date.now() - imgStart;

      await supabase.from('generation_steps').update({
        status: 'completed', output: imgOutput, latency_ms: imgLatency,
        completed_at: new Date().toISOString(),
        model_used: imgOutput.fallback ? 'picsum-fallback' : 'gemini-2.5-flash-image',
        provider: imgOutput.fallback ? 'fallback' : 'lovable-gateway',
      }).eq('id', imgStepId);

      if (!imgOutput.fallback) totalApiCalls++;
      console.log(`[V2] ✅ IMAGE_GEN_ASYNC ${imgLatency}ms | ${imgOutput.fallback ? 'FALLBACK' : 'AI_GENERATED'}`);
    } catch (imgErr) {
      const imgErrMsg = imgErr instanceof Error ? imgErr.message : 'Image gen failed';
      console.warn(`[V2] ⚠️ IMAGE_GEN_ASYNC failed (non-fatal): ${imgErrMsg}`);
      if (imgStepId) {
        await supabase.from('generation_steps').update({
          status: 'failed', error_message: imgErrMsg, completed_at: new Date().toISOString(),
        }).eq('id', imgStepId);
      }
    }
    await updatePublicStatus(supabase, jobId, 'IMAGE_GEN_ASYNC', true, lockId);

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { job_id } = await req.json();
    console.log('[ORCHESTRATOR_HANDLER_ENTRY:V2]', job_id);
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await orchestrate(job_id, supabase, supabaseUrl, serviceKey);
    return new Response(JSON.stringify({ success: true, job_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[ORCHESTRATOR:V2] Fatal:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
