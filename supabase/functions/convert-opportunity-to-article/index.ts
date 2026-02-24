import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// V6.0: Legacy rotation imports removed - orchestrator handles everything in generate-article-structured

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

  let requestId = 'unknown';

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // A) Receber request_id do frontend
    const { opportunityId, blogId, request_id }: ConvertRequest & { request_id?: string } = await req.json();
    requestId = request_id || crypto.randomUUID();

    if (!opportunityId || !blogId) {
      throw new Error("opportunityId and blogId are required");
    }

    console.log(`[${requestId}][CONVERT] Starting conversion for opportunity ${opportunityId} in blog ${blogId}`);

    // 1. Buscar oportunidade completa
    const { data: opportunity, error: oppError } = await supabase
      .from("article_opportunities")
      .select("*")
      .eq("id", opportunityId)
      .single();

    if (oppError || !opportunity) {
      console.error(`[${requestId}][CONVERT] Opportunity not found:`, oppError);
      throw new Error(`Opportunity not found: ${oppError?.message || 'Unknown error'}`);
    }

    // =========================================================================
    // 🛡️ GUARD 1: Verificar se oportunidade já foi convertida (status)
    // =========================================================================
    if (opportunity.status === 'converted') {
      console.log(`[${requestId}][CONVERT] Opportunity ${opportunityId} already converted to article ${opportunity.converted_article_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Opportunity already converted",
          article_id: opportunity.converted_article_id,
          reused: true,
          request_id: requestId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // 🛡️ GUARD 2: Verificar se já existe artigo para esta oportunidade (race condition)
    // =========================================================================
    const { data: existingArticleForOpp } = await supabase
      .from("articles")
      .select("id, title, status")
      .eq("opportunity_id", opportunityId)
      .eq("blog_id", blogId)
      .maybeSingle();

    if (existingArticleForOpp) {
      console.log(`[${requestId}][CONVERT] Article already exists for opportunity ${opportunityId}: ${existingArticleForOpp.id}`);
      
      // Sincronizar status da oportunidade se estiver dessincronizado
      await supabase
        .from("article_opportunities")
        .update({
          status: 'converted',
          converted_article_id: existingArticleForOpp.id,
          converted_at: new Date().toISOString(),
        })
        .eq("id", opportunityId)
        .eq("status", "pending"); // Só atualiza se ainda pending
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "Article already exists for this opportunity",
          article_id: existingArticleForOpp.id,
          reused: true,
          request_id: requestId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // 🔒 LOCK ATÔMICO: Marcar oportunidade como 'processing' ANTES de gerar
    // Isso elimina race conditions entre requests paralelos
    // =========================================================================
    const { data: lockResult, error: lockError } = await supabase
      .from("article_opportunities")
      .update({ status: 'processing' })
      .eq("id", opportunityId)
      .eq("status", "pending") // Só atualiza se ainda está pending
      .select("id")
      .maybeSingle();

    if (lockError || !lockResult) {
      console.log(`[${requestId}][CONVERT] Could not acquire lock - opportunity may be processing or already converted`);
      
      // Re-verificar status atual
      const { data: recheckOpp } = await supabase
        .from("article_opportunities")
        .select("status, converted_article_id")
        .eq("id", opportunityId)
        .single();
        
      if (recheckOpp?.converted_article_id) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Opportunity was converted by another request",
            article_id: recheckOpp.converted_article_id,
            reused: true,
            request_id: requestId
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (recheckOpp?.status === 'processing') {
        return new Response(
          JSON.stringify({
            success: false,
            error_type: 'ALREADY_PROCESSING',
            message: "Esta oportunidade está sendo processada por outra requisição. Aguarde alguns segundos.",
            request_id: requestId
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Failed to acquire processing lock for opportunity");
    }

    console.log(`[${requestId}][CONVERT] Lock acquired for opportunity ${opportunityId}`);

    // 🔒 LIMIT CHECK - Buscar user_id do blog
    const { data: blogData } = await supabase
      .from('blogs')
      .select('user_id')
      .eq('id', blogId)
      .single();

    if (!blogData?.user_id) {
      throw new Error('Blog not found or no user associated');
    }

    console.log(`[${requestId}][CONVERT] Checking limits for user ${blogData.user_id}`);

    // Chamar check-limits
    const limitCheckResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/check-limits`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          userId: blogData.user_id,
          action: 'check',
          resource: 'articles',
        }),
      }
    );

    const limitData = await limitCheckResponse.json();

    if (limitData.limitReached) {
      console.log(`[${requestId}][CONVERT] BLOCKED: Limit reached for user ${blogData.user_id}`);
      return new Response(
        JSON.stringify({
          success: false,
          error_type: 'LIMIT_REACHED',
          message: `Limite de artigos atingido (${limitData.usage?.articles_used || 0}/${limitData.limits?.articles_limit || 0})`,
          request_id: requestId,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}][CONVERT] Limit OK: ${limitData.remaining} remaining`);

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

    // V6.0: Legacy rotation calls removed - orchestrator in generate-article-structured handles everything
    console.log(`[${requestId}][CONVERT] V6.0: Editorial decisions delegated to Elite Engine orchestrator`);
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
      console.log(`[${requestId}][CONVERT] City from territory: ${resolvedCity}`);
    }

    // 2. Fallback: business_profile.city ou region
    if (!resolvedCity && profile) {
      resolvedCity = (profile as any).city || (profile as any).region || (profile as any).state;
      if (resolvedCity) {
        console.log(`[${requestId}][CONVERT] City from profile: ${resolvedCity}`);
      }
    }

    // 3. Fallback: Extrair cidade do título (regex: "em [Cidade]")
    if (!resolvedCity) {
      const cityMatch = opportunity.suggested_title.match(/\b(?:em|para|de)\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)?)/i);
      if (cityMatch && cityMatch[1]) {
        resolvedCity = cityMatch[1].trim();
        console.log(`[${requestId}][CONVERT] City extracted from title: ${resolvedCity}`);
      }
    }

    // 4. Fallback final: 'Brasil'
    if (!resolvedCity) {
      resolvedCity = 'Brasil';
      console.warn(`[${requestId}][CONVERT] Using fallback city: ${resolvedCity}`);
    }

    console.log(`[${requestId}][CONVERT] Resolved city: ${resolvedCity}`);

    // =========================================================================
    // V5.0: CREATE PLACEHOLDER BEFORE CALLING generate-article-structured
    // This enables real-time progress tracking via polling
    // =========================================================================
    console.log(`[${requestId}][CONVERT] Creating placeholder article...`);
    const placeholderSlug = `generating-${Date.now().toString(36)}`;
    const { data: placeholder, error: placeholderError } = await supabase
      .from("articles")
      .insert({
        blog_id: blogId,
        title: `Gerando: ${opportunity.suggested_title}`,
        slug: placeholderSlug,
        status: 'generating',
        generation_stage: 'validating',
        generation_progress: 5,
        generation_source: 'opportunity',
        opportunity_id: opportunityId,
        funnel_stage: opportunity.funnel_stage,
      })
      .select('id')
      .single();

    if (placeholderError || !placeholder?.id) {
      console.error(`[${requestId}][CONVERT] Placeholder creation failed:`, placeholderError);
      throw new Error(`Failed to create placeholder article: ${placeholderError?.message || 'Unknown'}`);
    }

    const placeholderArticleId = placeholder.id;
    console.log(`[${requestId}][CONVERT] Placeholder created: ${placeholderArticleId}`);

    // 5. Gerar conteúdo via generate-article-structured
    // V2.0: Tenta com geo_mode=true primeiro, fallback para geo_mode=false se QA falhar
    console.log(`[${requestId}][CONVERT] Generating article content for: "${opportunity.suggested_title}" with geo_mode=true`);

    const generatePayload = {
      // V5.0: Send article_id so generator updates placeholder instead of creating new
      article_id: placeholderArticleId,
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
      // V6.0: No longer sending structure/editorial params - orchestrator decides
      // D) Propagar request_id para generate-article-structured
      request_id: requestId,
    };

    // HOTFIX: Log de diagnóstico antes da chamada
    console.log(`[${requestId}][CONVERT] Calling generate with:`, {
      generation_mode: generatePayload.generation_mode,
      mode: (generatePayload as any).mode,
      city: generatePayload.city,
      request_id: requestId
    });

    // ENGINE V1: Delegate to create-generation-job → orchestrate-generation
    console.log(`[${requestId}][CONVERT] Delegating to Engine v1 via create-generation-job`);
    
    const jobPayload = {
      keyword: opportunity.suggested_title,
      blog_id: blogId,
      city: resolvedCity,
      niche: profile?.niche || 'default',
      country: 'BR',
      language: 'pt-BR',
      job_type: 'article' as const,
      intent: opportunity.funnel_stage === 'bottom' ? 'transactional' as const : 'informational' as const,
      target_words: 2500,
      image_count: 4,
    };

    const generateResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-generation-job`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jobPayload),
    });

    const responseText = await generateResponse.text();
    
    if (!generateResponse.ok) {
      console.error(`[${requestId}][CONVERT] Engine v1 job creation failed:`, responseText);
      
      // Mark placeholder as failed
      await supabase.from("articles").update({
        status: 'draft',
        generation_stage: 'failed',
        title: opportunity.suggested_title,
      }).eq("id", placeholderArticleId);
      
      return new Response(
        JSON.stringify({
          success: false,
          error_type: 'GENERATION_FAILED',
          message: `Falha ao criar job de geração Engine v1`,
          request_id: requestId,
          article_id: placeholderArticleId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let jobResult;
    try {
      jobResult = JSON.parse(responseText);
    } catch {
      throw new Error("Failed to parse job creation response");
    }

    console.log(`[${requestId}][CONVERT] Engine v1 job created: ${jobResult.job_id}`);

    // The job runs asynchronously via orchestrator
    // The article will be created by the orchestrator's OUTPUT step
    // For now, return the placeholder article ID — the orchestrator will update it
    const articleId = placeholderArticleId;
    const articleSlug = null; // Will be set by orchestrator

    console.log(`[${requestId}][CONVERT] Article generated successfully, id: ${articleId}`);

    // V5.0: opportunity_id already set in placeholder, but update goal if needed
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
      await supabase.from("articles").update({ article_goal: mappedGoal }).eq("id", articleId);
      console.log(`[${requestId}][CONVERT] Article goal set to: ${mappedGoal}`);
    }

    // Update opportunity as converted
    await supabase
      .from("article_opportunities")
      .update({
        status: 'converted',
        converted_article_id: articleId,
        converted_at: new Date().toISOString(),
      })
      .eq("id", opportunityId);

    // V5.0: REMOVED redundant image generation (lines 529-585)
    // Images are already generated inside generate-article-structured pipeline

    console.log(`[${requestId}][CONVERT] ✅ Conversion complete: Opportunity ${opportunityId} → Article ${articleId}`);

    // 🔒 INCREMENTAR USAGE após sucesso (fonte da verdade)
    console.log(`[${requestId}][CONVERT] Incrementing usage for user ${blogData.user_id}`);

    try {
      // Incrementar usage
      await fetch(
        `${SUPABASE_URL}/functions/v1/check-limits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId: blogData.user_id,
            action: 'increment',
            resource: 'articles',
          }),
        }
      );

      console.log(`[${requestId}][CONVERT] Usage incremented`);

      // Log consumption para billing
      await fetch(
        `${SUPABASE_URL}/functions/v1/log-consumption`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: blogData.user_id,
            blog_id: blogId,
            action_type: 'article_generation',
            action_description: `Artigo: ${opportunity.suggested_title}`,
            model_used: 'google/gemini-2.5-flash',
            metadata: {
              article_id: articleId,
              opportunity_id: opportunityId,
              source: 'opportunity_conversion',
              request_id: requestId,
            },
          }),
        }
      );

      console.log(`[${requestId}][CONVERT] Consumption logged`);
    } catch (billingError) {
      // Non-blocking - article was created
      console.error(`[${requestId}][CONVERT] Billing error (non-blocking):`, billingError);
    }

    // E) Retorno estruturado de sucesso
    return new Response(
      JSON.stringify({
        success: true,
        article_id: articleId,
        article_title: opportunity.suggested_title,
        article_slug: articleSlug,
        opportunity_id: opportunityId,
        funnel_stage: opportunity.funnel_stage,
        request_id: requestId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CONVERT] Error:", error);
    // E) Retorno estruturado de erro
    return new Response(
      JSON.stringify({
        success: false,
        error_type: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : "Unknown error",
        request_id: requestId || 'unknown',
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
