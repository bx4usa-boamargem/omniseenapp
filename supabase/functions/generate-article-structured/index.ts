import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildUniversalPrompt, type ClientStrategy, type FunnelMode, type ArticleGoal } from '../_shared/promptTypeCore.ts';
import { resolveStrategy } from '../_shared/strategyResolver.ts';
import { validateArticleQuality, validateGeoArticleQuality, generateCorrectionInstructions } from '../_shared/qualityValidator.ts';
import { generateAutoKeywords, mergeKeywords } from '../_shared/keywordGenerator.ts';
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

interface MandatorySection {
  heading: string;
  key_message: string;
}

interface EditorialTemplate {
  target_niche?: string;
  content_focus?: string;
  mandatory_structure?: MandatorySection[];
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
  company_name?: string;
  category_default?: string;
}

// Generation Mode Type - NUNCA pode ser undefined
type GenerationMode = 'fast' | 'deep';

// Interface para dados do artigo (usado para persistência e cache)
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
  image_prompts?: Array<{
    context: string;
    prompt: string;
    after_section: number;
    section_title?: string;
    visual_concept?: string;
  }>;
}

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any;

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
  // OmniCore fields
  omnicoreOpportunityId?: string;
  outlineId?: string;
  signalId?: string;
  // Territorial fields
  territoryId?: string;
  // GEO Writer mode - ALWAYS true (V2.0)
  geo_mode?: boolean;
  // V2.0: New mandatory GEO fields
  internal_links?: Array<{ title: string; url: string }>;
  external_sources?: Array<{ title: string; url: string }>;
  whatsapp?: string;
  google_place?: {
    official_name: string;
    lat: number;
    lng: number;
    neighborhood_tags: string[];
  };
}

// Territory data interface for geo-enriched articles
interface TerritoryData {
  official_name: string | null;
  neighborhood_tags: string[] | null;
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
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
  inferredTags?: string[]
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
  };
  
  console.log(`[PERSIST] Inserting article with slug: ${uniqueSlug}, status: ${insertData.status}`);
  
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
5. Último H2 → CTA natural (NUNCA "Conclusão")`;

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // ========== GEO MODE INITIALIZATION ==========
    let geoResearchData: GeoResearchData | null = null;
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (geo_mode) {
      console.log(`[GEO MODE] OmniCore GEO Writer activated for theme: "${theme}"`);
      
      // Fetch territory data first for GEO research context
      let geoTerritoryData: GeoTerritoryData | null = null;
      if (territoryId) {
        const { data: territory } = await supabase
          .from('territories')
          .select('official_name, neighborhood_tags, lat, lng, radius_km')
          .eq('id', territoryId)
          .maybeSingle();
        
        if (territory) {
          geoTerritoryData = territory as GeoTerritoryData;
        }
      }
      
      // STEP A: Fetch real-time research data via Perplexity (pre-generation)
      if (PERPLEXITY_API_KEY) {
        console.log('[GEO MODE] Fetching research data via Perplexity...');
        geoResearchData = await fetchGeoResearchData(theme, geoTerritoryData, PERPLEXITY_API_KEY);
        
        if (geoResearchData) {
          console.log(`[GEO MODE] Research fetched: ${geoResearchData.facts.length} facts, ${geoResearchData.trends.length} trends`);
        } else {
          console.warn('[GEO MODE] Perplexity research failed - continuing without real-time data');
        }
      } else {
        console.warn('[GEO MODE] PERPLEXITY_API_KEY not configured - skipping pre-generation research');
      }
    }

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
        console.log(`Using configured text model: ${textModel}`);
      }
      if (prefs?.default_word_count) {
        defaultWordCount = prefs.default_word_count;
        console.log(`Using configured word count: ${defaultWordCount}`);
      }
    }
    
    // Use word_count from request or fallback to preferences
    const targetWordCount = word_count || defaultWordCount;
    
    // ============ EDITORIAL MODEL CONFIGURATION ============
    const MODEL_CONFIG = {
      traditional: {
        sections: { min: 5, max: 7, default: 6 },
        imageFrequency: 3,   // 1 image per 3 H2s
        visualBlocks: { min: 2, max: 3, types: ['💡', '⚠️', '📌'] }
      },
      strategic: {
        sections: { min: 5, max: 9, default: 7 },
        imageFrequency: 2,   // 1 image per 2 H2s
        visualBlocks: { min: 5, max: 7, types: ['💡', '⚠️', '📌', '✅', '❝'] }
      },
      visual_guided: {
        sections: { min: 5, max: 6, default: 5 },
        imageFrequency: 1,   // 1 image per H2
        visualBlocks: { min: 3, max: 4, types: ['💡', '📌', '✅'] }
      }
    };
    
    const modelConfig = MODEL_CONFIG[editorial_model] || MODEL_CONFIG.traditional;
    const modelInstructions = EDITORIAL_MODEL_INSTRUCTIONS[editorial_model] || EDITORIAL_MODEL_INSTRUCTIONS.traditional;
    
    // Adjust section count based on model if not explicitly set
    const effectiveSectionCount = section_count || modelConfig.sections.default;
    
    // Calculate image count based on model frequency
    const calculatedImageCount = Math.ceil(effectiveSectionCount / modelConfig.imageFrequency);
    const targetImageCount = Math.min(Math.max(image_count || calculatedImageCount, 1), 5);
    
    console.log(`Editorial Model: ${editorial_model}, Sections: ${effectiveSectionCount}, Target words: ${targetWordCount}, Target images: ${targetImageCount}`);

    // Generate cache key including editorial_model
    const templateSignature = editorial_template 
      ? `${editorial_template.target_niche || ''}|${editorial_template.cta_template || ''}|${editorial_template.company_name || ''}`
      : '';
    const cacheKey = `${theme}|${keywords.sort().join(',')}|${tone}|wc:${targetWordCount}|ic:${targetImageCount}|sc:${effectiveSectionCount}|faq:${include_faq}|conc:${include_conclusion}|visual:${include_visual_blocks}|ai:${optimize_for_ai}|model:${editorial_model}|${templateSignature}|${blog_id || ''}`;
    const contentHash = generateHash(cacheKey);
    
    // Check cache first
    console.log(`Checking cache for theme: ${theme}, hash: ${contentHash}, target words: ${targetWordCount}`);
    const { data: cacheHit } = await supabase
      .from("ai_content_cache")
      .select("*")
      .eq("cache_type", "article")
      .eq("content_hash", contentHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cacheHit) {
      // Validate cached article word count meets current target
      const cachedContent = (cacheHit.response_data as {content?: string})?.content || '';
      const cachedWordCount = cachedContent.split(/\s+/).filter(Boolean).length;
      
      // Only use cache if word count is within 15% of target (tolerance)
      const minAcceptable = targetWordCount * 0.85;
      
      if (cachedWordCount >= minAcceptable) {
        console.log(`CACHE HIT for article: ${theme} (${cachedWordCount} words, target: ${targetWordCount})`);
        
        // Increment hit counter
        await supabase
          .from("ai_content_cache")
          .update({ hits: (cacheHit.hits || 0) + 1 })
          .eq("id", cacheHit.id);

        // Log cache hit as consumption (with zero cost)
        if (user_id) {
          await supabase.from("consumption_logs").insert({
            user_id,
            blog_id: blog_id || null,
            action_type: "article_generation_cached",
            action_description: `Cached Article: ${(cacheHit.response_data as {title?: string})?.title || theme}`,
            model_used: cacheHit.model_used || "cache",
            input_tokens: 0,
            output_tokens: 0,
            images_generated: 0,
            estimated_cost_usd: 0,
            metadata: { theme, keywords, cache_hit: true, original_cost: cacheHit.cost_saved_usd },
          });
        }

        // CACHE HIT: Ainda precisamos persistir como NOVO artigo no banco
        // O cache guarda apenas o conteúdo, não o registro persistido
        const cachedArticle = cacheHit.response_data as ArticleData;
        const autoPublishFromCache = true; // Cache hit sempre auto-publica
        
        console.log('[CACHE HIT] Persisting cached content as new article...');
        
        try {
          const persistedFromCache = await persistArticleToDb(
            supabase,
            blog_id!,
            cachedArticle,
            autoPublishFromCache
          );
          
          console.log(`[CACHE HIT] Article persisted: id=${persistedFromCache.id}, slug=${persistedFromCache.slug}`);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              article: {
                ...cachedArticle,
                id: persistedFromCache.id,
                slug: persistedFromCache.slug,
                status: persistedFromCache.status
              }, 
              from_cache: true 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (persistError) {
          console.error('[CACHE HIT] Failed to persist cached article:', persistError);
          // Continue to regenerate if cache persistence fails
        }
      } else {
        console.log(`CACHE SKIP - word count too low: ${cachedWordCount} < ${minAcceptable} (target: ${targetWordCount})`);
      }
    }

    console.log(`Cache MISS - Generating structured article for theme: ${theme}`, editorial_template ? '(with template)' : '');

    // ============ TERRITORIAL DATA FETCH ============
    // Fetch validated territory data for geo-enriched articles
    let territoryData: TerritoryData | null = null;

    if (territoryId) {
      console.log(`[TERRITORY] Fetching data for territory: ${territoryId}`);
      
      const { data: territory, error: territoryError } = await supabase
        .from('territories')
        .select('official_name, neighborhood_tags, lat, lng, radius_km')
        .eq('id', territoryId)
        .maybeSingle();
      
      if (territory && !territoryError) {
        territoryData = territory as TerritoryData;
        console.log(`[TERRITORY] Found: ${territoryData.official_name}, Bairros: ${(territoryData.neighborhood_tags || []).join(', ')}`);
      } else {
        console.warn(`[TERRITORY] Not found or error: ${territoryError?.message || 'not found'}`);
      }
    }

    // Build territorial instruction for prompt enrichment
    const territorialInstruction = territoryData?.neighborhood_tags?.length 
      ? `
