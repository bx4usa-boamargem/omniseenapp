import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * blog-cannibalization — OmniSeen Keyword Cannibalization Prevention
 *
 * Checks if a requested keyword, intent, or strongly similar keyword
 * has already been covered by an existing article in the same blog/tenant.
 * Returns cannibalization severity and recommendations.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Computes simple Levenshtein distance for keyword similarity
 */
function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = new Array<number[]>(bn + 1);
  for (let i = 0; i <= bn; ++i) {
    let row = matrix[i] = new Array<number>(an + 1);
    row[0] = i;
  }
  const firstRow = matrix[0];
  for (let j = 1; j <= an; ++j) {
    firstRow[j] = j;
  }
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[bn][an];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { keyword, blogId } = await req.json();
    if (!keyword || !blogId) {
      return new Response(JSON.stringify({ error: "keyword and blogId are required" }), { status: 400, headers: CORS_HEADERS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch previously published/draft articles on this blog
    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, slug, status, keywords")
      .eq("blog_id", blogId)
      .neq("status", "trash");

    if (error) throw new Error(error.message);

    const targetKwd = keyword.toLowerCase().trim();
    let severity = 'None';
    let recommendation = 'Proceed';
    let conflictingArticle = null;

    if (articles && articles.length > 0) {
      for (const article of articles) {
        // Check array of keywords
        const existingKeywords = Array.isArray(article.keywords) ? article.keywords.map((k: string) => (k || "").toLowerCase().trim()) : [];
        const existingTitle = (article.title || "").toLowerCase().trim();

        // Level 1: Exact Match in Keywords
        if (existingKeywords.includes(targetKwd)) {
          severity = 'Critical';
          recommendation = 'Merge';
          conflictingArticle = { id: article.id, title: article.title, url: `/post/${article.slug}` };
          break; // Critical is highest severity, we can stop
        }

        // Level 2: Exact Match in Title
        if (existingTitle === targetKwd || existingTitle.includes(` ${targetKwd} `)) {
          if (severity !== 'Critical') {
            severity = 'High';
            recommendation = 'Canonicalizer ou Differenciar';
            conflictingArticle = { id: article.id, title: article.title, url: `/post/${article.slug}` };
          }
        }

        // Level 3: Fuzzy Match (Levenshtein distance <= 2 for words longer than 5 chars)
        if (targetKwd.length > 5 && severity === 'None') {
          for (const extK of existingKeywords) {
            if (extK.length > 5 && levenshtein(extK, targetKwd) <= 2) {
              severity = 'Medium';
              recommendation = 'Diferenciar Intent';
              conflictingArticle = { id: article.id, title: article.title, url: `/post/${article.slug}` };
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      keyword: targetKwd,
      cannibalization_risk: severity !== 'None',
      severity,
      recommendation,
      conflicting_article: conflictingArticle,
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CANNIBALIZATION] Error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
});
