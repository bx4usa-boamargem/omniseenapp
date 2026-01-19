import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketIntelRequest {
  blogId: string;
  forceRegenerate?: boolean;
  processAllTerritories?: boolean;
}

interface Territory {
  id: string;
  country: string;
  state: string | null;
  city: string | null;
}

interface MarketIntelPackage {
  meta: {
    country: string;
    week_of: string;
    query_cost_estimate_usd: number;
    sources_count: number;
    source: "perplexity" | "fallback";
    territory_id?: string;
    territory_location?: string;
  };
  market_snapshot: string;
  trends: Array<{
    topic: string;
    why_trending: string;
    growth_signal: string;
    sources: string[];
  }>;
  questions: Array<{
    question: string;
    intent: "informational" | "commercial" | "transactional";
    audience_pain: string;
  }>;
  keywords: Array<{
    keyword: string;
    context: string;
    why_it_matters: string;
  }>;
  competitor_gaps: Array<{
    competitor_topic: string;
    who_is_using_it: string;
    gap_opportunity: string;
  }>;
  content_ideas: Array<{
    title: string;
    angle: "educational" | "seo_local" | "authority";
    keywords: string[];
    goal: "lead" | "authority" | "conversion";
    why_now: string;
    sources: string[];
  }>;
}

function getStartOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getTerritoryLocation(territory: Territory): string {
  if (territory.city) {
    return `${territory.city}, ${territory.state || ''}, ${territory.country}`.replace(', ,', ',');
  }
  if (territory.state) {
    return `${territory.state}, ${territory.country}`;
  }
  return territory.country;
}