🌍 ANCORAGEM TERRITORIAL OBRIGATÓRIA:
- Este artigo é para a região de: ${territoryData.official_name || 'região local'}
- INCLUA menções naturais a estes bairros: ${territoryData.neighborhood_tags.slice(0, 5).join(', ')}
- Use os bairros como exemplos de áreas atendidas ou contextos locais
- Mencione pelo menos 2 bairros de forma natural no conteúdo
- Evite parecer forçado - integre os nomes organicamente nas frases
`
      : '';

    // ========================================================================
    // UNIVERSAL PROMPT TYPE V1.0 - OBRIGATÓRIO SEM FALLBACK
    // ========================================================================
    // A função resolveStrategy() GARANTE que sempre existe uma estratégia.
    // Se não existir client_strategy, ela cria automaticamente com defaults.
    // ========================================================================
    
    let strategyId: string | null = null;
    let isDefaultStrategy = false;
    let clientStrategy: ClientStrategy;
    
    if (blog_id) {
      const resolution = await resolveStrategy(supabase, blog_id);
      clientStrategy = resolution.strategy;
      strategyId = resolution.strategyId;
      isDefaultStrategy = resolution.isDefault;
      console.log(`[UNIVERSAL V1.0] Strategy resolved: source=${resolution.source}, isDefault=${isDefaultStrategy}`);
    } else {
      // Fallback para geração sem blog_id (raro, mas possível)
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
      console.log('[UNIVERSAL V1.0] No blog_id - using minimal default strategy');
    }

    // Build base prompt - use GEO Writer identity if geo_mode is enabled
    let systemPrompt: string;
    
    if (geo_mode) {
      // GEO MODE: Use OmniCore GEO Writer identity + research data + territorial context
      const researchInjection = buildResearchInjection(geoResearchData);
      const territorialContext = buildTerritorialContext(territoryData as GeoTerritoryData);
      
      systemPrompt = `${GEO_WRITER_IDENTITY}

${researchInjection}
${territorialContext}

