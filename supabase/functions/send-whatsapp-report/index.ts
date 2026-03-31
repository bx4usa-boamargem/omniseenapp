import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE") || "omniseen";

    if (!evolutionApiUrl || !evolutionApiKey) {
      return new Response(
        JSON.stringify({ error: "WhatsApp API not configured (EVOLUTION_API_URL / EVOLUTION_API_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: settings, error: settingsError } = await supabase
      .from("weekly_report_settings")
      .select(`*, blogs!inner(id, name, slug, user_id)`)
      .eq("is_enabled", true)
      .not("whatsapp_number", "is", null);

    if (settingsError) throw settingsError;
    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No WhatsApp reports configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportsSent: string[] = [];

    for (const setting of settings) {
      const phone = setting.whatsapp_number?.replace(/\D/g, "");
      if (!phone || phone.length < 10) continue;

      if (setting.whatsapp_last_sent_at) {
        const lastSent = new Date(setting.whatsapp_last_sent_at);
        const daysSince = Math.floor((now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince < 6) continue;
      }

      const blogId = setting.blog_id;
      const blogName = (setting.blogs as { name: string }).name;

      const [analyticsRes, articlesRes, funnelRes, gscRes] = await Promise.all([
        supabase
          .from("article_analytics")
          .select("article_id, time_on_page, read_percentage")
          .eq("blog_id", blogId)
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("articles")
          .select("id, title, status")
          .eq("blog_id", blogId)
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("funnel_events")
          .select("event_type")
          .eq("blog_id", blogId)
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("gsc_analytics_history")
          .select("clicks, impressions")
          .eq("blog_id", blogId)
          .gte("date", weekAgo.toISOString().slice(0, 10)),
      ]);

      const views = analyticsRes.data?.length || 0;
      const articlesPublished = articlesRes.data?.filter((a) => a.status === "published").length || 0;
      const articlesGenerated = articlesRes.data?.length || 0;

      const ctaClicks = funnelRes.data?.filter((e) => e.event_type === "cta_click").length || 0;

      let gscClicks = 0;
      let gscImpressions = 0;
      if (gscRes.data) {
        for (const row of gscRes.data) {
          gscClicks += row.clicks || 0;
          gscImpressions += row.impressions || 0;
        }
      }

      const dateRange = `${weekAgo.toLocaleDateString("pt-BR")} - ${now.toLocaleDateString("pt-BR")}`;

      const message = [
        `📊 *Relatório Semanal - ${blogName}*`,
        `📅 ${dateRange}`,
        ``,
        `📈 *Performance*`,
        `• Visualizações: ${views.toLocaleString("pt-BR")}`,
        `• Cliques no Google: ${gscClicks.toLocaleString("pt-BR")}`,
        `• Impressões no Google: ${gscImpressions.toLocaleString("pt-BR")}`,
        `• Cliques em CTA: ${ctaClicks}`,
        ``,
        `✍️ *Conteúdo*`,
        `• Artigos gerados: ${articlesGenerated}`,
        `• Artigos publicados: ${articlesPublished}`,
        ``,
        views === 0
          ? `💡 Dica: publique mais artigos para atrair tráfego orgânico!`
          : gscClicks > 0
          ? `🎉 Seu blog está aparecendo no Google! Continue produzindo conteúdo.`
          : `💡 Dica: os artigos levam algumas semanas para ranquear. Paciência!`,
        ``,
        `🔗 Ver dashboard: https://app.omniseen.app/client/dashboard`,
      ].join("\n");

      try {
        const whatsappRes = await fetch(
          `${evolutionApiUrl}/message/sendText/${evolutionInstance}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionApiKey,
            },
            body: JSON.stringify({
              number: phone.startsWith("55") ? phone : `55${phone}`,
              text: message,
            }),
          }
        );

        if (!whatsappRes.ok) {
          console.error(`[send-whatsapp-report] Failed to send to ${phone}:`, await whatsappRes.text());
          continue;
        }

        await supabase
          .from("weekly_report_settings")
          .update({ whatsapp_last_sent_at: now.toISOString() })
          .eq("id", setting.id);

        reportsSent.push(phone);
      } catch (err) {
        console.error(`[send-whatsapp-report] Error sending to ${phone}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, reportsSent, total: settings.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-whatsapp-report] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
