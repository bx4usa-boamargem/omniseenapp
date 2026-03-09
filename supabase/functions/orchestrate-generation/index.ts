import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { injectImagesIntoContent, validateContentStructure } from "../_shared/imageInjector.ts";
import { QUALITY_GATE, getMinWordCount } from "../_shared/superPageEngine.ts";

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
  serviceKey: string
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
  ]);

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
  serviceKey: string
): Promise<{ output: { outline: OutlineData }; aiResult: AIRouterResult }> {
  const keyword = (jobInput.keyword as string) || '';
  const city = (jobInput.city as string) || '';
  const niche = (jobInput.niche as string) || '';
  const language = (jobInput.language as string) || 'pt-BR';
  const jobType = ((jobInput.job_type as string) || 'article') as 'article' | 'super_page';

  const wordHint = jobType === 'super_page'
    ? 'Support 3000-6000 words: 6-10 H2 sections, 2-4 H3 per H2.'
    : 'Support 1500-3000 words: 4-6 H2 sections, 2-3 H3 per H2.';

  const prompt = `You are an SEO content architect. Create a strict outline for a blog article.

Keyword: ${keyword}
City/region: ${city || 'Brazil'}
Niche: ${niche}
Language: ${language}
Content type: ${jobType}

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
  ]);

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
  ]);

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
  ]);

  if (!aiResult.success) throw new Error(`ENTITY_EXTRACTION_FAILED: ${aiResult.error}`);
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
    : businessName ? `Include a CTA for ${businessName}` : 'Include a strong contact CTA';

  const wordRange = jobType === 'super_page' ? '3000–6000' : '1500–3000';
  const outlineJson = JSON.stringify(outline, null, 0);
  const entitiesJson = JSON.stringify(entities, null, 0);
  const perSectionEntities = entityCoverage.assignment.map((a) => `Section "${a.sectionTitle}": cover these terms naturally: ${a.terms.slice(0, 8).join(', ')}`).join('\n');

  const prompt = `You are a senior SEO content strategist. Write a FULL article following this EXACT outline. Content type: ${jobType}.

INPUT:
- keyword: ${keyword}
- city: ${city || 'Brazil'}
- niche: ${niche}
- language: ${language}
- serp_summary: ${serpSummary || 'No competitive data'}

MANDATORY OUTLINE (follow this structure exactly; write each H2 and H3 section):
${outlineJson}

ENTITY COVERAGE — distribute and cover these per section (improves semantic score):
${perSectionEntities}

SEMANTIC ENTITIES (full list to weave in naturally):
${entitiesJson}

REQUIREMENTS:
1) Word count: ${wordRange} words.
2) Use the exact H1 and H2/H3 from the outline. Do not skip or merge sections.
3) Answer-first introduction. Real-world examples for the city.
4) ${ctaInfo}
5) FAQ section with 3–5 questions at the end.
6) Clean HTML with <style> and inline CSS. First content element must be <h1>.
7) Tone: authoritative, practical. No keyword stuffing.

IMAGE: Return one image description for the hero (realistic, specific to keyword and city).

