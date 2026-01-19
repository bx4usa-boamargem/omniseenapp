import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrendRequest {
  blogId: string;
  niche?: string;
  country?: string;
  territory?: string; // Legacy: OmniCore territory format "City, State, Country"
  territoryId?: string; // NEW: Direct territory ID for validated territories
  saveSignals?: boolean; // Save to omnicore_signals table
}

interface TerritoryData {
  official_name: string | null;
  neighborhood_tags: string[] | null;
  radius_km: number | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface TrendSignal {
  id?: string;
  topic: string;
  intent: string;
  volume_hint: string;
  sources: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { blogId, niche, country, territory, territoryId, saveSignals = false }: TrendRequest = await req.json();

    // Parse territory if provided (format: "City, State, Country")
    let parsedTerritory = territory || '';
    let businessNiche = niche || "negócios";
    let businessCountry = country || "Brasil";
    let neighborhoodTags: string[] = [];
    let radiusKm = 15;
    let territoryLat: number | null = null;
    let territoryLng: number | null = null;

    // PRIORITY 1: Use validated territory data if territoryId provided
    if (territoryId) {
      console.log(`[TERRITORIAL] Fetching validated territory: ${territoryId}`);
      const { data: territoryData } = await supabase
        .from('territories')
        .select('official_name, neighborhood_tags, radius_km, lat, lng, city, state, country')
        .eq('id', territoryId)
        .single();

      if (territoryData) {
        parsedTerritory = territoryData.official_name || `${territoryData.city}, ${territoryData.state}, ${territoryData.country}`;
        neighborhoodTags = territoryData.neighborhood_tags || [];
        radiusKm = territoryData.radius_km || 15;
        territoryLat = territoryData.lat;
        territoryLng = territoryData.lng;
        businessCountry = territoryData.country || businessCountry;
        console.log(`[TERRITORIAL] Using validated data: ${parsedTerritory}, ${neighborhoodTags.length} neighborhoods, ${radiusKm}km radius`);
      }
    }

    // PRIORITY 2: Fallback to blog profile data
    if (blogId && !parsedTerritory) {
      const { data: profile } = await supabase
        .from("business_profile")
        .select("niche, country, company_name, city")
        .eq("blog_id", blogId)
        .maybeSingle();

      if (profile) {
        businessNiche = profile.niche || businessNiche;
        businessCountry = profile.country || businessCountry;
        if (!parsedTerritory && profile.city) {
          parsedTerritory = profile.city;
        }
      }

      // Also check client_strategy
      const { data: strategy } = await supabase
        .from("client_strategy")
        .select("tipo_negocio, regiao_atuacao, empresa_nome")
        .eq("blog_id", blogId)
        .maybeSingle();

      if (strategy) {
        businessNiche = strategy.tipo_negocio || businessNiche;
        businessCountry = strategy.regiao_atuacao || businessCountry;
      }
    }

    const currentDate = new Date();
    const month = currentDate.toLocaleString("pt-BR", { month: "long" });
    const year = currentDate.getFullYear();

    // Determine language based on country
    const isEnglish = businessCountry.toLowerCase().includes("us") || 
                      businessCountry.toLowerCase().includes("estados unidos") ||
                      businessCountry.toLowerCase().includes("united states");
    
    const language = isEnglish ? "English" : "Portuguese (Brazilian)";

    // Build territorial context for prompts
    const hasValidatedTerritory = neighborhoodTags.length > 0;
    const neighborhoodContext = hasValidatedTerritory 
      ? `\nBairros validados para foco: ${neighborhoodTags.slice(0, 8).join(', ')}.`
      : '';
    const radiusContext = hasValidatedTerritory 
      ? `\nRaio de atuação: ${radiusKm}km a partir do centro.`
      : '';
    const territoryLabel = parsedTerritory || businessCountry;

    const systemPrompt = `Você é um especialista em marketing de conteúdo e tendências de mercado.
Sua função é identificar temas e tendências atuais relevantes para o nicho de ${businessNiche} na região de ${territoryLabel}.
${neighborhoodContext}${radiusContext}

Baseie suas sugestões em:
- Tendências sazonais e eventos relevantes para ${month}/${year}
- Problemas comuns enfrentados pelo público-alvo na região específica
- Novidades tecnológicas e regulatórias do setor
- Palavras-chave de alta demanda no nicho + localidade
- Conteúdo educacional que gera autoridade local

Responda em ${language}.

Retorne EXATAMENTE um JSON válido sem markdown, no formato:
{
  "trends": [
    {
      "topic": "título da tendência",
      "relevance": "descrição curta da relevância",
      "suggested_angle": "ângulo sugerido para o artigo",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "sources": ["URL1", "URL2"],
      "target_neighborhoods": ["bairro1", "bairro2"]
    }
  ]
}`;

    const userPrompt = `Identifique 10 tendências e temas em alta para o nicho de "${businessNiche}" na região de "${territoryLabel}" para ${month} de ${year}.
${hasValidatedTerritory ? `\nFOCO TERRITORIAL: Estes são os bairros validados onde a empresa atua: ${neighborhoodTags.join(', ')}. Priorize tendências relevantes para essas localidades específicas.` : ''}

Foque em:
1. Tendências sazonais do período para a região
2. Problemas urgentes do público local
3. Novidades do setor na localidade
4. Oportunidades de SEO local (geo-specific keywords)
5. Conteúdo educacional que gera autoridade territorial

Retorne apenas o JSON, sem explicações.`;

    let trends = null;
    let provider: "perplexity" | "lovable_ai" = "perplexity";
    let citations: string[] = [];

    // Try Perplexity first
    if (PERPLEXITY_API_KEY) {
      try {
        console.log("Attempting Perplexity API call for trends...");
        
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
          citations = data.citations || [];

          try {
            const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
            trends = JSON.parse(cleanContent);
            
            // Add citations to trends if available
            if (citations.length > 0 && trends.trends) {
              trends.trends = trends.trends.map((trend: any, index: number) => ({
                ...trend,
                sources: trend.sources || [citations[index % citations.length]]
              }));
            }
            
            console.log("Perplexity trends parsed successfully");
          } catch (parseError) {
            console.error("Failed to parse Perplexity response:", parseError);
            throw new Error("Parse error - falling back");
          }
        } else {
          const errorText = await perplexityResponse.text();
          console.error("Perplexity API error:", perplexityResponse.status, errorText);
          
          if (perplexityResponse.status === 429) {
            throw new Error("Rate limit - falling back");
          }
          throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
        }
      } catch (perplexityError) {
        console.log("Perplexity failed, falling back to Lovable AI:", perplexityError);
        provider = "lovable_ai";
      }
    } else {
      console.log("No Perplexity API key, using Lovable AI");
      provider = "lovable_ai";
    }

