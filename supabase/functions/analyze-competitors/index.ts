import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  blogId: string;
}

// Resilient parser to extract gaps even from partial/truncated JSON
function extractGapsFromPartialJSON(content: string): any[] {
  const gaps: any[] = [];
  
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
Identifique gaps de conteúdo baseado nos concorrentes listados.

Contexto do negócio:
- Nicho: ${businessContext.niche}
- Região: ${businessContext.region}
- Público-alvo: ${businessContext.targetAudience}

Concorrentes:
${competitorInfo.map(c => `- ${c.name}: ${c.url}`).join("\n")}

Artigos existentes (evitar duplicatas):
${existingTitles.slice(0, 5).join(", ") || "nenhum"}

IMPORTANTE: Retorne APENAS JSON puro, sem markdown, sem explicações.
Mantenha o "rationale" curto (máximo 25 palavras).

Formato exato:
{"gaps":[{"theme":"tema","competitor":"nome","suggested_title":"título","keywords":["kw1","kw2"],"rationale":"justificativa curta"}]}`;

    const userPrompt = `Identifique 3-5 gaps de conteúdo para o nicho "${businessContext.niche}" na região "${businessContext.region}".

Considere:
1. Temas que os concorrentes cobrem mas o cliente não
2. Palavras-chave de cauda longa
3. FAQs comuns do setor

Responda APENAS com o JSON, sem explicações adicionais.`;

    console.log("Calling AI Gateway for competitor analysis...");

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
        max_tokens: 4000,
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

    console.log("AI response length:", content.length);

    // Parse the JSON response with resilient fallback
    let analysis = { gaps: [] as any[] };
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
            gaps: []
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update competitors with last analyzed timestamp
    const now = new Date().toISOString();
    for (const competitor of competitors) {
      await supabase
        .from("competitors")
        .update({ last_analyzed_at: now } as Record<string, unknown>)
        .eq("id", competitor.id);
    }

    console.log("Returning", analysis.gaps?.length || 0, "gaps");

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