OUTPUT FORMAT (STRICT JSON only):
{
  "title": "...",
  "meta_description": "... max 155 chars ...",
  "html_article": "<!DOCTYPE html><html>...",
  "faq": [{"question": "...", "answer": "..."}],
  "image_prompt": "... detailed hero image description ..."
}`;

  const aiResult = await callAIRouter(supabaseUrl, serviceKey, 'article_gen_from_outline', [
    { role: 'system', content: `You are a premium SEO writer for ${niche} in ${language}. Return ONLY valid JSON. No markdown, no code blocks.` },
    { role: 'user', content: prompt },
  ]);

  if (!aiResult.success) throw new Error(`CONTENT_GEN_FAILED: ${aiResult.error}`);
  const parsed = parseAIJson(aiResult.content, 'CONTENT_GEN');
  if (!parsed.title) throw new Error('CONTENT_GEN: missing title');
  if (!parsed.html_article) throw new Error('CONTENT_GEN: missing html_article');
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
  const wordCountTarget = contentType === 'super_page' ? 4500 : 2250;

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

const GEMINI_IMAGE_MODEL = "google/gemini-2.5-flash-image";
const LOVABLE_IMAGE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function generateOneImage(prompt: string, apiKey: string): Promise<{ url: string; base64?: string } | null> {
  const res = await fetch(LOVABLE_IMAGE_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL,
      messages: [{ role: "user", content: `Generate a professional, realistic 16:9 image for a blog. ${prompt}. Style: editorial, high quality.` }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl?.startsWith("data:")) return null;
  return { url: imageUrl, base64: imageUrl };
}

async function executeImageGenGeminiNanoBanana(
  articleId: string | null,
  articleData: Record<string, unknown>,
  outline: OutlineData,
  jobInput: Record<string, unknown>,
  supabase: any
): Promise<Record<string, unknown>> {
  if (!articleId) return { skipped: true, reason: "no_article_id" };
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { skipped: true, reason: "LOVABLE_API_KEY not set" };

  const heroPrompt = (articleData.image_prompt as string) || (articleData.title as string) || (jobInput.keyword as string) || "professional blog";
  const keyword = (jobInput.keyword as string) || "article";
  const slug = keyword.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const contentImages: { context: string; url: string; alt?: string; after_section: number }[] = [];
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
      }
    }
    if (!heroUrl) {
      heroUrl = `https://picsum.photos/seed/${slug}-hero/1024/576`;
      heroAlt = `${keyword} — imagem ilustrativa`;
    }
    await supabase.from("articles").update({ featured_image_url: heroUrl, featured_image_alt: heroAlt }).eq("id", articleId);

    const html = (articleData.html_article as string) || "";
    const sectionCount = (html.match(/<h2[^>]*>/gi) || []).length;
    const maxSectionImages = Math.min(sectionCount, 8);
    for (let i = 0; i < maxSectionImages; i++) {
      const sectionTitle = outline.h2[i]?.title || `Section ${i + 1}`;
      const prompt = `${keyword}, ${sectionTitle}. Editorial, realistic.`;
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
      contentImages.push({ context: sectionTitle, url, alt: sectionTitle, after_section: i + 1 });
    }

    if (contentImages.length > 0 && validateContentStructure(html)) {
      const injected = injectImagesIntoContent(html, contentImages.map((c) => ({ ...c, alt: c.alt })));
      if (injected.injected > 0) {
        await supabase.from("articles").update({ content: injected.content, content_images: contentImages }).eq("id", articleId);
      }
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

  const minWords = getMinWordCount(jobType);
  const entityOk = entityCoverageScore >= QUALITY_GATE.ENTITY_COVERAGE_MIN;
  const wordOk = wordCount >= minWords;
  const faqOk = faqCount >= QUALITY_GATE.FAQ_MIN_ITEMS;
  const scoreOk = contentScore >= QUALITY_GATE.SEMANTIC_SCORE_MIN;

  const passed = entityOk && wordOk && faqOk && scoreOk;
  const reasons: string[] = [];
  if (!entityOk) reasons.push(`entity_coverage ${entityCoverageScore} < ${QUALITY_GATE.ENTITY_COVERAGE_MIN}`);
  if (!wordOk) reasons.push(`word_count ${wordCount} < ${minWords}`);
  if (!faqOk) reasons.push(`faq_items ${faqCount} < ${QUALITY_GATE.FAQ_MIN_ITEMS}`);
  if (!scoreOk) reasons.push(`semantic_score ${contentScore} < ${QUALITY_GATE.SEMANTIC_SCORE_MIN}`);

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

  return { passed, entityOk, wordOk, faqOk, scoreOk, reasons, quality_gate_status: qualityGateStatus };
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

  const jobInput = { ...(job.input as Record<string, unknown> || {}), job_type: jobType };
  console.log(`[ORCHESTRATOR:V2] job_id=${jobId} input=${JSON.stringify({ keyword: jobInput.keyword, city: jobInput.city, niche: jobInput.niche, job_type: jobType })}`);

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
        executeSerpSummary(jobInput, supabaseUrl, serviceKey),
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
      const gapResult = await withTimeout(executeSerpGapAnalysis(jobInput, serpSummaryText, supabaseUrl, serviceKey), 25_000, 'SERP_GAP_ANALYSIS');
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
      executeOutlineGen(jobInput, serpSummaryText, supabaseUrl, serviceKey),
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
    const entityCoverage = executeEntityCoverage(outline, entities);
    console.log(`[V2] Step: ENTITY_COVERAGE | score=${entityCoverage.coverageScore}`);
    await updatePublicStatus(supabase, jobId, 'ENTITY_COVERAGE', true, lockId);

    // ============================================================
    // STEP: CONTENT_GEN (outline-driven + entity coverage)
    // ============================================================
    console.log(`[V2] Step: CONTENT_GEN`);
    await updatePublicStatus(supabase, jobId, 'CONTENT_GEN', false, lockId);
    await supabase.from('generation_jobs').update({ current_step: 'CONTENT_GEN' }).eq('id', jobId);

    const genStepId = await createStepOrFail(supabase, jobId, 'CONTENT_GEN', { keyword: jobInput.keyword, job_type: jobType });
    const genStart = Date.now();
    let articleData: Record<string, unknown>;
    try {
      const genResult = await withTimeout(
        executeContentGenFromOutline(jobInput, serpSummaryText, outline, entities, entityCoverage, jobType, supabaseUrl, serviceKey),
        120_000, 'CONTENT_GEN'
      );
      articleData = genResult.output;
      totalApiCalls++;
      totalCostUsd += genResult.aiResult.costUsd || 0;
      await supabase.from('generation_steps').update({
        status: 'completed', output: { title: articleData.title }, latency_ms: Date.now() - genStart,
        completed_at: new Date().toISOString(), model_used: genResult.aiResult.model,
        provider: genResult.aiResult.provider, cost_usd: genResult.aiResult.costUsd,
      }).eq('id', genStepId);
    } catch (firstErr) {
      console.warn(`[V2] CONTENT_GEN first attempt failed: ${firstErr instanceof Error ? firstErr.message : 'unknown'}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
      const retryResult = await withTimeout(
        executeContentGenFromOutline(jobInput, serpSummaryText, outline, entities, entityCoverage, jobType, supabaseUrl, serviceKey),
        120_000, 'CONTENT_GEN_RETRY'
      );
      articleData = retryResult.output;
      totalApiCalls++;
      totalCostUsd += retryResult.aiResult.costUsd || 0;
      await supabase.from('generation_steps').update({
        status: 'completed', output: { title: articleData.title, retried: true }, latency_ms: Date.now() - genStart,
        completed_at: new Date().toISOString(), model_used: retryResult.aiResult.model, provider: retryResult.aiResult.provider, cost_usd: retryResult.aiResult.costUsd,
      }).eq('id', genStepId);
    }
    await updatePublicStatus(supabase, jobId, 'CONTENT_GEN', true, lockId);
    await supabase.from('generation_jobs').update({ total_api_calls: totalApiCalls, cost_usd: totalCostUsd }).eq('id', jobId);
    console.log(`[V2] ✅ CONTENT_GEN ${Date.now() - genStart}ms | title="${(articleData!.title as string || '').slice(0, 50)}"`);

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
      await supabase.from('articles').update({ images_pending: true }).eq('id', saveOutput.article_id);

      // Fire-and-forget: invoke async image generation function
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      fetch(`${supabaseUrl}/functions/v1/generate-article-images-async`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_id: saveOutput.article_id,
          keyword: jobInput.keyword || '',
          outline_h2: outline?.h2 || [],
          job_id: jobId,
          step_id: imgStepId,
        }),
      }).catch(e => console.warn('[V2] IMAGE_GEN async invoke error (non-fatal):', e));

      console.log(`[V2] ✅ IMAGE_GEN dispatched async for article ${saveOutput.article_id}`);
    } catch (imgErr) {
      const imgErrMsg = imgErr instanceof Error ? imgErr.message : 'Image gen dispatch failed';
      console.warn(`[V2] ⚠️ IMAGE_GEN failed (non-fatal): ${imgErrMsg}`);
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: any = createClient(supabaseUrl, serviceKey);

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
