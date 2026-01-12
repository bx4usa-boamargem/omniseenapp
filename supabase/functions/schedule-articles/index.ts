import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== ANTI-DUPLICAÇÃO: FINGERPRINT SEMÂNTICO (ETAPA 2) ==========
// Portuguese stopwords for semantic fingerprint (paridade com frontend)
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'as', 'os',
  'um', 'uma', 'uns', 'umas', 'para', 'por', 'com', 'em', 'no', 'na',
  'nos', 'nas', 'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'pelos', 'pelas',
  'mais', 'menos', 'seu', 'sua', 'seus', 'suas', 'que', 'como', 'quando',
  'onde', 'se', 'também', 'já', 'ainda', 'muito', 'sobre', 'entre', 'até',
  'desde', 'após', 'sem'
]);

function normalizeForFingerprint(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !STOPWORDS.has(word))
    .join(' ');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Parse request body for immediate flag
  let immediate = false;
  try {
    const body = await req.json();
    immediate = body?.immediate === true;
  } catch {
    // No body or invalid JSON, use defaults
  }

  try {
    console.log(`Starting article scheduling... (immediate: ${immediate})`);

    // Get all active automation settings
    const { data: automations, error: autoError } = await supabase
      .from('blog_automation')
      .select(`
        *,
        blogs (
          id,
          user_id,
          name,
          slug
        )
      `)
      .eq('is_active', true);

    if (autoError) {
      throw new Error(`Failed to fetch automations: ${autoError.message}`);
    }

    if (!automations || automations.length === 0) {
      console.log('No active automations found');
      return new Response(
        JSON.stringify({ scheduled: 0, message: 'No active automations' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${automations.length} active automations`);

    let totalScheduled = 0;
    let totalSkippedDuplicates = 0;

    for (const automation of automations) {
      try {
        // ========== VERIFICAR MODO (ETAPA 3 - RESPEITAR MANUAL) ==========
        const automationMode = automation.mode || 'auto';
        
        // Se modo = 'manual', não agendar nenhum artigo
        if (automationMode === 'manual') {
          console.log(`[SCHEDULE] Skipping blog ${automation.blog_id}: mode is MANUAL`);
          continue;
        }

        // Check if we need to schedule articles based on frequency
        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const preferredDays = automation.preferred_days || ['monday'];

        // Skip if today is not a preferred day (unless immediate mode)
        if (!immediate && !preferredDays.includes(currentDay)) {
          console.log(`Skipping ${automation.blog_id}: ${currentDay} not in preferred days`);
          continue;
        }

        // For immediate mode, always schedule 1 article now
        let articlesToSchedule = immediate ? 1 : automation.articles_per_period;

        if (!immediate) {
          // Check how many articles are already scheduled for today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);

          const { count: todayCount } = await supabase
            .from('article_queue')
            .select('*', { count: 'exact', head: true })
            .eq('blog_id', automation.blog_id)
            .gte('scheduled_for', todayStart.toISOString())
            .lte('scheduled_for', todayEnd.toISOString());

          articlesToSchedule = automation.articles_per_period - (todayCount || 0);
        }

        if (articlesToSchedule <= 0 && !immediate) {
          console.log(`Blog ${automation.blog_id} already has scheduled articles for today`);
          continue;
        }

        // Get existing article titles to avoid duplicates
        const { data: existingArticles } = await supabase
          .from('articles')
          .select('title')
          .eq('blog_id', automation.blog_id)
          .limit(50);

        const existingTitles = existingArticles?.map(a => a.title) || [];

        // Call suggest-themes to get new themes
        const themesResponse = await fetch(`${supabaseUrl}/functions/v1/suggest-themes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            niche: automation.blogs?.name || 'general',
            keywords: automation.niche_keywords || [],
            existingTitles,
            count: articlesToSchedule,
            tone: automation.tone
          }),
        });

        if (!themesResponse.ok) {
          console.error(`Failed to get themes for blog ${automation.blog_id}`);
          continue;
        }

        const themesData = await themesResponse.json();
        const themes = themesData.themes || [];

        if (themes.length === 0) {
          console.log(`No themes generated for blog ${automation.blog_id}`);
          continue;
        }

        // Schedule articles
        const preferredTime = automation.preferred_time || '09:00';
        const [hours, minutes] = preferredTime.split(':').map(Number);

        for (let i = 0; i < themes.length; i++) {
          const theme = themes[i];
          
          // ========== VERIFICAÇÃO ANTI-DUPLICAÇÃO (ETAPA 2) ==========
          const fingerprint = normalizeForFingerprint(theme.title);
          
          // VERIFICAÇÃO 1: Artigo com mesmo fingerprint já existe?
          const { data: existingArticle } = await supabase
            .from('articles')
            .select('id, title')
            .eq('blog_id', automation.blog_id)
            .eq('title_fingerprint', fingerprint)
            .maybeSingle();

          if (existingArticle) {
            console.log(`[SCHEDULE] Skipping - article already exists: "${theme.title}" (fingerprint: ${fingerprint})`);
            totalSkippedDuplicates++;
            continue;
          }

          // VERIFICAÇÃO 2: Tema similar já está na fila com status pending ou generating?
          const { data: existingInQueue } = await supabase
            .from('article_queue')
            .select('id, suggested_theme')
            .eq('blog_id', automation.blog_id)
            .in('status', ['pending', 'generating']);

          const queueHasSimilar = existingInQueue?.some(item => {
            const queueFingerprint = normalizeForFingerprint(item.suggested_theme);
            return queueFingerprint === fingerprint;
          });

          if (queueHasSimilar) {
            console.log(`[SCHEDULE] Skipping - theme already in queue: "${theme.title}" (fingerprint: ${fingerprint})`);
            totalSkippedDuplicates++;
            continue;
          }

          // ========== TEMA APROVADO - INSERIR NA FILA ==========
          let scheduledTime: Date;
          
          if (immediate) {
            // Schedule for right now (minus 1 minute to ensure it's processed immediately)
            scheduledTime = new Date();
            scheduledTime.setMinutes(scheduledTime.getMinutes() - 1);
          } else {
            scheduledTime = new Date();
            scheduledTime.setHours(hours + i, minutes, 0, 0); // Stagger by 1 hour

            // If time already passed, schedule for next occurrence
            if (scheduledTime < now) {
              scheduledTime.setDate(scheduledTime.getDate() + 1);
            }
          }

          const { error: insertError } = await supabase
            .from('article_queue')
            .insert({
              blog_id: automation.blog_id,
              suggested_theme: theme.title,
              keywords: theme.keywords || [],
              status: 'pending',
              scheduled_for: scheduledTime.toISOString()
            });

          if (insertError) {
            console.error(`Failed to schedule article: ${insertError.message}`);
            continue;
          }

          console.log(`Scheduled: "${theme.title}" for ${scheduledTime.toISOString()}`);
          totalScheduled++;
        }

      } catch (blogError) {
        console.error(`Error processing automation for blog ${automation.blog_id}:`, blogError);
      }
    }

    console.log(`Scheduling complete. Total scheduled: ${totalScheduled}, Skipped duplicates: ${totalSkippedDuplicates}`);

    return new Response(
      JSON.stringify({
        scheduled: totalScheduled,
        skipped_duplicates: totalSkippedDuplicates,
        message: `Scheduled ${totalScheduled} articles (${totalSkippedDuplicates} duplicates skipped)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in schedule-articles:', error);
    const message = error instanceof Error ? error.message : 'Failed to schedule articles';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
