import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get optional blog_id from request body
    let targetBlogId: string | null = null;
    try {
      const body = await req.json();
      targetBlogId = body.blogId || null;
    } catch {
      // No body, process all blogs
    }

    // Get all published articles
    let articlesQuery = supabase
      .from('articles')
      .select('id, blog_id')
      .eq('status', 'published');

    if (targetBlogId) {
      articlesQuery = articlesQuery.eq('blog_id', targetBlogId);
    }

    const { data: articles, error: articlesError } = await articlesQuery;

    if (articlesError) {
      console.error('Error fetching articles:', articlesError);
      return new Response(
        JSON.stringify({ error: articlesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No articles to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Get business profiles for value settings
    const blogIds = [...new Set(articles.map(a => a.blog_id))];
    const { data: profiles } = await supabase
      .from('business_profile')
      .select('blog_id, value_per_visibility, value_per_intent')
      .in('blog_id', blogIds);

    const profileMap = new Map(profiles?.map(p => [p.blog_id, p]) || []);

    let processed = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        // Get funnel events for this article today
        const { data: events } = await supabase
          .from('funnel_events')
          .select('event_type')
          .eq('article_id', article.id)
          .gte('created_at', startOfDay.toISOString());

        // Count events
        const counts: Record<string, number> = {};
        events?.forEach(e => {
          counts[e.event_type] = (counts[e.event_type] || 0) + 1;
        });

        const viewsTotal = counts['page_enter'] || 0;
        // Reads = scroll 75%+ (qualified read)
        const readsTotal = (counts['scroll_75'] || 0) + (counts['scroll_100'] || 0);
        const ctaClicks = counts['cta_click'] || 0;

        // Get value settings
        const profile = profileMap.get(article.blog_id);
        const valuePerVisibility = Number(profile?.value_per_visibility) || 5.00;
        const valuePerIntent = Number(profile?.value_per_intent) || 50.00;

        // Calculate values
        const visibilityValue = readsTotal * valuePerVisibility;
        const intentValue = ctaClicks * valuePerIntent;
        const totalValue = visibilityValue + intentValue;

        // Upsert metrics
        const { error: upsertError } = await supabase
          .from('article_conversion_metrics')
          .upsert({
            article_id: article.id,
            blog_id: article.blog_id,
            date: today,
            views_total: viewsTotal,
            reads_total: readsTotal,
            conversion_visibility_count: readsTotal,
            conversion_intent_count: ctaClicks,
            visibility_value: visibilityValue,
            intent_value: intentValue,
            total_value: totalValue,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'article_id,date'
          });

        if (upsertError) {
          console.error(`Error upserting metrics for article ${article.id}:`, upsertError);
          errors++;
        } else {
          processed++;
        }

        // Also update the article counters
        await supabase
          .from('articles')
          .update({
            conversion_visibility_count: readsTotal,
            conversion_intent_count: ctaClicks
          })
          .eq('id', article.id);

      } catch (err) {
        console.error(`Error processing article ${article.id}:`, err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        errors,
        date: today 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Aggregation error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
