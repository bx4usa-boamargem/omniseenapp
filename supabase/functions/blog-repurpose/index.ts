import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText, AIMessage } from "../_shared/omniseen-ai.ts";

/**
 * blog-repurpose — OmniSeen Native Repurposing Engine
 *
 * Takes a published article and generates 3 social media adaptations:
 * 1. A technical/hook-based LinkedIn post
 * 2. A 5-7 step Twitter/X Thread
 * 3. A Newsletter hook snippet
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { articleId } = await req.json();
    if (!articleId) {
      return new Response(JSON.stringify({ error: "articleId is required" }), { status: 400, headers: CORS_HEADERS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Fetch article
    const { data: article, error: artErr } = await supabase
      .from("articles")
      .select("title, content, url, status")
      .eq("id", articleId)
      .single();

    if (artErr || !article) throw new Error(artErr?.message || "Article not found");

    // Clear HTML for the LLM
    const pureText = (article.content || "").replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').substring(0, 15000);

    const systemPrompt = `Você é um Social Media Manager Expert. 
Dado o texto de um artigo de blog, extraia seu real valor (INFO-GAIN) e transforme-o impreterivelmente no seguinte formato JSON estrito:
{
  "linkedin_post": "O texto formatado para LinkedIn, com um HOOK forte na primeira linha, quebras de linha limpas, lista de 3 pontos-chave no meio e call-to-action para ler o post completo no último parágrafo.",
  "twitter_thread": [
    "Tweet 1/X: Hook agudo, provocativo + Promessa do que aprenderá",
    "Tweet 2/X: Contexto/Problema (max 280 chars)",
    "Tweet 3/X: O Insight central (max 280 chars)",
    "Tweet X/X: Call to action para o link"
  ],
  "newsletter_snippet": "Parágrafo curto (email) focando na 'dor vs solução' que faz o leitor querer clicar e ler o resto."
}`;

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Título: ${article.title}\n\nConteúdo Base:\n${pureText}` }
    ];

    console.log(`[blog-repurpose] Gerando peças sociais para artigo: ${article.title}`);

    // Call OmniSeen AI Router
    const aiResult = await generateText("general", messages, {
      temperature: 0.6,
      maxTokens: 2500,
      responseFormat: "json"
    });

    if (!aiResult.success) {
      throw new Error(`AI Generation failed: ${aiResult.error}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(aiResult.content);
    } catch (e) {
      throw new Error("O modelo não retornou JSON válido.");
    }

    return new Response(JSON.stringify({
      success: true,
      original_title: article.title,
      repurposed: {
        linkedin: parsed.linkedin_post,
        twitter: parsed.twitter_thread,
        newsletter: parsed.newsletter_snippet
      }
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[REPURPOSE] Error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
});
