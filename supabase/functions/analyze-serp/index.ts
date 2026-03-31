// ═══════════════════════════════════════════════════════════════════
// ANALYZE-SERP: Motor Determinístico de Mercado Local
// V3.0: Filtro Inteligente de Concorrentes + URLs Personalizados
// 
// ARQUITETURA DETERMINÍSTICA:
// - Firecrawl para scraping real das páginas (OBRIGATÓRIO)
// - Perplexity para descoberta de URLs
// - Filtro automático de diretórios/agregadores
// - Suporte a URLs personalizados pelo usuário
// - Perfil de Nicho dinâmico via banco de dados
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  SERPMatrix, 
  SERPCompetitor, 
  KeywordFrequency,
  MarketRanges,
  MetaPatterns,
  KeywordPresence,
  SubaccountContext,
  calculateMarketRanges,
  calculateKeywordPresence 
} from "../_shared/serpTypes.ts";
import { getNicheProfile, filterTermsByProfile, NicheProfile } from "../_shared/nicheProfile.ts";
import { filterSerpTermsForNiche, logBlockedAttempt } from "../_shared/nicheGuard.ts";
import { generateSerpHashAsync } from "../_shared/contentHashing.ts";
import { generateText } from '../_shared/omniseen-ai.ts';
import { 
  filterRealCompetitors, 
  isBlockedCompetitor, 
  analyzeFilterResults,
  isValidSearchKeyword 
} from "../_shared/competitorFilter.ts";

// ═══════════════════════════════════════════════════════════════════
// V3.2: SUBACCOUNT CONTEXT EXTRACTION
// REGRA-MÃE: "A Omniseen não compete. Quem compete é o cliente da subconta."
// ═══════════════════════════════════════════════════════════════════