## CONTEXTO DO CLIENTE
${buildUniversalPrompt(clientStrategy, funnel_mode as FunnelMode, article_goal as ArticleGoal | null, theme, keywords)}`;
      
      console.log(`[GEO MODE] GEO Writer prompt built with research: ${!!geoResearchData}, territory: ${!!territoryData}`);
    } else {
      // Standard mode: Use Universal Prompt
      systemPrompt = buildUniversalPrompt(
        clientStrategy,
        funnel_mode as FunnelMode,
        article_goal as ArticleGoal | null,
        theme,
        keywords
      ) + (territorialInstruction ? '\n\n' + territorialInstruction : '');
    }
    console.log(`[UNIVERSAL V1.0] Prompt built: funnel=${funnel_mode}, goal=${article_goal}, isDefault=${isDefaultStrategy}, hasTerritory=${!!territoryData}, geoMode=${geo_mode}`);


    // ============ INJECT GENERATION MODE + EDITORIAL MODEL INSTRUCTIONS ============
    // V2.0: GEO mode sempre usa 'deep' - instruções fixas
    const modeInstruction = generationRules.deep.promptInstruction;
    
    // V2.0: GEO mode sempre usa palavras profundas (1200-3000)
    const wordLimitInstruction = `- Tamanho: ENTRE 1.200 e 3.000 palavras (alvo: ${targetWordCount})`;
    
    // V2.0: GEO mode sempre usa seções completas
    const sectionInstruction = `- Quantidade de seções H2: EXATAMENTE ${effectiveSectionCount} seções`;
    
    const userPrompt = `${modeInstruction}

---

⛔ MODELO EDITORIAL OBRIGATÓRIO: ${modelInstructions.name.toUpperCase()}
⛔ QUALQUER DESVIO INVALIDA A RESPOSTA

${modelInstructions.instructions}

${HIERARCHY_RULES}

📊 LIMITES ESTRITOS PARA ESTE MODELO:
${sectionInstruction}
- Blocos visuais: ${modelConfig.visualBlocks.min} a ${modelConfig.visualBlocks.max} blocos
- Tipos PERMITIDOS: ${modelConfig.visualBlocks.types.join(', ')}
- Tipos PROIBIDOS: ${['💡', '⚠️', '📌', '✅', '❝'].filter(t => !modelConfig.visualBlocks.types.includes(t)).join(', ') || 'nenhum'}
- Frequência de imagens: 1 a cada ${modelConfig.imageFrequency} seções H2

---

Escreva um artigo completo sobre: "${theme}"

LEMBRE-SE: O dono de negócio deve ler e pensar "isso foi escrito para mim".

📏 ESTRUTURA OBRIGATÓRIA:
${sectionInstruction}
${wordLimitInstruction}
- FAQ: ${include_faq ? 'INCLUIR seção de FAQ (3-5 perguntas que um dono perguntaria de verdade)' : 'NÃO incluir FAQ'}
- Conclusão: ${include_conclusion ? 'INCLUIR seção de conclusão/próximos passos ao final' : 'NÃO incluir seção de conclusão separada'}
- Blocos visuais: ${include_visual_blocks ? `OBRIGATÓRIO ${modelConfig.visualBlocks.min}-${modelConfig.visualBlocks.max} blocos (${modelConfig.visualBlocks.types.join(', ')})` : 'NÃO usar blocos visuais com emojis'}
${optimize_for_ai ? `
🤖 OTIMIZAÇÃO PARA IAs (GEO/AEO):
- Estruture o conteúdo para ser facilmente citado por ChatGPT, Perplexity, etc.
- Use fatos e dados específicos, não afirmações genéricas
- Responda perguntas diretamente nos primeiros parágrafos de cada seção
- Use listas e formatação clara para facilitar extração
` : ''}

O artigo deve ter:
1. Título atraente que fala diretamente com o dono (50-60 caracteres)
2. Meta description focada na dor do dono (até 160 caracteres)
3. Excerpt/resumo que gera identificação (2-3 frases curtas)
4. Conteúdo completo com EXATAMENTE ${effectiveSectionCount} seções H2 (${targetWordCount} palavras)
${include_faq ? '5. 3-5 FAQs que um dono perguntaria de verdade (respostas máx 4 linhas)' : ''}
6. Tempo estimado de leitura

FORMATO AUTOMARTICLES (MOBILE-FIRST):
- Parágrafos de 1-3 linhas MÁXIMO
- Frases curtas (máx. 2 linhas)
- Listas com bullets frequentes
- 1-2 blockquotes (>) para insights importantes
- Negrito estratégico
${include_visual_blocks ? `
📝 BLOCOS VISUAIS (${modelConfig.visualBlocks.min}-${modelConfig.visualBlocks.max} no total):
APENAS ESTES TIPOS PERMITIDOS para ${modelInstructions.name}:
${modelConfig.visualBlocks.types.includes('💡') ? '- 💡 Insight (verdade ou descoberta importante)' : ''}
${modelConfig.visualBlocks.types.includes('⚠️') ? '- ⚠️ Alerta (erro ou risco)' : ''}
${modelConfig.visualBlocks.types.includes('📌') ? '- 📌 Destaque (dica prática)' : ''}
${modelConfig.visualBlocks.types.includes('✅') ? '- ✅ Resumo Rápido (pontos-chave)' : ''}
${modelConfig.visualBlocks.types.includes('❝') ? '- ❝ Citação Destacada (frase impactante)' : ''}
` : ''}

📋 SEÇÃO DE RESUMO OBRIGATÓRIA (penúltima H2):
- Título: "Resumo: [número] passos/dicas para [objetivo]"
- Lista em bullets de TODOS os pontos principais do artigo
- Uma linha por ponto, máximo 10 palavras
- Formato de checklist visual

⛔ SEÇÃO FINAL OBRIGATÓRIA (última H2 - SEM EXCEÇÕES):
- Título EXATO: "## Próximo passo" (NÃO use variações!)
- ⚠️ QUALQUER outro título será REJEITADO automaticamente
- NÃO use: "Conclusão", "Considerações Finais", "Direto ao ponto", "Saiba Mais", ou QUALQUER variação
- Primeiro parágrafo: conecte a dor do artigo com a solução
- Segundo parágrafo: CTA direto dizendo EXATAMENTE o que fazer
- Último parágrafo com CTA em **NEGRITO**:
${editorial_template?.cta_template ? `  **${editorial_template.cta_template}**` : '  **Quem age primeiro, vence.**'}

🖼️ IMAGENS CONTEXTUALIZADAS (${targetImageCount} prompts):
Cada imagem DEVE ser baseada no CONTEÚDO ESPECÍFICO da seção correspondente.
Frequência: 1 imagem a cada ${modelConfig.imageFrequency} seções H2.
Formato obrigatório para cada imagem:
- section_title: Título EXATO do H2 que ilustra
- section_index: Número da seção (1, 2, 3...)
- visual_concept: Conceito visual da IDEIA CENTRAL da seção
- description: Descrição detalhada baseada no TEXTO ESPECÍFICO
- style: "fotografia realista profissional"

