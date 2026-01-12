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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    // Use Lovable AI to generate realistic trends based on market knowledge
    const systemPrompt = `Você é um especialista em marketing de conteúdo e tendências de mercado no Brasil.
Sua função é identificar temas e tendências atuais relevantes para o nicho de ${businessNiche} na região de ${businessCountry}.

Baseie suas sugestões em:
- Tendências sazonais e eventos relevantes para ${month}/${year}
- Problemas comuns enfrentados pelo público-alvo
- Novidades tecnológicas e regulatórias do setor
- Palavras-chave de alta demanda no nicho
- Conteúdo educacional que gera autoridade

Retorne EXATAMENTE um JSON válido sem markdown, no formato:
{
  "trends": [
    {
      "topic": "título da tendência",
      "relevance": "descrição curta da relevância",
      "suggested_angle": "ângulo sugerido para o artigo",
      "keywords": ["keyword1", "keyword2", "keyword3"]
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let trends;
    try {
      // Clean up the response (remove markdown if present)
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      trends = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback to empty trends
      trends = { trends: [] };
    }

    return new Response(
      JSON.stringify({
        success: true,
        niche: businessNiche,
        region: businessCountry,
        period: `${month}/${year}`,
        ...trends,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in fetch-real-trends:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