    // Fallback to Lovable AI
    if (!trends && LOVABLE_API_KEY) {
      console.log("Using Lovable AI fallback for trends...");
      provider = "lovable_ai";

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
          temperature: 0.7,
        }),
      });

      if (!lovableResponse.ok) {
        const errorText = await lovableResponse.text();
        console.error("Lovable AI error:", lovableResponse.status, errorText);
        
        if (lovableResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (lovableResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI Gateway error: ${lovableResponse.status}`);
      }

      const lovableData = await lovableResponse.json();
      const content = lovableData.choices?.[0]?.message?.content || "";

      try {
        const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
        trends = JSON.parse(cleanContent);
        console.log("Lovable AI trends parsed successfully");
      } catch (parseError) {
        console.error("Failed to parse Lovable AI response:", content);
        trends = { trends: [] };
      }
    }

    if (!trends) {
      throw new Error("No AI provider available");
    }

    // ============================================
    // OMNICORE: Save signals to omnicore_signals table
    // ============================================
    const savedSignals: TrendSignal[] = [];
    
    if (saveSignals && blogId && trends.trends && Array.isArray(trends.trends)) {
      console.log(`[OMNICORE] Saving ${trends.trends.length} signals to omnicore_signals...`);
      
      for (const trend of trends.trends) {
        const signalData = {
          blog_id: blogId,
          territory: parsedTerritory || businessCountry,
          niche: businessNiche,
          topic: trend.topic || trend.keyword || 'Unknown topic',
          intent: trend.intent || 'informational',
          volume_hint: trend.volume_hint || trend.relevance || 'medium',
          sources: trend.sources || citations.slice(0, 3) || [],
        };
        
        const { data: insertedSignal, error: signalError } = await supabase
          .from('omnicore_signals')
          .insert(signalData)
          .select('id')
          .single();
        
        if (!signalError && insertedSignal) {
          savedSignals.push({
            id: insertedSignal.id,
            topic: signalData.topic,
            intent: signalData.intent,
            volume_hint: signalData.volume_hint,
            sources: signalData.sources,
          });
        } else {
          console.warn(`[OMNICORE] Failed to save signal:`, signalError);
        }
      }
      
      console.log(`[OMNICORE] Saved ${savedSignals.length} signals`);
    }

    // Log AI usage
    await supabase.from("ai_usage_logs").insert({
      blog_id: blogId || null,
      provider,
      endpoint: "fetch-real-trends",
      country: businessCountry,
      cost_usd: provider === "perplexity" ? 0.0057 : 0,
      success: true,
      metadata: {
        trends_count: trends.trends?.length || 0,
        citations_count: citations.length,
        signals_saved: savedSignals.length,
        territory: parsedTerritory,
        territory_id: territoryId || null,
        neighborhoods_used: neighborhoodTags.slice(0, 5),
        radius_km: radiusKm,
        has_geo_validation: hasValidatedTerritory,
      }
    });

    console.log(`Trends fetched successfully using ${provider}${hasValidatedTerritory ? ' with territorial data' : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        niche: businessNiche,
        region: businessCountry,
        territory: parsedTerritory || businessCountry,
        territory_id: territoryId || null,
        neighborhoods: neighborhoodTags,
        radius_km: radiusKm,
        geo_validated: hasValidatedTerritory,
        coordinates: territoryLat && territoryLng ? { lat: territoryLat, lng: territoryLng } : null,
        period: `${month}/${year}`,
        source: provider,
        citations_count: citations.length,
        signals: savedSignals.length > 0 ? savedSignals : undefined,
        ...trends,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in fetch-real-trends:", error);

    // Log failed attempt
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      
      const body = await req.clone().json().catch(() => ({}));
      
      await supabase.from("ai_usage_logs").insert({
        blog_id: body.blogId || null,
        provider: "unknown",
        endpoint: "fetch-real-trends",
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
