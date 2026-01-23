// ═══════════════════════════════════════════════════════════════════
// ANALYZE-SERP: Análise de Concorrência em Tempo Real (SERP)
// Motor: Perplexity Sonar Pro
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SERPMatrix, SERPCompetitor } from "../_shared/serpTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeSERPRequest {
  keyword: string;
  territory?: string;
  blogId: string;
  forceRefresh?: boolean;
  articleId?: string;  // Para correlação direta com artigo
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { keyword, territory, blogId, forceRefresh = false, articleId } = await req.json() as AnalyzeSERPRequest;

    if (!keyword || !blogId) {
      return new Response(
        JSON.stringify({ error: "keyword and blogId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ANALYZE-SERP] Starting for keyword: "${keyword}" territory: "${territory || 'none'}"`);

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
            analyzedAt: cached.analyzed_at
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get API keys
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!PERPLEXITY_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("No AI API key configured");
    }

    // Build SERP analysis prompt
    const searchQuery = territory ? `${keyword} ${territory}` : keyword;
    
    const serpPrompt = `Analise os 10 primeiros resultados orgânicos do Google para a busca: "${searchQuery}"

Para CADA um dos 10 primeiros resultados, extraia:
1. URL e título da página
2. Contagem aproximada de palavras do conteúdo principal
3. Quantidade de seções H2 e H3
4. Número aproximado de parágrafos
5. Quantidade de imagens no conteúdo
6. Se tem listas (ul/ol)
7. Se tem FAQ ou schema markup
8. Os 5 principais termos/entidades técnicas mencionadas

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

    let serpData: {
      competitors: SERPCompetitor[];
      commonTerms: string[];
      contentGaps: string[];
      topTitles: string[];
    };

    // Try Perplexity first (best for real-time SERP analysis)
    if (PERPLEXITY_API_KEY) {
      console.log("[ANALYZE-SERP] Using Perplexity Sonar Pro for SERP analysis");
      
      const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
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

      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        console.error("[ANALYZE-SERP] Perplexity error:", errorText);
        throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
      }

      const perplexityData = await perplexityResponse.json();
      const content = perplexityData.choices?.[0]?.message?.content || "";
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse SERP analysis JSON from Perplexity");
      }
      
      serpData = JSON.parse(jsonMatch[0]);
      
    } else {
      // Fallback to Lovable AI (Gemini)
      console.log("[ANALYZE-SERP] Falling back to Lovable AI (Gemini) for SERP analysis");
      
      const lovableResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are an SEO analyst. Return ONLY valid JSON without any markdown formatting."
            },
            { role: "user", content: serpPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!lovableResponse.ok) {
        throw new Error(`Lovable AI error: ${lovableResponse.status}`);
      }

      const lovableData = await lovableResponse.json();
      const content = lovableData.choices?.[0]?.message?.content || "{}";
      serpData = JSON.parse(content);
    }

    // Calculate averages
    const competitors = serpData.competitors || [];
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

    // Build SERPMatrix
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
      commonTerms: serpData.commonTerms || [],
      topTitles: serpData.topTitles || [],
      contentGaps: serpData.contentGaps || []
    };

    console.log(`[ANALYZE-SERP] Matrix built: ${competitors.length} competitors, avg ${avgWords} words, ${avgH2} H2s`);

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
        common_terms: serpData.commonTerms?.slice(0, 20) || [],
        analyzed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h TTL
      }, {
        onConflict: 'blog_id,keyword,territory'
      });

    if (cacheError) {
      console.error("[ANALYZE-SERP] Cache save error:", cacheError);
    }

    // Log AI usage com correlação de artigo
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
        article_id: articleId || null  // Correlação direta com artigo
      }
    });

    console.log(`[ANALYZE-SERP] Complete in ${durationMs}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        matrix,
        cached: false,
        analyzedAt: matrix.analyzedAt,
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
