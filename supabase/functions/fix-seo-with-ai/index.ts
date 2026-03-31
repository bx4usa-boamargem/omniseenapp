import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  computeSeoScore, 
  computeWordCount, 
  computeKeywordDensity, 
  stripHtml,
  type SEOResult 
} from "../_shared/seoScoring.ts";
import {
  extractImageBlocks,
  reinjectImageBlocks,
  validateImagePreservation,
  IMAGE_PROTECTION_PROMPT
} from "../_shared/imageProtection.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FixSeoRequest {
  article_id: string;
  keywords?: string[];
  target_word_count_min?: number;
  target_word_count_max?: number;
}

interface FixSeoResponse {
  success: boolean;
  article_id: string;
  updated?: {
    title: string;
    meta_description: string;
    content_text: string;
    word_count: number;
    keyword_density: Record<string, number>;
  };
  seo?: SEOResult;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const body: FixSeoRequest = await req.json();
    const { 
      article_id, 
      keywords: requestKeywords,
      target_word_count_min = 1200,
      target_word_count_max = 3000 
    } = body;

    if (!article_id) {
      throw new Error("article_id is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("GOOGLE_AI_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch current article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("id, title, meta_description, content, keywords, featured_image_url, blog_id")
      .eq("id", article_id)
      .single();

    if (articleError || !article) {
      throw new Error(`Article not found: ${articleError?.message || 'Unknown error'}`);
    }

    // Use provided keywords or article's existing keywords
    const keywords = requestKeywords && requestKeywords.length > 0 
      ? requestKeywords 
      : (article.keywords || []);

    if (keywords.length === 0) {
      throw new Error("No keywords available. Please provide keywords for SEO optimization.");
    }

    // 2. Calculate BEFORE score
    const cleanContentBefore = stripHtml(article.content || '');
    const beforeScore = computeSeoScore({
      title: article.title || '',
      meta_description: article.meta_description || '',
      content_text: cleanContentBefore,
      keywords,
      has_featured_image: !!article.featured_image_url
    });

    const wordCountBefore = computeWordCount(cleanContentBefore);
    const densityBefore = computeKeywordDensity(cleanContentBefore, keywords);

    // 3. Generate optimized content with AI
    if (!apiKey) {
      throw new Error("AI API key not configured");
    }

    const mainKeyword = keywords[0];
    const allKeywords = keywords.join(", ");

    // Generate optimized title (50-60 chars with keyword)
    const titlePrompt = `Reescreva este título para SEO otimizado:
Título atual: "${article.title}"
Palavra-chave principal: "${mainKeyword}"

REGRAS:
- Exatamente 50-60 caracteres
- Inclua a palavra-chave "${mainKeyword}" naturalmente
- Seja atraente e clicável
- Mantenha o tema do artigo

Responda APENAS com o novo título, sem aspas ou explicações.`;

    // Generate optimized meta description (140-160 chars with keyword)
    const metaPrompt = `Crie uma meta description otimizada para SEO:
Título: "${article.title}"
Palavra-chave principal: "${mainKeyword}"
Conteúdo resumido: "${cleanContentBefore.substring(0, 500)}..."

REGRAS:
- Exatamente 140-160 caracteres
- Inclua a palavra-chave "${mainKeyword}" no início
- Termine com chamada para ação
- Seja persuasivo

Responda APENAS com a meta description, sem aspas ou explicações.`;

    // Parallel AI calls for title and meta
    const [titleResponse, metaResponse] = await Promise.all([
      fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            { role: "system", content: "Você é um especialista em SEO. Responda de forma direta e precisa. REGRA CRÍTICA: Mantenha TODA a estrutura HTML. NÃO converta HTML para Markdown ou texto plano." },
            { role: "user", content: titlePrompt }
          ],
          max_tokens: 100,
          temperature: 0.7
        })
      }),
      fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            { role: "system", content: "Você é um especialista em SEO. Responda de forma direta e precisa. REGRA CRÍTICA: Mantenha TODA a estrutura HTML. NÃO converta HTML para Markdown ou texto plano." },
            { role: "user", content: metaPrompt }
          ],
          max_tokens: 200,
          temperature: 0.7
        })
      })
    ]);

    const titleData = await titleResponse.json();
    const metaData = await metaResponse.json();

    let newTitle = titleData.choices?.[0]?.message?.content?.trim() || article.title;
    let newMeta = metaData.choices?.[0]?.message?.content?.trim() || article.meta_description;

    // Clean up AI responses
    newTitle = newTitle.replace(/^["']|["']$/g, '').trim();
    newMeta = newMeta.replace(/^["']|["']$/g, '').trim();

    // 4. Expand content if needed
    let newContent = article.content || '';
    
    if (wordCountBefore < target_word_count_min) {
      const expansionNeeded = target_word_count_min - wordCountBefore;
      
      // Extract images before sending to AI
      const { cleanContent: contentWithoutImages, imageBlocks } = extractImageBlocks(article.content || '');
      console.log(`[FIX-SEO] Extracted ${imageBlocks.length} image blocks for protection`);

      const contentPrompt = `Expanda este artigo mantendo a estrutura HTML:

CONTEÚDO ATUAL:
${contentWithoutImages}

PALAVRAS-CHAVE para usar naturalmente: ${allKeywords}
${IMAGE_PROTECTION_PROMPT}

REGRAS OBRIGATÓRIAS:
1. Adicione ${expansionNeeded + 200} palavras
2. Mantenha toda a estrutura HTML existente (h1, h2, h3, p, ul, li)
3. Distribua as keywords naturalmente (densidade 0.5%-2.5%)
4. NÃO remova nenhum conteúdo existente
5. Adicione novas seções H2 ou H3 se necessário
6. Mantenha o tom profissional
7. Retorne o HTML completo expandido

Responda APENAS com o HTML expandido, sem explicações.`;

      const contentResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            { role: "system", content: "Você é um redator SEO especialista. Expanda o conteúdo mantendo a qualidade e estrutura HTML. REGRA CRÍTICA: Mantenha TODA a estrutura HTML. NÃO converta HTML para Markdown ou texto plano. Mantenha todos os marcadores <!--IMG_PLACEHOLDER_N--> nas suas posições." },
            { role: "user", content: contentPrompt }
          ],
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      const contentData = await contentResponse.json();
      let expandedContent = contentData.choices?.[0]?.message?.content?.trim();
      
      if (expandedContent && expandedContent.length > (article.content?.length || 0)) {
        // Re-inject images
        if (imageBlocks.length > 0) {
          expandedContent = reinjectImageBlocks(expandedContent, imageBlocks);
          const validation = validateImagePreservation(article.content || '', expandedContent);
          console.log(`[FIX-SEO] Image validation: ${validation.preserved ? '✅' : '⚠️'} ${validation.beforeCount} before, ${validation.afterCount} after`);
        }
        newContent = expandedContent;
      }
    }

    // 5. Calculate AFTER score
    const cleanContentAfter = stripHtml(newContent);
    const afterScore = computeSeoScore({
      title: newTitle,
      meta_description: newMeta,
      content_text: cleanContentAfter,
      keywords,
      has_featured_image: !!article.featured_image_url
    });

    const wordCountAfter = computeWordCount(cleanContentAfter);
    const densityAfter = computeKeywordDensity(cleanContentAfter, keywords);

    // 6. Update article
    const { error: updateError } = await supabase
      .from("articles")
      .update({
        title: newTitle,
        meta_description: newMeta,
        content: newContent,
        keywords: keywords,
        updated_at: new Date().toISOString()
      })
      .eq("id", article_id);

    if (updateError) {
      throw new Error(`Failed to update article: ${updateError.message}`);
    }

    // 7. Record audit in seo_ai_runs
    const { error: auditError } = await supabase
      .from("seo_ai_runs")
      .insert({
        article_id,
        action: "fix_all",
        provider: "lovable",
        model: 'gemini-2.5-flash',
        before: {
          title: article.title,
          meta_description: article.meta_description,
          content_preview: cleanContentBefore.substring(0, 500)
        },
        after: {
          title: newTitle,
          meta_description: newMeta,
          content_preview: cleanContentAfter.substring(0, 500)
        },
        before_score: beforeScore.score_total,
        after_score: afterScore.score_total,
        word_count_before: wordCountBefore,
        word_count_after: wordCountAfter,
        keyword_density_before: densityBefore,
        keyword_density_after: densityAfter,
        status: "success"
      });

    if (auditError) {
      console.error("Failed to record audit:", auditError);
      // Don't fail the request, just log the error
    }

    // 8. Log AI usage
    const executionTime = Date.now() - startTime;
    try {
      await supabase.from("ai_usage_logs").insert({
        blog_id: article.blog_id,
        endpoint: "fix-seo-with-ai",
        provider: "lovable",
        tokens_used: 0, // Approximation
        cost_usd: 0.001,
        success: true,
        metadata: {
          article_id,
          before_score: beforeScore.score_total,
          after_score: afterScore.score_total,
          execution_time_ms: executionTime
        }
      });
    } catch (logError) {
      console.error("Failed to log AI usage:", logError);
    }

    const response: FixSeoResponse = {
      success: true,
      article_id,
      updated: {
        title: newTitle,
        meta_description: newMeta,
        content_text: cleanContentAfter,
        word_count: wordCountAfter,
        keyword_density: densityAfter
      },
      seo: afterScore
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    console.error("Error in fix-seo-with-ai:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    const response: FixSeoResponse = {
      success: false,
      article_id: "",
      error: errorMessage
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
