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
  type TerritoryData as GeoTerritoryData,
  type GeoResearchData,
  type GeoValidationResult
} from '../_shared/geoWriterCore.ts';

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
}

async function runResearchStage(params: {
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

  // 1) SERP research (Perplexity + Firecrawl inside analyze-serp)
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const serpStart = nowMs();
  const serpRes = await fetch(`${SUPABASE_URL}/functions/v1/analyze-serp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keyword: primaryKeyword,
      territory: territoryName,
      blogId,
      forceRefresh: false,
      useFirecrawl: true,
    }),
  });

  if (!serpRes.ok) {
    const t = await serpRes.text().catch(() => '');
    throw new Error(`RESEARCH_REQUIRED: analyze-serp failed (${serpRes.status}) ${t.substring(0, 200)}`);
  }

  const serpJson = await serpRes.json();
  const serpMatrix: SerpMatrixLite = serpJson?.matrix || {};
  const serpDuration = nowMs() - serpStart;

  // 2) GEO factual package (Perplexity) - MUST succeed
  const geoStart = nowMs();
  const geo = await fetchGeoResearchData(
    theme,
    territoryData,
    PERPLEXITY_API_KEY,
    undefined, // no fallback
    supabase,
    blogId,
    undefined
  );

  const geoDuration = nowMs() - geoStart;

  if (!geo) {
    throw new Error('RESEARCH_REQUIRED: Perplexity research returned null');
  }

  // unified sources list (Perplexity + competitors)
  const competitorUrls = (serpMatrix.competitors || []).map(c => c.url).filter(Boolean);
  const sources = [...new Set([...(geo.sources || []), ...competitorUrls])].filter(Boolean);

  const pkg: ResearchPackage = {
    geo,
    serp: serpMatrix,
    sources,
    generatedAt: new Date().toISOString(),
  };

  const totalDuration = nowMs() - start;

  await logStage(supabase, blogId, 'research', 'perplexity', 'research-package', true, totalDuration, {
    geo_ms: geoDuration,
    serp_ms: serpDuration,
    sources_count: sources.length,
    has_firecrawl: true,
  });

  return pkg;
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

async function callLovableJsonTool(params: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  toolName: string;
  toolSchema: Record<string, unknown>;
  temperature?: number;
}): Promise<{ arguments: Record<string, unknown>; usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number } }> {
  const { url, apiKey, model, system, user, toolName, toolSchema, temperature = 0.4 } = params;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      tools: [toolSchema],
      tool_choice: { type: 'function', function: { name: toolName } },
      temperature,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`AI_GATEWAY_ERROR: ${res.status} ${t.substring(0, 300)}`);
  }

  const rawText = await res.text();
  const data = safeJsonParse<any>(rawText);
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error('AI_OUTPUT_INVALID: missing tool call arguments');
  }

  const parsedArgs = parseArticleJSON(toolCall.function.arguments);
  return { arguments: parsedArgs, usage: data.usage };
}

async function callLovableQa(params: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<{ approved: boolean; score: number; issues: Array<{ code: string; message: string }>; usage?: { total_tokens?: number } }> {
  const { url, apiKey, model, system, user } = params;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QA_GATEWAY_ERROR: ${res.status} ${text.substring(0, 300)}`);
  }

  const data = safeJsonParse<any>(text);
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = safeJsonParse<any>(content.replace(/```json\n?|\n?```/g, '').trim());

  return {
    approved: !!parsed.approved,
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    usage: data.usage,
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
  userId?: string | null  // User ID for RLS policy
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
  
  // Preparar dados para inserção (no duplicate found)
  const insertData = {
    blog_id: blogId,
    user_id: userId || null, // CRITICAL FIX: Set user_id for RLS policy
    title: articleData.title || 'Artigo sem título',
    title_fingerprint: titleFingerprint, // NEW: For deduplication
    slug: uniqueSlug,
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
    generation_source: 'form',
    featured_image_url: articleData.featured_image_url || null,
    featured_image_alt: articleData.featured_image_alt || null,
    // V2.0: Niche Deterministic Architecture fields
    niche_profile_id: nicheProfileId || null,
    niche_locked: true,   // Always lock niche on generation
    score_locked: true,   // Protect score from automatic changes
  };
  
  console.log(`[PERSIST] Inserting article with slug: ${uniqueSlug}, status: ${insertData.status}, user_id: ${insertData.user_id}`);
  
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
  const niche = template?.target_niche || 'empresas de serviços';
  const keywordsText = keywords.length > 0 ? keywords.join(', ') : theme;

  // Get tone instructions based on account configuration
  const selectedToneInstructions = toneInstructions[tone] || toneInstructions.friendly;

  // Custom structure from template
  const structureText = template?.mandatory_structure?.length 
    ? template.mandatory_structure.map((s, i) => `   ${i + 1}. H2: "${s.heading}" → Mensagem: ${s.key_message}`).join('\n')
    : '';

  return `Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, Especialista Editorial em Conteúdo para DONOS de Empresas de Serviços.

🤖 IDENTIDADE: OMNISEEN AI - Assistente de Criação de Conteúdo

🎯 PRINCÍPIO MESTRE (INQUEBRÁVEL)
Todo conteúdo deve parecer escrito para um dono de negócio lendo no celular, no carro ou no meio do trabalho.
O dono deve pensar: "Isso foi escrito para MIM."
Se isso não for atendido, o conteúdo está ERRADO e deve ser refeito.

🎙️ TOM DO ARTIGO (CONFIGURAÇÃO DA CONTA):
${selectedToneInstructions}

🧠 PERSONA OBRIGATÓRIA DO LEITOR
- Dono de pequena/média empresa de ${niche}
- Trabalha no campo, no atendimento ou na operação
- Vive apagando incêndios
- NÃO tem tempo para estudar tecnologia
- Quer parar de perder clientes, dinheiro e controle
- Lê no celular, entre um serviço e outro

🏷️ IDENTIDADE DA MARCA: ${companyName}
⚠️ EXTREMAMENTE IMPORTANTE:
- TODO benefício, exemplo e resultado deve ser em nome de: ${companyName}
- NUNCA use: "nossa plataforma", "esta solução", "o sistema", "a ferramenta", "a tecnologia"
- SEMPRE use: "${companyName}" ou fale direto com "você", "seu negócio", "seu cliente"
- Os benefícios pertencem à marca do dono, NUNCA à ferramenta

📐 ESTRUTURA EDITORIAL (ESTILO AUTOMARTICLES):
- 7-9 seções H2 (mais profundidade que o padrão)
- Parágrafos de 1-3 linhas no MÁXIMO
- Frases curtas e diretas (máximo 2 linhas)
- Listas com bullets FREQUENTES
- 1-2 blockquotes por artigo para insights importantes (use > no markdown)
- Negrito estratégico para pontos-chave
- Transições suaves entre seções
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
      google_place
    }: ArticleRequest & { funnel_mode?: FunnelMode; article_goal?: ArticleGoal | null; auto_publish?: boolean } = await req.json();

    // ============================================================================
    // V2.0: GEO MODE IS ALWAYS TRUE - NO EXCEPTIONS
    // ============================================================================
    const geo_mode = true; // HARDCODED - NEVER false
    console.log(`[OMNICORE GEO V2.0] geo_mode=true FORCED - No article exists outside OmniCore GEO Writer`);

    // RESOLVER GENERATION_MODE: Nunca undefined - GEO mode forces deep
    const generation_mode = 'deep'; // GEO mode always uses deep mode
    console.log(`[GENERATION MODE] Forced: deep (OmniCore GEO always generates 1200-3000 words)`);

    if (!theme) {
      return new Response(
        JSON.stringify({ error: 'Theme is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    // STAGE 1 (RESEARCH - PERPLEXITY REQUIRED)
    // - SERP (analyze-serp)
    // - GEO factual package (Perplexity)
    // ============================================================================
    const primaryKeyword = Array.isArray(keywords) && keywords.length > 0 ? keywords[0] : theme;
    let researchPackage: ResearchPackage;

    try {
      researchPackage = await runResearchStage({
        supabase,
        blogId: blog_id!,
        theme,
        primaryKeyword,
        territoryName: territoryData?.official_name || null,
        territoryData: (territoryData as unknown as GeoTerritoryData) || null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logStage(supabase, blog_id, 'research', 'perplexity', 'research-package', false, 0, {}, 0, 0, msg);
      return new Response(
        JSON.stringify({
          error: 'RESEARCH_REQUIRED',
          message: msg,
        }),
        { status: 424, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        empresa_nome: editorial_template?.company_name || null,
        tipo_negocio: editorial_template?.target_niche || 'serviços',
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
      isDefaultStrategy = true;
    }

    // GEO MODE: Use GEO Writer identity + REAL research + territorial context
    const researchInjection = buildResearchInjection(researchPackage.geo);
    const territorialContext = buildTerritorialContext(territoryData as GeoTerritoryData);
    const governanceBlock = buildGovernanceBlock(researchPackage);

    // Keep identity compact to avoid context overflow.
    const GEO_WRITER_IDENTITY_COMPACT = `Você é o OmniCore Writer da Omniseen.\n\nRegras: 1) H1 único. 2) H2/H3 consistentes. 3) Parágrafos curtos. 4) Use links externos para fontes. 5) Não invente dados fora do pacote.`;

    const systemPrompt = `${GEO_WRITER_IDENTITY_COMPACT}\n\n${governanceBlock}\n\n${researchInjection}\n${territorialContext}\n\n## CONTEXTO DO CLIENTE\n${buildUniversalPrompt(clientStrategy, funnel_mode as FunnelMode, article_goal as ArticleGoal | null, theme, keywords)}`;

    // ============================================================================
    // STAGE 2 (WRITER)
    // ============================================================================

    const MODEL_CONFIG = {
      traditional: {
        sections: { min: 5, max: 7, default: 6 },
        imageFrequency: 3,
        visualBlocks: { min: 2, max: 3, types: ['💡', '⚠️', '📌'] }
      },
      strategic: {
        sections: { min: 5, max: 9, default: 7 },
        imageFrequency: 2,
        visualBlocks: { min: 5, max: 7, types: ['💡', '⚠️', '📌', '✅', '❝'] }
      },
      visual_guided: {
        sections: { min: 5, max: 6, default: 5 },
        imageFrequency: 1,
        visualBlocks: { min: 3, max: 4, types: ['💡', '📌', '✅'] }
      }
    };

    const modelConfig = MODEL_CONFIG[editorial_model] || MODEL_CONFIG.traditional;
    const effectiveSectionCount = section_count || modelConfig.sections.default;
    const calculatedImageCount = Math.ceil(effectiveSectionCount / modelConfig.imageFrequency);
    const targetImageCount = Math.min(Math.max(image_count || calculatedImageCount, 1), 5);

    // Build dynamic tool schema (kept as create_article)
    const contextEnumValues = ['problem', 'solution', 'result', 'insight', 'cta'].slice(0, targetImageCount);

    const createArticleTool = {
      type: 'function' as const,
      function: {
        name: 'create_article',
        description: 'Creates a complete SEO-optimized blog article with meta + FAQ + image prompts',
        parameters: {
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
            reading_time: { type: 'number' },
            image_prompts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  context: { type: 'string', enum: contextEnumValues },
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
          required: ['title', 'meta_description', 'excerpt', 'content', 'faq', 'reading_time', 'image_prompts', 'images'],
          additionalProperties: false
        }
      }
    };

    const writerStart = nowMs();
    const writerUserPrompt = `Escreva o artigo completo sobre: "${theme}"\n\nREGRAS CRÍTICAS:\n- Use APENAS as fontes e dados do pacote de pesquisa\n- Inclua links externos (https://...) apontando para FONTES PERMITIDAS\n- Estruture com H1–H3, inclua FAQ + meta tags\n- Não invente estatísticas/tendências. Se faltar dado: "não encontrado nas fontes".`;

    const gatewayUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';

    const writerCall = await callLovableJsonTool({
      url: gatewayUrl,
      apiKey: LOVABLE_API_KEY,
      model: textModel,
      system: systemPrompt,
      user: writerUserPrompt,
      toolName: 'create_article',
      toolSchema: createArticleTool,
      temperature: 0.6
    });

    const writerDuration = nowMs() - writerStart;
    await logStage(supabase, blog_id, 'writer', 'lovable', 'writer', true, writerDuration, {
      model: textModel,
      keyword: primaryKeyword,
    }, 0, writerCall.usage?.total_tokens);

    // Build article object from writer output
    const writerOut = writerCall.arguments as any;

    // ============================================================================
    // STAGE 3 (SEO) - Re-structure for organic performance using SERP package
    // ============================================================================

    const optimizeTool = {
      type: 'function' as const,
      function: {
        name: 'optimize_article',
        description: 'SEO rewriter: outputs improved title/meta/content/faq based on research package',
        parameters: {
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
              },
              additionalProperties: true
            }
          },
          required: ['title', 'meta_description', 'excerpt', 'content', 'faq'],
          additionalProperties: true
        }
      }
    };

    const seoSystem = `Você é um Agente SEO. Reestruture o texto para máxima performance orgânica.\n\nRegras:\n- H1 único, H2/H3 consistentes, densidade semântica alta sem keyword stuffing\n- Use entidades/termos do SERP e respeite intenção de busca\n- Gere FAQ/snippet/meta tags\n- NÃO crie fatos novos. Use apenas o pacote de pesquisa e o rascunho.`;

    const seoUser = `PACOTE DE PESQUISA (resumo):\n- Termos: ${(researchPackage.serp.commonTerms || []).slice(0, 12).join(', ')}\n- Títulos top: ${(researchPackage.serp.topTitles || []).slice(0, 3).join(' | ')}\n- Gaps: ${(researchPackage.serp.contentGaps || []).slice(0, 5).join(' | ')}\n- Fontes permitidas: ${(researchPackage.sources || []).slice(0, 8).join(' | ')}\n\nRASCUNHO (writer):\nTitle: ${writerOut.title}\nMeta: ${writerOut.meta_description}\n\nCONTENT:\n${(writerOut.content || '').substring(0, 6000)}\n\nReestruture e retorne via tool optimize_article.`;

    const seoStart = nowMs();
    const seoCall = await callLovableJsonTool({
      url: gatewayUrl,
      apiKey: LOVABLE_API_KEY,
      model: textModel,
      system: seoSystem,
      user: seoUser,
      toolName: 'optimize_article',
      toolSchema: optimizeTool,
      temperature: 0.3
    });

    const seoDuration = nowMs() - seoStart;
    await logStage(supabase, blog_id, 'seo', 'lovable', 'seo', true, seoDuration, { model: textModel }, 0, seoCall.usage?.total_tokens);

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

    const allowed = new Set((researchPackage.sources || []).map(s => s.trim()));
    const supportedLinks = externalUrls.filter(u => allowed.has(u));

    if (supportedLinks.length < 2) {
      await logStage(supabase, blog_id, 'qa', 'internal', 'qa-deterministic', false, 0, { supported_links: supportedLinks.length });
      return new Response(
        JSON.stringify({
          error: 'QUALITY_GATE_FAILED',
          message: 'QA bloqueou: o artigo não contém links suficientes para fontes reais do pacote de pesquisa (mínimo 2).',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qaSystem = `Você é um Agente de Qualidade editorial e factual.\n\nTarefa:\n- Verificar clareza, autoridade e legibilidade\n- Verificar se afirmações factuais derivam do pacote de pesquisa\n- Reprovar se houver afirmações sem suporte\n\nRetorne JSON estrito:\n{\n  "approved": true|false,\n  "score": 0-100,\n  "issues": [{"code":"...","message":"..."}]\n}`;

    const qaUser = `PACOTE DE PESQUISA (fontes permitidas):\n${(researchPackage.sources || []).slice(0, 8).join('\n')}\n\nARTIGO:\nTITLE: ${seoOut.title}\nMETA: ${seoOut.meta_description}\n\nCONTENT (início):\n${contentForQa.substring(0, 6000)}\n\nValide se o conteúdo depende APENAS das fontes e do pacote. Se houver qualquer invenção, reprove.`;

    const qaStart = nowMs();
    const qa = await callLovableQa({
      url: gatewayUrl,
      apiKey: LOVABLE_API_KEY,
      model: 'google/gemini-2.5-flash',
      system: qaSystem,
      user: qaUser,
    });

    const qaDuration = nowMs() - qaStart;
    await logStage(supabase, blog_id, 'qa', 'lovable', 'qa', qa.approved, qaDuration, { score: qa.score }, 0, qa.usage?.total_tokens, qa.approved ? undefined : 'QA rejected');

    if (!qa.approved) {
      return new Response(
        JSON.stringify({
          error: 'QUALITY_GATE_FAILED',
          message: 'QA bloqueou: artigo reprovado por qualidade/consistência factual.',
          issues: qa.issues,
          score: qa.score,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================================
    // From here: continue using seoOut as the article payload (persist/cache/etc.)
    // ============================================================================

    // Ensure all fields have defaults
    const article = {
      title: (seoOut.title || writerOut.title || theme).toString().trim(),
      meta_description: (seoOut.meta_description || writerOut.meta_description || '').toString().trim().substring(0, 160),
      excerpt: (seoOut.excerpt || writerOut.excerpt || seoOut.meta_description || '').toString().trim(),
      content: (seoOut.content || writerOut.content || '').toString().trim(),
      faq: Array.isArray(seoOut.faq) ? seoOut.faq : (Array.isArray(writerOut.faq) ? writerOut.faq : []),
      reading_time: Number(writerOut.reading_time || Math.ceil(((seoOut.content || '').toString().split(' ').length) / 200)),
      image_prompts: Array.isArray(writerOut.image_prompts) ? writerOut.image_prompts : [],
      images: writerOut.images
    };

    // NEW: infer category/tags (used downstream)
    const inferredCategory = inferCategory(theme, article.content, keywords);
    const inferredTags = inferTags(theme, article.content, keywords, inferredCategory);

    // ============ PERSISTÊNCIA OBRIGATÓRIA NO BANCO ============
    // CRÍTICO: O artigo DEVE ser salvo na tabela 'articles' antes de retornar
    // O frontend espera id, slug e status válidos para confirmar sucesso
    const autoPublish = true; // Fluxo de subconta sempre auto-publica
    
    console.log(`[${requestId}] Starting persistence: blog_id=${blog_id}, user_id=${user?.id}`);
    
    // Helper function to generate slug from title
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
    };

    let persistedArticle;
    try {
      const insertData = {
        blog_id: blog_id,
        user_id: user?.id, // Derivado do JWT
        title: article.title,
        slug: generateSlug(article.title), // FIXED: Generate slug from title
        content: article.content,
        status: 'draft',
        // ... other fields
      };

      const { data, error: insertError } = await supabase
        .from('articles')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error(`[${requestId}] INSERT_ERROR:`, insertError);
        throw insertError;
      }
      persistedArticle = data;
      console.log(`[${requestId}] SUCCESS: id=${data.id}`);
    } catch (persistError) {
      console.error(`[${requestId}] PERSIST_ERROR:`, persistError);
      throw new Error(`DB_PERSIST_FAILED: Não foi possível salvar o artigo no banco. ${persistError instanceof Error ? persistError.message : 'Erro desconhecido'}`);
    }

    // OmniCore metadata - reuse existing textModel from generation
    const writerModelUsed = 'google/gemini-2.5-flash'; // Model used for writing
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