async function getSubaccountContext(
  supabase: SupabaseClient,
  blogId: string
): Promise<SubaccountContext | null> {
  try {
    // Buscar business_profile (fonte primária do contexto)
    const { data: bp, error } = await supabase
      .from('business_profile')
      .select('company_name, niche, city, services')
      .eq('blog_id', blogId)
      .single();

    if (error || !bp) {
      console.log(`[SUBACCOUNT] No business_profile found for blog ${blogId}`);
      return null;
    }

    // Parsear serviços
    let servicesList: string[] = [];
    if (bp.services) {
      if (typeof bp.services === 'string') {
        servicesList = bp.services.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      } else if (Array.isArray(bp.services)) {
        servicesList = bp.services.filter((s: string) => typeof s === 'string' && s.length > 0);
      }
    }

    // Extrair termo-chave do nicho do primeiro serviço
    const primaryService = servicesList[0] || bp.niche || 'serviços';
    
    const context: SubaccountContext = {
      companyName: bp.company_name || 'Empresa',
      primaryService,
      secondaryServices: servicesList.slice(1, 4),
      city: bp.city || '',
      nicheSlug: bp.niche || 'servicos'
    };

    console.log(`[SUBACCOUNT] Context: ${context.companyName} | Serviço: ${context.primaryService} | Cidade: ${context.city}`);
    return context;
  } catch (err) {
    console.error('[SUBACCOUNT] Error fetching context:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// V3.2: KEYWORD VALIDATION AND FALLBACK
// ═══════════════════════════════════════════════════════════════════

interface KeywordValidationResult {
  query: string;
  source: 'input' | 'service' | 'niche';
  wasInvalid: boolean;
  reason?: string;
}

function buildSearchQuery(
  inputKeyword: string,
  context: SubaccountContext | null,
  territory: string | null
): KeywordValidationResult {
  
  // Se não temos contexto, usar input como está
  if (!context) {
    const city = territory || '';
    const query = city && !inputKeyword.toLowerCase().includes(city.toLowerCase())
      ? `${inputKeyword} ${city}`
      : inputKeyword;
    return { query, source: 'input', wasInvalid: false };
  }

  const city = territory || context.city;
  
  // Padrões de keyword INVÁLIDA (genérica/placeholder)
  const INVALID_PATTERNS = [
    /^artigo\s+em\s+/i,           // "Artigo em Teresina..."
    /^artigo\s+sobre\s+/i,        // "Artigo sobre..."
    /^post\s+sobre\s+/i,          // "Post sobre..."
    /^conteúdo\s+sobre\s+/i,      // "Conteúdo sobre..."
    /^artigo:\s*/i,               // "Artigo:..."
    /^post:\s*/i,                 // "Post:..."
    /^\d+\s+/,                    // Começa com número "10 dicas..."
    /^como\s+criar\s+/i,          // "Como criar..." (muito genérico)
    /^guia\s+completo\s*$/i,      // "Guia completo" sozinho
    /^tudo\s+sobre\s+/i,          // "Tudo sobre..."
  ];
  
  // Termos que indicam que a keyword é sobre a PLATAFORMA, não o cliente
  const PLATFORM_TERMS = [
    'omniseen', 'lovable', 'saas', 'plataforma', 'software', 
    'marketing digital', 'seo', 'agência', 'consultoria seo',
    'geração de conteúdo', 'ia para', 'inteligência artificial'
  ];
  
  const keywordLower = inputKeyword.toLowerCase().trim();
  
  // Verificar se é keyword inválida por padrão
  const matchesInvalidPattern = INVALID_PATTERNS.some(p => p.test(keywordLower));
  
  // Verificar se contém termos da plataforma
  const containsPlatformTerm = PLATFORM_TERMS.some(term => keywordLower.includes(term));
  
  // Verificar se é muito curta ou genérica
  const isTooShort = keywordLower.length < 5;
  const isTooGeneric = keywordLower.split(' ').length <= 1 && keywordLower.length < 10;
  
  const isInvalid = matchesInvalidPattern || containsPlatformTerm || isTooShort || isTooGeneric;
  
  if (isInvalid) {
    // Construir keyword usando serviço primário + cidade
    const query = city 
      ? `${context.primaryService} em ${city}`
      : context.primaryService;
    
    let reason = 'Keyword genérica ou placeholder detectada';
    if (containsPlatformTerm) reason = 'Keyword contém termos da plataforma, não do cliente';
    if (matchesInvalidPattern) reason = 'Keyword é um título genérico, não uma busca local';
    
    return { 
      query, 
      source: 'service', 
      wasInvalid: true,
      reason
    };
  }
  
  // Keyword parece válida - adicionar cidade se não tiver
  const hasCity = city && keywordLower.includes(city.toLowerCase());
  const query = hasCity 
    ? inputKeyword 
    : (city ? `${inputKeyword} ${city}` : inputKeyword);
  
  return { query, source: 'input', wasInvalid: false };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeSERPRequest {
  keyword: string;
  territory?: string;
  blogId: string;
  forceRefresh?: boolean;
  articleId?: string;
  useFirecrawl?: boolean;  // V2.0: Enable real scraping (default: true)
  customCompetitorUrls?: string[];  // V3.0: User-provided competitor URLs
}

interface ScrapedCompetitor {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  h3s: string[];
  wordCount: number;
  imageCount: number;
  listCount: number;
  termFrequency: Record<string, number>;
  hasSchema: boolean;
  hasFAQ: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// FIRECRAWL SCRAPING
// ═══════════════════════════════════════════════════════════════════

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<ScrapedCompetitor | null> {
  // Timeout de 15 segundos por URL
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    console.log(`[SCRAPE] Scraping ${url} with Firecrawl...`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[SCRAPE] Failed to scrape ${url}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    const metadata = data.data?.metadata || data.metadata || {};

    // Extract metrics from HTML/Markdown
    const title = extractTitle(html) || metadata.title || '';
    const metaDescription = extractMetaDescription(html) || metadata.description || '';
    const h1 = extractH1(html);
    const h2s = extractH2s(html);
    const h3s = extractH3s(html);
    const wordCount = countWords(markdown);
    const imageCount = countImages(html);
    const listCount = countLists(html);
    const termFrequency = buildTermFrequencyMap(markdown);
    const hasSchema = html.includes('application/ld+json');
    const hasFAQ = html.toLowerCase().includes('faqpage') || 
                   html.includes('itemtype="https://schema.org/FAQPage"') ||
                   h2s.some(h => h.toLowerCase().includes('perguntas frequentes') || h.toLowerCase().includes('faq'));

    return {
      url,
      title,
      metaDescription,
      h1,
      h2s,
      h3s,
      wordCount,
      imageCount,
      listCount,
      termFrequency,
      hasSchema,
      hasFAQ
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[SCRAPE] ⏱️ Timeout (15s) scraping ${url}`);
      return null;
    }
    console.error(`[SCRAPE] Error scraping ${url}:`, error);
    return null;
  }
}

// HTML extraction helpers
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractMetaDescription(html: string): string {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  return match ? match[1].trim() : '';
}

function extractH1(html: string): string {
  const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return match ? match[1].trim() : '';
}

function extractH2s(html: string): string[] {
  const matches = html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi);
  return Array.from(matches).map(m => m[1].trim());
}

function extractH3s(html: string): string[] {
  const matches = html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi);
  return Array.from(matches).map(m => m[1].trim());
}

function countWords(text: string): number {
  const cleaned = text.replace(/[#*_`\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.split(' ').filter(w => w.length > 0).length;
}

function countImages(html: string): number {
  const matches = html.matchAll(/<img[^>]+>/gi);
  return Array.from(matches).length;
}

function countLists(html: string): number {
  const ulMatches = html.matchAll(/<ul[^>]*>/gi);
  const olMatches = html.matchAll(/<ol[^>]*>/gi);
  return Array.from(ulMatches).length + Array.from(olMatches).length;
}

function buildTermFrequencyMap(text: string): Record<string, number> {
  const stopwords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'as', 'os', 'um', 'uma',
    'para', 'por', 'com', 'em', 'no', 'na', 'nos', 'nas', 'ao', 'à', 'pelo', 'pela',
    'que', 'qual', 'quais', 'como', 'quando', 'onde', 'porque', 'se', 'também',
    'mais', 'menos', 'muito', 'muita', 'seu', 'sua', 'seus', 'suas', 'este', 'esta',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'você', 'vocês', 'nós', 'eles', 'elas', 'isso', 'isto', 'aquilo', 'ele', 'ela'
  ]);

  const words = text
    .toLowerCase()
    .replace(/[#*_`\[\](),.!?;:"']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));

  const frequency: Record<string, number> = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  return frequency;
}

// ═══════════════════════════════════════════════════════════════════
// PERPLEXITY URL DISCOVERY
// ═══════════════════════════════════════════════════════════════════

async function discoverTopURLsWithPerplexity(
  keyword: string, 
  territory: string | null,
  apiKey: string
): Promise<{ urls: string[]; competitors: SERPCompetitor[] }> {
  const searchQuery = territory ? `${keyword} ${territory}` : keyword;
  
  const serpPrompt = `Analise os 10 primeiros resultados orgânicos do Google para a busca: "${searchQuery}"

Para CADA um dos 10 primeiros resultados, extraia:
1. URL e título da página
2. Meta description
3. Contagem aproximada de palavras do conteúdo principal
4. Quantidade de seções H2 e H3
5. Número aproximado de parágrafos
6. Quantidade de imagens no conteúdo
7. Se tem listas (ul/ol)
8. Se tem FAQ ou schema markup
9. Os 5 principais termos/entidades técnicas mencionadas

Também identifique:
- Os 20 termos mais frequentes entre todos os resultados (exceto stopwords)
- Gaps de conteúdo: tópicos que poucos concorrentes cobrem mas são relevantes
- Padrões de título dos Top 5

Retorne APENAS um JSON válido no formato:
{
  "competitors": [
    {
      "url": "https://...",
      "title": "...",
      "metaDescription": "...",
      "position": 1,
      "metrics": {
        "wordCount": 1800,
        "h2Count": 12,
        "h3Count": 6,
        "paragraphCount": 45,
        "imageCount": 8,
        "listCount": 4,
        "hasSchema": true,
        "hasFAQ": true
      },
      "semanticTerms": ["termo1", "termo2", "termo3"],
      "titlePatterns": ["como", "guia"]
    }
  ],
  "commonTerms": ["termo1", "termo2", ...],
  "contentGaps": ["tópico não coberto 1", "tópico não coberto 2"],
  "topTitles": ["Título 1", "Título 2", ...]
}`;

  // Timeout de 30 segundos para descoberta de URLs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are an SEO analyst. Return ONLY valid JSON without any markdown formatting or code blocks."
          },
          { role: "user", content: serpPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[SERP] ⏱️ Perplexity TIMEOUT (30s) - aborting URL discovery');
      throw new Error('PERPLEXITY_TIMEOUT: URL discovery exceeded 30 seconds');
    }
    throw error;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse SERP analysis JSON from Perplexity");
  }
  
  const serpData = JSON.parse(jsonMatch[0]);
  const competitors = (serpData.competitors || []).map((c: SERPCompetitor, i: number) => ({
    ...c,
    position: c.position || i + 1,
    metaDescription: c.metaDescription || ''
  }));
  
  return {
    urls: competitors.map((c: SERPCompetitor) => c.url),
    competitors
  };
}

// ═══════════════════════════════════════════════════════════════════
// BUILD DETERMINISTIC MATRIX
// ═══════════════════════════════════════════════════════════════════

function buildKeywordFrequencyMap(
  scrapedCompetitors: ScrapedCompetitor[],
  perplexityTerms: string[]
): Record<string, KeywordFrequency> {
  const termMap: Record<string, KeywordFrequency> = {};

  // Initialize from perplexity terms
  for (const term of perplexityTerms) {
    termMap[term] = {
      occurrences: 0,
      avgFrequency: 0,
      positions: []
    };
  }

  // Aggregate from scraped competitors
  for (const comp of scrapedCompetitors) {
    const seenTerms = new Set<string>();
    
    for (const [term, count] of Object.entries(comp.termFrequency)) {
      if (!termMap[term]) {
        termMap[term] = { occurrences: 0, avgFrequency: 0, positions: [] };
      }
      
      if (!seenTerms.has(term)) {
        termMap[term].occurrences++;
        seenTerms.add(term);
      }
      
      termMap[term].avgFrequency += count;

      // Determine positions
      if (comp.title.toLowerCase().includes(term)) {
        if (!termMap[term].positions.includes('title')) {
          termMap[term].positions.push('title');
        }
      }
      if (comp.h1.toLowerCase().includes(term)) {
        if (!termMap[term].positions.includes('h1')) {
          termMap[term].positions.push('h1');
        }
      }
      if (comp.h2s.some(h => h.toLowerCase().includes(term))) {
        if (!termMap[term].positions.includes('h2')) {
          termMap[term].positions.push('h2');
        }
      }
      if (comp.metaDescription.toLowerCase().includes(term)) {
        if (!termMap[term].positions.includes('meta')) {
          termMap[term].positions.push('meta');
        }
      }
    }
  }

  // Calculate averages
  const competitorCount = scrapedCompetitors.length || 1;
  for (const term of Object.keys(termMap)) {
    termMap[term].avgFrequency = Math.round(termMap[term].avgFrequency / competitorCount);
  }

  return termMap;
}

function buildMetaPatterns(competitors: SERPCompetitor[]): MetaPatterns {
  const descriptions: string[] = competitors
    .map(c => c.metaDescription)
    .filter((d): d is string => typeof d === 'string' && d.length > 0);

  const avgLength = descriptions.length > 0
    ? Math.round(descriptions.reduce((sum, d) => sum + d.length, 0) / descriptions.length)
    : 150;

  // Extract common phrases (simplified)
  const commonPhrases: string[] = [];

  return {
    avgLength,
    commonPhrases,
    descriptions: descriptions.slice(0, 10)
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { 
      keyword, 
      territory, 
      blogId, 
      forceRefresh = false, 
      articleId,
      useFirecrawl = true,  // V2.0: Default to using Firecrawl
      customCompetitorUrls  // V3.0: User-provided competitor URLs
    } = await req.json() as AnalyzeSERPRequest;

    if (!keyword || !blogId) {
      return new Response(
        JSON.stringify({ error: "keyword and blogId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ═══════════════════════════════════════════════════════════════════
    // V3.2: GOVERNANÇA DE SUBCONTA LOCAL (ENHANCED)
    // REGRA-MÃE: "A Omniseen não compete. Quem compete é o cliente da subconta."
    // ═══════════════════════════════════════════════════════════════════
    
    // 1. Buscar contexto completo da subconta
    const subaccountContext = await getSubaccountContext(supabase, blogId);
    
    console.log(`[ANALYZE-SERP] 🎯 Entidade raiz: ${subaccountContext?.companyName || 'N/A'}`);
    console.log(`[ANALYZE-SERP] 📍 Nicho: ${subaccountContext?.nicheSlug || 'N/A'}`);
    console.log(`[ANALYZE-SERP] 🔧 Serviço primário: ${subaccountContext?.primaryService || 'N/A'}`);
    console.log(`[ANALYZE-SERP] 🌆 Cidade: ${subaccountContext?.city || territory || 'N/A'}`);

    // 2. Validar e corrigir keyword se necessário
    let searchConfig = buildSearchQuery(keyword, subaccountContext, territory || null);
    let effectiveKeyword = searchConfig.query;
    
    if (searchConfig.wasInvalid) {
      console.log(`[ANALYZE-SERP] ⚠️ Keyword original inválida: "${keyword}"`);
      console.log(`[ANALYZE-SERP] 📝 Motivo: ${searchConfig.reason}`);
      console.log(`[ANALYZE-SERP] ✅ Usando keyword do nicho: "${effectiveKeyword}"`);
    } else if (searchConfig.source === 'input' && effectiveKeyword !== keyword) {
      console.log(`[ANALYZE-SERP] 📍 Keyword enriquecida com cidade: "${effectiveKeyword}"`);
    }

    // 3. Validação final contra termos da plataforma
    const keywordValidation = isValidSearchKeyword(effectiveKeyword);
    if (!keywordValidation.valid) {
      // Se mesmo após correção ainda for inválida, tentar serviço primário puro
      if (subaccountContext?.primaryService) {
        effectiveKeyword = subaccountContext.city 
          ? `${subaccountContext.primaryService} em ${subaccountContext.city}`
          : subaccountContext.primaryService;
        console.log(`[ANALYZE-SERP] 🔄 Fallback final para serviço: "${effectiveKeyword}"`);
        searchConfig = { query: effectiveKeyword, source: 'niche', wasInvalid: true, reason: 'Fallback para serviço primário' };
      } else {
        console.error(`[ANALYZE-SERP] ❌ Keyword inválida e sem contexto de fallback: ${keywordValidation.reason}`);
        return new Response(
          JSON.stringify({ 
            error: keywordValidation.reason,
            invalidKeyword: true,
            suggestion: "Configure o Business Profile com serviços e cidade do cliente."
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const hasCustomUrls = customCompetitorUrls && customCompetitorUrls.length > 0;
    console.log(`[ANALYZE-SERP] V3.2 Starting for keyword: "${effectiveKeyword}" territory: "${territory || 'none'}" firecrawl: ${useFirecrawl} customUrls: ${hasCustomUrls ? customCompetitorUrls.length : 0}`);

    // V3.0: Skip cache if custom URLs provided
    if (!forceRefresh && !hasCustomUrls) {
      // Cache lookup uses effectiveKeyword for consistency
      const { data: cached } = await supabase
        .from("serp_analysis_cache")
        .select("*")
        .eq("blog_id", blogId)
        .eq("keyword", effectiveKeyword)
        .eq("territory", territory || null)
        .gt("expires_at", new Date().toISOString())
        .single();

      // V3.0: Invalidate cache if it doesn't have real scrape data
      if (cached) {
        const hasRealData = cached.serp_hash && 
                           cached.scrape_method !== 'perplexity' &&
                           cached.keyword_frequency_map &&
                           Object.keys(cached.keyword_frequency_map || {}).length > 0;
        
        if (hasRealData) {
          console.log(`[ANALYZE-SERP] Returning cached analysis from ${cached.analyzed_at}`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              matrix: cached.matrix,
              cached: true,
              analyzedAt: cached.analyzed_at,
              serpHash: cached.serp_hash,
              effectiveKeyword,
              subaccountContext
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.log(`[ANALYZE-SERP] Cache invalid (no real data) - forcing refresh`);
        }
      }
    }

    // Get API keys
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
    if (!PERPLEXITY_API_KEY && !GOOGLE_AI_KEY) {
      throw new Error("No AI API key configured");
    }

    // Get niche profile
    const nicheProfile: NicheProfile = await getNicheProfile(supabase, blogId);
    console.log(`[ANALYZE-SERP] Using niche profile: ${nicheProfile.displayName}`);

    let competitors: SERPCompetitor[] = [];
    let commonTerms: string[] = [];
    let topTitles: string[] = [];
    const contentGaps: string[] = [];
    let keywordFrequencyMap: Record<string, KeywordFrequency> = {};
    let scrapeMethod: 'perplexity' | 'firecrawl' | 'hybrid' | 'custom' = 'perplexity';
    let filterStats = { originalCount: 0, filteredCount: 0, blockedUrls: [] as string[] };

    // ═══════════════════════════════════════════════════════════════════
    // V3.0: CUSTOM URLS MODE - User provided specific competitors
    // ═══════════════════════════════════════════════════════════════════
    if (hasCustomUrls && FIRECRAWL_API_KEY) {
      console.log(`[ANALYZE-SERP] Using ${customCompetitorUrls.length} custom competitor URLs`);
      scrapeMethod = 'custom';
      
      const scrapedCompetitors: ScrapedCompetitor[] = [];
      
      for (let i = 0; i < customCompetitorUrls.length && i < 10; i++) {
        const url = customCompetitorUrls[i];
        
        // Skip blocked URLs even in custom mode
        const blockCheck = isBlockedCompetitor(url);
        if (blockCheck.blocked) {
          console.log(`[ANALYZE-SERP] Skipping blocked custom URL: ${url} (${blockCheck.reason})`);
          filterStats.blockedUrls.push(url);
          continue;
        }
        
        const scraped = await scrapeWithFirecrawl(url, FIRECRAWL_API_KEY);
        if (scraped) {
          scrapedCompetitors.push(scraped);
        }
      }
      
      // Convert scraped to SERPCompetitor format
      competitors = scrapedCompetitors.map((s, i) => ({
        url: s.url,
        title: s.title,
        metaDescription: s.metaDescription,
        position: i + 1,
        metrics: {
          wordCount: s.wordCount,
          h2Count: s.h2s.length,
          h3Count: s.h3s.length,
          paragraphCount: 0,
          imageCount: s.imageCount,
          listCount: s.listCount,
          hasSchema: s.hasSchema,
          hasFAQ: s.hasFAQ
        },
        semanticTerms: Object.keys(s.termFrequency).slice(0, 10)
      }));
      
      topTitles = competitors.slice(0, 5).map(c => c.title);
      
      // Build frequency map from custom scraped data
      keywordFrequencyMap = buildKeywordFrequencyMap(scrapedCompetitors, []);
      
      // Filter to terms appearing in 2+ competitors
      commonTerms = Object.entries(keywordFrequencyMap)
        .filter(([_, freq]) => freq.occurrences >= 2)
        .sort((a, b) => b[1].occurrences - a[1].occurrences)
        .map(([term, _]) => term)
        .slice(0, 30);
      
      console.log(`[ANALYZE-SERP] Custom mode: scraped ${scrapedCompetitors.length} pages, ${commonTerms.length} terms`);
    }
    // ═══════════════════════════════════════════════════════════════════
    // STANDARD MODE: Perplexity discovery + Firecrawl scraping
    // ═══════════════════════════════════════════════════════════════════
    else if (PERPLEXITY_API_KEY) {
      console.log(`[ANALYZE-SERP] Step 1: Discovering URLs with Perplexity for: "${effectiveKeyword}"`);
      const perplexityResult = await discoverTopURLsWithPerplexity(effectiveKeyword, territory || null, PERPLEXITY_API_KEY);
      competitors = perplexityResult.competitors;
      
      // V3.0: Filter out directories and aggregators
      filterStats.originalCount = competitors.length;
      const filterResult = filterRealCompetitors(competitors);
      competitors = filterResult.filtered;
      filterStats.filteredCount = competitors.length;
      filterStats.blockedUrls = filterResult.blocked.map(b => b.item.url);
      
      const analysisResult = analyzeFilterResults(filterStats.originalCount, filterStats.filteredCount);
      console.log(`[ANALYZE-SERP] Filter: ${analysisResult.message} (quality: ${analysisResult.quality})`);
      
      // Extract from perplexity response
      topTitles = competitors.slice(0, 5).map(c => c.title);
    }

    // STEP 2: If Firecrawl is available, do real scraping for enhanced data
    if (useFirecrawl && FIRECRAWL_API_KEY && competitors.length > 0) {
      console.log("[ANALYZE-SERP] Step 2: Real scraping with Firecrawl");
      scrapeMethod = 'hybrid';
      
      const scrapedCompetitors: ScrapedCompetitor[] = [];
      
      // Scrape top 5 competitors for real data
      for (const comp of competitors.slice(0, 5)) {
        const scraped = await scrapeWithFirecrawl(comp.url, FIRECRAWL_API_KEY);
        if (scraped) {
          scrapedCompetitors.push(scraped);
          
          // Merge scraped data with perplexity data
          const index = competitors.findIndex(c => c.url === comp.url);
          if (index !== -1) {
            competitors[index] = {
              ...competitors[index],
              metaDescription: scraped.metaDescription,
              metrics: {
                wordCount: scraped.wordCount || competitors[index].metrics.wordCount,
                h2Count: scraped.h2s.length || competitors[index].metrics.h2Count,
                h3Count: scraped.h3s.length || competitors[index].metrics.h3Count,
                paragraphCount: competitors[index].metrics.paragraphCount,
                imageCount: scraped.imageCount || competitors[index].metrics.imageCount,
                listCount: scraped.listCount || competitors[index].metrics.listCount,
                hasSchema: scraped.hasSchema,
                hasFAQ: scraped.hasFAQ
              }
            };
          }
        }
      }

      // Build frequency map from real scraped data
      if (scrapedCompetitors.length > 0) {
        keywordFrequencyMap = buildKeywordFrequencyMap(
          scrapedCompetitors,
          competitors.flatMap(c => c.semanticTerms || [])
        );
        
        // Filter to terms appearing in 2+ competitors
        commonTerms = Object.entries(keywordFrequencyMap)
          .filter(([_, freq]) => freq.occurrences >= 2)
          .sort((a, b) => b[1].occurrences - a[1].occurrences)
          .map(([term, _]) => term)
          .slice(0, 30);
      }
    }

    // If no Firecrawl or no scraping success, use Perplexity terms
    if (commonTerms.length === 0) {
      commonTerms = competitors.flatMap(c => c.semanticTerms || []);
      commonTerms = [...new Set(commonTerms)].slice(0, 20);
    }

    // Apply niche filtering to terms
    const originalTermsCount = commonTerms.length;
    commonTerms = filterTermsByProfile(commonTerms, nicheProfile);
    console.log(`[ANALYZE-SERP] Niche filter: ${originalTermsCount} → ${commonTerms.length} terms`);

    // Calculate averages
    const avgWords = competitors.length > 0 
      ? Math.round(competitors.reduce((sum, c) => sum + (c.metrics?.wordCount || 0), 0) / competitors.length)
      : 1500;
    const avgH2 = competitors.length > 0
      ? Math.round(competitors.reduce((sum, c) => sum + (c.metrics?.h2Count || 0), 0) / competitors.length)
      : 8;
    const avgH3 = competitors.length > 0
      ? Math.round(competitors.reduce((sum, c) => sum + (c.metrics?.h3Count || 0), 0) / competitors.length)
      : 4;
    const avgParagraphs = competitors.length > 0
      ? Math.round(competitors.reduce((sum, c) => sum + (c.metrics?.paragraphCount || 0), 0) / competitors.length)
      : 40;
    const avgImages = competitors.length > 0
      ? Math.round(competitors.reduce((sum, c) => sum + (c.metrics?.imageCount || 0), 0) / competitors.length)
      : 5;
    const avgLists = competitors.length > 0
      ? Math.round(competitors.reduce((sum, c) => sum + (c.metrics?.listCount || 0), 0) / competitors.length)
      : 3;

    // Calculate deterministic fields
    const ranges: MarketRanges = calculateMarketRanges(competitors);
    const keywordPresence: KeywordPresence = calculateKeywordPresence(competitors, effectiveKeyword);
    const metaPatterns: MetaPatterns = buildMetaPatterns(competitors);
    const serpHash = await generateSerpHashAsync(competitors.map(c => c.url));

    // Build SERPMatrix V3.2
    const matrix: SERPMatrix = {
      keyword: effectiveKeyword,  // V3.2: Use effective keyword, not original
      territory: territory || null,
      analyzedAt: new Date().toISOString(),
      competitors,
      averages: {
        avgWords,
        avgH2,
        avgH3,
        avgParagraphs,
        avgImages,
        avgLists
      },
      commonTerms,
      topTitles,
      contentGaps,
      // V2.0 fields
      ranges,
      keywordFrequencyMap,
      metaPatterns,
      keywordPresence,
      serpHash,
      scrapeMethod,
      // V3.2 fields - Local governance
      effectiveKeyword,
      subaccountContext: subaccountContext || undefined
    };

    console.log(`[ANALYZE-SERP] Matrix built: ${competitors.length} competitors, avg ${avgWords} words, method: ${scrapeMethod}, keyword: "${effectiveKeyword}"`);

    // Save to cache - use effectiveKeyword for cache key
    const { error: cacheError } = await supabase
      .from("serp_analysis_cache")
      .upsert({
        blog_id: blogId,
        keyword: effectiveKeyword,  // V3.2: Cache with effective keyword
        territory: territory || null,
        matrix,
        competitors_count: competitors.length,
        avg_words: avgWords,
        avg_h2: avgH2,
        avg_images: avgImages,
        common_terms: commonTerms.slice(0, 20),
        analyzed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        niche_profile_id: nicheProfile.id !== 'default' ? nicheProfile.id : null,
        // V2.0 fields
        min_words: ranges.minWords,
        max_words: ranges.maxWords,
        min_h2: ranges.minH2,
        max_h2: ranges.maxH2,
        min_images: ranges.minImages,
        max_images: ranges.maxImages,
        keyword_frequency_map: keywordFrequencyMap,
        meta_patterns: metaPatterns,
        keyword_presence: keywordPresence,
        serp_hash: serpHash,
        scrape_method: scrapeMethod
      }, {
        onConflict: 'blog_id,keyword,territory'
      });

    if (cacheError) {
      console.error("[ANALYZE-SERP] Cache save error:", cacheError);
    }

    // Log AI usage
    const durationMs = Date.now() - startTime;
    await supabase.from("ai_usage_logs").insert({
      blog_id: blogId,
      provider: PERPLEXITY_API_KEY ? "perplexity" : "gemini",
      endpoint: "analyze-serp",
      cost_usd: PERPLEXITY_API_KEY ? 0.015 : 0.002,
      tokens_used: 4000,
      success: true,
      metadata: {
        phase: "serp_analysis",
        model: PERPLEXITY_API_KEY ? "perplexity/sonar-pro" : 'gemini-2.5-flash',
        source: "PromptPy",
        keyword: effectiveKeyword,  // V3.2: Log effective keyword
        original_keyword: keyword,  // V3.2: Keep original for debugging
        keyword_was_corrected: searchConfig.wasInvalid,
        territory,
        competitors_found: competitors.length,
        duration_ms: durationMs,
        article_id: articleId || null,
        scrape_method: scrapeMethod,
        firecrawl_used: useFirecrawl && !!FIRECRAWL_API_KEY,
        subaccount: subaccountContext?.companyName || null
      }
    });

    console.log(`[ANALYZE-SERP] Complete in ${durationMs}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        matrix,
        cached: false,
        analyzedAt: matrix.analyzedAt,
        serpHash,
        durationMs,
        effectiveKeyword,
        keywordWasCorrected: searchConfig.wasInvalid,
        subaccountContext
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[ANALYZE-SERP] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "SERP analysis failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
