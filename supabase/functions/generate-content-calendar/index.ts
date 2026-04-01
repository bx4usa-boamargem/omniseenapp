import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarPayload {
  blogId: string;
  niche: string;
  frequency: string;
  theme?: string;
}

interface ContentIdea {
  title: string;
  keyword: string;
  intent: "informational" | "commercial" | "transactional" | "navigational";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json() as CalendarPayload;
    const { blogId, niche, frequency, theme } = payload;

    if (!blogId || !niche) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: blogId, niche." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[CONTENT-CALENDAR] Generating calendar for blog ${blogId}, niche: ${niche}`);

    // Call OpenAI to generate 12 ideas
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    const systemPrompt = `Você é um estrategista de conteúdo SEO Sênior. Sua tarefa é criar exatamente 12 ideias de artigos altamente otimizados para um blog.
Informações:
Nicho: ${niche}
Tema específico: ${theme || "Variado de acordo com o nicho"}
Frequência desejada de publicação: ${frequency}

Regras:
- Retorne APENAS um JSON válido. O JSON deve ser um array simples de objetos.
- Formato esperado de cada objeto:
{ "title": "Título SEO atrativo", "keyword": "Palavra-chave principal", "intent": "informational" ou "commercial" ou "transactional" }
- Não adicione marcação markdown \`\`\`json. Comece com [ e termine com ].`;

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // fast and economical for this task
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7,
      })
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      console.error("[CONTENT-CALENDAR] OpenAI Error:", errorData);
      throw new Error("Failed to generate ideas from OpenAI");
    }

    const aiData = await openAIResponse.json();
    let rawContent = aiData.choices[0].message.content.trim();
    
    // Clean up markdown markers if the model hallucinated them
    if (rawContent.startsWith("```json")) rawContent = rawContent.replace(/^```json/, "");
    if (rawContent.startsWith("```")) rawContent = rawContent.replace(/^```/, "");
    if (rawContent.endsWith("```")) rawContent = rawContent.replace(/```$/, "");
    rawContent = rawContent.trim();

    let ideas: ContentIdea[] = [];
    try {
      ideas = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error("[CONTENT-CALENDAR] Failed to parse JSON:", rawContent);
      throw new Error("Invalid format returned from AI.");
    }

    // Insert into content_calendars
    const { data: calendarData, error: insertErr } = await supabase
      .from("content_calendars")
      .insert({
        blog_id: blogId,
        niche: niche,
        frequency: frequency,
        theme: theme || null,
        ideas: ideas,
        status: "active"
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[CONTENT-CALENDAR] Failed to insert calendar:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        calendar_id: calendarData.id,
        ideas: ideas
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[CONTENT-CALENDAR] Internal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
