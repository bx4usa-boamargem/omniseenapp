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

    // ========================================================================
    // CITY FALLBACK CHAIN: territory → profile → extracted from title → Brasil
    // ========================================================================
    let resolvedCity: string | undefined;

    // 1. Tentar do território
    if (territory?.official_name) {
      resolvedCity = territory.official_name;
      console.log(`[CONVERT] City from territory: ${resolvedCity}`);
    }

    // 2. Fallback: business_profile.city ou region
    if (!resolvedCity && profile) {
      resolvedCity = (profile as any).city || (profile as any).region || (profile as any).state;
      if (resolvedCity) {
        console.log(`[CONVERT] City from profile: ${resolvedCity}`);
      }
    }

    // 3. Fallback: Extrair cidade do título (regex: "em [Cidade]")
    if (!resolvedCity) {
      const cityMatch = opportunity.suggested_title.match(/\b(?:em|para|de)\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)?)/i);
      if (cityMatch && cityMatch[1]) {
        resolvedCity = cityMatch[1].trim();
        console.log(`[CONVERT] City extracted from title: ${resolvedCity}`);
      }
    }

    // 4. Fallback final: 'Brasil'
    if (!resolvedCity) {
      resolvedCity = 'Brasil';
      console.warn(`[CONVERT] Using fallback city: ${resolvedCity}`);
    }

    console.log(`[CONVERT] Resolved city: ${resolvedCity}`);

    // 5. Gerar conteúdo via generate-article-structured
    // V2.0: Tenta com geo_mode=true primeiro, fallback para geo_mode=false se QA falhar
    console.log(`[CONVERT] Generating article content for: "${opportunity.suggested_title}" with geo_mode=true`);

    const generatePayload = {
      blog_id: blogId,
      theme: opportunity.suggested_title,
      keywords: opportunity.suggested_keywords || [],
      word_count: 1500, // GEO mode requires 1200-3000 words
      include_faq: true,
      include_conclusion: true,
      generation_mode: 'fast',  // HOTFIX: Mudado de 'deep' para 'fast'
      mode: 'entry',            // HOTFIX: Força thresholds permissivos do Quality Gate
      geo_mode: true, // V2.0: Try with GEO first
      source: 'opportunity',
      auto_publish: false, // SEMPRE draft
      // ===== CORREÇÃO: city, niche e businessName explícitos =====
      city: resolvedCity,
      niche: profile?.niche || 'pest_control',
      businessName: profile?.company_name || undefined,
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
    };

    // HOTFIX: Log de diagnóstico antes da chamada
    console.log('[CONVERT] Calling generate with:', {
      generation_mode: generatePayload.generation_mode,
      mode: (generatePayload as any).mode,
      city: generatePayload.city
    });

    let generateResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-article-structured`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(generatePayload),
    });

    // Parse response body as text first to debug
    let responseText = await generateResponse.text();
    
    // FALLBACK: If QA failed (422), retry without geo_mode
    if (generateResponse.status === 422) {
      console.warn("[CONVERT] GEO mode QA failed, retrying with geo_mode=false (fallback)...");
      
      const fallbackPayload = {
        ...generatePayload,
        generation_mode: 'fast',
        mode: 'entry',  // HOTFIX: Alinhar mode com generation_mode fast
        geo_mode: false,
        word_count: 800,
      };
      
      generateResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-article-structured`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fallbackPayload),
      });
      
      responseText = await generateResponse.text();
      
      if (generateResponse.ok) {
        console.log("[CONVERT] Fallback generation succeeded");
      }
    }
    
    if (!generateResponse.ok) {
      console.error("[CONVERT] Article generation failed:", responseText);
      
      // Try to parse error for better messaging
      try {
        const errorData = JSON.parse(responseText);
        // Return 422 as-is (QA failure), other errors as 500
        const statusCode = generateResponse.status === 422 ? 422 : 500;
        return new Response(
          JSON.stringify({
            success: false,
            error: errorData.error || "GENERATION_FAILED",
            message: errorData.message || `Falha na geração do artigo (${generateResponse.status})`,
            debug: errorData.debug || null,
          }),
          { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: "GENERATION_FAILED",
            message: `Falha na geração do artigo (${generateResponse.status})`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
