import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateText, generateImage } from '../_shared/omniseen-ai.ts';


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { long_description, niche, target_audience, existing_items, type = "concepts" } = await req.json();
console.log("Generating items for:", { type, niche, target_audience });

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "concepts") {
      systemPrompt = `Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, especialista em marketing de conteúdo e estratégia de negócios. 
Seu objetivo é sugerir conceitos técnicos e termos importantes para um negócio.
Conceitos são termos técnicos, metodologias, frameworks, e jargões do nicho que a equipe de conteúdo deve conhecer para criar material relevante.

IMPORTANTE:
- Retorne APENAS termos curtos (1-3 palavras cada)
- Foque em termos técnicos do nicho, não descrições longas
- Evite termos genéricos demais
- Priorize conceitos que diferenciam o nicho`;

      userPrompt = `Gere 10-15 conceitos relevantes para este negócio:

Nicho: ${niche || "Não especificado"}
Público-alvo: ${target_audience || "Não especificado"}
Descrição do negócio: ${long_description || "Não especificada"}

${existing_items?.length > 0 ? `Conceitos já cadastrados (NÃO repita estes): ${existing_items.join(", ")}` : ""}

Retorne em formato JSON: { "items": ["Item1", "Item2", ...] }`;
    } else if (type === "pain_points") {
      systemPrompt = `Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, especialista em comportamento do consumidor e marketing.
Seu objetivo é identificar as principais dores, frustrações e problemas que o público-alvo enfrenta.

IMPORTANTE:
- Retorne frases curtas e diretas (máximo 8 palavras cada)
- Foque em problemas reais e específicos do nicho
- Evite termos genéricos como "falta de tempo"
- Priorize dores que o negócio pode resolver`;

      userPrompt = `Gere 8-12 dores/problemas que o público-alvo enfrenta:

Nicho: ${niche || "Não especificado"}
Público-alvo: ${target_audience || "Não especificado"}
Descrição do negócio: ${long_description || "Não especificada"}

${existing_items?.length > 0 ? `Dores já cadastradas (NÃO repita estas): ${existing_items.join(", ")}` : ""}

Retorne em formato JSON: { "items": ["Dor1", "Dor2", ...] }`;
    } else if (type === "desires") {
      systemPrompt = `Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, especialista em comportamento do consumidor e marketing.
Seu objetivo é identificar os principais desejos, aspirações e resultados que o público-alvo busca.

IMPORTANTE:
- Retorne frases curtas e diretas (máximo 8 palavras cada)
- Foque em resultados e transformações desejadas
- Evite termos genéricos como "ter sucesso"
- Priorize desejos que o negócio pode ajudar a alcançar`;

      userPrompt = `Gere 8-12 desejos/aspirações que o público-alvo tem:

Nicho: ${niche || "Não especificado"}
Público-alvo: ${target_audience || "Não especificado"}
Descrição do negócio: ${long_description || "Não especificada"}

${existing_items?.length > 0 ? `Desejos já cadastrados (NÃO repita estes): ${existing_items.join(", ")}` : ""}

Retorne em formato JSON: { "items": ["Desejo1", "Desejo2", ...] }`;
    } else {
      throw new Error("Invalid type. Must be 'concepts', 'pain_points', or 'desires'");
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response:", content);

    // Parse the JSON response
    let items: string[] = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        items = parsed.items || parsed.concepts || [];
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Fallback: try to extract items from plain text
      const lines = content.split("\n").filter((line: string) => line.trim());
      items = lines.slice(0, 15).map((line: string) => 
        line.replace(/^[\d\.\-\*]+\s*/, "").trim()
      ).filter((c: string) => c.length > 0 && c.length < 80);
    }

    console.log("Generated items:", items);

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating concepts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
