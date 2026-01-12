import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  blogId: string;
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
          gaps: []
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
    const existingKeywords = (existingArticles || [])
      .flatMap(a => a.keywords || [])
      .map(k => k.toLowerCase());

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
Sua função é identificar gaps de conteúdo baseado na análise de concorrentes.

Contexto do negócio:
- Nicho: ${businessContext.niche}
- Região: ${businessContext.region}
- Público-alvo: ${businessContext.targetAudience}

Concorrentes a analisar:
${competitorInfo.map(c => `- ${c.name}: ${c.url}`).join("\n")}

Artigos já existentes (evitar duplicatas):
${existingTitles.slice(0, 10).join(", ")}

Palavras-chave já usadas:
${existingKeywords.slice(0, 20).join(", ")}

Retorne EXATAMENTE um JSON válido sem markdown:
{
  "gaps": [
    {
      "theme": "tema do gap identificado",
      "competitor": "nome do concorrente de referência",
      "suggested_title": "título sugerido para artigo",
      "keywords": ["keyword1", "keyword2"],
      "rationale": "por que este tema é uma oportunidade"
    }
  ]
}`;

    const userPrompt = `Analise os concorrentes listados e identifique 5-10 gaps de conteúdo que podem ser explorados.

Considere:
1. Temas que os concorrentes provavelmente cobrem mas o cliente não
2. Palavras-chave de cauda longa do nicho
3. Conteúdo educacional que gera autoridade
4. FAQs comuns do setor
5. Tendências locais/regionais

Evite sugerir temas muito similares aos artigos já existentes.
Retorne apenas o JSON, sem explicações adicionais.`;

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
    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      analysis = { gaps: [] };
    }

    // Update competitors with last analyzed timestamp
    const now = new Date().toISOString();
    for (const competitor of competitors) {
      await supabase
        .from("competitors")
        .update({ last_analyzed_at: now } as Record<string, unknown>)
        .eq("id", competitor.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        competitors_analyzed: competitors.length,
        ...analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-competitors:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
        gaps: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
