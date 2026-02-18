import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildUniversalPrompt, type ClientStrategy, type FunnelMode, type ArticleGoal } from '../_shared/promptTypeCore.ts';
import { resolveStrategy } from '../_shared/strategyResolver.ts';
import { validateArticleQuality, validateGeoArticleQuality, generateCorrectionInstructions } from '../_shared/qualityValidator.ts';
import { generateAutoKeywords, mergeKeywords } from '../_shared/keywordGenerator.ts';
import { sanitizeTitle, sanitizeTitleInContent, validateTitleForPublication, TITLE_RULES_PROMPT } from '../_shared/titleValidator.ts';
// V2.0: Import niche profile and guard for deterministic architecture
import { getNicheProfile, getNichePromptInstructions, validateRequiredTerms, type NicheProfile } from '../_shared/nicheProfile.ts';
import { validateAndSanitize, logBlockedAttempt } from '../_shared/nicheGuard.ts';
import {
  GEO_WRITER_IDENTITY,
  GEO_WRITER_RULES,
  GEO_LINKING_RULES,
  fetchGeoResearchData,
  buildResearchInjection,
  buildTerritorialContext,
  buildWhatsAppCTABlock,
  buildInternalLinksBlock,
  buildExternalSourcesBlock,
  countGeoWords,
  countGeoPhrasesInContent,
  hasAnswerFirstPattern,
  hasTerritorialMentions,
  countInternalLinks,
  countExternalLinks,
  hasWhatsAppCTA,
  validateGeoArticleFull,
  generateGeoCorrectionInstructions,
  // V2.1: Article Engine E-E-A-T
  injectLocalExperience,
  NICHE_EAT_PHRASES,
  type TerritoryData as GeoTerritoryData,
  type GeoResearchData,
  type GeoValidationResult
} from '../_shared/geoWriterCore.ts';

// V2.1: Article Engine imports (Sprint 2+3 Integration)
import { 
  selectTemplate, 
  classifyIntent,
  type TemplateType,
  type TemplateSelectionResult
} from '../_shared/templateSelector.ts';

// V6.0: Elite Engine V2 imports
import { 
  getEditorialDecision, 
  buildBlocksPromptInjection,
  buildAnglePromptInstructions,
  HEADING_BLACKLIST_PROMPT,
  type EditorialDecision
} from '../_shared/editorialOrchestrator.ts';
import { 
  runFootprintChecks, 
  generateH2PatternHash,
  buildAutoFixPrompt
} from '../_shared/footprintChecks.ts';
import { normalizeNiche } from '../_shared/editorialOrchestrator.ts';
import { buildLocalPromptInjection, buildMicroGeoEntities } from '../_shared/localIntelligence.ts';

import { 
  validateBrief, 
  buildOutlineStructure,
  selectTemplateForBrief,
  type ArticleBrief,
  type OutlineStructure
} from '../_shared/pipelineStages.ts';

import { 
  generateImageAlt,
  generateMultipleAlts,
  type ImageAltContext,
  type GeneratedAlt
} from '../_shared/imageAltGenerator.ts';

// V3.0: Quality Gate imports (Anti-Loop Architecture)
import { runQualityGate } from '../_shared/qualityGate.ts';
import { parseArticleJSONStrict } from '../_shared/jsonParser.ts';
import { QUALITY_GATE_CONFIG, ERROR_CODES, ERROR_MESSAGES, type ArticleMode } from '../_shared/qualityGateConfig.ts';

// V3.1: AI Provider Layer (Unified Entry Point for ALL AI calls)
import { 
  callWriter, 
  callQA, 
  generateArticleImagesViaProvider,
  generateUnsplashFallback, // V4.1: For image timeout fallback
  type WriterRequest,
  type QARequest
} from '../_shared/aiProviders.ts';
import { AI_CONFIG, logAICall } from '../_shared/aiConfig.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Minimal local types (present in original file; re-declared here) ---------

type GenerationMode = 'fast' | 'deep';

interface ArticleData {
  title: string;
  content?: string;
  excerpt?: string;
  meta_description?: string;
  faq?: Array<{ question: string; answer: string }>;
  keywords?: string[];
  reading_time?: number;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  image_prompts?: Array<{ context: string; prompt: string; after_section: number }>;
  // deno-lint-ignore no-explicit-any
  images?: any;
}

interface EditorialTemplate {
  company_name?: string;
  target_niche?: string;
  content_focus?: string;
  mandatory_structure?: Array<{ heading: string; key_message: string }>;
  title_guidelines?: string;
  tone_rules?: string;
  seo_settings?: {
    main_keyword?: string;
    secondary_keywords?: string[];
    search_intent?: string;
  };
  cta_template?: string;
  image_guidelines?: {
    cover?: string;
    internal?: string;
    style?: string;
  };
  category_default?: string;
}

interface ArticleRequest {
  theme: string;
  keywords?: string[];
  tone?: string;
  category?: string;
  editorial_template?: EditorialTemplate;
  image_count?: number;
  word_count?: number;
  user_id?: string;
  blog_id?: string;
  section_count?: number;
  include_faq?: boolean;
  include_conclusion?: boolean;
  include_visual_blocks?: boolean;
  optimize_for_ai?: boolean;
  source?: 'chat' | 'instagram' | 'youtube' | 'pdf' | 'url' | 'form' | 'opportunity';
  editorial_model?: 'traditional' | 'strategic' | 'visual_guided';
  generation_mode?: GenerationMode;
  auto_publish?: boolean;
  territoryId?: string;
  // GEO MODE FIELDS (V2.0)
  geo_mode?: boolean;
  internal_links?: Array<{url: string; anchor: string}>;
  external_sources?: Array<{url: string; title: string}>;
  whatsapp?: string;
  google_place?: Record<string, unknown>;
  // V2.1: Article Engine fields (Sprint 4 Integration)
  templateOverride?: string;           // TemplateType override
  useEat?: boolean;                    // Inject E-E-A-T local phrases
  contextualAlt?: boolean;             // Contextual image ALT generation
  niche?: string;                      // Business niche
  mode?: 'entry' | 'authority';        // Article depth mode
  businessName?: string;               // Business name (for ALT/E-E-A-T)
  businessWhatsapp?: string;           // WhatsApp number (for CTA)
  city?: string;                       // City name for local authority
}

interface TerritoryData {
  official_name: string | null;
  neighborhood_tags: string[] | null;
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
}

// --- NEW: pipeline helpers ---------------------------------------------------

type PipelineStage = 'research' | 'writer' | 'seo' | 'qa';

function nowMs(): number {
  return Date.now();
}

function safeJsonParse<T>(text: string): T {
  return JSON.parse(text) as T;
}

async function logStage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  blogId: string | undefined,
  stage: PipelineStage,
  provider: string,
  endpoint: string,
  success: boolean,
  durationMs: number,
  metadata: Record<string, unknown> = {},
  costUsd?: number,
  tokensUsed?: number,
  errorMessage?: string
) {
  if (!blogId) return;
  try {
    await supabase.from('ai_usage_logs').insert({
      blog_id: blogId,
      provider,
      endpoint,
      cost_usd: costUsd ?? 0,
      tokens_used: tokensUsed ?? 0,
      success,
      error_message: errorMessage || null,
      metadata: {
        stage,
        duration_ms: durationMs,
        ...metadata,
      }
    });
  } catch (_e) {
    // non-blocking
  }
}

interface SerpMatrixLite {
  commonTerms?: string[];
  topTitles?: string[];
  contentGaps?: string[];
  averages?: { avgWords?: number; avgH2?: number; avgImages?: number };
  competitors?: Array<{ url: string; title: string }>;
  keyword?: string;
  effectiveKeyword?: string;
}

interface ResearchPackage {
  geo: GeoResearchData;
  serp: SerpMatrixLite;
  sources: string[]; // unified list for governance
  generatedAt: string;
  provider?: 'perplexity' | 'gemini_fallback'; // Track which provider generated the research
}

/**
 * runLightResearchStage - FAST Perplexity-only research (NO Firecrawl)
 * 
 * V4.0: Decoupled from analyze-serp to eliminate blocking on Firecrawl.
 * Time: ~5 seconds vs ~60+ seconds with full SERP analysis.
 * 
 * Deep SERP analysis now happens in background via seo-enhancer-job.
 */
async function runLightResearchStage(params: {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  blogId: string;
  theme: string;
  primaryKeyword: string;
  territoryName: string | null;
  territoryData: GeoTerritoryData | null;
}): Promise<ResearchPackage> {
  const { supabase, blogId, theme, primaryKeyword, territoryName, territoryData } = params;

  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) {
    throw new Error('RESEARCH_REQUIRED: PERPLEXITY_API_KEY not configured');
  }

  const start = nowMs();
  console.log(`[LightResearch] Starting fast research (Perplexity only) for: "${primaryKeyword}"`);

  // ONLY GEO factual package (Perplexity) - ~5 seconds
  // NO analyze-serp, NO Firecrawl - that happens in background job
  const geo = await fetchGeoResearchData(
    theme,
    territoryData,
    PERPLEXITY_API_KEY,
    undefined, // no fallback
    supabase,
    blogId,
    undefined
  );

  const geoDuration = nowMs() - start;

  if (!geo) {
    throw new Error('RESEARCH_REQUIRED: Perplexity research returned null');
  }

  // Sources from Perplexity only (SERP will be empty - filled by background job)
  const sources = [...new Set(geo.sources || [])].filter(Boolean);

  const pkg: ResearchPackage = {
    geo,
    serp: {}, // Empty SERP - will be filled by seo-enhancer-job in background
    sources,
    generatedAt: new Date().toISOString(),
    provider: 'perplexity',
  };

  console.log(`[LightResearch] ✅ Completed in ${geoDuration}ms (Perplexity only, no Firecrawl)`);

  await logStage(supabase, blogId, 'research', 'perplexity', 'light-research', true, geoDuration, {
    geo_ms: geoDuration,
    sources_count: sources.length,
    firecrawl_skipped: true, // V4.0: Firecrawl moved to background
  });

  return pkg;
}

/**
 * LEGACY: runResearchStage - DEPRECATED in favor of runLightResearchStage
 * Kept for backward compatibility but NOT used in main flow.
 * Deep SERP analysis now happens in seo-enhancer-job.
 */
async function runResearchStage(params: {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  blogId: string;
  theme: string;
  primaryKeyword: string;
  territoryName: string | null;
  territoryData: GeoTerritoryData | null;
}): Promise<ResearchPackage> {
  // V4.0: Redirect to light research - deep SERP is now background
  console.warn('[Research] runResearchStage is DEPRECATED - using runLightResearchStage');
  return runLightResearchStage(params);
}

function buildGovernanceBlock(research: ResearchPackage): string {
  // Keep this compact to avoid prompt/context overflow.
  const topTerms = (research.serp.commonTerms || []).slice(0, 12);
  const topTitles = (research.serp.topTitles || []).slice(0, 3);
  const gaps = (research.serp.contentGaps || []).slice(0, 5);
  const sources = (research.sources || []).slice(0, 8);

  return `
# GOVERNANÇA (OBRIGATÓRIA)

Você só pode escrever com base nos dados abaixo.

## INTENÇÃO E CONTEXTO (SERP)
- Títulos top (amostra):\n${topTitles.map(t => `- ${t}`).join('\n')}
- Entidades/termos recorrentes (use no texto):\n${topTerms.map(t => `- ${t}`).join('\n')}
- Gaps (oportunidades):\n${gaps.map(g => `- ${g}`).join('\n')}

## FONTES PERMITIDAS (citar no texto com links)
${sources.map(u => `- ${u}`).join('\n')}

REGRAS:
1) É PROIBIDO inventar estatísticas/tendências/concorrentes fora do pacote.
2) Se faltar dado, diga: "não encontrado nas fontes".
3) Afirmação factual relevante => cite uma fonte permitida.
`;
}

/**
 * DEPRECATED: Direct AI calls removed.
 * All AI calls now go through aiProviders.ts layer.
 * 
 * callWriter() → OpenAI GPT-4o (primary) → Google Gemini (fallback)
 * callQA() → Google Gemini (primary) → OpenAI GPT-4o (fallback)
 * callImageGeneration() → Lovable Gateway (primary) → Unsplash (fallback)
 * callResearch() → Perplexity Sonar-Pro (primary) → Google Gemini (fallback)
 */

// Wrapper to use the new provider layer with tool calls
async function callWriterWithTool(params: {
  system: string;
  user: string;
  toolName: string;
  toolSchema: Record<string, unknown>;
  temperature?: number;
}): Promise<{ arguments: Record<string, unknown>; usage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number }; provider: string }> {
  const { system, user, toolName, toolSchema, temperature = 0.4 } = params;

  const result = await callWriter({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    tool: {
      name: toolName,
      schema: toolSchema
    },
    temperature
  });

  if (!result.success || !result.data) {
    throw new Error(`AI_PROVIDER_ERROR: ${result.fallbackReason || 'Writer call failed'}`);
  }

  const toolCall = result.data.toolCall;
  if (!toolCall?.arguments) {
    // Try parsing content as JSON if no tool call
    if (result.data.content) {
      try {
        const parsed = parseArticleJSON(result.data.content);
        return { 
          arguments: parsed, 
          usage: result.usage,
          provider: result.provider
        };
      } catch {
        throw new Error('AI_OUTPUT_INVALID: missing tool call arguments');
      }
    }
    throw new Error('AI_OUTPUT_INVALID: missing tool call arguments');
  }

  return { 
    arguments: toolCall.arguments, 
    usage: result.usage,
    provider: result.provider
  };
}

// Wrapper for QA calls using provider layer
async function callQAWithProvider(params: {
  system: string;
  user: string;
}): Promise<{ approved: boolean; score: number; issues: Array<{ code: string; message: string }>; usage?: { totalTokens?: number }; provider: string }> {
  const { system, user } = params;

  const result = await callQA({
    systemPrompt: system,
    userPrompt: user
  });

  if (!result.success || !result.data) {
    // QA failure shouldn't block - return default approval with warning
    console.warn('[QA] Provider failed, defaulting to warning mode:', result.fallbackReason);
    return {
      approved: true,
      score: 50,
      issues: [{ code: 'QA_UNAVAILABLE', message: 'QA service temporarily unavailable' }],
      provider: result.provider
    };
  }

  return {
    approved: result.data.approved,
    score: result.data.score,
    issues: result.data.issues,
    usage: result.usage,
    provider: result.provider
  };
}

// ============ CATEGORIA E TAGS AUTOMÁTICAS ============

const ARTICLE_CATEGORIES = [
  'SEO',
  'Automação', 
  'Marketing',
  'Inteligência Artificial',
  'Vendas',
  'Produtividade',
  'Tecnologia',
  'Negócios'
] as const;

