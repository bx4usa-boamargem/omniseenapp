/**
 * generate-article-core — DEPRECATED
 * 
 * This engine is deprecated. All generation must go through:
 * create-generation-job → orchestrate-generation (Engine v1)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.error('[BLOCKED] generate-article-core is DEPRECATED. All generation must go through create-generation-job → orchestrate-generation.');
  return new Response(
    JSON.stringify({ 
      success: false,
      error: 'Motor deprecated. Use o Engine v1 via create-generation-job.',
      redirect: 'create-generation-job'
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
