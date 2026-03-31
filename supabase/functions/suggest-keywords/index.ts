import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const { title, content, blog_id } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Título é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Fetch preferred AI model from content_preferences if blog_id is provided
    let textModel = 'gemini-2.5-flash';
    
    if (blog_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: prefs } = await supabase
          .from("content_preferences")
          .select("ai_model_text")
          .eq("blog_id", blog_id)
          .single();
        
        if (prefs?.ai_model_text) {
          textModel = prefs.ai_model_text;
          console.log(`Using custom text model: ${textModel}`);
        }
      }
    }

    // Create a summary of the content (first 1500 chars)
    const contentSummary = content 
      ? content.substring(0, 1500).replace(/\n+/g, ' ').trim()
      : '';

    const prompt = `Você é um especialista em SEO. Analise o seguinte artigo e sugira 5 palavras-chave otimizadas para SEO.

As palavras-chave devem ser:
1. Relevantes ao tema principal do artigo
2. Com bom potencial de busca (long-tail quando apropriado)
3. Específicas e direcionadas ao público-alvo
4. Variadas entre termos principais e secundários
5. Naturais para uso no conteúdo

Título: "${title}"
${contentSummary ? `\nResumo do conteúdo: "${contentSummary}"` : ''}

Responda APENAS com um JSON válido no formato:
{
  "keywords": [
    { "keyword": "palavra-chave 1", "reason": "Motivo breve da sugestão" },
    { "keyword": "palavra-chave 2", "reason": "Motivo breve da sugestão" },
    { "keyword": "palavra-chave 3", "reason": "Motivo breve da sugestão" },
    { "keyword": "palavra-chave 4", "reason": "Motivo breve da sugestão" },
    { "keyword": "palavra-chave 5", "reason": "Motivo breve da sugestão" }
  ]
}`;

    console.log("Calling AI to suggest keywords...");

    const aiResult = await generateText('keyword_suggest', [
      { role: 'system', content: 'Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, especialista em SEO. Responda apenas com JSON válido.' },
      { role: 'user', content: prompt }
    ]);

    if (!aiResult.success) {
      console.error("AI error:", aiResult.error);
      const isRateLimit = aiResult.error?.includes('RATE_LIMITED');
      return new Response(
        JSON.stringify({ error: isRateLimit ? "Rate limit exceeded. Tente novamente em alguns segundos." : "Erro ao gerar sugestões" }),
        { status: isRateLimit ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiContent = aiResult.content;

    if (!aiContent) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "Resposta vazia da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = aiContent;
    const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const result = JSON.parse(jsonStr);
      console.log(`Successfully suggested ${result.keywords?.length || 0} keywords`);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      console.error("Raw response:", aiContent);
      return new Response(
        JSON.stringify({ error: "Erro ao processar resposta da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error in suggest-keywords:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