function inferCategory(theme: string, content: string, keywords: string[]): string {
  const text = `${theme} ${content} ${keywords.join(' ')}`.toLowerCase();
  
  const categoryPatterns: Record<string, RegExp> = {
    'SEO': /\b(seo|ranqueamento|google|palavras?-?chave|orgânico|serp|backlink|indexação|meta.?description|título.?seo|rank|pesquisa|busca)\b/i,
    'Automação': /\b(automaç|automati|robô|bot|chatbot|workflow|funil|crm|integraç|zapier|n8n|processo.?automático|fluxo)\b/i,
    'Inteligência Artificial': /\b(ia|inteligência.?artificial|gpt|modelo|machine.?learning|ai|agente|prompt|llm|openai|gemini)\b/i,
    'Marketing': /\b(marketing|brand|marca|campanha|estratégia|posicionamento|público|audiência|conteúdo|engajamento|branding|redes.?sociais)\b/i,
    'Vendas': /\b(venda|cliente|lead|conversão|prospecção|fechamento|objeção|proposta|orçamento|negociação|comercial)\b/i,
    'Produtividade': /\b(produtiv|tempo|rotina|organização|gestão.?de.?tempo|eficiência|tarefa|prioridade|foco)\b/i,
    'Tecnologia': /\b(tecnologia|software|app|aplicativo|sistema|plataforma|digital|ferramenta|dashboard|saas)\b/i,
    'Negócios': /\b(negócio|empresa|empreend|gestão|finanç|lucro|crescimento|escala|mercado|empreendedor)\b/i
  };
  
  // Count matches per category
  const scores: Record<string, number> = {};
  for (const [category, pattern] of Object.entries(categoryPatterns)) {
    const matches = text.match(new RegExp(pattern, 'gi'));
    scores[category] = matches?.length || 0;
  }
  
  // Return category with most matches
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topCategory = sorted[0][1] > 0 ? sorted[0][0] : 'Negócios';
  console.log(`[CATEGORY] Inferred category: ${topCategory} (scores: ${JSON.stringify(scores)})`);
  return topCategory;
}

function inferTags(theme: string, content: string, keywords: string[], category: string): string[] {
  const text = `${theme} ${content}`.toLowerCase();
  
  const tagPatterns: Record<string, RegExp> = {
    'guia': /\b(guia|passo.?a.?passo|como.?fazer|tutorial)\b/i,
    'dicas': /\b(dicas?|truques?|segredos?|hacks?)\b/i,
    'estratégia': /\b(estratégia|tática|planejamento|plano)\b/i,
    'ferramentas': /\b(ferramenta|software|app|plataforma|sistema)\b/i,
    'tendências': /\b(tendência|futuro|202[4-9]|novo|novidade)\b/i,
    'case': /\b(case|exemplo|sucesso|resultado|estudo)\b/i,
    'iniciantes': /\b(iniciante|básico|começar|primeiros.?passos)\b/i,
    'avançado': /\b(avançado|profissional|expert|especialista)\b/i,
    'grátis': /\b(grátis|gratuito|free|sem.?custo)\b/i,
    'roi': /\b(roi|retorno|lucro|economia|custo)\b/i,
    'produtividade': /\b(produtiv|eficiência|tempo|otimiz)\b/i,
    'crescimento': /\b(cresc|escala|expan|aument)\b/i
  };
  
  const matchedTags: string[] = [];
  
  // Check patterns
  for (const [tag, pattern] of Object.entries(tagPatterns)) {
    if (pattern.test(text) && matchedTags.length < 5) {
      matchedTags.push(tag);
    }
  }
  
  // Add keywords as tags (up to 5 total)
  const keywordTags = keywords
    .slice(0, 5 - matchedTags.length)
    .map(k => k.toLowerCase().replace(/\s+/g, '-').substring(0, 20));
  
  const finalTags = [...new Set([...matchedTags, ...keywordTags])].slice(0, 5);
  console.log(`[TAGS] Inferred tags: ${finalTags.join(', ')}`);
  return finalTags;
}

// ============ FIM CATEGORIA E TAGS ============

// ============ SANITIZADOR DE CONTEÚDO ============
// Remove lixo, repetições, e textos estranhos antes de persistir

interface SanitizeResult {
  content: string;
  removed: string[];
}

