import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * FUNNEL-AUTOPILOT
 * 
 * Edge function que executa diariamente para blogs com funnel_autopilot = true.
 * Converte automaticamente N oportunidades de maior score por estágio do funil.
 * Artigos são SEMPRE criados como DRAFT (nunca publicados automaticamente).
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET");

    // Validate cron secret for scheduled runs
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization");
    
    const isValidCron = CRON_SECRET && cronSecret === CRON_SECRET;
    const isValidAuth = authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY);
    
    if (!isValidCron && !isValidAuth) {
      console.log("[AUTOPILOT] Unauthorized request");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[AUTOPILOT] Starting funnel autopilot run...");

    // 1. Buscar blogs com autopilot ativado
    const { data: automations, error: autoError } = await supabase
      .from("blog_automation")
      .select("blog_id, autopilot_top, autopilot_middle, autopilot_bottom")
      .eq("funnel_autopilot", true)
      .eq("is_active", true);

    if (autoError) {
      console.error("[AUTOPILOT] Failed to fetch automations:", autoError);
      throw new Error(`Failed to fetch automations: ${autoError.message}`);
    }

    if (!automations || automations.length === 0) {
      console.log("[AUTOPILOT] No blogs with funnel_autopilot enabled");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No blogs with funnel_autopilot enabled",
          blogs_processed: 0,
          articles_created: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalArticlesCreated = 0;
    const results: Array<{ blog_id: string; articles_created: number; errors: string[] }> = [];

    // 2. Para cada blog com autopilot ativo
    for (const automation of automations) {
      const { blog_id, autopilot_top, autopilot_middle, autopilot_bottom } = automation;
      const blogErrors: string[] = [];
      let blogArticlesCreated = 0;

      console.log(`[AUTOPILOT] Processing blog ${blog_id}: top=${autopilot_top}, middle=${autopilot_middle}, bottom=${autopilot_bottom}`);

      // Processar cada estágio do funil
      const stages = [
        { stage: 'topo', count: autopilot_top || 0 },
        { stage: 'meio', count: autopilot_middle || 0 },
        { stage: 'fundo', count: autopilot_bottom || 0 },
      ];

      for (const { stage, count } of stages) {
        if (count <= 0) continue;

        // Buscar top N oportunidades do estágio
        const { data: opportunities, error: oppError } = await supabase
          .from("article_opportunities")
          .select("id")
          .eq("blog_id", blog_id)
          .eq("funnel_stage", stage)
          .in("status", ["pending", "approved"])
          .order("relevance_score", { ascending: false })
          .limit(count);

        if (oppError) {
          console.error(`[AUTOPILOT] Failed to fetch ${stage} opportunities:`, oppError);
          blogErrors.push(`Failed to fetch ${stage} opportunities: ${oppError.message}`);
          continue;
        }

        if (!opportunities || opportunities.length === 0) {
          console.log(`[AUTOPILOT] No open ${stage} opportunities for blog ${blog_id}`);
          continue;
        }

        // Converter cada oportunidade
        for (const opp of opportunities) {
          try {
            const convertResponse = await fetch(`${SUPABASE_URL}/functions/v1/convert-opportunity-to-article`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                opportunityId: opp.id,
                blogId: blog_id,
              }),
            });

            if (convertResponse.ok) {
              const convertResult = await convertResponse.json();
              const articleId = convertResult.article_id;

              // Run Quality Gate on the new article
              if (articleId) {
                try {
                  const gateResponse = await fetch(`${SUPABASE_URL}/functions/v1/quality-gate`, {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      articleId,
                      blogId: blog_id,
                    }),
                  });

                  if (gateResponse.ok) {
                    const gateResult = await gateResponse.json();
                    
                    if (gateResult.approved) {
                      // Get publish delay from automation settings
                      const { data: autoSettings } = await supabase
                        .from("blog_automation")
                        .select("publish_delay_hours")
                        .eq("blog_id", blog_id)
                        .single();
                      
                      const delayHours = autoSettings?.publish_delay_hours || 24;
                      const readyAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();

                      // Mark as ready for publish
                      await supabase
                        .from("articles")
                        .update({
                          status: "ready_for_publish",
                          ready_for_publish_at: readyAt,
                          quality_gate_status: "approved",
                        })
                        .eq("id", articleId);

                      console.log(`[AUTOPILOT] ✅ Article ${articleId} approved, ready at ${readyAt}`);
                    } else if (gateResult.auto_fixable) {
                      // Attempt auto-fix
                      await fetch(`${SUPABASE_URL}/functions/v1/auto-fix-article`, {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          articleId,
                          blogId: blog_id,
                          fix_suggestions: gateResult.fix_suggestions,
                          current_content: gateResult.fixed_content || "",
                          attempt_number: 1,
                        }),
                      });
                      console.log(`[AUTOPILOT] ⚠️ Article ${articleId} sent for auto-fix`);
                    } else {
                      console.log(`[AUTOPILOT] ❌ Article ${articleId} blocked by Quality Gate`);
                    }
                  }
                } catch (gateError) {
                  console.error(`[AUTOPILOT] Quality Gate error for ${articleId}:`, gateError);
                }
              }

              blogArticlesCreated++;
              totalArticlesCreated++;
              console.log(`[AUTOPILOT] ✅ Converted ${stage} opportunity ${opp.id}`);
            } else {
              const errorText = await convertResponse.text();
              console.error(`[AUTOPILOT] Failed to convert opportunity ${opp.id}:`, errorText);
              blogErrors.push(`Failed to convert ${stage} opportunity: ${opp.id}`);
            }
          } catch (convertError) {
            console.error(`[AUTOPILOT] Error converting opportunity ${opp.id}:`, convertError);
            blogErrors.push(`Error converting ${stage} opportunity: ${opp.id}`);
        }
      }
    }

      results.push({
        blog_id,
        articles_created: blogArticlesCreated,
        errors: blogErrors,
      });

      // Criar notificação para o blog se artigos foram criados
      if (blogArticlesCreated > 0) {
        const { data: blog } = await supabase
          .from("blogs")
          .select("user_id")
          .eq("id", blog_id)
          .single();

        if (blog?.user_id) {
          await supabase.from("automation_notifications").insert({
            blog_id,
            user_id: blog.user_id,
            notification_type: "autopilot_articles",
            title: `${blogArticlesCreated} artigos criados pelo Autopilot`,
            message: `O sistema gerou automaticamente ${blogArticlesCreated} artigo(s) baseado(s) em oportunidades do Radar de Mercado. Revise e publique quando estiver pronto.`,
          });
        }
      }
    }

    console.log(`[AUTOPILOT] ✅ Run complete. Total articles created: ${totalArticlesCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        blogs_processed: automations.length,
        articles_created: totalArticlesCreated,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AUTOPILOT] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
