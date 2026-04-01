import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * evaluate-geo-readiness — OmniSeen GEO Scoring
 *
 * Scores an article based on specific parameters matching AI search
 * engine preferences (ChatGPT, Perplexity, AI Overviews):
 * 1. 120-180 word sections
 * 2. Answer-first after H2 (40-60 words)
 * 3. Tables with <thead>
 * 4. FAQ presence
 * 5. Data/Statistical density
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function analyzeHtml(html: string) {
  const content = html || "";
  
  // Basic metrics
  const word_count = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const h2Matches = [...content.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  const h3Matches = [...content.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
  const heading_count = h2Matches.length + h3Matches.length;
  const has_faq = /faq|perguntas frequentes|dúvidas/i.test(content) || content.includes("FAQPage");
  const has_lists = /<ul|<ol/i.test(content);
  const has_table = /<table/i.test(content) && /<thead/i.test(content);
  const has_statistics = /\d+%|\d+,\d+%|\d+\.\d+%|\$\d+|R\$\d+|pesquisa|estudo|dados/i.test(content);

  // Advanced GEO metrics
  // Benchmarks: Answer-first (first paragraph after H2 is 40-60 words)
  let answerFirstCount = 0;
  for (const h2 of h2Matches) {
    const sectionIndex = h2.index;
    if (sectionIndex) {
      // Find the first paragraph after this H2
      const block = content.slice(sectionIndex);
      const pMatch = block.match(/<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
      if (pMatch) {
        const pTokens = pMatch[1].replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
        if (pTokens >= 35 && pTokens <= 75) { // Roughly 40-60 words in target logic
          answerFirstCount++;
        }
      }
    }
  }
  const has_answer_first = h2Matches.length > 0 && answerFirstCount >= Math.ceil(h2Matches.length / 2);

  // Section lengths (120-180 words ideal)
  let optimalSectionCount = 0;
  const h2Splits = content.split(/<h2[^>]*>/i).slice(1);
  for (const section of h2Splits) {
    const sectionWords = section.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length;
    if (sectionWords >= 100 && sectionWords <= 250) {
      optimalSectionCount++;
    }
  }
  const has_optimal_sections = h2Splits.length > 0 && optimalSectionCount >= Math.ceil(h2Splits.length / 2);

  return {
    word_count, heading_count, has_faq, has_lists, has_table, has_statistics, has_answer_first, has_optimal_sections,
  };
}

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
      .select("id, blog_id, content, url, status")
      .eq("id", articleId)
      .single();

    if (artErr || !article) throw new Error(artErr?.message || "Article not found");

    // Fetch tenant mapping (via blog)
    const { data: blog } = await supabase.from("blogs").select("tenant_id").eq("id", article.blog_id).single();

    // 2. Analyze HTML
    const a = analyzeHtml(article.content || "");

    // 3. Compute scores (0-25 each)
    let score_entity_coverage = 15; // Base assumption since it passed entity pipeline
    if (a.has_table) score_entity_coverage += 5;
    if (a.word_count > 1000) score_entity_coverage += 5;

    let score_structure = 5;
    if (a.heading_count > 3) score_structure += 5;
    if (a.has_faq) score_structure += 10;
    if (a.has_optimal_sections) score_structure += 5;

    let score_authority_signals = 5;
    if (a.has_statistics) score_authority_signals += 20;

    let score_format_readability = 5;
    if (a.has_lists) score_format_readability += 10;
    if (a.has_answer_first) score_format_readability += 10;

    // Cap at 25 each
    score_entity_coverage = Math.min(25, score_entity_coverage);
    score_structure = Math.min(25, score_structure);
    score_authority_signals = Math.min(25, score_authority_signals);
    score_format_readability = Math.min(25, score_format_readability);

    const geo_score = score_entity_coverage + score_structure + score_authority_signals + score_format_readability;
    let geo_tier = 'baixo';
    if (geo_score >= 80) geo_tier = 'alto';
    else if (geo_score >= 50) geo_tier = 'medio';

    // 4. Recommendations
    const recommendations = [];
    if (!a.has_answer_first) recommendations.push({ dimension: 'format_readability', priority: 'high', recommendation_text: 'Suas seções H2 não começam com respostas diretas (40-60 palavras).', action_hint: 'Edite o primeiro parágrafo após os H2 principais para entregar a resposta imediata antes de elaborar.'});
    if (!a.has_statistics) recommendations.push({ dimension: 'authority_signals', priority: 'high', recommendation_text: 'Não detectamos dados estatísticos ou referências numéricas fortes.', action_hint: 'Adicione % ou números para fundamentar seus argumentos.'});
    if (!a.has_table) recommendations.push({ dimension: 'entity_coverage', priority: 'medium', recommendation_text: 'Nenhuma tabela detectada.', action_hint: 'Modelos de IA como Gemini citam artigos com <table_thead> em 47% mais vezes.'});
    if (!a.has_faq) recommendations.push({ dimension: 'structure', priority: 'medium', recommendation_text: 'FAQ ausente.', action_hint: 'Adicione um painel de Perguntas Frequentes no final do artigo (com schemas).'});
    if (!a.has_optimal_sections) recommendations.push({ dimension: 'structure', priority: 'low', recommendation_text: 'Suas seções estão muito densas ou muito curtas.', action_hint: 'Mantenha cerca de 120-180 palavras entre cada subtítulo.'});

    // 5. Save to DB
    const { data: readinessData, error: insertErr } = await supabase
      .from("seo_geo_readiness")
      .upsert({
        article_id: articleId,
        blog_id: article.blog_id,
        tenant_id: blog?.tenant_id,
        geo_score,
        geo_tier,
        score_entity_coverage,
        score_structure,
        score_authority_signals,
        score_format_readability,
        word_count: a.word_count,
        heading_count: a.heading_count,
        has_faq: a.has_faq,
        has_answer_first: a.has_answer_first,
        has_statistics: a.has_statistics,
        has_lists: a.has_lists,
        generation_mode: 'engine_v2'
      }, { onConflict: "article_id" })
      .select('id')
      .single();

    if (insertErr) throw new Error(insertErr.message);

    if (readinessData?.id && recommendations.length > 0) {
      // Clear old recommendations
      await supabase.from("geo_recommendations").delete().eq("geo_readiness_id", readinessData.id);
      
      const insertRecs = recommendations.map(r => ({ ...r, geo_readiness_id: readinessData.id, article_id: articleId }));
      await supabase.from("geo_recommendations").insert(insertRecs);
    }

    return new Response(JSON.stringify({
      success: true,
      geo_score,
      geo_tier,
      recommendation_count: recommendations.length,
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[GEO_READINESS] Error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
});