function sanitizeContent(content: string): SanitizeResult {
  const removed: string[] = [];
  let sanitized = content;
  
  // V4.3: PRIMEIRO - Remover markdown fences (```html, ```, etc.)
  const fenceMatches = sanitized.match(/```(?:html|markdown|md|json|text)?/gi);
  if (fenceMatches) {
    removed.push(`Markdown fences removed: ${fenceMatches.length}`);
    // Extract content inside fences, remove the fence markers
    sanitized = sanitized.replace(/```(?:html|markdown|md|json|text)?\n?([\s\S]*?)```/gi, '$1');
  }
  // Also remove standalone ``` markers
  sanitized = sanitized.replace(/```/g, '');
  
  // 1. Remove ocorrências repetidas de "ATENÇÃO" (case-insensitive)
  // V4.3: Negative lookahead para proteger headings (## Atenção:)
  const atencaoPattern = /(?:^|\n)(?!##\s)(?:>?\s*)?(?:⚠️?\s*)?ATENÇÃO[:\s!]*[^\n]*\n?/gi;
  const atencaoMatches = sanitized.match(atencaoPattern);
  if (atencaoMatches && atencaoMatches.length > 1) {
    // Keep only the first occurrence
    let count = 0;
    sanitized = sanitized.replace(atencaoPattern, (match) => {
      count++;
      if (count > 1) {
        removed.push(`Duplicate ATENÇÃO block removed`);
        return '';
      }
      return match;
    });
  }
  
  // 2. Remove strange phrases: "varredura", "verdade dura"
  const strangePatterns = [
    /\b(?:varredura|verdade\s+dura)\b[^.]*\.\s*/gi,
    /(?:^|\n)[^#\n]*(?:varredura|verdade\s+dura)[^#\n]*(?:\n|$)/gi
  ];
  for (const pattern of strangePatterns) {
    const match = sanitized.match(pattern);
    if (match) {
      removed.push(`Strange text removed: "${match[0].substring(0, 50)}..."`);
      sanitized = sanitized.replace(pattern, '\n');
    }
  }
  
  // 3. Remove consecutive duplicate lines
  const lines = sanitized.split('\n');
  const cleanLines: string[] = [];
  let prevLine = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed === prevLine.trim()) {
      removed.push(`Duplicate line removed: "${trimmed.substring(0, 40)}..."`);
      continue;
    }
    cleanLines.push(line);
    prevLine = line;
  }
  sanitized = cleanLines.join('\n');
  
  // 4. Remove duplicate H2 headings (keep only first occurrence)
  const h2Pattern = /^##\s+(.+)$/gm;
  const seenH2s = new Map<string, number>();
  sanitized = sanitized.replace(h2Pattern, (match, heading) => {
    const normalizedHeading = heading.toLowerCase().trim();
    const count = seenH2s.get(normalizedHeading) || 0;
    seenH2s.set(normalizedHeading, count + 1);
    if (count > 0) {
      removed.push(`Duplicate H2 removed: "${heading}"`);
      return ''; // Remove duplicate H2
    }
    return match;
  });
  
  // 5. Clean up excessive whitespace
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');
  
  if (removed.length > 0) {
    console.log(`[Sanitizer] Removed ${removed.length} issues:`, removed);
  }
  
  return { content: sanitized.trim(), removed };
}

// ============ CTA BUILDER ============
// Builds CTA JSON from business profile

// V4.3: Interface atualizada - apenas colunas que EXISTEM na tabela
interface ArticleCTA {
  company_name?: string;
  whatsapp?: string;
  city?: string;
}

async function buildArticleCTA(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  blogId: string
): Promise<ArticleCTA | null> {
  try {
    console.log(`[CTA] Fetching business profile for blog: ${blogId}`);
    
    // V4.3: Query apenas colunas que EXISTEM (phone, booking_url, site, email NÃO existem)
    const { data: profile } = await supabaseClient
      .from('business_profile')
      .select('company_name, whatsapp, city')
      .eq('blog_id', blogId)
      .maybeSingle();
    
    if (!profile) {
      console.log('[CTA] No business profile found for blog');
      return null;
    }
    
    const cta: ArticleCTA = {};
    
    if (profile.company_name) cta.company_name = profile.company_name;
    if (profile.whatsapp) cta.whatsapp = profile.whatsapp;
    if (profile.city) cta.city = profile.city;
    
    // V4.3: Nunca retornar objeto vazio - CRÍTICO
    if (Object.keys(cta).length === 0) {
      console.log('[CTA] Profile found but no usable fields');
      return null;
    }
    
    // Retornar se tiver pelo menos company_name OU whatsapp
    if (cta.company_name || cta.whatsapp) {
      console.log(`[CTA] ✅ Built: company="${cta.company_name || 'N/A'}", whatsapp="${cta.whatsapp || 'N/A'}", city="${cta.city || 'N/A'}"`);
      return cta;
    }
    
    console.log('[CTA] No company_name or whatsapp found');
    return null;
  } catch (error) {
    console.warn('[CTA] Error fetching business profile:', error);
    return null;
  }
}

// ============ PERSISTÊNCIA DE ARTIGO ============
// Função obrigatória para salvar artigo na tabela 'articles'
// CRÍTICO: Sem esta persistência, o frontend recebe artigo sem id/slug/status
// V2.0: Adiciona title_fingerprint para deduplicação semântica

// Portuguese stopwords for semantic fingerprint (same as frontend)
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'as', 'os',
  'um', 'uma', 'uns', 'umas', 'para', 'por', 'com', 'em', 'no', 'na',
  'nos', 'nas', 'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'pelos', 'pelas',
  'mais', 'menos', 'seu', 'sua', 'seus', 'suas', 'este', 'esta', 'estes',
  'estas', 'esse', 'essa', 'esses', 'essas', 'aquele', 'aquela', 'aqueles',
  'aquelas', 'que', 'qual', 'quais', 'como', 'quando', 'onde', 'porque',
  'se', 'também', 'já', 'ainda', 'muito', 'muita', 'muitos', 'muitas',
  'sobre', 'entre', 'até', 'desde', 'após', 'sob', 'sem', 'ter', 'sido',
  'foi', 'era', 'será', 'pode', 'podem', 'deve', 'devem', 'fazer', 'faz',
  'feito', 'forma', 'formas', 'ano', 'anos'
]);

function normalizeForFingerprintBackend(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !STOPWORDS.has(word))
    .join(' ');
}

async function persistArticleToDb(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  blogId: string,
  articleData: ArticleData,
  autoPublish: boolean = true,
  inferredCategory?: string,
  inferredTags?: string[],
  nicheProfileId?: string | null,  // V2.0: Niche profile linkage
  userId?: string | null,  // User ID for RLS policy
  // V2.1: Article Engine metadata
  articleStructureType?: string | null,
  sourcePayload?: Record<string, unknown> | null,
  // V4.2: CTA data
  ctaData?: ArticleCTA | null
): Promise<{ id: string; slug: string; status: string; title: string }> {
  console.log(`[PERSIST] Preparing to save article: "${articleData.title}" for blog ${blogId}`);
  
  // Gerar slug único baseado no título
  const baseSlug = (articleData.title || 'artigo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-')     // Substitui não-alfanuméricos por hífen
    .replace(/(^-|-$)/g, '')          // Remove hífens nas pontas
    .slice(0, 60);                     // Limita tamanho
  
  // Verificar colisão e gerar slug único inteligente (-2, -3, etc.)
  const { data: existingSlugs } = await supabaseClient
    .from('articles')
    .select('slug')
    .eq('blog_id', blogId)
    .like('slug', `${baseSlug}%`)
    .limit(50);
  
  let uniqueSlug = baseSlug;
  if (existingSlugs && existingSlugs.some((a: { slug: string }) => a.slug === baseSlug)) {
    let counter = 2;
    while (existingSlugs.some((a: { slug: string }) => a.slug === `${baseSlug}-${counter}`)) {
      counter++;
    }
    uniqueSlug = `${baseSlug}-${counter}`;
  }
  
  // Calcular reading_time se não existir
  const wordCount = (articleData.content || '').split(/\s+/).filter(Boolean).length;
  const readingTime = articleData.reading_time || Math.ceil(wordCount / 200) || 5;
  
  // Generate title_fingerprint for deduplication
  const titleFingerprint = normalizeForFingerprintBackend(articleData.title || '');
  console.log(`[PERSIST] Generated fingerprint: "${titleFingerprint}" from title: "${articleData.title}"`);
  
  // Check for existing article with same fingerprint (DEDUPLICATION)
  const { data: existingArticle } = await supabaseClient
    .from('articles')
    .select('id, title')
    .eq('blog_id', blogId)
    .eq('title_fingerprint', titleFingerprint)
    .maybeSingle();
  
  if (existingArticle) {
    console.log(`[PERSIST] ⚠️ Duplicate detected! Existing article id=${existingArticle.id}, updating instead of inserting`);
    
    // UPDATE existing article instead of creating duplicate
    // Convert image_prompts to content_images format for persistence
    const contentImages = (articleData.image_prompts || []).map((prompt: any, index: number) => ({
      context: prompt.context || `Imagem ${index + 1}`,
      prompt: prompt.prompt || '',
      alt: prompt.alt || prompt.context || `Imagem do artigo`,
      title: prompt.title || '',
      caption: prompt.caption || '',
      after_section: prompt.after_section || index + 1,
      url: null // URL será preenchido quando imagem for gerada
    }));
    
    console.log(`[PERSIST] Saving ${contentImages.length} content_images for article update`);
    
    const updateData = {
      content: articleData.content || '',
      excerpt: articleData.excerpt || articleData.meta_description || '',
      meta_description: articleData.meta_description || '',
      category: inferredCategory || null,
      tags: inferredTags || [],
      faq: articleData.faq || [],
      keywords: articleData.keywords || [],
      reading_time: readingTime,
      status: autoPublish ? 'published' : 'draft',
      published_at: autoPublish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      // V2.1: Article Engine metadata
      article_structure_type: articleStructureType || null,
      source_payload: sourcePayload || null,
      // V2.2: Content images (from image_prompts)
      content_images: contentImages.length > 0 ? contentImages : null,
    };
    
    const { error: updateError } = await supabaseClient
      .from('articles')
      .update(updateData)
      .eq('id', existingArticle.id);
    
    if (updateError) {
      console.error(`[PERSIST] Update failed:`, updateError);
      throw new Error(`Falha ao atualizar artigo existente: ${updateError.message}`);
    }
    
    console.log(`[PERSIST] ✅ Updated existing article id=${existingArticle.id} instead of creating duplicate`);
    return { 
      id: existingArticle.id, 
      slug: uniqueSlug, 
      status: autoPublish ? 'published' : 'draft',
      title: articleData.title || 'Artigo sem título'
    };
  }
  
  // Convert image_prompts to content_images format for persistence
  const contentImagesForInsert = (articleData.image_prompts || []).map((prompt: any, index: number) => ({
    context: prompt.context || `Imagem ${index + 1}`,
    prompt: prompt.prompt || '',
    alt: prompt.alt || prompt.context || `Imagem do artigo`,
    title: prompt.title || '',
    caption: prompt.caption || '',
    after_section: prompt.after_section || index + 1,
    url: null // URL será preenchido quando imagem for gerada
  }));
  
  console.log(`[PERSIST] Saving ${contentImagesForInsert.length} content_images for new article`);
  
  // V4.2: Sanitize content before persisting
  const { content: sanitizedContent, removed: sanitizeRemoved } = sanitizeContent(articleData.content || '');
  if (sanitizeRemoved.length > 0) {
    console.log(`[PERSIST] Content sanitized, removed ${sanitizeRemoved.length} issues`);
  }

  // V4.3: Validar links externos (warning only, não bloqueia persistência)
  const externalLinks = sanitizedContent.match(
    /<a\s+href="https?:\/\/(?![^"]*(seudominio\.com|localhost))[^"]+"/gi
  );

  if (!externalLinks || externalLinks.length < 2) {
    console.warn(
      `[PERSIST] ⚠️ Less than 2 external links detected. Found: ${
        externalLinks ? externalLinks.length : 0
      }`
    );
  } else {
    console.log(
      `[PERSIST] ✅ External links validated: ${externalLinks.length}`
    );
  }
  
  // Preparar dados para inserção (no duplicate found)
  const insertData = {
    blog_id: blogId,
    title: articleData.title || 'Artigo sem título',
    title_fingerprint: titleFingerprint, // NEW: For deduplication
    slug: uniqueSlug,
    content: sanitizedContent, // V4.2: Use sanitized content
    excerpt: articleData.excerpt || articleData.meta_description || '',
    meta_description: articleData.meta_description || '',
    category: inferredCategory || null,
    tags: inferredTags || [],
    faq: articleData.faq || [],
    keywords: articleData.keywords || [],
    reading_time: readingTime,
    status: autoPublish ? 'published' : 'draft',
    published_at: autoPublish ? new Date().toISOString() : null,
    generation_source: 'form',
    featured_image_url: articleData.featured_image_url || null,
    featured_image_alt: articleData.featured_image_alt || null,
    // V2.0: Niche Deterministic Architecture fields
    niche_profile_id: nicheProfileId || null,
    niche_locked: true,   // Always lock niche on generation
    score_locked: true,   // Protect score from automatic changes
    // V2.1: Article Engine metadata
    article_structure_type: articleStructureType || null,
    source_payload: sourcePayload || null,
    // V2.2: Content images (from image_prompts)
    content_images: contentImagesForInsert.length > 0 ? contentImagesForInsert : null,
    // V4.2: CTA data from business profile
    cta: ctaData || null,
  };
  
  console.log(`[PERSIST] Inserting article with slug: ${uniqueSlug}, status: ${insertData.status}, blog_id: ${blogId}`);
  
  const { data, error } = await supabaseClient
    .from('articles')
    .insert(insertData)
    .select('id, slug, status, title')
    .single();

  if (error) {
    console.error(`[PERSIST] Database insert failed:`, error);
    throw new Error(`Falha ao salvar artigo: ${error.message} (code: ${error.code})`);
  }

  if (!data) {
    console.error(`[PERSIST] No data returned after insert`);
    throw new Error('Nenhum dado retornado após inserção do artigo');
  }

  console.log(`[PERSIST] ✅ Article inserted: id=${data.id}, slug=${data.slug}, status=${data.status}`);
  return data;
}

// ============ FIM PERSISTÊNCIA DE ARTIGO ============

// Editorial Model Instructions with strict visual block limits
const EDITORIAL_MODEL_INSTRUCTIONS = {
  traditional: {
    name: 'Artigo Clássico',
    instructions: `## MODELO: ARTIGO CLÁSSICO (SEO & Autoridade)
📐 ESTRUTURA: 5-7 seções H2, estrutura limpa e clássica
📝 BLOCOS VISUAIS: Usar APENAS 2-3 blocos (💡, ⚠️ ou 📌) - NÃO ULTRAPASSAR
🎯 CTA: APENAS no final do artigo
📷 IMAGENS: 1 capa + 2 imagens de apoio (1 a cada 3 seções)
TOM: Consultivo, informativo, profissional`,
    visualBlockLimit: { min: 2, max: 3, types: ['💡', '⚠️', '📌'] }
  },
  strategic: {
    name: 'Artigo de Impacto',
    instructions: `## MODELO: ARTIGO DE IMPACTO (Conversão & Persuasão)
📐 ESTRUTURA: 5-7 seções H2, estrutura dinâmica
📝 BLOCOS VISUAIS: Usar 5-7 blocos INTENSIVAMENTE (💡, ⚠️, 📌, ✅, ❝) - Pull quotes (❝) a cada 2 seções
🎯 CTA: CTAs distribuídos (a cada 2-3 seções) + CTA forte no final
📷 IMAGENS: 1 capa + 3 imagens de apoio (1 a cada 2 seções)
TOM: Persuasivo, direto, orientado a conversão`,
    visualBlockLimit: { min: 5, max: 7, types: ['💡', '⚠️', '📌', '✅', '❝'] }
  },
  visual_guided: {
    name: 'Artigo Visual',
    instructions: `## MODELO: ARTIGO VISUAL (Leitura Fluida & Mobile-first)
📐 ESTRUTURA: 5-6 seções H2 curtas, alternância clara: Imagem → Título → Texto curto
📝 BLOCOS VISUAIS: Usar 3-4 blocos (💡, 📌, ✅) - Menos texto por seção, mais respiro visual
🎯 CTA: CTA no final + 1 CTA sutil no meio
📷 IMAGENS: 1 capa + 4 imagens de apoio (1 por seção) - CADA IMAGEM LOGO APÓS O TÍTULO H2
TOM: Amigável, convidativo, escaneável`,
    visualBlockLimit: { min: 3, max: 4, types: ['💡', '📌', '✅'] }
  }
};

// Hierarchy validation rules
const HIERARCHY_RULES = `
## ⛔ REGRAS ABSOLUTAS DE HIERARQUIA (VIOLAÇÃO = ARTIGO INVÁLIDO)

❌ PROIBIDO:
- Mais de 1 H1 por artigo
- H2 na introdução (primeiras 3-4 linhas)
- H3 sem H2 pai imediatamente antes
- H2 consecutivos sem conteúdo entre eles (mínimo 2 parágrafos)
- Mais de 3 H3 dentro de um único H2
- H2 com menos de 50 palavras de conteúdo

✅ ESTRUTURA CORRETA:
1. H1 (título) → 1 único
2. Introdução → 3-4 linhas, SEM headings
3. H2 → 2-3 parágrafos + blocos visuais opcionais
4. H3 (opcional) → detalhamento, máx. 2 por H2
5. Último H2 → CTA natural (NUNCA "Conclusão")

${TITLE_RULES_PROMPT}`;

// ============================================================================
// REGRAS DE GERAÇÃO POR MODO (FAST vs DEEP)
// ============================================================================
// O sistema opera com DOIS MODOS CLAROS - nunca undefined:
// - FAST: Chat/Instagram - artigos rápidos (400-1000 palavras)
// - DEEP: Form/Funil/URL/PDF/YouTube - ativos editoriais profundos (1500-3000)
// ============================================================================

const generationRules: Record<GenerationMode, { 
  minPercent: number; 
  minWords: number; 
  maxWords: number; 
  autoRetry: boolean; 
  maxRetries: number;
  promptInstruction: string;
}> = {
  fast: {
    minPercent: 0.50,
    minWords: 400,
    maxWords: 1000,
    autoRetry: true,
    maxRetries: 2,
    promptInstruction: `# 🚀 MODO RÁPIDO (400-1000 palavras)
Gere um artigo OBJETIVO e DIRETO, entre 400 e 1000 palavras.
- Seja prático e vá ao ponto
- Foque na essência do tema
- Parágrafos curtos (1-2 linhas)
- 3-5 seções H2 máximo
- CTA simples no final`
  },
  deep: {
    minPercent: 0.80,
    minWords: 1200,
    maxWords: 3000,
    autoRetry: true,
    maxRetries: 2,
    promptInstruction: `# 🧠 MODO PROFUNDO (1500-3000 palavras)
Gere um artigo COMPLETO e APROFUNDADO, entre 1500 e 3000 palavras.
- Explore o tema com profundidade estratégica
- Inclua exemplos práticos e cenários reais
- Insights e dicas acionáveis em cada seção
- 5-7 seções H2 bem desenvolvidas
- FAQ e resumo obrigatórios
- CTA estruturado com contexto`
  }
};

// Helper: Determinar generation_mode a partir do source (fallback)
function resolveGenerationMode(requestMode: GenerationMode | undefined, source: string): GenerationMode {
  // Se o modo foi explicitamente passado, usar ele
  if (requestMode === 'fast' || requestMode === 'deep') {
    return requestMode;
  }
  // Inferir a partir do source - chat/instagram = fast, resto = deep
  if (source === 'chat' || source === 'instagram') {
    return 'fast';
  }
  // Default é SEMPRE deep (nunca undefined)
  return 'deep';
}

// Word Count Enforcer: Expands article content until it meets minimum word count
async function expandArticleContent(
  content: string,
  title: string,
  targetWordCount: number,
  currentWordCount: number,
  textModel: string,
  LOVABLE_API_KEY: string,
  maxRetries: number = 2
): Promise<{ content: string; wordCount: number; retries: number }> {
  let expandedContent = content;
  let wordCount = currentWordCount;
  let retryCount = 0;
  const minAcceptable = targetWordCount * 0.90; // 90% of target is acceptable

  while (wordCount < minAcceptable && retryCount < maxRetries) {
    retryCount++;
    console.log(`Word Count Enforcer: Expansion attempt ${retryCount}/${maxRetries} - Current: ${wordCount} words, Target: ${targetWordCount}`);

    const expansionPrompt = `# TAREFA: EXPANSÃO OBRIGATÓRIA DE ARTIGO

O artigo abaixo tem apenas ${wordCount} palavras, mas PRECISA ter no mínimo ${targetWordCount} palavras.

## REGRAS DE EXPANSÃO (TODAS OBRIGATÓRIAS):

1. **MANTER** a mesma estrutura de H2s (NÃO adicionar nem remover seções)
2. **MANTER** o mesmo título: "${title}"
3. **MANTER** o mesmo tom de conversa e linguagem
4. **MANTER** todos os blockquotes (>) e emojis (💡⚠️📌) existentes

5. **EXPANDIR** cada seção H2 com:
   - Mais exemplos práticos do dia a dia do dono
   - Mais detalhes técnicos explicados de forma simples
   - Mais benefícios e consequências reais
   - Mais dicas acionáveis e específicas
   - Mais cenários "Imagine que..." ou "Por exemplo..."
   - Mais perguntas retóricas que engajam o leitor

6. **PARÁGRAFOS CURTOS**: Máximo 1-3 linhas cada (NÃO escreva parágrafos longos)
7. **LISTAS**: Use bullets frequentemente para organizar informações
8. **NEGRITO**: Use **negrito** para pontos-chave

9. **NÃO REMOVER** nenhum conteúdo existente - apenas ADICIONAR
10. **NÃO ALTERAR** o bloco de imagens ou FAQs

O resultado DEVE ter no mínimo ${targetWordCount} palavras. Se necessário, dobre cada seção.

## ARTIGO PARA EXPANDIR:

${expandedContent}

---

Retorne APENAS o conteúdo expandido em Markdown, sem explicações ou comentários.`;

    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: textModel,
          messages: [
            { 
              role: 'system', 
              content: `Você é um redator SEO especialista em expandir artigos para donos de pequenos negócios.

Sua ÚNICA tarefa é AUMENTAR significativamente o conteúdo mantendo qualidade e estrutura.

REGRAS ABSOLUTAS:
- NUNCA reduza o tamanho do artigo
- SEMPRE expanda cada seção com mais detalhes, exemplos e dicas
- Mantenha parágrafos curtos (1-3 linhas)
- Use linguagem de conversa WhatsApp entre empresários
- Adicione cenários reais do dia a dia do dono
- O resultado deve ter no mínimo ${targetWordCount} palavras` 
            },
            { role: 'user', content: expansionPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        console.error(`Word Count Enforcer: Expansion retry ${retryCount} failed with status ${response.status}`);
        break;
      }

      const data = await response.json();
      const newContent = data.choices?.[0]?.message?.content;

      if (newContent) {
        const newWordCount = newContent.split(/\s+/).filter(Boolean).length;
        console.log(`Word Count Enforcer: Expansion ${retryCount} result: ${wordCount} → ${newWordCount} words (${newWordCount > wordCount ? '+' : ''}${newWordCount - wordCount})`);

        if (newWordCount > wordCount) {
          expandedContent = newContent;
          wordCount = newWordCount;
        } else {
          console.warn(`Word Count Enforcer: Expansion ${retryCount} did not increase word count, stopping`);
          break;
        }
      } else {
        console.error(`Word Count Enforcer: Empty response in retry ${retryCount}`);
        break;
      }
    } catch (error) {
      console.error(`Word Count Enforcer: Expansion retry ${retryCount} error:`, error);
      break;
    }
  }

  console.log(`Word Count Enforcer: Complete - Final word count: ${wordCount} after ${retryCount} retries`);
  return { content: expandedContent, wordCount, retries: retryCount };
}

const sourceNames: Record<string, string> = {
  chat: 'Chat IA',
  instagram: 'Instagram',
  youtube: 'YouTube',
  pdf: 'PDF',
  url: 'URL',
  form: 'Formulário'
};

// Helper function to clean and parse JSON with retry
function parseArticleJSON(rawArgs: string): Record<string, unknown> {
  // First attempt: direct parse
  try {
    return JSON.parse(rawArgs);
  } catch {
    console.log('Direct JSON parse failed, attempting cleanup...');
  }

  // Second attempt: clean control characters
  try {
    const cleanedArgs = rawArgs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except \t \n \r
      .replace(/\r\n/g, '\\n') // Normalize line endings
      .replace(/\r/g, '\\n')
      .replace(/(?<!\\)\n/g, '\\n'); // Escape unescaped newlines
    return JSON.parse(cleanedArgs);
  } catch {
    console.log('Cleanup parse failed, attempting aggressive cleanup...');
  }

  // Third attempt: aggressive cleanup
  try {
    // Find content boundaries and escape problematic characters
    let processed = rawArgs;
    
    // Handle content field which often has unescaped newlines
    const contentMatch = processed.match(/"content"\s*:\s*"([\s\S]*?)(?:","|\","|"\s*,\s*")/);
    if (contentMatch) {
      const originalContent = contentMatch[1];
      const escapedContent = originalContent
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/"/g, '\\"');
      processed = processed.replace(contentMatch[1], escapedContent);
    }
    
    return JSON.parse(processed);
  } catch (finalError) {
    console.error('All parse attempts failed:', finalError);
    throw new Error('AI_OUTPUT_INVALID: Failed to parse article data after all cleanup attempts');
  }
}

// Tone instructions mapping - configurable per account
const toneInstructions: Record<string, string> = {
  personal: `Use primeira pessoa ("eu", "minha experiência"). 
Compartilhe como se fosse um amigo especialista dando conselhos pessoais.
Ex: "Eu já cometi esse erro dezenas de vezes antes de descobrir..."`,
  
  professional: `Tom empresarial mas humano. Evite jargões corporativos.
Fale como um consultor experiente em reunião com cliente.
Ex: "A realidade de quem gerencia uma empresa é..."`,
  
  friendly: `Linguagem informal, como conversa entre parceiros de negócio.
Use "você" frequentemente, crie conexão emocional.
Ex: "Sabe aquele dia que parece que nada dá certo?"`,
  
  educational: `Tom didático e paciente. Explique passo a passo.
Use numeração e organização clara.
Ex: "Vamos entender isso em 3 passos simples..."`,
  
  authoritative: `Voz de especialista reconhecido. Dados quando relevante.
Posicione-se como referência no assunto.
Ex: "Depois de analisar centenas de casos, posso afirmar..."`,
  
  conversational: `Como uma mensagem de WhatsApp para um colega.
Direto, prático, sem enrolação.
Ex: "Olha só, o negócio é o seguinte..."`
};

// MASTER PROMPT - MANDATORY EDITORIAL FRAMEWORK (AUTOMARTICLES STYLE)
function buildMasterPrompt(template: EditorialTemplate | null, theme: string, keywords: string[], tone: string = 'friendly'): string {
  const companyName = template?.company_name || 'a empresa';
  const keywordsText = keywords.length > 0 ? keywords.join(', ') : theme;
  
  // Build structure if mandatory_structure exists
  let structureText = '';
  if (template?.mandatory_structure && template.mandatory_structure.length > 0) {
    structureText = template.mandatory_structure.map(s => 
      `H2: ${s.heading}\n   Mensagem: ${s.key_message}`
    ).join('\n');
  }

  return `# 🎯 FRAMEWORK EDITORIAL OMNISEEN (OBRIGATÓRIO)

📌 EMPRESA: ${companyName}
📌 TEMA: ${theme}
📌 KEYWORDS SEO: ${keywordsText}

## 👤 PÚBLICO-ALVO (ÚNICO E OBRIGATÓRIO)

O leitor é EXCLUSIVAMENTE:
- Dono de pequeno negócio (1 a 15 funcionários)
- Faturamento R$ 30k–R$ 300k/mês
- Trabalha DENTRO da operação (não tem tempo)
- Lida com clientes no WhatsApp pessoal
- Frustrado com vendas perdidas por não conseguir atender
- Quer crescer, mas não sabe como delegar ou automatizar

⛔ NÃO É público deste artigo:
- Profissionais de marketing
- Gestores de equipes grandes
- Desenvolvedores ou técnicos
- Consumidores finais

## 📝 REGRAS ABSOLUTAS DE ESCRITA

✍️ ESTILO OBRIGATÓRIO:
- Parágrafos de 1-3 linhas APENAS (NUNCA mais de 3 linhas)
- Frases curtas (máximo 2 linhas)
- Linguagem de WhatsApp entre empreendedores
- Cenários REAIS: telefone tocando, cliente esperando, dono ocupado
- Blocos visuais 💡⚠️📌 (mínimo 3, máximo 5)

🚨 PROIBIDO (CAUSA REJEIÇÃO IMEDIATA):
❌ Linguagem corporativa ("maximizar", "otimizar processos", "omnichannel", "estratégico")
❌ Jargões técnicos ("URA", "CRM", "API", "machine learning", "automação inteligente")
❌ Parágrafos com mais de 3 linhas
❌ Frases com mais de 2 linhas
❌ Conceitos abstratos sem exemplos reais do dia a dia
❌ Estatísticas genéricas ("empresas que usam X aumentam Y%")
❌ Tom acadêmico, de whitepaper ou de marketing corporativo
❌ Promessas milagrosas ou exageradas
❌ "Nossa plataforma", "nossa solução", "esta ferramenta"

✅ OBRIGATÓRIO EM CADA PARÁGRAFO:
- Frases CURTAS (máximo 2 linhas)
- Parágrafos CURTOS (máximo 3 linhas)
- Linguagem de conversa WhatsApp entre empresários
- Cenários REAIS: telefone tocando, cliente esperando, dono trabalhando
- Sempre "você", "seu negócio", "seu cliente"
- Conexão emocional com a rotina real do dono
- Tom de parceiro de negócio, não de empresa de tecnologia

🎨 BLOCOS VISUAIS OBRIGATÓRIOS (usar 3-5 no artigo):
Use estes emojis no INÍCIO de parágrafos especiais para criar destaque visual:
- 💡 para "Verdade Dura" → Insight importante que o dono precisa aceitar
- ⚠️ para "Alerta" → Erro comum ou risco que precisa evitar
- 📌 para "Dica Prática" → Ação imediata que pode tomar agora
Distribua estes blocos ao longo do artigo (mínimo 3, máximo 5).

🧱 ESTRUTURA OBRIGATÓRIA DO ARTIGO (7-9 H2s - ESTILO AUTOMARTICLES):

1️⃣ ABERTURA (H2 #1) — Choque de Realidade
- Começar com cena REAL do dia a dia do dono
- Exemplos: telefone tocando, cliente esperando, dono ocupado
- O leitor deve se reconhecer em até 3 linhas
- NUNCA começar com definição ou conceito

2️⃣ A DOR (H2 #2) — Sem Culpa
- Explicar o problema deixando claro:
  • NÃO é falta de esforço
  • É falta de estrutura
  • O dono NÃO está errado
- Mostrar consequências REAIS: perda de clientes, dinheiro jogado fora, estresse, reputação
- INCLUIR pelo menos 1 bloco 💡 ou ⚠️

3️⃣ O ERRO COMUM (H2 #3)
- Mostrar o erro que quase todo dono comete
- Exemplos: tentar fazer tudo sozinho, depender só de atendimento humano, achar que "depois resolve"
- INCLUIR 1 bloco ⚠️ destacando o erro

4️⃣ CONTEXTO/CENÁRIO (H2 #4) — Aprofundamento
- Expandir o contexto do problema
- Mostrar como o mercado mudou
- Usar BLOCKQUOTE para insight importante

5️⃣ A SOLUÇÃO (H2 #5) — Como Alívio, NUNCA como Tecnologia
- A solução deve parecer: simples, prática, acessível, possível AGORA
- NUNCA explicar tecnologia
- NUNCA usar termos técnicos
- A solução existe para: atender o cliente enquanto o dono trabalha
- INCLUIR 1-2 blocos 📌 com dicas práticas

6️⃣ PASSO A PASSO (H2 #6) — Implementação Prática
- Lista numerada de ações concretas
- Cada passo simples e executável
- Sem complexidade técnica

7️⃣ A MARCA ${companyName} (H2 #7)
- ${companyName} aparece como: criada para essa dor, pensada para rotina real
- Sem exagero, sem promessa milagrosa, sem discurso de marketing
- Foco em resultado prático
- INCLUIR BLOCKQUOTE com depoimento ou insight

8️⃣ RESULTADOS ESPERADOS (H2 #8) — O Que Muda
- Pintar o cenário após implementar a solução
- Benefícios concretos e tangíveis
- Sem promessas irreais

9️⃣ RESUMO (H2 #9) — Checklist Visual dos Pontos Principais
- Título OBRIGATÓRIO: "Resumo: [número] passos/dicas para [objetivo do artigo]"
- Lista em bullets com CADA ponto principal discutido no artigo
- Uma linha por ponto, máximo 10 palavras cada
- O leitor deve poder escanear e lembrar de tudo rapidamente
- Formato de checklist visual que funciona como "cola" do artigo
- EXEMPLO:
  ## Resumo: 7 dicas para nunca perder cliente
  - Responda em menos de 5 minutos
  - Tenha atendimento fora do horário comercial
  - Personalize cada mensagem com o nome do cliente
  - Acompanhe o histórico de conversas
  - Automatize perguntas frequentes
  - Peça feedback após cada atendimento
  - Analise dados para melhorar continuamente

🔟 DIRETO AO PONTO (H2 #10) — CTA Natural e Humanizado
- Título que convida: "Direto ao ponto: Por onde começar?" ou "Seu próximo passo"
- NUNCA use: "Conclusão", "Considerações Finais", "Saiba Mais", "Entre em Contato"
- Primeiro parágrafo: reconheça a jornada do leitor ("Você agora sabe...")
- Segundo parágrafo: convide naturalmente para testar a solução
- INCLUA blockquote inspirador (frase impactante relacionada ao tema):
  > "Quem atende bem, vende sempre."
- Último parágrafo: CTA em **NEGRITO** com ação específica
${template?.cta_template ? `- CTA OBRIGATÓRIO: **${template.cta_template}**` : '- Ex: **Teste grátis por 7 dias e veja quantos clientes você consegue recuperar.**'}
- EXEMPLO COMPLETO:
  ## Direto ao ponto: Seu próximo passo
  
  Você agora sabe o que está perdendo por não ter atendimento 24h.
  
  A boa notícia? Resolver isso é mais simples do que parece.
  
  > "Cliente que espera, é cliente que vai embora."
  
  **Teste ${companyName} grátis por 7 dias e veja quantos clientes você consegue recuperar.**

${structureText ? `📐 ESTRUTURA H2 PERSONALIZADA (usar se definida):
${structureText}
` : ''}

❓ FAQ (3-5 perguntas):
- Perguntas que um DONO faria de verdade
- Respostas CURTAS (máximo 4 linhas)
- Linguagem tranquilizadora
- Orientada à ação, não à explicação

📊 SEO:
- Palavra-chave principal: ${template?.seo_settings?.main_keyword || theme}
- Palavras secundárias: ${template?.seo_settings?.secondary_keywords?.join(', ') || keywordsText}
- Formatação: Markdown (## H2, ### H3, **negrito**, listas, > blockquotes)

${template?.tone_rules ? `🎙️ TOM ADICIONAL: ${template.tone_rules}` : ''}
${template?.title_guidelines ? `📰 TÍTULO: ${template.title_guidelines}` : ''}

🛑 VALIDAÇÃO FINAL:
Antes de finalizar, pergunte-se:
"Esse conteúdo parece escrito especificamente para esse dono de negócio?"
"O dono vai pensar: isso acontece comigo?"
"Tem 7-9 H2s, parágrafos curtos, e blocos visuais?"
Se NÃO → REFAZER.`;
}

// Build realistic image prompts focused on real business scenarios
function buildImagePrompts(theme: string, niche: string, count: number = 3): Array<{context: string; prompt: string; after_section: number}> {
  const nicheDescription = niche || 'service business';
  
  const allPrompts = [
    { 
      context: 'problem', 
      prompt: `Realistic photo style: A stressed small ${nicheDescription} owner unable to answer ringing phone while working. Real workshop or job site environment, natural warm lighting, genuine frustrated expression. Authentic workplace, NOT corporate stock photo. Medium shot, warm tones. Worker clothes, real tools visible. Photo that a business owner would relate to.`,
      after_section: 1 
    },
    { 
      context: 'solution', 
      prompt: `Realistic photo style: A calm ${nicheDescription} business owner working peacefully while phone shows notification that customer is being attended automatically. Real work environment (van, workshop, site), relief expression on face, natural lighting. Subtle smartphone notification visible. NOT corporate office, NOT suit. Authentic working person.`,
      after_section: 3 
    },
    { 
      context: 'result', 
      prompt: `Realistic photo style: Happy ${nicheDescription} business owner checking smartphone showing new appointments and satisfied customer messages. Real small business environment, genuine smile, natural lighting. Signs of business growth visible. NOT corporate celebration, NOT stock photo pose. Authentic success moment.`,
      after_section: 5 
    },
    { 
      context: 'insight', 
      prompt: `Realistic photo style: ${nicheDescription} business owner having a productive moment, reviewing documents or phone with focused expression. Clean workspace in authentic environment, natural daylight. Shows professionalism without corporate feel. Real person, real work.`,
      after_section: 2 
    },
    { 
      context: 'cta', 
      prompt: `Realistic photo style: Confident ${nicheDescription} business owner ready to take action, standing in their workplace with positive body language. Inviting expression, natural setting. Represents success and approachability. Authentic small business atmosphere.`,
      after_section: 6 
    }
  ];
  
  // Return only the requested number of prompts (1-5)
  const safeCount = Math.min(Math.max(count, 1), 5);
  return allPrompts.slice(0, safeCount);
}

// Generate a normalized hash for cache lookup
function generateHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function cleanAndFormatContent(content: string): string {
  // 1. Quebrar parágrafos excessivamente longos (baseado em pontos finais seguidos de muito texto)
  // Divide o texto em parágrafos e processa cada um
  const paragraphs = content.split('\n\n');
  const refinedParagraphs = paragraphs.map(p => {
    // Se o parágrafo tiver mais de 400 caracteres, tenta quebrar no meio
    if (p.length > 400 && !p.startsWith('#') && !p.startsWith('>')) {
      return p.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n\n');
    }
    return p;
  });

  return refinedParagraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

// V3.0: Extract H2 sections from markdown content for Quality Gate validation
function extractSectionsFromContent(content: string): Array<{ h2: string; content: string }> {
  const sections: Array<{ h2: string; content: string }> = [];
  
  // Split by H2 headers (## )
  const h2Regex = /^##\s+([^#\n]+)/gm;
  const parts = content.split(h2Regex);
  
  // First part is introduction (before any H2), skip it
  for (let i = 1; i < parts.length; i += 2) {
    const h2Title = parts[i]?.trim() || '';
    const sectionContent = parts[i + 1]?.trim() || '';
    
    if (h2Title) {
      sections.push({
        h2: h2Title,
        content: sectionContent
      });
    }
  }
  
  console.log(`[extractSections] Found ${sections.length} H2 sections`);
  return sections;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Client com o token do usuário para pegar o user.id real do JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    // Client admin para persistência controlada
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // LOVABLE AI API KEY - required for AI gateway calls
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing LOVABLE_API_KEY configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      theme, keywords = [], tone = 'friendly', category = 'general',
      editorial_template, image_count = 3, word_count, user_id, blog_id,
      section_count = 7,
      include_faq = true,
      include_conclusion = true,
      include_visual_blocks = true,
      optimize_for_ai = false,
      source = 'form',
      funnel_mode = 'middle',
      article_goal = null,
      editorial_model = 'traditional',
      generation_mode: requestedGenerationMode,
      auto_publish = true,
      territoryId,
      // V2.0: GEO MODE IS NOW ALWAYS TRUE - HARDCODED
      geo_mode: _geo_mode_ignored = true,
      // V2.0: New GEO fields
      internal_links,
      external_sources,
      whatsapp: requestWhatsapp,
      google_place,
      // V2.1: Article Engine fields (Sprint 4 Integration)
      templateOverride,
      useEat = false,
      contextualAlt = false,
      niche = 'default',
      mode = 'authority',
      businessName,
      businessWhatsapp,
      city: requestCity,
      request_id: incomingRequestId,
      // V5.0: Accept article_id for placeholder-first pattern
      article_id: incomingArticleId,
      // V5.0: Accept article_structure_type from caller (editorial rotation)
      article_structure_type: incomingArticleStructureType,
    }: ArticleRequest & { funnel_mode?: FunnelMode; article_goal?: ArticleGoal | null; auto_publish?: boolean; request_id?: string; article_id?: string; article_structure_type?: string } = await req.json();

    // A) Usar request_id do caller OU gerar novo
    const requestId = incomingRequestId || crypto.randomUUID();
    console.log(`[${requestId}] Starting article generation (incoming: ${incomingRequestId ? 'yes' : 'no'}, article_id: ${incomingArticleId || 'none'})`);

    // V5.0: Helper to update generation stage in DB (for polling)
    const updateStage = async (stage: string, progress: number) => {
      if (!incomingArticleId) return; // No placeholder to update
      try {
        await supabase.from('articles').update({
          generation_stage: stage,
          generation_progress: progress,
        }).eq('id', incomingArticleId);
        console.log(`[${requestId}][STAGE] ${stage} (${progress}%)`);
      } catch (e) {
        console.warn(`[${requestId}][STAGE] Failed to update stage:`, e);
      }
    };

    // V5.0: Update stage to validating
    await updateStage('validating', 5);

    // ============================================================================
    // V2.0: GEO MODE IS ALWAYS TRUE - NO EXCEPTIONS
    // ============================================================================
    const geo_mode = true; // HARDCODED - NEVER false
    console.log(`[${requestId}][OMNICORE GEO V2.0] geo_mode=true FORCED - No article exists outside OmniCore GEO Writer`);
    
    // B) Log obrigatório do payload recebido
    console.log(`[${requestId}][PAYLOAD] Received:`, JSON.stringify({
      requestedGenerationMode,
      mode,
      niche,
      city: requestCity,
      businessName
    }));
    
    // Log Article Engine parameters
    console.log(`[${requestId}][Article Engine] Params: useEat=${useEat}, niche=${niche}, mode=${mode}, businessName=${businessName || 'not set'}`);

    // RESOLVER GENERATION_MODE: Respeitar request ou usar deep como padrão
    const generation_mode = requestedGenerationMode || 'deep';
    console.log(`[${requestId}][GENERATION MODE] Resolved: ${generation_mode} (requested: ${requestedGenerationMode || 'none'})`);

    // ============================================================================
    // HOTFIX: Forçar mode='entry' quando generation_mode='fast'
    // ============================================================================
    let effectiveMode = mode;
    if (generation_mode === 'fast') {
      effectiveMode = 'entry';
      console.log(`[${requestId}][HOTFIX] mode forced to entry because generation_mode=fast`);
    }
    
    // C) Log de resolução final
    console.log(`[${requestId}][MODE RESOLUTION] effectiveMode=${effectiveMode}, articleMode will be ${effectiveMode === 'entry' ? 'entry' : 'authority'}`);

    // ============ TERRITORIAL DATA FETCH (needed for research) ============
    let territoryData: TerritoryData | null = null;

    if (territoryId) {
      const { data: territory, error: territoryError } = await supabase
        .from('territories')
        .select('official_name, neighborhood_tags, lat, lng, radius_km')
        .eq('id', territoryId)
        .maybeSingle();

      if (territory && !territoryError) {
        territoryData = territory as TerritoryData;
      }
    }

    // ============================================================================
    // V3.0 QUALITY GATE - STEP 1: CONTEXT VALIDATION (HARD GATES)
    // ============================================================================
    console.log(`[${requestId}][QualityGate] Step 1: Validating request context...`);

    // Extract city with multiple fallbacks
    let city = requestCity || territoryData?.official_name || '';

    // FALLBACK 1: Extract city from theme (e.g., "Serviço em Teresina" → "Teresina")
    if (!city && theme) {
      const cityMatch = theme.match(/\b(?:em|para|de)\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)?)/i);
      if (cityMatch && cityMatch[1]) {
        city = cityMatch[1].trim();
        console.log(`[${requestId}][QualityGate] City extracted from theme: ${city}`);
      }
    }

    // FALLBACK 2: From google_place if available
    if (!city && google_place?.official_name && typeof google_place.official_name === 'string') {
      city = google_place.official_name as string;
      console.log(`[${requestId}][QualityGate] City from google_place: ${city}`);
    }
    
    // V4.5: City fallback (nunca abort - usa fallback genérico)
    if (!city || city.trim() === '') {
      console.warn(`[${requestId}][PIPELINE] Forcing draft fallback - city missing, using "Brasil"`);
      city = 'Brasil';
    }

    // Niche fallback with warning (never 'default')
    let effectiveNiche = niche;
    if (!effectiveNiche || effectiveNiche.trim() === '' || effectiveNiche === 'default') {
      console.warn(`[${requestId}][QualityGate] ⚠️ Niche invalid, using fallback: pest_control`);
      effectiveNiche = 'pest_control';
    }

    // BusinessName fallback with warning
    let effectiveBusinessName = businessName;
    if (!effectiveBusinessName || effectiveBusinessName.trim() === '') {
      console.warn(`[${requestId}][QualityGate] ⚠️ BusinessName missing, using fallback: Empresa Local`);
      effectiveBusinessName = 'Empresa Local';
    }

    console.log(`[${requestId}][QualityGate] ✅ Context validated:`, { city, niche: effectiveNiche, businessName: effectiveBusinessName });

    // ============================================================================
    // V6.0: ELITE ENGINE V2 - Editorial Orchestrator (Single Source of Truth)
    // ============================================================================
    const primaryKeyword = Array.isArray(keywords) && keywords.length > 0 ? keywords[0] : theme;
    
    let articleEngineTemplate: TemplateSelectionResult | null = null;
    let articleEngineOutline: OutlineStructure | null = null;
    let eliteEngineDecision: EditorialDecision | null = null;
    
    console.log(`[${requestId}][PIPELINE] V6.0: Elite Engine V2 - calling editorialOrchestrator`);
    
    try {
      eliteEngineDecision = await getEditorialDecision({
        supabase,
        blogId: blog_id!,
        niche: effectiveNiche,
        city,
        keyword: primaryKeyword,
        funnel_mode: funnel_mode || 'middle',
        article_goal: article_goal || 'educar',
      });
      
      console.log(`[${requestId}][EliteEngine] Decision: structure=${eliteEngineDecision.structure_type}, variant=${eliteEngineDecision.variant}, angle=${eliteEngineDecision.angle}, style=${eliteEngineDecision.style_mode}, blocks=${eliteEngineDecision.blocks.length}`);
    } catch (orchErr) {
      console.error(`[${requestId}][EliteEngine] Orchestrator failed, falling back to intent classification:`, orchErr);
    }

    // Use orchestrator decision or fallback to classifyIntent
    const intent = classifyIntent(primaryKeyword);
    const selectedTemplate = eliteEngineDecision?.structure_type || intent.recommendedTemplate;
    const selectedVariant = eliteEngineDecision?.variant || 'chronological';
    
    articleEngineTemplate = {
      template: selectedTemplate,
      variant: selectedVariant as import('../_shared/pipelineStages.ts').TemplateVariant,
      intent,
      reason: eliteEngineDecision 
        ? `V6.0: Elite Engine - ${eliteEngineDecision.structure_type}/${eliteEngineDecision.variant}/${eliteEngineDecision.angle}`
        : `V6.0 fallback: intent=${intent.type}`,
      antiPatternApplied: eliteEngineDecision?.anti_collision_metadata?.collision_avoided || false
    };
    
    // V6.0: Update stage to classifying
    await updateStage('classifying', 15);
    console.log(`[${requestId}][STAGE] classifying (15%)`);

    // Generate structured outline with fixed template
    try {
      const territoryName = territoryData?.official_name || 'Brasil';
      articleEngineOutline = buildOutlineStructure(
        articleEngineTemplate.template,
        articleEngineTemplate.variant,
        mode,
        primaryKeyword,
        territoryName,
        businessName || editorial_template?.company_name || undefined
      );
      
      console.log(`[Article Engine] Outline generated: ${articleEngineOutline.h2Count} H2s, ${articleEngineOutline.totalTargetWords} target words`);
    } catch (outlineError) {
      console.warn(`[Article Engine] Outline generation failed, continuing:`, outlineError);
    }

    // ============================================================================
    // STAGE 1 (RESEARCH) - Perplexity Primary → Gemini Fallback → Abort
    // ============================================================================
    let researchPackage: ResearchPackage;

    // V5.0: Update stage to researching
    await updateStage('researching', 30);
    
    // Diagnostic logging
    console.log('[Research] Starting web research stage...');
    console.log('[Research] PERPLEXITY_API_KEY exists:', !!Deno.env.get('PERPLEXITY_API_KEY'));
    console.log('[Research] Theme:', theme);
    console.log('[Research] Primary keyword:', primaryKeyword);
    console.log('[Research] Territory:', territoryData?.official_name || 'N/A');

    try {
      // LEVEL 1: Try runResearchStage (Perplexity + Firecrawl)
      researchPackage = await runResearchStage({
        supabase,
        blogId: blog_id!,
        theme,
        primaryKeyword,
        territoryName: territoryData?.official_name || null,
        territoryData: (territoryData as unknown as GeoTerritoryData) || null,
      });
      researchPackage.provider = 'perplexity';
      console.log('[Research] ✅ SUCCESS (Perplexity) - Sources:', researchPackage.sources.length);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[Research] ❌ Perplexity FAILED: ${msg}`);
      
      await logStage(supabase, blog_id, 'research', 'perplexity', 'research-package', false, 0, { error: msg }, 0, 0, msg);
      
      // LEVEL 2: Gemini fallback TEMPORARIAMENTE DESABILITADO
      console.log('[Research] ⚠️ Gemini fallback disabled - using minimal package');

      // Minimal fallback package
      researchPackage = {
        geo: {
          facts: [`Informações sobre ${theme} em ${territoryData?.official_name || 'Brasil'}`],
          trends: ['Setor em crescimento'],
          sources: [],
          rawQuery: primaryKeyword,
          fetchedAt: new Date().toISOString(),
        },
        serp: { commonTerms: [], topTitles: [], contentGaps: [], averages: {} },
        sources: [],
        generatedAt: new Date().toISOString(),
        provider: 'gemini_fallback',
      };

      console.log('[Research] ⚠️ Using minimal fallback (Perplexity failed)');

      await logStage(supabase, blog_id, 'research', 'fallback', 'research-package', true, 0, { 
        minimal_fallback: true,
        perplexity_error: msg,
      });
    }

    // ============================================================================
    // (Existing) RATE LIMIT + DEDUP can remain
    // ============================================================================

    // ========== RATE LIMIT CHECK (PROTEÇÃO CONTRA DUPLICAÇÃO EM MASSA) ==========
    if (blog_id && user_id) {
      console.log(`[RATE_LIMIT] Checking rate limit for blog=${blog_id}, user=${user_id}`);
      
      const { data: allowed, error: limitError } = await supabase
        .rpc('check_article_rate_limit', { 
          p_blog_id: blog_id, 
          p_user_id: user_id 
        });
      
      if (limitError) {
        console.error(`[RATE_LIMIT] Error checking rate limit:`, limitError);
        // Continue even if rate limit check fails (fail-open for now)
      } else if (!allowed) {
        console.log(`[RATE_LIMIT] BLOCKED: blog=${blog_id}, user=${user_id} - exceeded 5 articles/minute`);
        return new Response(
          JSON.stringify({ 
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Limite de geração excedido. Você pode gerar no máximo 5 artigos por minuto. Aguarde alguns segundos.'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log(`[RATE_LIMIT] OK: blog=${blog_id}, user=${user_id}`);
      }
    }

    // ========== DEDUPLICATION CHECK (PREVENIR ARTIGOS DUPLICADOS) ==========
    if (blog_id) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Check for recent articles with similar themes
      const { data: recentSimilar } = await supabase
        .from('articles')
        .select('id, title')
        .eq('blog_id', blog_id)
        .gte('created_at', twentyFourHoursAgo)
        .ilike('title', `%${theme.slice(0, 50)}%`)
        .limit(1);

      if (recentSimilar && recentSimilar.length > 0) {
        console.log(`[DEDUP] Potential duplicate detected - recent article: "${recentSimilar[0].title}" (id: ${recentSimilar[0].id})`);
        // Log warning but don't block - title similarity isn't definitive
      }
    }

    // Fetch AI model and content preferences
    let textModel = 'google/gemini-2.5-flash';
    let defaultWordCount = 1500;

    if (blog_id) {
      const { data: prefs } = await supabase
        .from('content_preferences')
        .select('ai_model_text, default_word_count')
        .eq('blog_id', blog_id)
        .maybeSingle();

      if (prefs?.ai_model_text) {
        textModel = prefs.ai_model_text;
      }
      if (prefs?.default_word_count) {
        defaultWordCount = prefs.default_word_count;
      }
    }

    const targetWordCount = word_count || defaultWordCount;

    // ============================================================================
    // UNIVERSAL PROMPT RESOLUTION (kept)
    // ============================================================================

    let strategyId: string | null = null;
    let isDefaultStrategy = false;
    let clientStrategy: ClientStrategy;

    if (blog_id) {
      const resolution = await resolveStrategy(supabase, blog_id);
      clientStrategy = resolution.strategy;
      strategyId = resolution.strategyId;
      isDefaultStrategy = resolution.isDefault;
    } else {
      clientStrategy = {
        empresa_nome: null,
        tipo_negocio: 'serviços',
        regiao_atuacao: 'Brasil',
        tipo_publico: 'B2B/B2C',
        nivel_consciencia: 'consciente_problema',
        nivel_conhecimento: 'iniciante',
        dor_principal: null,
        desejo_principal: null,
        o_que_oferece: null,
        principais_beneficios: null,
        diferenciais: null,
        acao_desejada: 'entre em contato',
        canal_cta: 'WhatsApp'
      };
    }

    // ============================================================================
    // STAGE 2 (WRITER) - produce article content using GEO-based approach
    // ============================================================================

    // V5.0: Update stage to writing
    await updateStage('writing', 55);
    
    const editorialConfig = EDITORIAL_MODEL_INSTRUCTIONS[editorial_model] || EDITORIAL_MODEL_INSTRUCTIONS.traditional;

    // Get niche profile for prompt instructions
    let nicheProfile: NicheProfile | null = null;
    if (blog_id) {
      nicheProfile = await getNicheProfile(supabase, blog_id);
    }
    const nichePromptBlock = nicheProfile ? getNichePromptInstructions(nicheProfile) : '';

    // V2.1: Build outline instruction if Article Engine generated an outline
    let outlineInstruction = '';
    if (articleEngineOutline) {
      const sectionsPreview = articleEngineOutline.sections
        .map((s, i) => `${i + 1}. ${s.h2 || 'Introdução'} (${s.targetWords} palavras)${s.includeTable ? ' [TABELA]' : ''}${s.forceList ? ' [LISTA]' : ''}${s.injectEat ? ' [E-E-A-T]' : ''}${s.geoSpecific ? ' [GEO]' : ''}`)
        .join('\n');
      
      outlineInstruction = `
## ESTRUTURA OBRIGATÓRIA (Article Engine V2.1)
H1: ${articleEngineOutline.h1}
Meta Title: ${articleEngineOutline.metaTitle}
URL Slug: ${articleEngineOutline.urlSlug}

### SEÇÕES:
${sectionsPreview}

Word Count Target: ${articleEngineOutline.totalTargetWords} palavras
SIGA ESTA ESTRUTURA EXATAMENTE.
`;
    }

    // V6.0: Elite Engine V2 - Inject blocks, angle, and heading blacklist into prompt
    const eliteEnginePromptBlocks = eliteEngineDecision 
      ? buildBlocksPromptInjection(eliteEngineDecision.blocks) 
      : '';
    const eliteEngineAngleInstructions = eliteEngineDecision 
      ? `\n## ÂNGULO EDITORIAL OBRIGATÓRIO\n${buildAnglePromptInstructions(eliteEngineDecision.angle)}\n` 
      : '';
    const eliteEngineRhythm = eliteEngineDecision?.rhythm_profile 
      ? `\n## RITMO DE ESCRITA\n${eliteEngineDecision.rhythm_profile}\n` 
      : '';

    // V2.2: Local Intelligence prompt injection
    const localIntelligencePrompt = eliteEngineDecision?.local_intelligence
      ? buildLocalPromptInjection(
          eliteEngineDecision.local_intelligence,
          city,
          clientStrategy || null
        )
      : '';

    const systemPrompt = `${GEO_WRITER_IDENTITY}

${GEO_LINKING_RULES}

${buildTerritorialContext((territoryData as unknown as GeoTerritoryData) || null)}
${buildResearchInjection(researchPackage.geo)}
${buildGovernanceBlock(researchPackage)}
${nichePromptBlock}
${outlineInstruction}

${editorialConfig.instructions}
${eliteEngineAngleInstructions}
${eliteEnginePromptBlocks}
${eliteEngineRhythm}
${localIntelligencePrompt}
${HEADING_BLACKLIST_PROMPT}

${HIERARCHY_RULES}

${buildMasterPrompt(editorial_template || null, theme, keywords, tone)}

Prazo de entrega: Data de referência é Janeiro de 2026. Todos os dados, tendências e referências devem ser contextualizados para esta data.`;

    // V2.2: image_count dinâmico por modo - Authority permite 6-10 imagens
    const maxImagesByMode = mode === 'authority' ? 10 : 5;
    const minImagesByMode = mode === 'authority' ? 6 : 3;  // Mínimo garantido
    const targetImageCount = Math.min(Math.max(image_count || (mode === 'authority' ? 8 : 3), minImagesByMode), maxImagesByMode);
    console.log(`[IMAGES] Mode: ${mode}, requested: ${image_count}, target: ${targetImageCount} (min: ${minImagesByMode}, max: ${maxImagesByMode})`);

    // Tool schema for article generation - only the parameters object, not the full function wrapper
    // V3.3: Added explicit 'introduction' field to enforce separation from content
    const createArticleSchema = {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'SEO title (max 60 chars)' },
        meta_description: { type: 'string', description: 'Meta description (max 160 chars)' },
        excerpt: { type: 'string', description: 'Short excerpt (max 200 chars)' },
        // V3.3: Campo explícito de introdução - FONTE DA VERDADE
        introduction: { 
          type: 'string', 
          description: 'Introduction paragraph (3-4 sentences, MINIMUM 120 characters). Plain text WITHOUT any headings (#, ##, ###). Must NOT start with markdown heading. This is SEPARATE from content field.',
          minLength: 120
        },
        content: { 
          type: 'string', 
          description: 'Full markdown content starting with first H2 section (##). Do NOT include introduction here - it goes in separate "introduction" field. Content MUST start with ## heading.' 
        },
        faq: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' }
            },
            required: ['question', 'answer']
          },
          minItems: 3,
          maxItems: 8
        },
        reading_time: { type: 'number', description: 'Estimated reading time in minutes' },
        image_prompts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              context: { type: 'string' },
              prompt: { type: 'string' },
              after_section: { type: 'number' }
            },
            required: ['context', 'prompt', 'after_section']
          },
          minItems: targetImageCount,
          maxItems: targetImageCount
        },
        images: { type: 'object' }
      },
      required: ['title', 'meta_description', 'excerpt', 'introduction', 'content', 'faq', 'reading_time', 'image_prompts', 'images']
    };

    const writerStart = nowMs();
    // V3.3: Writer prompt exigindo introdução como campo separado
    const writerUserPrompt = `Escreva o artigo completo sobre: "${theme}"

${outlineInstruction}

## ⛔ CAMPO "introduction" OBRIGATÓRIO (SEPARADO DO CONTENT):
- DEVE ter no MÍNIMO 120 caracteres de texto corrido
- DEVE ser texto puro, SEM headings (#, ##, ###)
- DEVE contextualizar o problema/tema para o leitor em 3-4 frases
- Se gerar menos de 120 caracteres, REESCREVA até atingir o mínimo
- NÃO repita esta introdução no campo "content"
- NÃO comece com heading - comece direto com o texto

## CAMPO "content" (SEPARADO DA INTRODUÇÃO):
- DEVE começar DIRETAMENTE com o primeiro H2 (##)
- NÃO inclua a introdução aqui - ela vai no campo separado "introduction"
- Estruture com H2/H3 conforme outline
- O primeiro caractere do content DEVE ser #

REGRAS CRÍTICAS:
- Use APENAS as fontes e dados do pacote de pesquisa
- Inclua links externos (https://...) apontando para FONTES PERMITIDAS
- Estruture com H2–H3, inclua FAQ + meta tags
- Não invente estatísticas/tendências. Se faltar dado: "não encontrado nas fontes".`;

    // V3.1: Using unified AI Provider Layer (aiProviders.ts)
    // Primary: OpenAI GPT-4o → Fallback: Google Gemini
    const writerCall = await callWriterWithTool({
      system: systemPrompt,
      user: writerUserPrompt,
      toolName: 'create_article',
      toolSchema: createArticleSchema,
      temperature: 0.6
    });

    const writerDuration = nowMs() - writerStart;
    await logStage(supabase, blog_id, 'writer', writerCall.provider, 'writer', true, writerDuration, {
      model: AI_CONFIG.writer.primary.model,
      provider: writerCall.provider,
      keyword: primaryKeyword,
      articleEngineTemplate: articleEngineTemplate?.template || null,
    }, 0, writerCall.usage?.totalTokens);

    // Build article object from writer output
    const writerOut = writerCall.arguments as any;

    // ============================================================================
    // STAGE 3 (SEO) - Re-structure for organic performance using SERP package
    // ============================================================================

    // Tool schema for SEO optimization - only the parameters object
    const optimizeArticleSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        meta_description: { type: 'string' },
        excerpt: { type: 'string' },
        content: { type: 'string' },
        faq: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' }
            },
            required: ['question', 'answer']
          }
        },
        seo_notes: {
          type: 'object',
          properties: {
            entities_used: { type: 'array', items: { type: 'string' } },
            intent: { type: 'string' },
            snippet_candidates: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['title', 'meta_description', 'excerpt', 'content', 'faq']
    };

    // V3.2: SEO System with HIERARCHY_RULES to preserve introduction
    const seoSystem = `Você é um Agente SEO. Reestruture o texto para máxima performance orgânica.

## ⛔ REGRAS ABSOLUTAS DE HIERARQUIA (VIOLAÇÃO = ARTIGO INVÁLIDO)
❌ PROIBIDO:
- Mais de 1 H1 por artigo
- H2 na introdução (primeiras 3-4 linhas DEVEM ser texto puro, SEM headings)
- H3 sem H2 pai imediatamente antes
- H2 consecutivos sem conteúdo entre eles

✅ ESTRUTURA OBRIGATÓRIA:
1. H1 (título) → 1 único, NÃO incluir no content
2. INTRODUÇÃO → 3-4 linhas de texto puro, MÍNIMO 120 caracteres, SEM headings (##/###)
3. Primeiro ## só aparece APÓS a introdução
4. H2 → 2-3 parágrafos cada
5. Último H2 → CTA natural

Regras SEO:
- H1 único, H2/H3 consistentes, densidade semântica alta sem keyword stuffing
- Use entidades/termos do SERP e respeite intenção de busca
- Gere FAQ/snippet/meta tags
- NÃO crie fatos novos. Use apenas o pacote de pesquisa e o rascunho.
- PRESERVE A INTRODUÇÃO DO RASCUNHO. Ela DEVE ter pelo menos 120 caracteres ANTES do primeiro ##.`;

    // V3.3: SEO User Prompt - NÃO recebe introdução, atua APENAS no corpo
    const seoUser = `PACOTE DE PESQUISA (resumo):
- Termos: ${(researchPackage.serp.commonTerms || []).slice(0, 12).join(', ')}
- Títulos top: ${(researchPackage.serp.topTitles || []).slice(0, 3).join(' | ')}
- Gaps: ${(researchPackage.serp.contentGaps || []).slice(0, 5).join(' | ')}
- Fontes permitidas: ${(researchPackage.sources || []).slice(0, 8).join(' | ')}

RASCUNHO (writer):
Title: ${writerOut.title}
Meta: ${writerOut.meta_description}

⚠️ A INTRODUÇÃO FOI SEPARADA E NÃO DEVE SER MODIFICADA.
OTIMIZE APENAS O CORPO ABAIXO (H2s e seus conteúdos):

CONTENT (corpo apenas, SEM introdução):
${(writerOut.content || '').substring(0, 6000)}

⚠️ REGRA CRÍTICA: O campo "content" da resposta DEVE começar com ## (H2). NÃO adicione introdução - ela é gerenciada separadamente pelo Writer.

Reestruture e retorne via tool optimize_article.`;

    // V5.0: Update stage to seo
    await updateStage('seo', 75);
    
    const seoStart = nowMs();
    // V3.1: SEO optimization via unified provider layer
    const seoCall = await callWriterWithTool({
      system: seoSystem,
      user: seoUser,
      toolName: 'optimize_article',
      toolSchema: optimizeArticleSchema,
      temperature: 0.3
    });

    const seoDuration = nowMs() - seoStart;
    await logStage(supabase, blog_id, 'seo', seoCall.provider, 'seo', true, seoDuration, { 
      model: AI_CONFIG.writer.primary.model,
      provider: seoCall.provider 
    }, 0, seoCall.usage?.totalTokens);

    const seoOut = seoCall.arguments as any;

    // ============================================================================
    // STAGE 4 (QA) - factual coherence vs research sources
    // ============================================================================

    // Deterministic guard: require at least 2 external links matching research sources
    const contentForQa = `${seoOut.content || ''}`;
    const externalLinkMatches = contentForQa.match(/\]\((https?:\/\/[^)]+)\)/g) || [];
    const externalUrls = externalLinkMatches
      .map(m => (m.match(/\((https?:\/\/[^)]+)\)/)?.[1] || '').trim())
      .filter(Boolean);

    // Extract base domains from allowed sources for flexible matching
    const extractDomain = (url: string): string => {
      try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
      } catch {
        return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      }
    };

    const allowedDomains = new Set(
      (researchPackage.sources || []).map(s => extractDomain(s.trim()))
    );

    // Match by domain instead of exact URL (AI may use subpages from allowed sources)
    const supportedLinks = externalUrls.filter(u => {
      const urlDomain = extractDomain(u);
      return allowedDomains.has(urlDomain);
    });

    console.log(`[QA] External links found: ${externalUrls.length}, supported: ${supportedLinks.length}`);
    console.log(`[QA] Allowed domains: ${Array.from(allowedDomains).slice(0, 5).join(', ')}`);

    // ========================================================================
    // UNBLOCKED GENERATION: Quality Gate é apenas LOG, nunca bloqueia
    // Nada pode impedir a geração de um artigo ou super página
    // ========================================================================
    const isFastMode = requestedGenerationMode === 'fast' || source === 'chat' || source === 'instagram';
    
    console.log(`[QA] Mode: ${isFastMode ? 'FAST' : 'DEEP'}, external links: ${externalUrls.length}, supported: ${supportedLinks.length}`);
    console.log(`[QA] UNBLOCKED: Quality checks são apenas informativos, geração NUNCA é bloqueada`);

    // Log quality metrics but NEVER block
    if (supportedLinks.length < 2) {
      console.warn(`[QA] WARNING: Poucos links externos (${supportedLinks.length}/2), mas geração continua`);
      await logStage(supabase, blog_id, 'qa', 'internal', 'qa-deterministic-warning', true, 0, { 
        supported_links: supportedLinks.length,
        external_links: externalUrls.length,
        allowed_domains: Array.from(allowedDomains).slice(0, 10),
        generation_mode: isFastMode ? 'fast' : 'deep',
        unblocked: true
      });
    }

    const qaSystem = `Você é um Agente de Qualidade editorial e factual.\n\nTarefa:\n- Verificar clareza, autoridade e legibilidade\n- Verificar se afirmações factuais derivam do pacote de pesquisa\n- Reprovar se houver afirmações sem suporte\n\nRetorne JSON estrito:\n{\n  "approved": true|false,\n  "score": 0-100,\n  "issues": [{"code":"...","message":"..."}]\n}`;

    const qaUser = `PACOTE DE PESQUISA (fontes permitidas):\n${(researchPackage.sources || []).slice(0, 8).join('\n')}\n\nARTIGO:\nTITLE: ${seoOut.title}\nMETA: ${seoOut.meta_description}\n\nCONTENT (início):\n${contentForQa.substring(0, 6000)}\n\nValide se o conteúdo depende APENAS das fontes e do pacote. Se houver qualquer invenção, reprove.`;

    const qaStart = nowMs();
    // V3.1: QA via unified provider layer (Primary: Gemini, Fallback: OpenAI)
    const qa = await callQAWithProvider({
      system: qaSystem,
      user: qaUser,
    });

    const qaDuration = nowMs() - qaStart;
    await logStage(supabase, blog_id, 'qa', qa.provider, 'qa', qa.approved, qaDuration, { 
      score: qa.score, 
      provider: qa.provider,
      unblocked: true 
    }, 0, qa.usage?.totalTokens, qa.approved ? undefined : 'QA rejected (logged only)');

    // UNBLOCKED: Log rejection but NEVER return 422
    if (!qa.approved) {
      console.warn(`[QA] WARNING: QA reprovou com score ${qa.score}, mas geração continua (UNBLOCKED)`);
      console.warn(`[QA] Issues: ${JSON.stringify(qa.issues)}`);
    }

    // ============================================================================
    // V3.3: ARTICLE ENGINE - Writer é FONTE DA VERDADE para INTRODUÇÃO
    // SEO atua APENAS no corpo (content), NUNCA na introdução
    // ============================================================================

    // A introdução vem EXPLICITAMENTE do Writer (campo separado)
    const writerIntroduction = (writerOut.introduction || '').toString().trim();

    // Telemetria obrigatória V3.3
    console.log(`[Merge V3.3] Writer introduction: ${writerIntroduction.length} chars`);
    console.log(`[Merge V3.3] Writer introduction preview: "${writerIntroduction.substring(0, 100)}..."`);

    // Validar que não começa com heading (double check)
    const introStartsWithHeading = /^#/.test(writerIntroduction.trim());
    if (introStartsWithHeading) {
      console.error(`[Merge V3.3] ⚠️ WARNING: Writer introduction starts with heading! Cleaning...`);
    }
    const cleanIntroduction = introStartsWithHeading 
      ? writerIntroduction.replace(/^#+\s*[^\n]*\n*/gm, '').trim()
      : writerIntroduction;

    // SEO content (corpo apenas, SEM introdução)
    let seoBodyContent = seoOut.content || writerOut.content || '';

    // Garantir que SEO content começa com H2 (remover qualquer intro duplicada)
    const firstH2InSeo = seoBodyContent.search(/^##\s+/m);
    if (firstH2InSeo > 0) {
      console.log(`[Merge V3.3] Removing ${firstH2InSeo} chars before first H2 in SEO output (prevents duplication)`);
      seoBodyContent = seoBodyContent.substring(firstH2InSeo).trim();
    } else if (firstH2InSeo === -1) {
      console.warn(`[Merge V3.3] ⚠️ SEO output has no H2, using as-is`);
    }

    // E-E-A-T injection mantém a lógica existente, mas sobre seoBodyContent
    let contentWithEat = seoBodyContent;

    console.log(`[Article Engine] E-E-A-T check: useEat=${useEat}, niche="${niche}", hasContent=${contentWithEat.length > 0}`);
    
    if (useEat && niche && niche !== 'default') {
      try {
        console.log(`[Article Engine] Attempting E-E-A-T injection for niche: ${niche}`);
        const territoryName = territoryData?.official_name || 'Brasil';
        const neighborhoods = territoryData?.neighborhood_tags?.slice(0, 2) || [];
        
        const eatPhrase = injectLocalExperience(
          niche,
          territoryName,
          businessName || clientStrategy?.empresa_nome || 'nossa empresa',
          undefined, // yearsInBusiness - could come from business_profile
          neighborhoods
        );
        
        if (eatPhrase) {
          console.log(`[Article Engine] E-E-A-T injected: "${eatPhrase.substring(0, 80)}..."`);
          
          // V3.3: E-E-A-T agora é inserido logo após o primeiro H2 (não na introdução)
          const firstH2Match = contentWithEat.match(/^(##\s+[^\n]+\n)/m);
          if (firstH2Match && firstH2Match.index !== undefined) {
            const insertPos = firstH2Match.index + firstH2Match[0].length;
            contentWithEat = contentWithEat.slice(0, insertPos) + `\n${eatPhrase}\n\n` + contentWithEat.slice(insertPos);
          } else {
            contentWithEat = contentWithEat + '\n\n' + eatPhrase;
          }
        }
      } catch (eatError) {
        console.error(`[Article Engine] Error injecting E-E-A-T:`, eatError);
        // Continue without E-E-A-T
      }
    }

    // V3.3: MERGE FINAL - Introdução do Writer + Corpo do SEO (com E-E-A-T)
    const finalContent = cleanIntroduction + '\n\n' + contentWithEat;
    console.log(`[Merge V3.3] Final content length: ${finalContent.length}, intro: ${cleanIntroduction.length}, body: ${contentWithEat.length}`);

    // ============================================================================
    // V2.1: ARTICLE ENGINE - Contextual Image ALT Generation
    // ============================================================================

    let processedImagePrompts = Array.isArray(writerOut.image_prompts) ? writerOut.image_prompts : [];
    console.log(`[Images] Writer returned ${processedImagePrompts.length} image_prompts`);
    if (processedImagePrompts.length > 0) {
      console.log('[Images] Prompts:', processedImagePrompts.map((p: any) => ({ context: p.context, after_section: p.after_section })));
    }
    let featuredImageAlt: string | null = null;

    if (contextualAlt && niche) {
      try {
        const territoryName = territoryData?.official_name || 'Brasil';
        const imageTypes: ('hero' | 'service' | 'team' | 'equipment' | 'before_after' | 'location')[] = 
          ['hero', 'service', 'service', 'equipment', 'team', 'location'];
        
        // Generate contextual ALTs for each image
        const contextualAlts = generateMultipleAlts(
          {
            service: primaryKeyword,
            businessName: businessName || clientStrategy?.empresa_nome || 'empresa local',
            city: territoryName,
            niche: niche
          },
          processedImagePrompts.length || 3,
          imageTypes.slice(0, processedImagePrompts.length || 3)
        );
        
        // Associate ALTs to image prompts
        processedImagePrompts = processedImagePrompts.map((prompt: any, index: number) => ({
          ...prompt,
          alt: contextualAlts[index]?.alt || prompt.alt,
          title: contextualAlts[index]?.title || prompt.title,
          caption: contextualAlts[index]?.caption || prompt.caption
        }));
        
        // Featured image ALT
        if (contextualAlts.length > 0) {
          featuredImageAlt = contextualAlts[0].alt;
          console.log(`[Article Engine] Featured image ALT: "${featuredImageAlt}"`);
        }
        
        console.log(`[Article Engine] ${contextualAlts.length} contextual ALTs generated`);
      } catch (altError) {
        console.error(`[Article Engine] Error generating contextual ALTs:`, altError);
        // Continue with original ALTs
      }
    }

    // ============================================================================
    // V3.0: QUALITY GATE - IMAGE GENERATION WITH GEMINI
    // ============================================================================
    console.log('[QualityGate] Step 3: Generating images with Gemini...');
    
    // Generate images for all prompts using Gemini (with Unsplash fallback)
    // V3.3: LOGS OBRIGATÓRIOS antes do Quality Gate
    console.log(`[QualityGate V3.3] ========== PRE-VALIDATION DIAGNOSTICS ==========`);
    console.log(`[QualityGate V3.3] writer_intro_raw: ${writerIntroduction.length} chars`);
    console.log(`[QualityGate V3.3] clean_introduction: ${cleanIntroduction.length} chars`);
    console.log(`[QualityGate V3.3] introduction.preview: "${cleanIntroduction.substring(0, 120)}..."`);
    console.log(`[QualityGate V3.3] seo_body_trimmed: ${seoBodyContent.length} chars`);
    console.log(`[QualityGate V3.3] firstH2Index in finalContent: ${finalContent.search(/^##\s+/m)}`);
    console.log(`[QualityGate V3.3] ================================================`);

    let articleWithImages = {
      title: (seoOut.title || writerOut.title || articleEngineOutline?.h1 || theme).toString().trim(),
      meta_description: (seoOut.meta_description || writerOut.meta_description || articleEngineOutline?.metaDescription || '').toString().trim().substring(0, 160),
      excerpt: (seoOut.excerpt || writerOut.excerpt || seoOut.meta_description || '').toString().trim(),
      content: finalContent,  // V3.3: Usando finalContent (intro + body merged)
      // V3.3: Introduction vem DIRETAMENTE do campo Writer, não de parsing
      introduction: (() => {
        // Prioridade 1: Campo explícito do Writer (FONTE DA VERDADE)
        const explicitIntro = cleanIntroduction;
        
        if (explicitIntro.length >= 100) {
          console.log(`[Intro V3.3] ✅ Using explicit Writer introduction: ${explicitIntro.length} chars`);
          return explicitIntro;
        }
        
        // Prioridade 2: Fallback - extrair do finalContent (backward compatibility)
        console.warn(`[Intro V3.3] ⚠️ Writer introduction too short (${explicitIntro.length}), falling back to extraction`);
        
        const firstH2Index = finalContent.search(/^##\s+/m);
        
        // Edge-case: H2 at index 0 = no introduction
        if (firstH2Index === 0) {
          console.error(`[Intro V3.3] ❌ Content starts with ## - no introduction found`);
          return '';
        }
        
        // Normal case: extract before first H2
        if (firstH2Index > 0) {
          const extracted = finalContent.substring(0, firstH2Index).trim();
          console.log(`[Intro V3.3] Extracted from finalContent: ${extracted.length} chars`);
          return extracted;
        }
        
        // Fallback extremo: primeiros 2 parágrafos (sem headings)
        const paragraphs = finalContent.split('\n\n')
          .filter((p: string) => !p.trim().startsWith('#'))
          .slice(0, 2);
        console.warn(`[Intro V3.3] Using paragraph fallback: ${paragraphs.join('\n\n').length} chars`);
        return paragraphs.join('\n\n');
      })(),
      // V3.3: Extract conclusion using finalContent
      conclusion: (() => {
        const conclusionMatch = finalContent.match(/##\s*[^#]*(próximo\s*passo|conclus[ãa]o)[^#]*\n([\s\S]*?)(?=##|$)/i);
        return conclusionMatch?.[2]?.trim() || finalContent.split(/##\s*[^#]+próximo\s*passo|##\s*[^#]+conclus/i).pop()?.trim() || '';
      })(),
      sections: extractSectionsFromContent(finalContent),  // V3.3: Extract H2 sections from finalContent
      faq: Array.isArray(seoOut.faq) ? seoOut.faq : (Array.isArray(writerOut.faq) ? writerOut.faq : []),
      reading_time: Number(writerOut.reading_time || Math.ceil((finalContent.split(' ').length) / 200)),
      image_prompts: processedImagePrompts,  // With contextual ALTs
      images: writerOut.images,
      featured_image_alt: featuredImageAlt,  // Contextual ALT
      featured_image_url: null as string | null
    };

    // V5.0: Update stage to images
    await updateStage('images', 88);
    
    // V4.1: Image generation with 5s timeout + async fallback
    const IMAGE_TIMEOUT_MS = 5000; // 5 seconds max for sync images
    let imagesTimedOut = false;
    
    if (articleWithImages.image_prompts && articleWithImages.image_prompts.length > 0) {
      try {
        // V4.1: Race between image generation and timeout
        const imageGenPromise = generateArticleImagesViaProvider(
          articleWithImages,
          effectiveNiche,
          city
        );
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('IMAGE_TIMEOUT')), IMAGE_TIMEOUT_MS);
        });
        
        articleWithImages = await Promise.race([imageGenPromise, timeoutPromise]);
        console.log(`[${requestId}][Images] ✅ Generated in sync within ${IMAGE_TIMEOUT_MS}ms`);
        
      } catch (imgError) {
        const errorMsg = imgError instanceof Error ? imgError.message : 'Unknown';
        
        if (errorMsg === 'IMAGE_TIMEOUT') {
          console.warn(`[${requestId}][Images] ⏱️ Timeout after ${IMAGE_TIMEOUT_MS}ms - will generate in background`);
          imagesTimedOut = true;
          
          // Use Unsplash placeholders for immediate response
          for (const imgPrompt of articleWithImages.image_prompts) {
            const placeholder = generateUnsplashFallback({
              prompt: '',
              context: imgPrompt.context || 'business',
              niche: effectiveNiche,
              city
            });
            imgPrompt.url = placeholder.url;
            imgPrompt.generated_by = 'unsplash_placeholder';
          }
          
          // Set placeholder for featured image
          if (!articleWithImages.featured_image_url && articleWithImages.image_prompts[0]) {
            articleWithImages.featured_image_url = articleWithImages.image_prompts[0].url;
          }
        } else {
          console.error(`[${requestId}][Images] ⚠️ Generation failed:`, errorMsg);
        }
      }
    }

    // ============================================================================
    // V3.0: QUALITY GATE - FINAL VALIDATION (FAIL-FAST)
    // ============================================================================
    console.log(`[${requestId}][QualityGate] Step 4: Running quality validation...`);
    
    // Determine mode for validation - HOTFIX: usar effectiveMode
    const articleMode: ArticleMode = effectiveMode === 'entry' ? 'entry' : 'authority';
    console.log(`[${requestId}][QualityGate] Running validation for mode: ${articleMode}`);
    
    // 5. Chamada do Quality Gate com allowWarnings
    const gateResult = runQualityGate(articleWithImages, articleMode, {
      allowWarnings: generation_mode === 'fast' || articleMode === 'entry',
      generationMode: generation_mode,
      requestId: requestId
    });

    // Log warnings se existirem
    if (gateResult.warnings && gateResult.warnings.length > 0) {
      console.warn(`[${requestId}][QualityGate] Passed with warnings:`, gateResult.warnings);
    }

    // V4.4: Quality Gate NEVER aborts - always saves with warnings
    // Articles with quality issues are forced to 'draft' status
    const hasQualityWarnings = gateResult.warnings && gateResult.warnings.length > 0;
    const hasCriticalWarnings = gateResult.warnings?.some(w => w.startsWith('critical_'));
    
    if (!gateResult.passed) {
      // V4.4: Even failed gates should save as draft (never return 422)
      console.warn(`[${requestId}][QualityGate] ⚠️ GATE FAILED but saving as draft: ${gateResult.code}`);
      console.warn(`[${requestId}][QualityGate] Details: ${gateResult.details}`);
    } else if (hasQualityWarnings) {
      console.warn(`[${requestId}][QualityGate] ⚠️ PASSED WITH WARNINGS:`, gateResult.warnings);
    } else {
      console.log(`[${requestId}][QualityGate] ✅ ALL GATES PASSED`);
    }
    
    console.log(`[${requestId}][QualityGate] Metrics:`, gateResult.metrics);

    // ============================================================================
    // V6.1: FOOTPRINT CHECKS - Anti-Commodity Validation + Inline Auto-Mutation
    // ============================================================================
    const footprintStartMs = Date.now();
    let footprintSimilarityScore = 0;
    let highSimilarityWarning = false;
    let mutationSkippedDueTimeout = false;
    let h2PatternHash = '';

    if (eliteEngineDecision && articleWithImages.content) {
      try {
        console.log(`[${requestId}][FootprintChecks] Running anti-commodity validation...`);
        
        // Fetch history for footprint comparison (city+niche scoped)
        const fpWindowSize = eliteEngineDecision.anti_collision_metadata.window_size;
        const fpNicheNormalized = normalizeNiche(effectiveNiche);
        const fpCityNormalized = (city || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        
        // Single query, filter in-memory for city+niche scope
        const { data: fpHistoryRaw } = await supabase
          .from('articles')
          .select('content, source_payload')
          .eq('blog_id', blog_id!)
          .not('article_structure_type', 'is', null)
          .order('created_at', { ascending: false })
          .limit(fpWindowSize * 3);

        let fpHistory = fpHistoryRaw || [];
        
        // City+niche scoped filtering (when available)
        if (fpCityNormalized && fpCityNormalized !== 'brasil' && fpNicheNormalized !== 'default') {
          const scoped = fpHistory.filter((a: any) => {
            const ee = a.source_payload?.eliteEngine;
            if (!ee) return false;
            const aNiche = ee.niche_normalized || '';
            const aCity = (ee.city || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            if (aNiche && aNiche !== fpNicheNormalized) return false;
            if (aCity && aCity !== fpCityNormalized) return false;
            return true;
          });
          if (scoped.length >= 3) {
            fpHistory = scoped.slice(0, fpWindowSize);
            console.log(`[${requestId}][FootprintChecks] Using city+niche scoped history: ${fpHistory.length} articles`);
          } else {
            fpHistory = fpHistory.slice(0, fpWindowSize);
            console.log(`[${requestId}][FootprintChecks] Fallback to blog-level history: ${fpHistory.length} articles`);
          }
        } else {
          fpHistory = fpHistory.slice(0, fpWindowSize);
        }
        
        // Extract hashes from history
        const historyStructureHashes: string[] = fpHistory
          .map((a: any) => a.source_payload?.eliteEngine?.structure_hash)
          .filter(Boolean);
        const historyBlocksHashes: string[] = fpHistory
          .map((a: any) => a.source_payload?.eliteEngine?.blocks_hash)
          .filter(Boolean);
        const historyH2PatternHashes: string[] = fpHistory
          .map((a: any) => a.source_payload?.eliteEngine?.h2_pattern_hash)
          .filter(Boolean);
        const historyH2Patterns: string[][] = fpHistory
          .map((a: any) => {
            const content = a.content || '';
            const matches = content.match(/^##\s+(.+)$/gm);
            return (matches || []).map((m: string) => m.replace(/^##\s+/, '').trim());
          })
          .filter((h: string[]) => h.length > 0);
        
        // Generate hashes for current content
        h2PatternHash = generateH2PatternHash(articleWithImages.content);
        const currentStructureHash = eliteEngineDecision.anti_collision_metadata.structure_hash;
        const currentBlocksHash = eliteEngineDecision.anti_collision_metadata.blocks_hash;
        
        // Run footprint checks
        const fpResult = runFootprintChecks({
          content: articleWithImages.content,
          structureHash: currentStructureHash,
          blocksHash: currentBlocksHash,
          h2PatternHash,
          historyStructureHashes,
          historyBlocksHashes,
          historyH2PatternHashes,
          historyH2Patterns,
          threshold: 70,
        });

        footprintSimilarityScore = fpResult.similarity_score;
        console.log(`[${requestId}][FootprintChecks] similarity_score=${fpResult.similarity_score}, should_mutate=${fpResult.should_mutate}, issues=${fpResult.issues.length}`);

        // Auto-mutation if needed
        if (fpResult.should_mutate && fpResult.mutation_instructions) {
          // Timeout guardrail: check if we have enough time remaining
          // Edge functions have ~120s max. Reserve 20s for persistence + background jobs.
          const elapsedMs = Date.now() - footprintStartMs;
          const totalElapsedMs = Date.now() - (footprintStartMs - elapsedMs); // approximate
          const estimatedTimeRemainingMs = 120000 - totalElapsedMs;
          
          if (estimatedTimeRemainingMs < 20000) {
            console.warn(`[${requestId}][FootprintChecks] ⚠️ Skipping mutation: only ${Math.round(estimatedTimeRemainingMs/1000)}s remaining`);
            mutationSkippedDueTimeout = true;
            highSimilarityWarning = true;
          } else {
            console.log(`[${requestId}][FootprintChecks] Running inline auto-mutation (${fpResult.mutation_instructions.length} instructions)...`);
            
            const autoFixPrompt = buildAutoFixPrompt(fpResult.mutation_instructions, articleWithImages.content);
            
            if (autoFixPrompt) {
              try {
                const SUPABASE_URL_FP = Deno.env.get('SUPABASE_URL')!;
                const SERVICE_KEY_FP = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                
                const mutationPrompt = `Você é um editor profissional. Reescreva APENAS as seções indicadas abaixo, mantendo o restante do artigo INTACTO.
${autoFixPrompt}

ARTIGO COMPLETO:
${articleWithImages.content}

Retorne APENAS o artigo completo corrigido em Markdown. NÃO inclua explicações.`;

                const mutationResponse = await fetch(`${SUPABASE_URL_FP}/functions/v1/ai-gateway`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${SERVICE_KEY_FP}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'google/gemini-2.5-flash',
                    messages: [{ role: 'user', content: mutationPrompt }],
                    temperature: 0.3,
                    max_tokens: 8000,
                  }),
                });
                
                if (mutationResponse.ok) {
                  const mutationResult = await mutationResponse.json();
                  const mutatedContent = mutationResult.choices?.[0]?.message?.content;
                  
                  if (mutatedContent) {
                    // Validate mutation didn't destroy content (max 15% reduction)
                    const originalWords = articleWithImages.content.split(/\s+/).length;
                    const mutatedWords = mutatedContent.split(/\s+/).length;
                    const reduction = (originalWords - mutatedWords) / originalWords;
                    
                    if (reduction <= 0.15) {
                      articleWithImages.content = mutatedContent;
                      h2PatternHash = generateH2PatternHash(mutatedContent);
                      
                      // Re-run footprint checks on mutated content
                      const fpResult2 = runFootprintChecks({
                        content: mutatedContent,
                        structureHash: currentStructureHash,
                        blocksHash: currentBlocksHash,
                        h2PatternHash,
                        historyStructureHashes,
                        historyBlocksHashes,
                        historyH2PatternHashes,
                        historyH2Patterns,
                        threshold: 70,
                      });

                      footprintSimilarityScore = fpResult2.similarity_score;
                      highSimilarityWarning = fpResult2.should_mutate;
                      console.log(`[${requestId}][FootprintChecks] Post-mutation: similarity_score=${fpResult2.similarity_score}, still_high=${fpResult2.should_mutate}`);
                    } else {
                      console.warn(`[${requestId}][FootprintChecks] Mutation rejected: ${(reduction*100).toFixed(1)}% content reduction`);
                      highSimilarityWarning = true;
                    }
                  }
                } else {
                  console.error(`[${requestId}][FootprintChecks] AI Gateway error: ${mutationResponse.status}`);
                  highSimilarityWarning = true;
                }
              } catch (mutErr) {
                console.error(`[${requestId}][FootprintChecks] Mutation error:`, mutErr);
                highSimilarityWarning = true;
              }
            }
          }
        }
        
        console.log(`[${requestId}][FootprintChecks] Done in ${Date.now() - footprintStartMs}ms. h2_pattern_hash=${h2PatternHash}, similarity=${footprintSimilarityScore}`);
      } catch (fpErr) {
        console.error(`[${requestId}][FootprintChecks] Error (non-blocking):`, fpErr);
      }
    }

    // Build final article object for persistence
    const article = {
      title: articleWithImages.title,
      meta_description: articleWithImages.meta_description,
      excerpt: articleWithImages.excerpt,
      content: articleWithImages.content,
      faq: articleWithImages.faq,
      reading_time: articleWithImages.reading_time,
      image_prompts: articleWithImages.image_prompts,
      images: articleWithImages.images,
      featured_image_alt: articleWithImages.featured_image_alt,
      featured_image_url: articleWithImages.featured_image_url
    };

    // NEW: infer category/tags (used downstream)
    const inferredCategory = inferCategory(theme, article.content, keywords);
    const inferredTags = inferTags(theme, article.content, keywords, inferredCategory);

    // V5.0: Update stage to finalizing
    await updateStage('finalizing', 95);
    
    // ============ PERSISTÊNCIA OBRIGATÓRIA NO BANCO ============
    // CRÍTICO: O artigo DEVE ser salvo na tabela 'articles' antes de retornar
    // V5.0: Respeitar auto_publish do request + Quality Gate
    const shouldForceDraft = !gateResult.passed || hasCriticalWarnings;
    const autoPublish = auto_publish && !shouldForceDraft; // V5.0: Respeitar parametro do caller
    
    if (shouldForceDraft) {
      console.log(`[${requestId}] ⚠️ Forcing draft status due to quality gate issues`);
    }
    
    console.log(`[${requestId}] Starting persistence: blog_id=${blog_id}, user_id=${user?.id}, autoPublish=${autoPublish}`);
    
    // Helper function to generate slug from title
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
    };

    // V2.1: Build Article Engine metadata for source_payload
    const articleEnginePayload = articleEngineTemplate ? {
      articleEngine: {
        version: '3.0',
        template: articleEngineTemplate.template,
        variant: articleEngineTemplate.variant,
        intent: articleEngineTemplate.intent?.type,
        useEat: useEat,
        contextualAlt: contextualAlt,
        niche: effectiveNiche,
        mode: mode,
        qualityGate: gateResult.metrics,
        outline: articleEngineOutline ? {
          h2Count: articleEngineOutline.h2Count,
          targetWords: articleEngineOutline.totalTargetWords
        } : null
      }
    } : null;

    // V4.2: Build CTA from business profile
    const articleCTA = await buildArticleCTA(supabase, blog_id!);

    let persistedArticle;
    try {
      // V5.0: If article_id provided, UPDATE the placeholder instead of INSERT
      if (incomingArticleId) {
        console.log(`[${requestId}] V5.0: Updating placeholder ${incomingArticleId} instead of creating new`);
        
        // V5.0: Deduplicate featured image from content_images (Bug 3 fix)
        const contentImagesForUpdate = (article.image_prompts || []).map((prompt: any, index: number) => ({
          context: prompt.context || `Imagem ${index + 1}`,
          prompt: prompt.prompt || '',
          alt: prompt.alt || prompt.context || `Imagem do artigo`,
          title: prompt.title || '',
          caption: prompt.caption || '',
          after_section: prompt.after_section || index + 1,
          url: prompt.url || null
        }));
        
        // V5.0 Bug 3: Remove featured image from content_images to avoid duplication
        const featuredUrl = article.featured_image_url;
        const filteredContentImages = featuredUrl 
          ? contentImagesForUpdate.filter((img: any) => img.url !== featuredUrl)
          : contentImagesForUpdate;
        
        const { content: sanitizedContent } = sanitizeContent(article.content || '');
        
        const updateData: Record<string, any> = {
          title: article.title || 'Artigo sem título',
          slug: (article.title || 'artigo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) + '-' + Date.now().toString(36),
          content: sanitizedContent,
          excerpt: article.excerpt || article.meta_description || '',
          meta_description: article.meta_description || '',
          category: inferredCategory || null,
          tags: inferredTags || [],
          faq: article.faq || [],
          keywords: keywords || [],
          reading_time: article.reading_time || 5,
          status: autoPublish ? 'published' : 'draft',
          published_at: autoPublish ? new Date().toISOString() : null,
          generation_source: source || 'form',
          featured_image_url: article.featured_image_url || null,
          featured_image_alt: article.featured_image_alt || null,
          niche_profile_id: nicheProfile?.id || null,
          niche_locked: true,
          score_locked: true,
          // V6.0: Save structure_type from Elite Engine (official taxonomy only)
          article_structure_type: eliteEngineDecision?.structure_type || articleEngineTemplate?.template || null,
          source_payload: eliteEngineDecision ? {
            ...(articleEnginePayload || {}),
            eliteEngine: {
              version: '2.2',
              structure_type: eliteEngineDecision.structure_type,
              variant: eliteEngineDecision.variant,
              angle: eliteEngineDecision.angle,
              style_mode: eliteEngineDecision.style_mode,
              blocks: eliteEngineDecision.blocks.map(b => b.block_key),
              rhythm_profile: eliteEngineDecision.rhythm_profile,
              funnel_mode: eliteEngineDecision.funnel_mode,
              article_goal: eliteEngineDecision.article_goal,
              structure_hash: eliteEngineDecision.anti_collision_metadata.structure_hash,
              blocks_hash: eliteEngineDecision.anti_collision_metadata.blocks_hash,
              h2_pattern_hash: h2PatternHash || null,
              anti_collision: eliteEngineDecision.anti_collision_metadata,
              similarity_score: footprintSimilarityScore,
              high_similarity_warning: highSimilarityWarning,
              mutation_skipped_due_timeout: mutationSkippedDueTimeout || undefined,
              city: city || null,
              niche_normalized: normalizeNiche(effectiveNiche),
              local_intelligence: eliteEngineDecision.local_intelligence || null,
            }
          } : (articleEnginePayload || null),
          content_images: filteredContentImages.length > 0 ? filteredContentImages : null,
          cta: articleCTA || null,
          generation_stage: 'completed',
          generation_progress: 100,
          updated_at: new Date().toISOString(),
        };
        
        const { error: updateError } = await supabase
          .from('articles')
          .update(updateData)
          .eq('id', incomingArticleId);
        
        if (updateError) {
          console.error(`[${requestId}] Placeholder update failed:`, updateError);
          throw new Error(`Falha ao atualizar placeholder: ${updateError.message}`);
        }
        
        persistedArticle = { 
          id: incomingArticleId, 
          slug: updateData.slug, 
          status: updateData.status, 
          title: updateData.title 
        };
        console.log(`[${requestId}] ✅ Placeholder updated: id=${incomingArticleId}`);
      } else {
        // Original flow: create new article
        persistedArticle = await persistArticleToDb(
          supabase,
          blog_id!,
          article,
          autoPublish,
          inferredCategory,
          inferredTags,
          nicheProfile?.id || null,
          user?.id,
          // V6.0: Save structure_type from Elite Engine
          eliteEngineDecision?.structure_type || articleEngineTemplate?.template || null,
          eliteEngineDecision ? {
            ...(articleEnginePayload || {}),
            eliteEngine: {
              version: '2.2',
              structure_type: eliteEngineDecision.structure_type,
              variant: eliteEngineDecision.variant,
              angle: eliteEngineDecision.angle,
              style_mode: eliteEngineDecision.style_mode,
              blocks: eliteEngineDecision.blocks.map((b: any) => b.block_key),
              rhythm_profile: eliteEngineDecision.rhythm_profile,
              funnel_mode: eliteEngineDecision.funnel_mode,
              article_goal: eliteEngineDecision.article_goal,
              structure_hash: eliteEngineDecision.anti_collision_metadata.structure_hash,
              blocks_hash: eliteEngineDecision.anti_collision_metadata.blocks_hash,
              h2_pattern_hash: h2PatternHash || null,
              anti_collision: eliteEngineDecision.anti_collision_metadata,
              similarity_score: footprintSimilarityScore,
              high_similarity_warning: highSimilarityWarning,
              mutation_skipped_due_timeout: mutationSkippedDueTimeout || undefined,
              city: city || null,
              niche_normalized: normalizeNiche(effectiveNiche),
              local_intelligence: eliteEngineDecision.local_intelligence || null,
            }
          } : articleEnginePayload,
          // V4.2: CTA
          articleCTA
        );
      }
      console.log(`[${requestId}] SUCCESS: id=${persistedArticle.id}`);
      
      // ============================================================================
      // V4.0: DISPATCH BACKGROUND SEO ENHANCER JOB
      // This runs AFTER article is saved - does NOT block the response
      // ============================================================================
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      // Use EdgeRuntime.waitUntil if available, otherwise fire-and-forget
      const seoJobPayload = {
        article_id: persistedArticle.id,
        blog_id,
        request_id: requestId,
        keyword: primaryKeyword,
        territory: territoryData?.official_name || null,
      };
      
      console.log(`[${requestId}] Dispatching seo-enhancer-job for article ${persistedArticle.id}`);
      
      // Fire-and-forget background job (non-blocking)
      fetch(`${SUPABASE_URL}/functions/v1/seo-enhancer-job`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(seoJobPayload),
      }).then(res => {
        if (res.ok) {
          console.log(`[${requestId}][SEO-Job] ✅ Dispatched successfully`);
        } else {
          console.warn(`[${requestId}][SEO-Job] ⚠️ Dispatch returned ${res.status}`);
        }
      }).catch(e => {
        console.error(`[${requestId}][SEO-Job] ❌ Failed to dispatch:`, e);
      });
      
      // V4.3: Dispatch background image generation if timed out
      if (imagesTimedOut && articleWithImages.image_prompts?.length > 0) {
        const totalImages = articleWithImages.image_prompts.length;
        console.log(`[${requestId}][STAGE] images - Dispatching background job for ${totalImages} images`);
        
        // V4.7: Atualizar flags de imagem ANTES do dispatch
        // NOTA: image_prompts removido - coluna não existe, content_images será atualizado pelo background job
        const { error: preDispatchError } = await supabase
          .from('articles')
          .update({ 
            images_pending: true,
            images_total: totalImages,
            images_completed: 0
            // V4.7: REMOVIDO image_prompts - coluna não existe
            // content_images será atualizado pelo background job
          })
          .eq('id', persistedArticle.id);
        
        if (preDispatchError) {
          console.error(`[${requestId}][Images] Pre-dispatch update failed:`, preDispatchError);
        }
        
        // V4.3: Dispatch com await e logging obrigatório
        try {
          const dispatchRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-images-background`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              article_id: persistedArticle.id,
              blog_id,
              request_id: requestId,
              image_prompts: articleWithImages.image_prompts,
              niche: effectiveNiche,
              city
            }),
          });
          
          const dispatchBody = await dispatchRes.text();
          console.log(`[${requestId}][ImageJob] Dispatch response: status=${dispatchRes.status}, body=${dispatchBody.substring(0, 200)}`);
          
          if (!dispatchRes.ok) {
            console.error(`[${requestId}][ImageJob] ❌ Dispatch failed: ${dispatchRes.status}`);
          }
        } catch (dispatchErr) {
          console.error(`[${requestId}][ImageJob] ❌ Dispatch exception:`, dispatchErr);
        }
      }
      
      // V4.3: Garantir generation_stage = 'completed' após persistência
      const { error: stageError } = await supabase
        .from('articles')
        .update({ 
          generation_stage: 'completed',
          generation_progress: 100
        })
        .eq('id', persistedArticle.id);
      
      if (stageError) {
        console.warn(`[${requestId}] Failed to set final stage:`, stageError);
      }
      
      console.log(`[${requestId}][STAGE] completed (100%)`);
      
    } catch (persistError) {
      console.error(`[${requestId}] PERSIST_ERROR:`, persistError);
      throw new Error(`DB_PERSIST_FAILED: Não foi possível salvar o artigo no banco. ${persistError instanceof Error ? persistError.message : 'Erro desconhecido'}`);
    }

    // OmniCore metadata - reuse existing textModel from generation
    const writerModelUsed = textModel; // Model used for writing
    const qaModelUsed = 'google/gemini-2.5-flash';     // QA model for OmniCore
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        article: {
          ...article,
          id: persistedArticle.id,
          slug: persistedArticle.slug,
          status: persistedArticle.status,
          category: inferredCategory,
          tags: inferredTags
        },
        // OmniCore metadata
        writer_model: writerModelUsed,
        qa_model: qaModelUsed,
        // V2.1: Article Engine metadata
        articleEngine: articleEngineTemplate ? {
          template: articleEngineTemplate.template,
          variant: articleEngineTemplate.variant,
          intent: articleEngineTemplate.intent,
          antiPatternApplied: articleEngineTemplate.antiPatternApplied,
          outline: articleEngineOutline ? {
            h1: articleEngineOutline.h1,
            h2Count: articleEngineOutline.h2Count,
            targetWords: articleEngineOutline.totalTargetWords,
            urlSlug: articleEngineOutline.urlSlug
          } : null,
          eatInjected: useEat,
          contextualAltGenerated: contextualAlt
        } : null,
        // Territorial metadata for frontend JSON-LD injection
        territorial: territoryData ? {
          official_name: territoryData.official_name,
          neighborhoods_used: territoryData.neighborhood_tags?.slice(0, 5) || [],
          geo: territoryData.lat && territoryData.lng ? {
            '@type': 'GeoCoordinates',
            latitude: territoryData.lat,
            longitude: territoryData.lng
          } : null
        } : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-article-structured:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate article';

    let errorCode = 'UNKNOWN_ERROR';
    if (message.includes('RESEARCH_REQUIRED')) errorCode = 'RESEARCH_REQUIRED';
    else if (message.includes('QUALITY_GATE_FAILED')) errorCode = 'QUALITY_GATE_FAILED';
    else if (message.includes('AI_RATE_LIMIT')) errorCode = 'AI_RATE_LIMIT';
    else if (message.includes('AI_CREDITS')) errorCode = 'AI_CREDITS';
    else if (message.includes('AI_OUTPUT_INVALID')) errorCode = 'AI_OUTPUT_INVALID';
    else if (message.includes('LOVABLE_API_KEY')) errorCode = 'CONFIG_ERROR';

    return new Response(
      JSON.stringify({ error: errorCode, message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
