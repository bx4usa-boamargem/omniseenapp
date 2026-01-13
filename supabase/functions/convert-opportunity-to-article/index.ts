import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConvertRequest {
  opportunityId: string;
  blogId: string;
}

/**
 * CONVERT-OPPORTUNITY-TO-ARTICLE
 * 
 * Responsabilidades:
 * 1. Receber opportunityId e blogId
 * 2. Buscar dados completos da oportunidade
 * 3. Gerar conteúdo do artigo via generate-article-structured
 * 4. Inserir DIRETAMENTE na tabela articles (NÃO na queue)
 * 5. Vincular via opportunity_id
 * 6. Atualizar oportunidade: status = 'converted'
 * 7. Retornar article_id para redirecionamento
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { opportunityId, blogId }: ConvertRequest = await req.json();

    if (!opportunityId || !blogId) {
      throw new Error("opportunityId and blogId are required");
    }

    console.log(`[CONVERT] Starting conversion for opportunity ${opportunityId} in blog ${blogId}`);

    // 1. Buscar oportunidade completa
    const { data: opportunity, error: oppError } = await supabase
      .from("article_opportunities")
      .select("*")
      .eq("id", opportunityId)
      .single();

    if (oppError || !opportunity) {
      console.error("[CONVERT] Opportunity not found:", oppError);
      throw new Error(`Opportunity not found: ${oppError?.message || 'Unknown error'}`);
    }

    // Verificar se já foi convertida
    if (opportunity.status === 'converted') {
      console.log(`[CONVERT] Opportunity ${opportunityId} already converted to article ${opportunity.converted_article_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Opportunity already converted",
          article_id: opportunity.converted_article_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar contexto do blog para geração
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

    // 3. Gerar conteúdo via generate-article-structured
    // Usando mode 'fast' para oportunidades - mais confiável e rápido
    console.log(`[CONVERT] Generating article content for: "${opportunity.suggested_title}"`);

    const generateResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-article-structured`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        blog_id: blogId,
        theme: opportunity.suggested_title,
        keywords: opportunity.suggested_keywords || [],
        word_count: 1000, // Reduced for faster generation
        include_faq: true,
        include_conclusion: true,
        generation_mode: 'fast', // Use fast mode for opportunity conversion - more reliable
        source: 'opportunity',
        auto_publish: false, // SEMPRE draft
      }),
    });

    // Parse response body as text first to debug
    const responseText = await generateResponse.text();
    
    if (!generateResponse.ok) {
      console.error("[CONVERT] Article generation failed:", responseText);
      
      // Try to parse error for better messaging
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(`Article generation failed: ${errorData.message || errorData.error || generateResponse.status}`);
      } catch {
        throw new Error(`Article generation failed: ${generateResponse.status}`);
      }
    }

    // Parse successful response
    let generatedResult;
    try {
      generatedResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[CONVERT] Failed to parse generation response:", responseText.substring(0, 500));
      throw new Error("Failed to parse article generation response");
    }

    // CRITICAL FIX: The generate-article-structured returns { success, article: { id, ... } }
    // We need to extract article.id, not just id
    const articleId = generatedResult.article?.id || generatedResult.id;
    const articleSlug = generatedResult.article?.slug || generatedResult.slug;
    
    if (!articleId) {
      console.error("[CONVERT] No article ID in response:", JSON.stringify(generatedResult).substring(0, 500));
      throw new Error("Article was generated but no ID was returned. Response structure may have changed.");
    }

    console.log(`[CONVERT] Article generated successfully, id: ${articleId}`);

    // 4. Atualizar artigo com opportunity_id e funnel_stage (já foi criado pelo generate-article-structured)
    // Mapear article_goal para valores válidos do check constraint
    const goalMap: Record<string, string> = {
      'lead': 'lead',
      'authority': 'seo_traffic',
      'conversion': 'lead',
      'seo_traffic': 'seo_traffic',
      'engagement': 'engagement'
    };
    const mappedGoal = opportunity.goal ? goalMap[opportunity.goal] || null : null;

    const { error: updateArticleError } = await supabase
      .from("articles")
      .update({
        opportunity_id: opportunityId,
        funnel_stage: opportunity.funnel_stage,
        article_goal: mappedGoal,
        generation_source: 'opportunity',
      })
      .eq("id", articleId);

    if (updateArticleError) {
      console.error("[CONVERT] Failed to update article with opportunity link:", updateArticleError);
      // Non-blocking - article was created, just link failed
    }

    // 5. Atualizar oportunidade como convertida
    const { error: updateOppError } = await supabase
      .from("article_opportunities")
      .update({
        status: 'converted',
        converted_article_id: articleId,
        converted_at: new Date().toISOString(),
      })
      .eq("id", opportunityId);

    if (updateOppError) {
      console.error("[CONVERT] Failed to update opportunity status:", updateOppError);
      // Non-blocking - article was created
    }

    // =========================================================================
    // 6. GERAR IMAGENS AUTOMATICAMENTE (NOVO!)
    // Gera imagem de capa + 2 imagens do corpo para artigos convertidos
    // =========================================================================
    console.log(`[CONVERT] Generating images for article ${articleId}...`);

    try {
      // 6.1 Gerar imagem de capa
      console.log(`[CONVERT] Generating cover image...`);
      const coverResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-image`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleTitle: opportunity.suggested_title,
          context: 'cover',
          blog_id: blogId,
          article_id: articleId,
        }),
      });

      if (coverResponse.ok) {
        const coverResult = await coverResponse.json();
        console.log(`[CONVERT] Cover image generated: ${coverResult.publicUrl ? 'success' : 'no url'}`);
      } else {
        console.warn(`[CONVERT] Cover image generation failed: ${coverResponse.status}`);
      }

      // 6.2 Gerar imagens do corpo (problem + solution)
      const bodyContexts = ['problem', 'solution'];
      for (const ctx of bodyContexts) {
        console.log(`[CONVERT] Generating ${ctx} image...`);
        const imgResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-image`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            articleTitle: opportunity.suggested_title,
            context: ctx,
            blog_id: blogId,
            article_id: articleId,
          }),
        });

        if (imgResponse.ok) {
          const imgResult = await imgResponse.json();
          console.log(`[CONVERT] ${ctx} image generated: ${imgResult.publicUrl ? 'success' : 'no url'}`);
        } else {
          console.warn(`[CONVERT] ${ctx} image generation failed: ${imgResponse.status}`);
        }
      }

      console.log(`[CONVERT] ✅ Images generated for article ${articleId}`);
    } catch (imageError) {
      // Non-blocking - article was created, images can be generated later
      console.error("[CONVERT] Image generation error (non-blocking):", imageError);
    }

    console.log(`[CONVERT] ✅ Conversion complete: Opportunity ${opportunityId} → Article ${articleId}`);

    return new Response(
      JSON.stringify({
        success: true,
        article_id: articleId,
        article_title: opportunity.suggested_title,
        article_slug: articleSlug,
        opportunity_id: opportunityId,
        funnel_stage: opportunity.funnel_stage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CONVERT] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
