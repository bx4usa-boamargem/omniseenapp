import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  blogId: string;
}

interface GapData {
  theme: string;
  competitor: string;
  suggested_title: string;
  keywords: string[];
  rationale: string;
  funnel_stage?: string;
}

// Resilient parser to extract gaps even from partial/truncated JSON
function extractGapsFromPartialJSON(content: string): GapData[] {
  const gaps: GapData[] = [];
  
  // Try to find individual gap objects using regex
  const gapRegex = /\{\s*"theme"\s*:\s*"([^"]+)"\s*,\s*"competitor"\s*:\s*"([^"]+)"\s*,\s*"suggested_title"\s*:\s*"([^"]+)"\s*,\s*"keywords"\s*:\s*\[([^\]]*)\]/g;
  
  let match;
  while ((match = gapRegex.exec(content)) !== null) {
    try {
      const keywords = match[4]
        .split(',')
        .map(k => k.trim().replace(/"/g, ''))
        .filter(k => k.length > 0);
      
      gaps.push({
        theme: match[1],
        competitor: match[2],
        suggested_title: match[3],
        keywords: keywords,
        rationale: "Identificado via análise competitiva"
      });
    } catch (e) {
      // Ignore malformed gaps
      console.warn("Failed to parse gap match:", e);
    }
  }
  
  return gaps;
}

// Calculate relevance score based on keywords and context
function calculateRelevanceScore(gap: GapData, businessContext: { niche: string; targetAudience: string }): number {
  let score = 50; // Base score
  
  // Bonus for matching niche keywords
  const nicheWords = businessContext.niche.toLowerCase().split(/\s+/);
  const titleLower = gap.suggested_title.toLowerCase();
  
  for (const word of nicheWords) {
    if (titleLower.includes(word)) {
      score += 10;
    }
  }
  
  // Bonus for longer keyword lists (more SEO potential)
  if (gap.keywords.length >= 3) score += 10;
  if (gap.keywords.length >= 5) score += 5;
  
  // Cap at 100
  return Math.min(score, 100);
}

// Determine funnel stage from gap context
function determineFunnelStage(gap: GapData): string {
  const title = gap.suggested_title.toLowerCase();
  const theme = gap.theme.toLowerCase();
  
  // Bottom of funnel indicators
  const bottomIndicators = ['comprar', 'preço', 'orçamento', 'contratar', 'melhor', 'comparativo', 'review', 'avaliação'];
  for (const indicator of bottomIndicators) {
    if (title.includes(indicator) || theme.includes(indicator)) {
      return 'bottom';
    }
  }
  
  // Middle of funnel indicators
  const middleIndicators = ['como', 'guia', 'passo a passo', 'dicas', 'estratégia', 'resolver', 'solução'];
  for (const indicator of middleIndicators) {
    if (title.includes(indicator) || theme.includes(indicator)) {
      return 'middle';
    }
  }
  
  // Default to top of funnel
  return 'top';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { blogId }: AnalyzeRequest = await req.json();

    // Fetch competitors
    const { data: competitors, error: competitorsError } = await supabase
      .from("competitors")
      .select("*")
      .eq("blog_id", blogId);

    if (competitorsError) throw competitorsError;

    if (!competitors || competitors.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No competitors found. Please add competitors first.",
          gaps: [],
          gaps_created: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch existing articles to compare
    const { data: existingArticles } = await supabase
      .from("articles")
      .select("title, keywords")
      .eq("blog_id", blogId);

    const existingTitles = (existingArticles || []).map(a => a.title.toLowerCase());
    
    // Fetch existing opportunities to avoid duplicates
    const { data: existingOpportunities } = await supabase
      .from("article_opportunities")
      .select("suggested_title")
      .eq("blog_id", blogId)
      .eq("source", "competitors");
    
    const existingOpportunityTitles = (existingOpportunities || []).map(o => o.suggested_title.toLowerCase());

    // Fetch business profile for context
    const { data: profile } = await supabase
      .from("business_profile")
      .select("*")
      .eq("blog_id", blogId)
      .maybeSingle();

    const { data: strategy } = await supabase
      .from("client_strategy")
      .select("*")
      .eq("blog_id", blogId)
      .maybeSingle();

    const businessContext = {
      niche: profile?.niche || strategy?.tipo_negocio || "serviços",
      region: profile?.country || strategy?.regiao_atuacao || "Brasil",
      targetAudience: profile?.target_audience || "clientes em geral",
    };

    // Use AI to analyze competitor patterns and identify gaps
    const competitorInfo = competitors.map(c => ({
      name: c.name,
      url: c.url,
    }));

    const systemPrompt = `Você é um especialista em SEO e análise competitiva de conteúdo.
Identifique gaps de conteúdo baseado nos concorrentes listados.

Contexto do negócio:
- Nicho: ${businessContext.niche}
- Região: ${businessContext.region}
- Público-alvo: ${businessContext.targetAudience}

Concorrentes:
${competitorInfo.map(c => `- ${c.name}: ${c.url}`).join("\n")}

Artigos existentes (evitar duplicatas):
${existingTitles.slice(0, 5).join(", ") || "nenhum"}

Oportunidades já identificadas (evitar duplicatas):
${existingOpportunityTitles.slice(0, 5).join(", ") || "nenhuma"}

IMPORTANTE: Retorne APENAS JSON puro, sem markdown, sem explicações.
Mantenha o "rationale" curto (máximo 25 palavras).
O campo "competitor" deve ser EXATAMENTE o nome de um dos concorrentes listados.

Formato exato:
{"gaps":[{"theme":"tema","competitor":"nome exato do concorrente","suggested_title":"título","keywords":["kw1","kw2","kw3"],"rationale":"justificativa curta"}]}`;

    const userPrompt = `Identifique 3-5 gaps de conteúdo para o nicho "${businessContext.niche}" na região "${businessContext.region}".

Para cada gap:
1. Associe a um concorrente específico (use o nome exato)
2. Sugira um título SEO otimizado
3. Liste 3-5 keywords relevantes
4. Explique brevemente por que é uma oportunidade

Responda APENAS com o JSON, sem explicações adicionais.`;

    console.log("Calling AI Gateway for competitor analysis...");

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: "POST",
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", gaps_created: 0 }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace.", gaps_created: 0 }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    console.log("AI response length:", content.length);

    // Parse the JSON response with resilient fallback
    let analysis = { gaps: [] as GapData[] };
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(cleanContent);
      console.log("Successfully parsed JSON with", analysis.gaps?.length || 0, "gaps");
    } catch (parseError) {
      console.warn("Full JSON parse failed, attempting partial extraction...");
      
      // Try to extract gaps from partial response
      const partialGaps = extractGapsFromPartialJSON(content);
      
      if (partialGaps.length > 0) {
        console.log(`Recovered ${partialGaps.length} gaps from partial response`);
        analysis = { gaps: partialGaps };
      } else {
        console.error("Failed to parse AI response:", content.substring(0, 500));
        // Return with descriptive error instead of empty array
        return new Response(
          JSON.stringify({
            success: false,
            error: "Não foi possível processar a análise da IA. Tente novamente.",
            competitors_analyzed: competitors.length,
            gaps: [],
            gaps_created: 0
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // PERSIST GAPS TO article_opportunities
    const insertedGaps: any[] = [];
    
    for (const gap of analysis.gaps) {
      // Skip if already exists
      const titleLower = gap.suggested_title.toLowerCase();
      if (existingOpportunityTitles.includes(titleLower) || existingTitles.includes(titleLower)) {
        console.log(`Skipping duplicate: ${gap.suggested_title}`);
        continue;
      }
      
      // Find the matching competitor
      const matchedCompetitor = competitors.find(c => 
        c.name.toLowerCase() === gap.competitor?.toLowerCase() ||
        c.name.toLowerCase().includes(gap.competitor?.toLowerCase() || '') ||
        gap.competitor?.toLowerCase().includes(c.name.toLowerCase())
      );

      const relevanceScore = calculateRelevanceScore(gap, businessContext);
      const funnelStage = determineFunnelStage(gap);

      const { data: inserted, error: insertError } = await supabase
        .from('article_opportunities')
        .insert({
          blog_id: blogId,
          suggested_title: gap.suggested_title,
          suggested_keywords: gap.keywords || [],
          source: 'competitors',
          trend_source: 'competitors',
          competitor_id: matchedCompetitor?.id || null,
          competitor_name: gap.competitor || matchedCompetitor?.name || 'Concorrente',
          why_now: gap.rationale,
          status: 'pending',
          relevance_score: relevanceScore,
          funnel_stage: funnelStage,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting gap:", insertError);
      } else if (inserted) {
        insertedGaps.push(inserted);
        console.log(`Inserted gap: ${gap.suggested_title} (competitor: ${matchedCompetitor?.name || gap.competitor})`);
      }
    }

    // Update competitors with last analyzed timestamp
    const now = new Date().toISOString();
    for (const competitor of competitors) {
      await supabase
        .from("competitors")
        .update({ updated_at: now })
        .eq("id", competitor.id);
    }

    console.log(`Returning ${insertedGaps.length} new gaps (${analysis.gaps.length} total analyzed)`);

    return new Response(
      JSON.stringify({
        success: true,
        competitors_analyzed: competitors.length,
        gaps_created: insertedGaps.length,
        gaps_analyzed: analysis.gaps.length,
        gaps: insertedGaps,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-competitors:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
        gaps: [],
        gaps_created: 0
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
