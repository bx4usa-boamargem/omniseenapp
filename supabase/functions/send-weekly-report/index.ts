import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const currentDay = now.getUTCDay();
    const currentHour = now.getUTCHours();

    // Fetch all report settings that should be sent now
    const { data: settings, error: settingsError } = await supabase
      .from("weekly_report_settings")
      .select(`
        *,
        blogs!inner(id, name, slug)
      `)
      .eq("is_enabled", true)
      .eq("send_day", currentDay)
      .eq("send_hour", currentHour);

    if (settingsError) throw settingsError;
    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reports to send at this time" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportsSent: string[] = [];

    for (const setting of settings) {
      // Check if already sent this week
      if (setting.last_sent_at) {
        const lastSent = new Date(setting.last_sent_at);
        const daysSinceLastSent = Math.floor((now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastSent < 6) {
          continue; // Already sent this week
        }
      }

      const blogId = setting.blog_id;
      const blogName = (setting.blogs as { name: string }).name;

      // Calculate date range (last 7 days)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Fetch this week's data
      const { data: thisWeekAnalytics } = await supabase
        .from("article_analytics")
        .select("article_id, time_on_page, read_percentage, scroll_depth")
        .eq("blog_id", blogId)
        .gte("created_at", weekAgo.toISOString());

      const { data: lastWeekAnalytics } = await supabase
        .from("article_analytics")
        .select("article_id")
        .eq("blog_id", blogId)
        .gte("created_at", twoWeeksAgo.toISOString())
        .lt("created_at", weekAgo.toISOString());

      const { data: funnelEvents } = await supabase
        .from("funnel_events")
        .select("event_type")
        .eq("blog_id", blogId)
        .gte("created_at", weekAgo.toISOString());

      const { data: opportunities } = await supabase
        .from("article_opportunities")
        .select("suggested_title, relevance_score")
        .eq("blog_id", blogId)
        .eq("status", "pending")
        .order("relevance_score", { ascending: false })
        .limit(3);

      // Fetch GSC data for insights
      let gscInsights: { 
        topGrowingQueries: { query: string; change: number }[];
        topFallingQueries: { query: string; change: number }[];
        avgPosition: number;
        positionChange: number;
      } | null = null;

      const { data: gscConnection } = await supabase
        .from("gsc_connections")
        .select("is_active")
        .eq("blog_id", blogId)
        .eq("is_active", true)
        .single();

      if (gscConnection && setting.include_gsc_insights !== false) {
        // Get current week queries
        const { data: currentQueries } = await supabase
          .from("gsc_queries_history")
          .select("query, clicks, position")
          .eq("blog_id", blogId)
          .gte("date", weekAgo.toISOString().split("T")[0])
          .order("clicks", { ascending: false })
          .limit(50);

        // Get previous week queries
        const { data: previousQueries } = await supabase
          .from("gsc_queries_history")
          .select("query, clicks, position")
          .eq("blog_id", blogId)
          .gte("date", twoWeeksAgo.toISOString().split("T")[0])
          .lt("date", weekAgo.toISOString().split("T")[0])
          .order("clicks", { ascending: false })
          .limit(50);

        if (currentQueries && previousQueries) {
          // Calculate query changes
          const queryChanges: { query: string; change: number }[] = [];
          for (const current of currentQueries) {
            const prev = previousQueries.find(p => p.query === current.query);
            if (prev) {
              const change = prev.clicks > 0 
                ? Math.round(((current.clicks - prev.clicks) / prev.clicks) * 100)
                : current.clicks > 0 ? 100 : 0;
              queryChanges.push({ query: current.query, change });
            }
          }

          // Sort to get top growing and falling
          const sorted = [...queryChanges].sort((a, b) => b.change - a.change);
          const topGrowingQueries = sorted.filter(q => q.change > 0).slice(0, 5);
          const topFallingQueries = sorted.filter(q => q.change < 0).slice(-5).reverse();

          // Get position data
          const { data: positionData } = await supabase
            .from("gsc_analytics_history")
            .select("position, date")
            .eq("blog_id", blogId)
            .gte("date", twoWeeksAgo.toISOString().split("T")[0])
            .order("date", { ascending: true });

          let avgPosition = 0;
          let positionChange = 0;
          if (positionData && positionData.length > 0) {
            const currentWeekData = positionData.filter(d => d.date >= weekAgo.toISOString().split("T")[0]);
            const previousWeekData = positionData.filter(d => d.date < weekAgo.toISOString().split("T")[0]);
            
            if (currentWeekData.length > 0) {
              avgPosition = currentWeekData.reduce((sum, d) => sum + Number(d.position || 0), 0) / currentWeekData.length;
            }
            if (previousWeekData.length > 0 && currentWeekData.length > 0) {
              const prevAvg = previousWeekData.reduce((sum, d) => sum + Number(d.position || 0), 0) / previousWeekData.length;
              positionChange = prevAvg - avgPosition; // Positive = improvement
            }
          }

          gscInsights = {
            topGrowingQueries,
            topFallingQueries,
            avgPosition: Math.round(avgPosition * 10) / 10,
            positionChange: Math.round(positionChange * 10) / 10,
          };
        }
      }

      // Calculate metrics
      const thisWeekViews = thisWeekAnalytics?.length || 0;
      const lastWeekViews = lastWeekAnalytics?.length || 0;
      const viewsChange = lastWeekViews > 0 
        ? Math.round(((thisWeekViews - lastWeekViews) / lastWeekViews) * 100) 
        : 0;

      let readRate = 0;
      let ctaClicks = 0;
      if (funnelEvents && funnelEvents.length > 0) {
        const pageEnters = funnelEvents.filter((e) => e.event_type === "page_enter").length;
        const scroll100 = funnelEvents.filter((e) => e.event_type === "scroll_100").length;
        ctaClicks = funnelEvents.filter((e) => e.event_type === "cta_click").length;
        if (pageEnters > 0) {
          readRate = Math.round((scroll100 / pageEnters) * 100);
        }
      }

      // Build report content
      let reportHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">
            📊 Relatório Semanal - ${blogName}
          </h1>
          <p style="color: #666;">Período: ${weekAgo.toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}</p>
      `;

      // Add GSC insights section if available
      if (gscInsights) {
        const positionIcon = gscInsights.positionChange > 0 ? "↑" : gscInsights.positionChange < 0 ? "↓" : "→";
        const positionColor = gscInsights.positionChange > 0 ? "#22c55e" : gscInsights.positionChange < 0 ? "#ef4444" : "#666";

        reportHtml += `
          <div style="background: #e0f2fe; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #0369a1; margin-top: 0;">🔍 Insights do Google Search Console</h2>
            <p><strong>Posição Média:</strong> ${gscInsights.avgPosition} <span style="color: ${positionColor};">(${positionIcon}${Math.abs(gscInsights.positionChange)} posições)</span></p>
        `;

        if (gscInsights.topGrowingQueries.length > 0) {
          reportHtml += `<h3 style="color: #166534; margin-bottom: 5px;">📈 Queries em Alta</h3><ul style="padding-left: 20px;">`;
          for (const q of gscInsights.topGrowingQueries.slice(0, 3)) {
            reportHtml += `<li>"${q.query}" <span style="color: #22c55e;">↑${q.change}%</span></li>`;
          }
          reportHtml += `</ul>`;
        }

        if (gscInsights.topFallingQueries.length > 0) {
          reportHtml += `<h3 style="color: #991b1b; margin-bottom: 5px;">⚠️ Queries em Queda</h3><ul style="padding-left: 20px;">`;
          for (const q of gscInsights.topFallingQueries.slice(0, 3)) {
            reportHtml += `<li>"${q.query}" <span style="color: #ef4444;">${q.change}%</span></li>`;
          }
          reportHtml += `</ul>`;
        }

        reportHtml += `</div>`;
      }

      if (setting.include_performance) {
        const changeIcon = viewsChange >= 0 ? "↑" : "↓";
        const changeColor = viewsChange >= 0 ? "#22c55e" : "#ef4444";

        reportHtml += `
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #1e293b; margin-top: 0;">📈 Performance da Semana</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong>Visualizações</strong>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  ${thisWeekViews.toLocaleString('pt-BR')} 
                  <span style="color: ${changeColor};">(${changeIcon}${Math.abs(viewsChange)}%)</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong>Taxa de Leitura</strong>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  ${readRate}%
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0;">
                  <strong>Cliques em CTA</strong>
                </td>
                <td style="padding: 10px 0; text-align: right;">
                  ${ctaClicks}
                </td>
              </tr>
            </table>
          </div>
        `;
      }

      if (setting.include_opportunities && opportunities && opportunities.length > 0) {
        reportHtml += `
          <div style="background: #fef9c3; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #854d0e; margin-top: 0;">💡 Oportunidades Sugeridas</h2>
            <ul style="padding-left: 20px;">
        `;
        for (const opp of opportunities) {
          const stars = "★".repeat(Math.ceil((opp.relevance_score || 0) / 20));
          reportHtml += `<li style="margin-bottom: 10px;">${stars} ${opp.suggested_title}</li>`;
        }
        reportHtml += `</ul></div>`;
      }

      if (setting.include_recommendations) {
        const recommendations: string[] = [];

        if (readRate < 30) {
          recommendations.push("Sua taxa de leitura está baixa. Considere revisar as introduções dos artigos para prender mais a atenção.");
        }
        if (thisWeekViews < lastWeekViews) {
          recommendations.push("As visualizações caíram esta semana. Aumente a divulgação nas redes sociais e email.");
        }
        if (opportunities && opportunities.length > 0) {
          recommendations.push(`Você tem ${opportunities.length} oportunidades de artigos identificadas. Crie conteúdo para aproveitar as tendências!`);
        }
        if (recommendations.length === 0) {
          recommendations.push("Continue o bom trabalho! Mantenha a consistência de publicações.");
        }

        reportHtml += `
          <div style="background: #dcfce7; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #166534; margin-top: 0;">🎯 Próximos Passos Recomendados</h2>
            <ol style="padding-left: 20px;">
        `;
        for (const rec of recommendations) {
          reportHtml += `<li style="margin-bottom: 10px;">${rec}</li>`;
        }
        reportHtml += `</ol></div>`;
      }

      reportHtml += `
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://app.omniseen.app/client/dashboard" 
               style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Ver Dashboard Completo
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            Este é um relatório automático da Omniseen. Para desativar, acesse as configurações.
          </p>
        </div>
      `;

      // Send email via centralized send-email function
      try {
        const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: setting.email_address,
            template: 'weekly_report',
            language: 'pt-BR',
            subject: `📊 Relatório Semanal - ${blogName}`,
            htmlContent: reportHtml,
            blogId,
            variables: {
              blogName,
            },
          }),
        });

        if (!emailResponse.ok) {
          console.error("Error sending email:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }

      // Update last_sent_at
      await supabase
        .from("weekly_report_settings")
        .update({ last_sent_at: now.toISOString() })
        .eq("id", setting.id);

      reportsSent.push(setting.email_address);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportsSent,
        totalSettings: settings.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending weekly reports:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
