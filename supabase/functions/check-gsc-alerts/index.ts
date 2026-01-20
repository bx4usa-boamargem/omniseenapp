import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertCheckRequest {
  blogId?: string;
}

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
    const { blogId }: AlertCheckRequest = await req.json().catch(() => ({}));

    // Get active alerts
    let alertsQuery = supabase
      .from("gsc_ranking_alerts")
      .select("*, blogs!inner(name)")
      .eq("is_active", true);

    if (blogId) {
      alertsQuery = alertsQuery.eq("blog_id", blogId);
    }

    const { data: alerts, error: alertsError } = await alertsQuery;

    if (alertsError) throw alertsError;
    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active alerts configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const triggeredAlerts: any[] = [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Group alerts by blog_id for efficiency
    const blogIds = [...new Set(alerts.map(a => a.blog_id))];

    for (const currentBlogId of blogIds) {
      const blogAlerts = alerts.filter(a => a.blog_id === currentBlogId);
      const blogName = (blogAlerts[0].blogs as any)?.name || "Blog";

      // Fetch current period data
      const { data: currentData } = await supabase
        .from("gsc_analytics_history")
        .select("clicks, impressions, position")
        .eq("blog_id", currentBlogId)
        .gte("date", weekAgo.toISOString().split("T")[0])
        .lte("date", now.toISOString().split("T")[0]);

      // Fetch previous period data
      const { data: previousData } = await supabase
        .from("gsc_analytics_history")
        .select("clicks, impressions, position")
        .eq("blog_id", currentBlogId)
        .gte("date", twoWeeksAgo.toISOString().split("T")[0])
        .lt("date", weekAgo.toISOString().split("T")[0]);

      if (!currentData || !previousData || currentData.length === 0 || previousData.length === 0) {
        continue;
      }

      // Calculate metrics
      const currentClicks = currentData.reduce((sum, d) => sum + (d.clicks || 0), 0);
      const previousClicks = previousData.reduce((sum, d) => sum + (d.clicks || 0), 0);
      const currentImpressions = currentData.reduce((sum, d) => sum + (d.impressions || 0), 0);
      const previousImpressions = previousData.reduce((sum, d) => sum + (d.impressions || 0), 0);
      const currentPosition = currentData.reduce((sum, d) => sum + (d.position || 0), 0) / currentData.length;
      const previousPosition = previousData.reduce((sum, d) => sum + (d.position || 0), 0) / previousData.length;

      // Check each alert type
      for (const alert of blogAlerts) {
        let shouldTrigger = false;
        let changePercent = 0;
        let previousValue = 0;
        let currentValue = 0;
        let message = "";

        switch (alert.alert_type) {
          case "clicks_drop":
            if (previousClicks > 0) {
              changePercent = ((currentClicks - previousClicks) / previousClicks) * 100;
              shouldTrigger = changePercent <= -alert.threshold_percent;
              previousValue = previousClicks;
              currentValue = currentClicks;
              message = `Queda de cliques: ${previousClicks} → ${currentClicks} (${changePercent.toFixed(1)}%)`;
            }
            break;

          case "impressions_drop":
            if (previousImpressions > 0) {
              changePercent = ((currentImpressions - previousImpressions) / previousImpressions) * 100;
              shouldTrigger = changePercent <= -alert.threshold_percent;
              previousValue = previousImpressions;
              currentValue = currentImpressions;
              message = `Queda de impressões: ${previousImpressions} → ${currentImpressions} (${changePercent.toFixed(1)}%)`;
            }
            break;

          case "position_drop":
            // For position, higher number is worse
            const positionDiff = currentPosition - previousPosition;
            changePercent = positionDiff;
            shouldTrigger = positionDiff >= alert.threshold_percent;
            previousValue = previousPosition;
            currentValue = currentPosition;
            message = `Queda de posição: ${previousPosition.toFixed(1)} → ${currentPosition.toFixed(1)} (+${positionDiff.toFixed(1)} posições)`;
            break;
        }

        if (shouldTrigger) {
          // Check if already triggered recently (within 24 hours)
          if (alert.last_triggered_at) {
            const lastTriggered = new Date(alert.last_triggered_at);
            const hoursSinceLastTrigger = (now.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastTrigger < 24) {
              continue;
            }
          }

          // Record alert in history
          await supabase.from("gsc_alert_history").insert({
            alert_id: alert.id,
            blog_id: currentBlogId,
            metric_type: alert.alert_type,
            previous_value: previousValue,
            current_value: currentValue,
            change_percent: changePercent,
            message,
          });

          // Update last triggered timestamp
          await supabase
            .from("gsc_ranking_alerts")
            .update({ last_triggered_at: now.toISOString() })
            .eq("id", alert.id);

          triggeredAlerts.push({
            alertId: alert.id,
            blogId: currentBlogId,
            blogName,
            type: alert.alert_type,
            message,
            email: alert.notification_email,
          });

          // Send email notification via centralized send-email function
          if (alert.notification_email) {
            try {
              const alertHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">
                    ⚠️ Alerta de Ranking
                  </h1>
                  <p style="color: #666;">Blog: ${blogName}</p>
                  <div style="background: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h2 style="color: #991b1b; margin-top: 0;">Detalhes do Alerta</h2>
                    <p style="font-size: 16px; color: #1e293b;">${message}</p>
                    <p style="color: #666;">
                      Período comparado: última semana vs semana anterior
                    </p>
                  </div>
                  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #1e293b; margin-top: 0;">Recomendações</h3>
                    <ul style="color: #666;">
                      <li>Verifique se houve alterações técnicas no site</li>
                      <li>Analise os artigos afetados e suas palavras-chave</li>
                      <li>Considere atualizar o conteúdo existente</li>
                      <li>Verifique a concorrência nas SERPs</li>
                    </ul>
                  </div>
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="https://app.omniseen.app/client/seo" 
                       style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                      Ver Dashboard de SEO
                    </a>
                  </div>
                </div>
              `;

              await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: alert.notification_email,
                  template: 'gsc_alert',
                  language: 'pt-BR',
                  subject: `⚠️ Alerta de SEO - ${blogName}`,
                  htmlContent: alertHtml,
                  blogId: currentBlogId,
                  variables: {
                    blogName,
                    message,
                  },
                }),
              });
            } catch (emailError) {
              console.error("Error sending alert email:", emailError);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertsChecked: alerts.length,
        triggeredAlerts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking GSC alerts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