async function generateIntelForTerritory(
  supabase: any,
  blogId: string,
  weekOf: string,
  territory: Territory | null,
  profile: any,
  strategy: any,
  competitors: any[],
  forceRegenerate: boolean
): Promise<{ success: boolean; id?: string; error?: string; intelPackage?: MarketIntelPackage }> {
  
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const territoryLocation = territory ? getTerritoryLocation(territory) : (profile?.city || "");
  const territoryId = territory?.id || null;

  // Check if intel already exists for this week AND territory
  const existingQuery = supabase
    .from("market_intel_weekly")
    .select("id")
    .eq("blog_id", blogId)
    .eq("week_of", weekOf);

  // If territory exists, filter by it; otherwise look for null territory
  if (territoryId) {
    existingQuery.eq("territory_id", territoryId);
  } else {
    existingQuery.is("territory_id", null);
  }

  const { data: existingIntel } = await existingQuery.maybeSingle();

  if (existingIntel && !forceRegenerate) {
    console.log(`Intel already exists for blog ${blogId}, territory ${territoryId || 'default'}, week ${weekOf}`);
    return { success: true, id: existingIntel.id };
  }

  if (existingIntel && forceRegenerate) {
    console.log(`Force regenerating intel for territory ${territoryId || 'default'}`);
    await supabase.from("market_intel_weekly").delete().eq("id", existingIntel.id);
  }

  // Build context
  const country = territory?.country || profile?.country || strategy?.regiao_atuacao || "Brasil";
  const niche = profile?.niche || strategy?.tipo_negocio || "negócios";
  const companyName = profile?.company_name || strategy?.empresa_nome || "";
  const targetAudience = profile?.target_audience || strategy?.publico_alvo_tipo || "empresários";
  const services = profile?.services || strategy?.oferta_principal || "";
  const toneOfVoice = profile?.tone_of_voice || strategy?.tom_de_voz || "profissional";
  const competitorUrls = competitors?.map(c => c.url).filter(Boolean).join(", ") || "";

  const isEnglish = country.toLowerCase().includes("us") || 
                    country.toLowerCase().includes("estados unidos") ||
                    country.toLowerCase().includes("united states");
  
  const language = isEnglish ? "English" : "Portuguese (Brazilian)";

  const systemPrompt = `You are a market intelligence analyst specializing in ${niche}.
Country/Region: ${country}
Industry/Niche: ${niche}
Company Name: ${companyName}
Target Audience: ${targetAudience}
Services/Products: ${services}
City/Region: ${territoryLocation || country}
Tone of Voice: ${toneOfVoice}
Competitors: ${competitorUrls}

Task: Return a complete weekly market intelligence package for this business in the region: ${territoryLocation || country}.

Requirements:
- Use real, up-to-date web data (last 7 days when possible)
- Focus on trends, real user questions, emerging keywords, competitor gaps
- Produce 5-10 ready-to-use content ideas for a blog
- Each trend and content idea must include source URLs when available
- Optimize for content that drives traffic and leads for small businesses
- Tailor the language and market context to ${territoryLocation || country}
- Respond in ${language}

Return STRICT JSON in this exact schema:
{
  "market_snapshot": "A 2-3 sentence summary of what's happening in this market this week",
  "trends": [
    {
      "topic": "Trending topic title",
      "why_trending": "Why this is trending now",
      "growth_signal": "Data or signal indicating growth",
      "sources": ["URL1", "URL2"]
    }
  ],
  "questions": [
    {
      "question": "Real question people are asking",
      "intent": "informational|commercial|transactional",
      "audience_pain": "The underlying pain point"
    }
  ],
  "keywords": [
    {
      "keyword": "Emerging keyword or phrase",
      "context": "How it's being used",
      "why_it_matters": "Strategic importance"
    }
  ],
  "competitor_gaps": [
    {
      "competitor_topic": "Topic competitors are covering",
      "who_is_using_it": "Which competitors",
      "gap_opportunity": "How to do it better"
    }
  ],
  "content_ideas": [
    {
      "title": "Ready-to-use article title",
      "angle": "educational|seo_local|authority",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "goal": "lead|authority|conversion",
      "why_now": "Why publish this now",
      "sources": ["URL1"]
    }
  ]
}`;

  const userPrompt = `Generate a complete weekly market intelligence package for a ${niche} business specifically targeting the region: ${territoryLocation || country}.

Focus on:
1. What's trending in this industry in this specific region right now
2. Real questions the target audience (${targetAudience}) in ${territoryLocation || country} is asking
3. Emerging keywords with local SEO potential
4. Content gaps compared to competitors in this region
5. 5-10 ready-to-publish article ideas optimized for ${territoryLocation || country}

The content should help drive traffic, establish authority, and generate leads in ${territoryLocation || country}.
Return only valid JSON, no markdown.`;

  let intelPackage: MarketIntelPackage | null = null;
  let provider: "perplexity" | "fallback" = "perplexity";
  let sourcesCount = 0;

  // Try Perplexity first
  if (PERPLEXITY_API_KEY) {
    try {
      console.log(`Attempting Perplexity API call for territory: ${territoryLocation || 'default'}...`);
      
      const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          search_recency_filter: "week",
          temperature: 0.3,
        }),
      });

      if (perplexityResponse.ok) {
        const data = await perplexityResponse.json();
        const content = data.choices?.[0]?.message?.content || "";
        const citations = data.citations || [];
        sourcesCount = citations.length;

        try {
          const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(cleanContent);
          
          intelPackage = {
            meta: {
              country,
              week_of: weekOf,
              query_cost_estimate_usd: 0.0057,
              sources_count: sourcesCount,
              source: "perplexity",
              territory_id: territoryId || undefined,
              territory_location: territoryLocation || undefined
            },
            market_snapshot: parsed.market_snapshot || "",
            trends: parsed.trends || [],
            questions: parsed.questions || [],
            keywords: parsed.keywords || [],
            competitor_gaps: parsed.competitor_gaps || [],
            content_ideas: parsed.content_ideas || []
          };

          console.log(`Perplexity response parsed successfully for territory: ${territoryLocation || 'default'}`);
        } catch (parseError) {
          console.error("Failed to parse Perplexity response:", parseError);
          throw new Error("Parse error - falling back");
        }
      } else {
        const errorText = await perplexityResponse.text();
        console.error("Perplexity API error:", perplexityResponse.status, errorText);
        throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
      }
    } catch (perplexityError) {
      console.log("Perplexity failed, falling back to Lovable AI:", perplexityError);
      provider = "fallback";
    }
  } else {
    console.log("No Perplexity API key, using Lovable AI");
    provider = "fallback";
  }

  // Fallback to Lovable AI
  if (!intelPackage && LOVABLE_API_KEY) {
    console.log(`Using Lovable AI fallback for territory: ${territoryLocation || 'default'}...`);
    provider = "fallback";

    const lovableResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.5,
      }),
    });

    if (!lovableResponse.ok) {
      const errorText = await lovableResponse.text();
      console.error("Lovable AI error:", lovableResponse.status, errorText);
      return { success: false, error: `AI Gateway error: ${lovableResponse.status}` };
    }

    const lovableData = await lovableResponse.json();
    const content = lovableData.choices?.[0]?.message?.content || "";

    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanContent);
      
      intelPackage = {
        meta: {
          country,
          week_of: weekOf,
          query_cost_estimate_usd: 0,
          sources_count: 0,
          source: "fallback",
          territory_id: territoryId || undefined,
          territory_location: territoryLocation || undefined
        },
        market_snapshot: parsed.market_snapshot || "",
        trends: parsed.trends || [],
        questions: parsed.questions || [],
        keywords: parsed.keywords || [],
        competitor_gaps: parsed.competitor_gaps || [],
        content_ideas: parsed.content_ideas || []
      };

      console.log(`Lovable AI response parsed successfully for territory: ${territoryLocation || 'default'}`);
    } catch (parseError) {
      console.error("Failed to parse Lovable AI response:", content);
      return { success: false, error: "Failed to parse AI response" };
    }
  }

  if (!intelPackage) {
    return { success: false, error: "No AI provider available" };
  }

  // Save to database with territory_id
  const { data: savedIntel, error: saveError } = await supabase
    .from("market_intel_weekly")
    .insert({
      blog_id: blogId,
      week_of: weekOf,
      country,
      territory_id: territoryId,
      market_snapshot: intelPackage.market_snapshot,
      trends: intelPackage.trends,
      questions: intelPackage.questions,
      keywords: intelPackage.keywords,
      competitor_gaps: intelPackage.competitor_gaps,
      content_ideas: intelPackage.content_ideas,
      source: provider,
      query_cost_usd: provider === "perplexity" ? 0.0057 : 0,
      sources_count: sourcesCount,
      raw_response: intelPackage
    })
    .select()
    .single();

  if (saveError) {
    console.error("Failed to save intel:", saveError);
    return { success: false, error: `Failed to save intel: ${saveError.message}` };
  }

  // Log AI usage
  await supabase.from("ai_usage_logs").insert({
    blog_id: blogId,
    provider,
    endpoint: "weekly-market-intel",
    country,
    cost_usd: provider === "perplexity" ? 0.0057 : 0,
    success: true,
    metadata: {
      sources_count: sourcesCount,
      content_ideas_count: intelPackage.content_ideas.length,
      trends_count: intelPackage.trends.length,
      territory_id: territoryId,
      territory_location: territoryLocation
    }
  });

  // Registrar também em consumption_logs para fallbacks (rastreabilidade completa)
  if (provider === 'fallback') {
    await supabase.from("consumption_logs").insert({
      user_id: null, // Sistema
      blog_id: blogId,
      action_type: 'market_intel_fallback',
      model_used: 'google/gemini-2.5-flash',
      estimated_cost_usd: 0,
      metadata: {
        original_provider: 'perplexity',
        fallback_reason: 'API error or key missing',
        territory_id: territoryId,
        territory_location: territoryLocation
      }
    });
    console.log(`[FALLBACK LOG] Logged consumption for fallback provider - territory: ${territoryLocation || 'default'}`);
  }

  // Map goal to funnel_stage
  const mapGoalToFunnelStage = (goal: string): string => {
    switch (goal) {
      case 'lead': return 'topo';
      case 'authority': return 'meio';
      case 'conversion': return 'fundo';
      default: return 'topo';
    }
  };

  // Convert content ideas to opportunities with territory linkage
  const highScoreOpportunities: string[] = [];
  for (const idea of intelPackage.content_ideas) {
    let score = 75;
    if (idea.goal === "lead") score += 10;
    if (idea.goal === "conversion") score += 15;
    if (idea.angle === "authority") score += 5;
    if (idea.sources && idea.sources.length > 0) score += 5;
    score = Math.min(score, 100);

    const { data: opportunity, error: oppError } = await supabase
      .from("article_opportunities")
      .insert({
        blog_id: blogId,
        suggested_title: idea.title,
        suggested_keywords: idea.keywords,
        suggested_outline: { angle: idea.angle, goal: idea.goal },
        relevance_score: score,
        source_urls: idea.sources,
        origin: "market_intel",
        trend_source: provider,
        why_now: idea.why_now,
        goal: idea.goal,
        funnel_stage: mapGoalToFunnelStage(idea.goal),
        intel_week_id: savedIntel.id,
        territory_id: territoryId,
        relevance_factors: {
          angle: idea.angle,
          goal: idea.goal,
          has_sources: idea.sources && idea.sources.length > 0,
          territory: territory ? {
            country: territory.country,
            state: territory.state,
            city: territory.city,
            location: territoryLocation
          } : null
        }
      })
      .select()
      .single();

    if (oppError) {
      console.error("Failed to create opportunity:", oppError);
      continue;
    }

    const isHighScore = score >= 90;
    
    if (score >= 80 && opportunity) {
      highScoreOpportunities.push(opportunity.id);
      
      try {
        const notifyResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-opportunity-notification`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            opportunityId: opportunity.id,
            blogId,
            title: idea.title,
            score,
            keywords: idea.keywords,
            commercialAlignment: idea.goal,
            isHighScore,
            territoryInfo: territory ? {
              id: territory.id,
              country: territory.country,
              state: territory.state,
              city: territory.city,
              location: territoryLocation
            } : undefined
          }),
        });

        if (!notifyResponse.ok) {
          console.error("Failed to send notification:", await notifyResponse.text());
        } else {
          const urgentFlag = isHighScore ? " [URGENT]" : "";
          console.log(`Notification sent for high-score opportunity${urgentFlag}: ${idea.title} (${score}%) - Territory: ${territoryLocation || 'default'}`);
        }
      } catch (notifyError) {
        console.error("Error sending notification:", notifyError);
      }
    }
  }

  console.log(`Market intel generated for territory ${territoryLocation || 'default'}, week ${weekOf}. High-score: ${highScoreOpportunities.length}`);

  return { 
    success: true, 
    id: savedIntel.id, 
    intelPackage 
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { blogId, forceRegenerate, processAllTerritories }: MarketIntelRequest = await req.json();

    if (!blogId) {
      throw new Error("blogId is required");
    }

    const weekOf = getStartOfWeek();

    // Fetch business context
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

    const { data: competitors } = await supabase
      .from("competitors")
      .select("url, name")
      .eq("blog_id", blogId);

    // Fetch active territories for this blog
    const { data: activeTerritories } = await supabase
      .from("territories")
      .select("id, country, state, city")
      .eq("blog_id", blogId)
      .eq("is_active", true);

    const results: Array<{ territory_id: string | null; success: boolean; id?: string; error?: string }> = [];

    // If processAllTerritories is true OR no territories exist, process accordingly
    if (processAllTerritories && activeTerritories && activeTerritories.length > 0) {
      // Process EACH territory separately
      console.log(`Processing ${activeTerritories.length} active territories for blog ${blogId}...`);
      
      for (const territory of activeTerritories) {
        const result = await generateIntelForTerritory(
          supabase,
          blogId,
          weekOf,
          territory,
          profile,
          strategy,
          competitors || [],
          forceRegenerate || false
        );
        
        results.push({
          territory_id: territory.id,
          success: result.success,
          id: result.id,
          error: result.error
        });

        // Rate limiting between territory calls
        if (activeTerritories.indexOf(territory) < activeTerritories.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      // Fallback: process with primary territory or no territory (legacy mode)
      const primaryTerritory = activeTerritories && activeTerritories.length > 0 
        ? activeTerritories[0] 
        : null;

      const result = await generateIntelForTerritory(
        supabase,
        blogId,
        weekOf,
        primaryTerritory,
        profile,
        strategy,
        competitors || [],
        forceRegenerate || false
      );

      results.push({
        territory_id: primaryTerritory?.id || null,
        success: result.success,
        id: result.id,
        error: result.error
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Weekly intel completed for blog ${blogId}. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        week_of: weekOf,
        territories_processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in weekly-market-intel:", error);

    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      
      const body = await req.clone().json().catch(() => ({}));
      
      await supabase.from("ai_usage_logs").insert({
        blog_id: body.blogId || null,
        provider: "unknown",
        endpoint: "weekly-market-intel",
        cost_usd: 0,
        success: false,
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
