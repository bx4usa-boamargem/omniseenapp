import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getNextStructureWithTemplate, type StructureType } from "../_shared/structureRotation.ts";
import { getNextEditorialModel, type EditorialModel } from "../_shared/editorialRotation.ts";

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

    // 3. ROTAÇÃO ESTRUTURAL - Determinar próximo modelo editorial
    console.log(`[CONVERT] Calculating next structure type for blog ${blogId}...`);
    const { structureType, template, activitySlug } = await getNextStructureWithTemplate(
      supabase,
      blogId,
      profile?.niche,
      profile?.services
    );
    
    console.log(`[CONVERT] Structure rotation: type=${structureType}, activity=${activitySlug}, template=${template?.display_name || 'fallback'}`);

    // 3b. ROTAÇÃO EDITORIAL - Determinar próximo modelo de conteúdo
    console.log(`[CONVERT] Calculating next editorial model for blog ${blogId}...`);
    const editorialModel: EditorialModel = await getNextEditorialModel(
      supabase,
      blogId,
      profile?.niche
    );
    
    console.log(`[CONVERT] Editorial rotation: model=${editorialModel}`);
    // 4. Buscar dados adicionais para GEO mode (território e whatsapp)
    const { data: territory } = await supabase
      .from("territories")
      .select("id, official_name, lat, lng, neighborhood_tags")
      .eq("blog_id", blogId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Buscar artigos existentes para links internos
    const { data: existingArticles } = await supabase
      .from("articles")
      .select("title, slug")
      .eq("blog_id", blogId)
      .eq("status", "published")
      .limit(5);

    const internalLinks = existingArticles?.map(a => ({
      title: a.title,
      url: `/blog/${a.slug}`
    })) || [];

    // 5. Gerar conteúdo via generate-article-structured
    // V2.0: SEMPRE usa geo_mode=true e generation_mode='deep'
    console.log(`[CONVERT] Generating article content for: "${opportunity.suggested_title}" with geo_mode=true`);

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
        word_count: 1500, // GEO mode requires 1200-3000 words
        include_faq: true,
        include_conclusion: true,
        generation_mode: 'deep', // GEO mode ALWAYS uses deep
        geo_mode: true, // V2.0: ALWAYS true
        source: 'opportunity',
        auto_publish: false, // SEMPRE draft
        // Territorial data for GEO
        territoryId: opportunity.territory_id || territory?.id,
        google_place: territory ? {
          official_name: territory.official_name,
          lat: territory.lat,
          lng: territory.lng,
          neighborhood_tags: territory.neighborhood_tags || []
        } : undefined,
        // Links for GEO
        internal_links: internalLinks,
        whatsapp: profile?.whatsapp || null,
        // Parâmetros de estrutura editorial
        article_structure_type: structureType,
        structure_prompt: template?.generation_prompt || null,
        activity_slug: activitySlug,
        // ROTAÇÃO EDITORIAL - Modelo de conteúdo
        editorial_model: editorialModel,
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

    // 4. Verificar que o artigo existe no banco antes de atualizar
    const { data: articleCheck } = await supabase
      .from("articles")
      .select("id")
      .eq("id", articleId)
      .single();

    if (!articleCheck) {
      console.error("[CONVERT] Article not found in database after generation");
      throw new Error("Article was not persisted correctly");
    }

    console.log(`[CONVERT] Article ${articleId} confirmed in database`);

    // 5. Atualizar artigo com opportunity_id e funnel_stage (OBRIGATÓRIO)
    const { error: linkError } = await supabase
      .from("articles")
      .update({
        opportunity_id: opportunityId,
        funnel_stage: opportunity.funnel_stage,
        generation_source: 'opportunity',
      })
      .eq("id", articleId);

    if (linkError) {
      console.error("[CONVERT] CRITICAL: Failed to link article:", linkError);
      // Continue anyway - article exists
    } else {
      console.log(`[CONVERT] Article linked to opportunity successfully`);
    }

    // 6. Mapear e atualizar article_goal (valores em PORTUGUÊS conforme constraint)
    // Constraint: article_goal = ANY (ARRAY['educar', 'autoridade', 'apoiar_vendas', 'converter'])
    const goalMap: Record<string, string> = {
      'lead': 'converter',
      'authority': 'autoridade',
      'conversion': 'converter',
      'educar': 'educar',
      'autoridade': 'autoridade',
      'apoiar_vendas': 'apoiar_vendas',
      'converter': 'converter',
      'seo_traffic': 'educar',
      'engagement': 'educar'
    };
    const mappedGoal = opportunity.goal ? goalMap[opportunity.goal] || null : null;

    if (mappedGoal) {
      const { error: goalError } = await supabase
        .from("articles")
        .update({ article_goal: mappedGoal })
        .eq("id", articleId);

      if (goalError) {
        console.warn("[CONVERT] Goal update failed (non-blocking):", goalError);
      } else {
        console.log(`[CONVERT] Article goal set to: ${mappedGoal}`);
      }
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
