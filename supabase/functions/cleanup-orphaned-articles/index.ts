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

  console.log('[cleanup-orphaned-articles] Starting cleanup...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 30 minutes ago
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    console.log(`[cleanup] Looking for articles with status='generating' older than ${thirtyMinAgo}`);

    // Update orphaned placeholders to draft with failed stage
    const { data: updated, error } = await supabase
      .from('articles')
      .update({
        status: 'draft',
        generation_stage: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'generating')
      .lt('created_at', thirtyMinAgo)
      .select('id, blog_id, title, created_at');

    if (error) {
      console.error('[cleanup] Error updating orphaned articles:', error);
      throw error;
    }

    const count = updated?.length || 0;
    console.log(`[cleanup] Recovered ${count} orphaned articles to draft/failed`);

    if (updated && updated.length > 0) {
      updated.forEach(a => {
        console.log(`[cleanup] Recovered article ${a.id} (blog: ${a.blog_id}, title: ${a.title || 'sem título'})`);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        recovered_count: count,
        cutoff: thirtyMinAgo,
        message: `Recovered ${count} orphaned generating articles to draft/failed`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[cleanup] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
