// ═══════════════════════════════════════════════════════════════════
// ANALYZE-SERP: Análise de Concorrência em Tempo Real (SERP)
// V2.0: Deterministic Engine com Firecrawl + Perplexity
// 
// ARQUITETURA DETERMINÍSTICA:
// - Firecrawl para scraping real das páginas
// - Perplexity para descoberta de URLs
// - Perfil de Nicho dinâmico via banco de dados
// - Filtro de termos por nicho para evitar contaminação
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  SERPMatrix, 
  SERPCompetitor, 
  KeywordFrequency,
  MarketRanges,
  MetaPatterns,
  KeywordPresence,
  calculateMarketRanges,
  calculateKeywordPresence 
} from "../_shared/serpTypes.ts";
import { getNicheProfile, filterTermsByProfile, NicheProfile } from "../_shared/nicheProfile.ts";
import { filterSerpTermsForNiche, logBlockedAttempt } from "../_shared/nicheGuard.ts";
import { generateSerpHashAsync } from "../_shared/contentHashing.ts";

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
  useFirecrawl?: boolean;  // V2.0: Enable real scraping
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
    });

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

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
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
  });

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
      useFirecrawl = true  // V2.0: Default to using Firecrawl
    } = await req.json() as AnalyzeSERPRequest;

    if (!keyword || !blogId) {
      return new Response(
        JSON.stringify({ error: "keyword and blogId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ANALYZE-SERP] V2.0 Starting for keyword: "${keyword}" territory: "${territory || 'none'}" firecrawl: ${useFirecrawl}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (unless forceRefresh)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("serp_analysis_cache")
        .select("*")
        .eq("blog_id", blogId)
        .eq("keyword", keyword)
        .eq("territory", territory || null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (cached) {
        console.log(`[ANALYZE-SERP] Returning cached analysis from ${cached.analyzed_at}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            matrix: cached.matrix,
            cached: true,
            analyzedAt: cached.analyzed_at,
            serpHash: cached.serp_hash
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get API keys
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!PERPLEXITY_API_KEY && !LOVABLE_API_KEY) {
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
    let scrapeMethod: 'perplexity' | 'firecrawl' | 'hybrid' = 'perplexity';

    // STEP 1: Discover URLs and initial data with Perplexity
    if (PERPLEXITY_API_KEY) {
      console.log("[ANALYZE-SERP] Step 1: Discovering URLs with Perplexity");
      const perplexityResult = await discoverTopURLsWithPerplexity(keyword, territory || null, PERPLEXITY_API_KEY);
      competitors = perplexityResult.competitors;
      
      // Extract from perplexity response
      const perplexityData = perplexityResult.competitors;
      topTitles = perplexityData.slice(0, 5).map(c => c.title);
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
    const keywordPresence: KeywordPresence = calculateKeywordPresence(competitors, keyword);
    const metaPatterns: MetaPatterns = buildMetaPatterns(competitors);
    const serpHash = await generateSerpHashAsync(competitors.map(c => c.url));

    // Build SERPMatrix V2.0
    const matrix: SERPMatrix = {
      keyword,
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
      scrapeMethod
    };

    console.log(`[ANALYZE-SERP] Matrix built: ${competitors.length} competitors, avg ${avgWords} words, method: ${scrapeMethod}`);

    // Save to cache
    const { error: cacheError } = await supabase
      .from("serp_analysis_cache")
      .upsert({
        blog_id: blogId,
        keyword,
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
      provider: PERPLEXITY_API_KEY ? "perplexity" : "lovable",
      endpoint: "analyze-serp",
      cost_usd: PERPLEXITY_API_KEY ? 0.015 : 0.002,
      tokens_used: 4000,
      success: true,
      metadata: {
        phase: "serp_analysis",
        model: PERPLEXITY_API_KEY ? "perplexity/sonar-pro" : "google/gemini-2.5-flash",
        source: "PromptPy",
        keyword,
        territory,
        competitors_found: competitors.length,
        duration_ms: durationMs,
        article_id: articleId || null,
        scrape_method: scrapeMethod,
        firecrawl_used: useFirecrawl && !!FIRECRAWL_API_KEY
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
        durationMs
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
