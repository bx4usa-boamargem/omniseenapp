import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface DigestRequest {
  type: 'daily' | 'weekly';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret for scheduled calls
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (cronSecret && cronSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { type = 'daily' }: DigestRequest = await req.json().catch(() => ({ type: 'daily' }));
    console.log(`Processing ${type} notification digest...`);

    // Get current hour for digest_time matching
    const currentHour = new Date().getUTCHours();
    const digestTimePattern = `${currentHour.toString().padStart(2, '0')}:%`;

    // Fetch users with matching digest settings
    const { data: settings, error: settingsError } = await supabase
      .from('opportunity_notifications')
      .select(`
        *,
        blogs:blog_id (
          id,
          name,
          platform_subdomain
        )
      `)
      .eq('daily_digest', true)
      .eq('notification_frequency', type)
      .ilike('digest_time', digestTimePattern);

    if (settingsError) {
      console.error('Error fetching notification settings:', settingsError);
      throw settingsError;
    }

    if (!settings || settings.length === 0) {
      console.log('No users scheduled for digest at this time');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    const since = type === 'daily' 
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const setting of settings) {
      try {
        // Get high-score opportunities since last digest
        const { data: opportunities, error: oppsError } = await supabase
          .from('article_opportunities')
          .select('*')
          .eq('blog_id', setting.blog_id)
          .gte('created_at', since)
          .gte('relevance_score', setting.high_score_threshold || 80)
          .order('relevance_score', { ascending: false });

        if (oppsError) {
          console.error(`Error fetching opportunities for blog ${setting.blog_id}:`, oppsError);
          continue;
        }

        if (!opportunities || opportunities.length === 0) {
          console.log(`No high-score opportunities for blog ${setting.blog_id}`);
          continue;
        }

        // Get user's preferred language
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', setting.user_id)
          .maybeSingle();

        const language = profile?.preferred_language || 'pt-BR';
        const blogName = (setting.blogs as any)?.name || 'Seu blog';
        const blogSubdomain = (setting.blogs as any)?.platform_subdomain;

        // Build digest content
        const topOpportunities = opportunities.slice(0, 5);
        const digestSummary = {
          total: opportunities.length,
          top5: topOpportunities.map(o => ({
            title: o.suggested_title,
            score: o.relevance_score,
            keywords: o.suggested_keywords?.slice(0, 3) || []
          }))
        };

        // Send email digest if enabled
        if (setting.notify_email && setting.email_address) {
          const opportunityListHtml = topOpportunities.map(o => 
            `<li><strong>${o.suggested_title}</strong> - ${o.relevance_score}% relevância</li>`
          ).join('');

          const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: setting.email_address,
              template: 'opportunity_digest',
              language,
              variables: {
                blogName,
                periodType: type === 'daily' ? 'diário' : 'semanal',
                totalOpportunities: String(opportunities.length),
                opportunityList: opportunityListHtml,
                dashboardUrl: blogSubdomain 
                  ? `https://${blogSubdomain}.app.omniseen.app/client/consultant`
                  : `https://app.omniseen.app/client/consultant`,
              },
              blogId: setting.blog_id,
              userId: setting.user_id,
            }),
          });

          if (!emailResponse.ok) {
            console.error('Error sending digest email:', await emailResponse.text());
          } else {
            console.log(`Digest email sent to ${setting.email_address}`);
          }
        }

        // Create in-app notification for digest
        if (setting.notify_in_app) {
          const digestTitle = type === 'daily' 
            ? `📊 Resumo Diário: ${opportunities.length} oportunidades`
            : `📊 Resumo Semanal: ${opportunities.length} oportunidades`;

          const digestMessage = `Você tem ${opportunities.length} oportunidades de alto score. ` +
            `A melhor: "${topOpportunities[0]?.suggested_title}" com ${topOpportunities[0]?.relevance_score}% de relevância.`;

          await supabase
            .from('opportunity_notification_history')
            .insert({
              opportunity_id: topOpportunities[0]?.id,
              blog_id: setting.blog_id,
              user_id: setting.user_id,
              notification_type: 'digest',
              title: digestTitle,
              message: digestMessage,
            });
        }

        processedCount++;
        console.log(`Processed digest for blog ${setting.blog_id}: ${opportunities.length} opportunities`);

      } catch (userError) {
        console.error(`Error processing digest for user ${setting.user_id}:`, userError);
      }
    }

    console.log(`Digest processing complete. Processed: ${processedCount}`);

    return new Response(
      JSON.stringify({ success: true, processed: processedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-notification-digest:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
