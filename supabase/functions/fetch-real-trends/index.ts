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
    const { blogId, niche, country }: TrendRequest = await req.json();

    // Fetch business profile for context
    let businessNiche = niche || "negócios";
    let businessCountry = country || "Brasil";

    if (blogId) {
      const { data: profile } = await supabase
        .from("business_profile")
        .select("niche, country, company_name")
        .eq("blog_id", blogId)
        .maybeSingle();

      if (profile) {
        businessNiche = profile.niche || businessNiche;
        businessCountry = profile.country || businessCountry;
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

    const systemPrompt = `Você é um especialista em marketing de conteúdo e tendências de mercado.
Sua função é identificar temas e tendências atuais relevantes para o nicho de ${businessNiche} na região de ${businessCountry}.

Baseie suas sugestões em:
- Tendências sazonais e eventos relevantes para ${month}/${year}
- Problemas comuns enfrentados pelo público-alvo
- Novidades tecnológicas e regulatórias do setor
- Palavras-chave de alta demanda no nicho
- Conteúdo educacional que gera autoridade

Responda em ${language}.

Retorne EXATAMENTE um JSON válido sem markdown, no formato:
{
  "trends": [
    {
      "topic": "título da tendência",
      "relevance": "descrição curta da relevância",
      "suggested_angle": "ângulo sugerido para o artigo",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "sources": ["URL1", "URL2"]
    }
  ]
}`;

    const userPrompt = `Identifique 10 tendências e temas em alta para o nicho de "${businessNiche}" na região de "${businessCountry}" para ${month} de ${year}.

Foque em:
1. Tendências sazonais do período
2. Problemas urgentes do público
3. Novidades do setor
4. Oportunidades de SEO local
5. Conteúdo educacional de alto valor

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
        citations_count: citations.length
      }
    });

    console.log(`Trends fetched successfully using ${provider}`);

    return new Response(
      JSON.stringify({
        success: true,
        niche: businessNiche,
        region: businessCountry,
        period: `${month}/${year}`,
        source: provider,
        citations_count: citations.length,
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