${targetImageCount >= 1 ? '- Imagem 1: Representa o PROBLEMA central do artigo' : ''}
${targetImageCount >= 2 ? '- Imagem 2: Representa a SOLUÇÃO ou caminho' : ''}
${targetImageCount >= 3 ? '- Imagem 3: Representa o RESULTADO ou benefício' : ''}
${targetImageCount >= 4 ? '- Imagem 4: Representa INSIGHT específico de uma seção' : ''}
${targetImageCount >= 5 ? '- Imagem 5: Representa o CTA ou próximo passo' : ''}

Cada prompt deve mostrar cenários REAIS de trabalho, não escritórios corporativos.`;

    // Build dynamic tool schema based on targetImageCount and targetWordCount
    const contextEnumValues = ['problem', 'solution', 'result', 'insight', 'cta'].slice(0, targetImageCount);
    
    const toolSchema = {
      type: 'function' as const,
      function: {
        name: 'create_article',
        description: 'Creates a complete SEO-optimized blog article written for business owners, with realistic image prompts and mandatory image descriptions',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Article title that speaks directly to the business owner (50-60 characters)'
            },
            meta_description: {
              type: 'string',
              description: 'Meta description focused on the owner pain point (max 160 characters)'
            },
            excerpt: {
              type: 'string',
              description: 'Short summary that creates identification with the owner (2-3 sentences)'
            },
            content: {
              type: 'string',
              description: `CRITICAL: Full article in Markdown with MINIMUM ${targetWordCount} words. This is a HARD requirement - articles with fewer words will be rejected. Use EXACTLY ${section_count} H2 sections. Each section should have at least 200-300 words with detailed examples, practical tips, and real-world scenarios. MUST include: 1) Penultimate H2 titled "Resumo: X passos/dicas para Y" with bullet list summarizing ALL key points, 2) ⚠️ FINAL H2 MUST BE EXACTLY "## Próximo passo" (no variations!) with CTA connecting pain to solution. Follow mandatory structure with short paragraphs (1-3 lines), bullet lists, blockquotes.`
            },
            faq: {
              type: 'array',
              description: 'Real questions a business owner would ask (3-5 items, max 4 line answers)',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string', description: 'Short answer, max 4 lines, reassuring tone' }
                },
                required: ['question', 'answer']
              }
            },
            reading_time: {
              type: 'number',
              description: 'Estimated reading time in minutes'
            },
            image_prompts: {
              type: 'array',
              description: `Exactly ${targetImageCount} REALISTIC image prompts showing real work scenarios, NOT corporate settings`,
              items: {
                type: 'object',
                properties: {
                  context: { 
                    type: 'string',
                    enum: contextEnumValues,
                    description: 'The narrative context: problem (stressed owner), solution (calm working), result (happy with results), insight (focused analysis), cta (confident ready)'
                  },
                  prompt: { 
                    type: 'string',
                    description: 'REALISTIC photo prompt in English showing real work environment: workshop, van, job site. NOT corporate office. Include: real worker, authentic expression, natural lighting, work clothes'
                  },
                  after_section: {
                    type: 'number',
                    description: 'Insert image after this H2 section number (1-6)'
                  }
                },
                required: ['context', 'prompt', 'after_section']
              },
              minItems: targetImageCount,
              maxItems: targetImageCount
            },
            images: {
              type: 'object',
              description: 'MANDATORY block with detailed image descriptions for cover and content images. Must follow niche-specific visual guidelines.',
              properties: {
                cover_image: {
                  type: 'object',
                  description: 'Cover image representing the central problem of the article',
                  properties: {
                    description: { type: 'string', description: 'Detailed description of the cover image showing the main problem. Must be realistic photography, professional style.' },
                    style: { type: 'string', description: 'Visual style: realistic photography, professional, natural lighting' },
                    use_case: { type: 'string', enum: ['capa do artigo'] }
                  },
                  required: ['description', 'style', 'use_case']
                },
                content_images: {
                  type: 'array',
                  description: 'Exactly 3 support images linked to key article sections',
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: 'object',
                    properties: {
                      section: { type: 'string', description: 'H2 section name this image relates to' },
                      description: { type: 'string', description: 'Detailed description of the image reinforcing the section argument. Must be realistic, not stock photos or cartoons.' },
                      style: { type: 'string', description: 'Visual style: realistic photography, natural lighting, professional' },
                      use_case: { type: 'string', enum: ['imagem de apoio'] }
                    },
                    required: ['section', 'description', 'style', 'use_case']
                  }
                }
              },
              required: ['cover_image', 'content_images']
            }
          },
          required: ['title', 'meta_description', 'excerpt', 'content', 'faq', 'reading_time', 'image_prompts', 'images'],
          additionalProperties: false
        }
      }
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: textModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [toolSchema],
        tool_choice: { type: 'function', function: { name: 'create_article' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI_RATE_LIMIT', message: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI_CREDITS', message: 'Insufficient credits. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI request failed: ${response.status}`);
    }

    // Resilient JSON parsing - read text first to handle empty or truncated responses
    const responseText = await response.text();
    
    if (!responseText || responseText.trim().length === 0) {
      console.error('AI Gateway returned empty response body');
      throw new Error('AI_EMPTY_RESPONSE: O serviço de IA retornou uma resposta vazia. Tente novamente.');
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText.substring(0, 500));
      throw new Error('AI_PARSE_ERROR: Falha ao processar resposta da IA. Tente novamente.');
    }
    
    console.log('AI response received and parsed successfully');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function?.name !== 'create_article') {
      console.error('No valid tool call in response:', JSON.stringify(data));
      throw new Error('AI_OUTPUT_INVALID: No structured article output received');
    }

    // Parse with retry logic
    const articleData = parseArticleJSON(toolCall.function.arguments);

    // Validate required fields
    if (!articleData.title || typeof articleData.title !== 'string') {
      throw new Error('AI_OUTPUT_INVALID: Missing or invalid title');
    }
    if (!articleData.content || typeof articleData.content !== 'string') {
      throw new Error('AI_OUTPUT_INVALID: Missing or invalid content');
    }
    // Note: Word count validation happens later with proper retry logic
    // Only reject truly empty or minimal content here
    if ((articleData.content as string).trim().length < 100) {
      throw new Error('AI_OUTPUT_INVALID: Content is essentially empty');
    }
    
    // Validate mandatory images block
    if (!articleData.images || typeof articleData.images !== 'object') {
      console.error('AI_OUTPUT_INVALID: Missing images block');
      throw new Error('AI_OUTPUT_INVALID: Bloco "images" obrigatório não foi gerado. O artigo precisa incluir descrições de imagens.');
    }

    const imagesBlock = articleData.images as { 
      cover_image?: { description?: string; style?: string; use_case?: string }; 
      content_images?: Array<{ section?: string; description?: string; style?: string; use_case?: string }> 
    };
    
    if (!imagesBlock.cover_image || !imagesBlock.cover_image.description) {
      console.error('AI_OUTPUT_INVALID: Missing or invalid cover_image');
      throw new Error('AI_OUTPUT_INVALID: Imagem de capa (cover_image) obrigatória não foi gerada corretamente.');
    }
    
    // REGRA GLOBAL: Mínimo 2 imagens internas (artigo sem imagem é rascunho)
    const MIN_INTERNAL_IMAGES = 2;
    
    if (!Array.isArray(imagesBlock.content_images) || imagesBlock.content_images.length < MIN_INTERNAL_IMAGES) {
      console.error(`AI_OUTPUT_INVALID: Invalid content_images - expected at least ${MIN_INTERNAL_IMAGES}, got:`, imagesBlock.content_images?.length || 0);
      throw new Error(`AI_OUTPUT_INVALID: Artigo sem imagem é rascunho. Mínimo ${MIN_INTERNAL_IMAGES} imagens internas obrigatórias. Geradas: ${imagesBlock.content_images?.length || 0}`);
    }
    
    // Validate each content image has required fields
    for (let i = 0; i < imagesBlock.content_images.length; i++) {
      const img = imagesBlock.content_images[i];
      if (!img.description || !img.section) {
        console.error(`AI_OUTPUT_INVALID: content_images[${i}] missing required fields`);
        throw new Error(`AI_OUTPUT_INVALID: Imagem de apoio ${i + 1} está incompleta (falta description ou section).`);
      }
    }
    
    console.log(`Images block validated successfully: cover + ${imagesBlock.content_images.length} content images`);
    
    // =========================================================================
    // CONTRATO EDITORIAL ABSOLUTO - VALIDAÇÕES COM AUTO-CORREÇÃO
    // =========================================================================
    // PRINCÍPIO: Sempre corrigir automaticamente, NUNCA lançar erro por H1
    // =========================================================================
    
    const MANDATORY_FINAL_SECTION = '## Próximo passo';
    let workingContent = (articleData.content as string) || '';
    const title = (articleData.title as string) || 'Artigo';
    
    // REGRA 3: Garantir que o artigo começa com H1
    // Remove leading empty lines
    workingContent = workingContent.replace(/^\s*\n+/, '');
    
    // Check if first line is H1
    const firstLine = workingContent.split('\n')[0]?.trim() || '';
    const startsWithH1 = firstLine.startsWith('# ') && !firstLine.startsWith('## ');
    
    if (!startsWithH1) {
      console.log(`AUTO-FIX H1: First line is "${firstLine.substring(0, 50)}..." - prepending title as H1`);
      
      // Remove any existing H1 that might be somewhere else in the content
      workingContent = workingContent.replace(/^# .+\n\n?/m, '');
      
      // Prepend the title as H1
      workingContent = `# ${title}\n\n${workingContent.trim()}`;
      console.log('✅ H1 auto-fixed: prepended title as H1');
    } else {
      // Check if there's a blank line after H1
      const contentLines = workingContent.split('\n');
      if (contentLines.length > 1 && contentLines[1].trim() !== '') {
        console.log('AUTO-FIX H1: Adding blank line after H1');
        contentLines.splice(1, 0, '');
        workingContent = contentLines.join('\n');
      }
      console.log('✅ H1 structure validated');
    }
    
    // Apply H1 fixes to articleData
    articleData.content = workingContent;
    
    // Final verification (soft - just log, don't throw)
    const verifyFirstLine = workingContent.split('\n')[0]?.trim() || '';
    if (!verifyFirstLine.startsWith('# ') || verifyFirstLine.startsWith('## ')) {
      console.warn(`WARNING: H1 still not correct after fix: "${verifyFirstLine.substring(0, 50)}"`);
      // Force it one more time
      articleData.content = `# ${title}\n\n${workingContent.trim()}`;
      console.log('✅ H1 force-fixed with title');
    }
    
    // H1 validation complete - continue with CTA validation
    
    // REGRA 2: Última seção DEVE ser "## Próximo passo" - com CTA obrigatório do contrato
    // Importar função do contrato editorial
    const editorialContract = await import('../_shared/editorialContract.ts');
    const { ensureCTA, ensureCompanyCTA, hasValidCTA } = editorialContract;
    
    // Buscar dados da empresa para CTA personalizado (incluindo nicho e serviços)
    let companyInfo: { name: string; city?: string; whatsapp?: string; niche?: string; services?: string } | null = null;
    if (blog_id) {
      const { data: profile } = await supabase
        .from('business_profile')
        .select('company_name, city, country, whatsapp, niche, services')
        .eq('blog_id', blog_id)
        .maybeSingle();
      
      if (profile?.company_name) {
        companyInfo = {
          name: profile.company_name,
          city: profile.city || profile.country || undefined,
          whatsapp: (profile as { whatsapp?: string }).whatsapp || undefined,
          niche: (profile as { niche?: string }).niche || undefined,
          services: (profile as { services?: string }).services || undefined
        };
        console.log(`[CTA] Using company info: ${companyInfo.name}${companyInfo.city ? ` em ${companyInfo.city}` : ''} (nicho: ${companyInfo.niche || 'não especificado'})`);
      }
    }
    
    let finalContent = articleData.content as string;
    const h2Matches = finalContent.match(/^## .+$/gm) || [];
    
    if (h2Matches.length > 0) {
      // Aplicar CTA obrigatório do contrato editorial (com ou sem empresa)
      if (companyInfo) {
        finalContent = ensureCompanyCTA(finalContent, companyInfo);
        console.log('✅ CTA Final com nome da empresa aplicado');
      } else {
        finalContent = ensureCTA(finalContent);
        console.log('✅ CTA Final genérico aplicado');
      }
      articleData.content = finalContent;
      
      if (hasValidCTA(finalContent)) {
        console.log('✅ CTA Final "## Próximo passo" validado (Contrato Editorial)');
      } else {
        console.warn('⚠️ CTA pode não estar no formato exato do contrato');
      }
    } else {
      console.error('AI_OUTPUT_INVALID: No H2 sections found in article');
      throw new Error('AI_OUTPUT_INVALID: Artigo não possui seções H2. Estrutura inválida.');
    }
    
    // ============ VALIDATE EDITORIAL MODEL COMPLIANCE ============
    // Use finalContent after auto-fixes (not contentText)
    
    // Count H2 sections using auto-fixed content
    const h2Count = (finalContent.match(/^## /gm) || []).length;
    if (h2Count < modelConfig.sections.min || h2Count > modelConfig.sections.max) {
      console.warn(`EDITORIAL MODEL WARNING: Article has ${h2Count} H2s, model ${editorial_model} expects ${modelConfig.sections.min}-${modelConfig.sections.max}`);
    }
    
    // Count visual blocks
    const blockMatches = finalContent.match(/^[💡⚠️📌✅❝]/gm) || [];
    const blockCount = blockMatches.length;
    
    if (blockCount < modelConfig.visualBlocks.min) {
      console.warn(`EDITORIAL MODEL WARNING: Article has ${blockCount} visual blocks, minimum for ${editorial_model} is ${modelConfig.visualBlocks.min}`);
    }
    if (blockCount > modelConfig.visualBlocks.max) {
      console.warn(`EDITORIAL MODEL WARNING: Article has ${blockCount} visual blocks, maximum for ${editorial_model} is ${modelConfig.visualBlocks.max}`);
    }
    
    // Check for forbidden block types
    const allowedTypes = new Set(modelConfig.visualBlocks.types);
    for (const block of blockMatches) {
      if (!allowedTypes.has(block)) {
        console.warn(`EDITORIAL MODEL WARNING: Block type "${block}" is not allowed for model ${editorial_model}. Allowed: ${modelConfig.visualBlocks.types.join(', ')}`);
      }
    }
    
    // Check for forbidden section titles in body (not in final section which is now correct)
    const contentWithoutFinal = finalContent.split(MANDATORY_FINAL_SECTION)[0];
    if (/^## ?(conclusão|considerações finais|direto ao ponto|saiba mais|o que fazer agora)/im.test(contentWithoutFinal)) {
      console.warn('EDITORIAL MODEL WARNING: Article contains forbidden section title in body');
    }
    
    console.log(`EDITORIAL MODEL VALIDATION: Model=${editorial_model}, H2s=${h2Count}, Blocks=${blockCount}`);

    // ========================================================================
    // GEO QUALITY GATE LOOP - OMNICORE GEO WRITER
    // ========================================================================
    // When geo_mode=true, validates article against GEO rules and regenerates
    // automatically up to 3 times if it doesn't pass the Quality Gate
    // ========================================================================

    if (geo_mode) {
      console.log('[GEO QUALITY GATE] Starting GEO validation loop...');
      
      const neighborhoodTags = territoryData?.neighborhood_tags || [];
      let geoAttempts = 0;
      let currentContent = articleData.content as string;
      
      while (geoAttempts < GEO_WRITER_RULES.max_retries) {
        geoAttempts++;
        console.log(`[GEO QUALITY GATE] Attempt ${geoAttempts}/${GEO_WRITER_RULES.max_retries}`);
        
        // Validate with GEO-specific rules
        const geoValidation = validateGeoArticleQuality(
          currentContent,
          funnel_mode as FunnelMode,
          { geoMode: true, territories: neighborhoodTags }
        );
        
        console.log(`[GEO QUALITY GATE] Score: ${geoValidation.score}/100, Passed: ${geoValidation.passed}`);
        
        if (geoValidation.passed) {
          console.log(`[GEO QUALITY GATE] ✅ Article passed on attempt ${geoAttempts}`);
          break;
        }
        
        // If max retries reached, throw error
        if (geoAttempts >= GEO_WRITER_RULES.max_retries) {
          console.error(`[GEO QUALITY GATE] ❌ Failed after ${geoAttempts} attempts`);
          console.error(`[GEO QUALITY GATE] Failures: ${geoValidation.failures.join(', ')}`);
          throw new Error('OmniCore Quality Gate Failed: Article did not meet GEO standards after 3 attempts');
        }
        
        // Generate correction instructions using geoWriterCore
        const geoWordCount = countGeoWords(currentContent);
        const geoPhrasesCount = countGeoPhrasesInContent(currentContent);
        const hasAnswerFirst = hasAnswerFirstPattern(currentContent);
        const hasTerritorial = hasTerritorialMentions(currentContent, neighborhoodTags);
        
        const correctionPrompt = generateGeoCorrectionInstructions(
          geoWordCount,
          geoPhrasesCount,
          hasAnswerFirst,
          hasTerritorial,
          neighborhoodTags.length > 0
        );
        
        console.log(`[GEO QUALITY GATE] Regenerating with corrections...`);
        console.log(`  - Word count: ${geoWordCount} (need ${GEO_WRITER_RULES.word_count.min}-${GEO_WRITER_RULES.word_count.max})`);
        console.log(`  - GEO phrases: ${geoPhrasesCount} (need 2+)`);
        console.log(`  - Answer-first: ${hasAnswerFirst}`);
        console.log(`  - Territorial: ${hasTerritorial}`);
        
        // Regenerate with corrections
        const correctionUserPrompt = `${correctionPrompt}

---

ARTIGO ORIGINAL A CORRIGIR:

${currentContent}

---

REESCREVA o artigo completo aplicando TODAS as correções listadas.
Mantenha o tema, estrutura e informações, mas corrija os problemas identificados.
Retorne o artigo corrigido no formato JSON da tool create_article.`;

        try {
          const correctionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: textModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: correctionUserPrompt }
              ],
              tools: [toolSchema],
              tool_choice: { type: 'function', function: { name: 'create_article' } }
            }),
          });
          
          if (!correctionResponse.ok) {
            console.error(`[GEO QUALITY GATE] Regeneration failed: ${correctionResponse.status}`);
            continue; // Try again
          }
          
          const correctionData = await correctionResponse.json();
          const correctionToolCall = correctionData.choices?.[0]?.message?.tool_calls?.[0];
          
          if (correctionToolCall?.function?.name === 'create_article') {
            const correctedArticle = parseArticleJSON(correctionToolCall.function.arguments);
            currentContent = correctedArticle.content as string;
            
            // Update articleData with corrected content
            articleData.content = currentContent;
            articleData.title = correctedArticle.title || articleData.title;
            articleData.meta_description = correctedArticle.meta_description || articleData.meta_description;
            
            console.log(`[GEO QUALITY GATE] Content regenerated, new word count: ${countGeoWords(currentContent)}`);
          }
        } catch (regenError) {
          console.error(`[GEO QUALITY GATE] Regeneration error:`, regenError);
          // Continue to next attempt
        }
      }
      
      // Final log of GEO validation result
      const finalGeoValidation = validateGeoArticleQuality(
        articleData.content as string,
        funnel_mode as FunnelMode,
        { geoMode: true, territories: neighborhoodTags }
      );
      
      console.log(`[GEO QUALITY GATE] Final state: Score=${finalGeoValidation.score}, Passed=${finalGeoValidation.passed}, Attempts=${geoAttempts}`);
    }

    // Validate word count using generation_mode rules (NUNCA sourceValidationRules)
    const rules = generationRules[generation_mode];
    
    let generatedWordCount = (articleData.content as string).split(/\s+/).filter(Boolean).length;
    
    // CORREÇÃO: Use percentual do target OU mínimo absoluto, o que for MENOR
    // Se target=1400, aceitar 1400*0.85=1190 (não forçar 1500)
    const percentOfTarget = targetWordCount * rules.minPercent;
    const minAcceptableWords = targetWordCount < rules.minWords 
      ? percentOfTarget  // Se target < minWords absoluto, usa só o percentual
      : Math.max(percentOfTarget, rules.minWords);
    
    console.log(`Generation Mode: ${generation_mode}, Target: ${targetWordCount}, Generated: ${generatedWordCount} words, Min acceptable: ${Math.round(minAcceptableWords)}, Max: ${rules.maxWords}`);
    
    // Apply maximum word limit based on generation_mode
    if (rules.maxWords && generatedWordCount > rules.maxWords) {
      console.log(`Truncating article from ${generatedWordCount} to ${rules.maxWords} words for ${generation_mode} mode`);
      const words = (articleData.content as string).split(/\s+/);
      articleData.content = words.slice(0, rules.maxWords).join(' ');
      generatedWordCount = rules.maxWords;
    }
    
    // Word Count Enforcer: Validate and expand if needed
    if (generatedWordCount < minAcceptableWords && rules.autoRetry && rules.maxRetries > 0) {
      console.warn(`AI_OUTPUT_TOO_SHORT: ${generatedWordCount} words < ${minAcceptableWords} minimum for ${generation_mode} mode`);
      console.log(`Word Count Enforcer: Starting expansion with max ${rules.maxRetries} retries...`);

      // Preserve the original images block before expansion (expansion doesn't regenerate it)
      const originalImagesBlock = articleData.images;
      const originalFaq = articleData.faq;
      const originalImagePrompts = articleData.image_prompts;

      // Run Word Count Enforcer
      const expansion = await expandArticleContent(
        articleData.content as string,
        articleData.title as string,
        targetWordCount,
        generatedWordCount,
        textModel,
        LOVABLE_API_KEY,
        rules.maxRetries
      );

      // Update article content with expanded version
      articleData.content = expansion.content;
      generatedWordCount = expansion.wordCount;

      // Restore preserved blocks (expansion only changes content)
      articleData.images = originalImagesBlock;
      articleData.faq = originalFaq;
      articleData.image_prompts = originalImagePrompts;

      console.log(`Word Count Enforcer: Complete - ${generatedWordCount} words after ${expansion.retries} expansion attempts`);
    }

    // Final validation after expansion attempts
    if (generatedWordCount < minAcceptableWords) {
      const errorData = {
        code: 'AI_OUTPUT_TOO_SHORT',
        message: `O artigo gerado tem ${generatedWordCount} palavras após ${rules.maxRetries || 0} tentativas de expansão. Mínimo: ${Math.round(minAcceptableWords)} palavras.`,
        suggestion: 'O OmniCore GEO Writer requer artigos com 1200-3000 palavras. Tente novamente ou forneça mais conteúdo de referência sobre o tema.',
        generatedWords: generatedWordCount,
        requiredWords: Math.round(minAcceptableWords),
        generationMode: 'deep', // V2.0: Always deep
        expansionAttempts: rules.maxRetries || 0
      };
      
      throw new Error(JSON.stringify(errorData));
    }

    // Get niche for image prompts
    const niche = editorial_template?.target_niche || 'service business';
    
    // Ensure image_prompts have correct structure with realistic defaults
    const defaultImagePrompts = buildImagePrompts(theme, niche);

    let imagePrompts = defaultImagePrompts;
    if (Array.isArray(articleData.image_prompts) && articleData.image_prompts.length > 0) {
      // Validate and fix each prompt
      imagePrompts = (articleData.image_prompts as Array<{context?: string; prompt?: string; after_section?: number}>).map((p, i) => ({
        context: p.context || defaultImagePrompts[i]?.context || 'problem',
        prompt: p.prompt || defaultImagePrompts[i]?.prompt || `Realistic photo of ${niche} business owner at work`,
        after_section: typeof p.after_section === 'number' ? p.after_section : (i === 0 ? 1 : i === 1 ? 3 : 5)
      }));
    }

    // Ensure all fields have defaults
    const article = {
      title: (articleData.title as string).trim(),
      meta_description: ((articleData.meta_description || '') as string).trim().substring(0, 160),
      excerpt: ((articleData.excerpt || articleData.meta_description || '') as string).trim(),
      content: (articleData.content as string).trim(),
      faq: Array.isArray(articleData.faq) ? articleData.faq : [],
      reading_time: (articleData.reading_time as number) || Math.ceil((articleData.content as string).split(' ').length / 200),
      image_prompts: imagePrompts,
      images: articleData.images // NEW: Bloco obrigatório de descrições de imagens
    };

    // ========================================================================
    // INFERIR CATEGORIA E TAGS AUTOMATICAMENTE
    // ========================================================================
    const inferredCategory = inferCategory(theme, article.content, keywords);
    const inferredTags = inferTags(theme, article.content, keywords, inferredCategory);
    console.log(`[AUTO-CLASSIFY] Category: ${inferredCategory}, Tags: [${inferredTags.join(', ')}]`);

    console.log(`Article generated successfully: "${article.title}" (${article.content.length} chars, ${article.image_prompts.length} image prompts)`);

    // Log consumption if user_id provided
    const inputTokens = Math.ceil((theme.length + keywords.join(' ').length + 2000) / 4);
    const outputTokens = Math.ceil(article.content.length / 4);
    const estimatedCost = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

    // ========================================================================
    // VALIDAÇÃO DE QUALIDADE PÓS-GERAÇÃO (OBRIGATÓRIA)
    // ========================================================================
    const qualityValidation = validateArticleQuality(article.content, funnel_mode as FunnelMode);
    console.log(`[QUALITY V1.0] Score: ${qualityValidation.score}/100, Passed: ${qualityValidation.passed}`);
    
    if (!qualityValidation.passed) {
      console.warn(`[QUALITY V1.0] Failures: ${qualityValidation.failures.join(' | ')}`);
    }

    // ========================================================================
    // POLIDOR FINAL - CONTRATO EDITORIAL ABSOLUTO
    // ========================================================================
    // Normaliza estrutura sem alterar conteúdo (H1, parágrafos, CTA)
    // ========================================================================
    try {
      console.log('[POLISH] Applying final editorial polish...');
      
      const polishResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/polish-article-final`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: article.content })
      });

      if (polishResponse.ok) {
        const polishResult = await polishResponse.json();
        
        if (polishResult.success && polishResult.content) {
          article.content = polishResult.content;
          console.log(`[POLISH] Applied successfully - Changes: ${polishResult.changes?.join(', ') || 'none'}, Valid: ${polishResult.structureValid}`);
        } else {
          console.warn('[POLISH] No changes applied:', polishResult.changes);
        }
      } else {
        console.warn('[POLISH] Edge function returned error - continuing with original content');
      }
    } catch (polishError) {
      console.warn('[POLISH] Failed to apply polish (non-blocking):', polishError);
      // Non-blocking: continue with unpolished content
    }

    if (user_id) {
      try {
        // ========================================================================
        // LOG UNIVERSAL OBRIGATÓRIO - Rastreabilidade completa
        // ========================================================================
        await supabase.from("consumption_logs").insert({
          user_id,
          blog_id: blog_id || null,
          action_type: "article_generation",
          action_description: `Article: ${article.title}`,
          model_used: "google/gemini-2.5-flash",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          images_generated: 0,
          estimated_cost_usd: estimatedCost,
          metadata: { 
            theme, 
            keywords,
            // CAMPOS OBRIGATÓRIOS - RASTREABILIDADE UNIVERSAL
            prompt_system: 'universal_v1',
            generation_mode: generation_mode, // NOVO - fast ou deep
            funnel_mode: funnel_mode,
            article_goal: article_goal || null,
            strategy_id: strategyId,
            is_default_strategy: isDefaultStrategy,
            quality_passed: qualityValidation.passed,
            quality_score: qualityValidation.score,
            quality_failures: qualityValidation.failures,
            source: source,
            // TERRITORIAL TRACKING
            territory_id: territoryId || null,
            territory_name: territoryData?.official_name || null,
            neighborhoods_injected: territoryData?.neighborhood_tags?.slice(0, 5) || [],
            has_geo_coordinates: !!(territoryData?.lat && territoryData?.lng)
          },
        });
        console.log("[UNIVERSAL V1.0] Consumption logged with full metadata");
      } catch (logError) {
        console.warn("Failed to log consumption:", logError);
      }
    }

    // Save to cache for future use
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await supabase.from("ai_content_cache").upsert({
        cache_type: "article",
        content_hash: contentHash,
        prompt_text: cacheKey,
        response_data: article,
        model_used: "google/gemini-2.5-flash",
        tokens_saved: inputTokens + outputTokens,
        cost_saved_usd: estimatedCost,
        blog_id: blog_id || null,
        user_id: user_id || null,
        expires_at: expiresAt.toISOString(),
        hits: 0,
      }, { onConflict: 'cache_type,content_hash' });
      console.log("Article saved to cache");
    } catch (cacheError) {
      console.warn("Failed to save to cache:", cacheError);
    }

    // ============ PERSISTÊNCIA OBRIGATÓRIA NO BANCO ============
    // CRÍTICO: O artigo DEVE ser salvo na tabela 'articles' antes de retornar
    // O frontend espera id, slug e status válidos para confirmar sucesso
    const autoPublish = true; // Fluxo de subconta sempre auto-publica
    
    console.log('[PERSIST] Starting article persistence to database...');
    
    let persistedArticle: { id: string; slug: string; status: string; title: string };
    
    try {
      persistedArticle = await persistArticleToDb(
        supabase,
        blog_id!,
        article,
        autoPublish,
        inferredCategory,  // Pass category
        inferredTags       // Pass tags
      );
      
      console.log(`[PERSIST] ✅ Article saved successfully: id=${persistedArticle.id}, slug=${persistedArticle.slug}, status=${persistedArticle.status}`);
    } catch (persistError) {
      console.error('[PERSIST] ❌ Failed to save article to database:', persistError);
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
    
    // Categorize error for better debugging
    let errorCode = 'UNKNOWN_ERROR';
    if (message.includes('AI_RATE_LIMIT')) errorCode = 'AI_RATE_LIMIT';
    else if (message.includes('AI_CREDITS')) errorCode = 'AI_CREDITS';
    else if (message.includes('AI_OUTPUT_INVALID')) errorCode = 'AI_OUTPUT_INVALID';
    else if (message.includes('LOVABLE_API_KEY')) errorCode = 'CONFIG_ERROR';
    
    return new Response(
      JSON.stringify({ error: errorCode, message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
