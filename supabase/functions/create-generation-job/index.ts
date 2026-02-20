import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * create-generation-job — OmniSeen Article Engine v1
 * 
 * Validates input, creates job in generation_jobs, checks limits,
 * and triggers orchestrate-generation with confirmed wake.
 * 
 * Hard cap: max 3 simultaneous running jobs per user.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerationInput {
  keyword: string;
  blog_id: string;
  country: string;
  city?: string;
  state?: string;
  language: string;
  niche: string;
  job_type: 'article' | 'super_page';
  intent: 'informational' | 'commercial' | 'transactional' | 'service';
  target_words: number;
  image_count: number;
  brand_voice?: { tone: string; person: string; avoid?: string[] };
  business?: { name: string; phone?: string; whatsapp?: string; website?: string; services?: string[] };
  layout_preferences?: { use_tables: boolean; use_callouts: boolean; use_lists: boolean; use_key_takeaways: boolean };
}

function validateInput(body: Record<string, unknown>): { valid: boolean; input?: GenerationInput; error?: string } {
  const keyword = body.keyword as string;
  const blog_id = body.blog_id as string;

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
    return { valid: false, error: 'keyword is required (min 2 chars)' };
  }
  if (!blog_id || typeof blog_id !== 'string') {
    return { valid: false, error: 'blog_id is required' };
  }

  const input: GenerationInput = {
    keyword: keyword.trim(),
    blog_id,
    country: (body.country as string) || 'BR',
    city: (body.city as string) || undefined,
    state: (body.state as string) || undefined,
    language: (body.language as string) || 'pt-BR',
    niche: (body.niche as string) || 'default',
    job_type: (body.job_type as 'article' | 'super_page') || 'article',
    intent: (body.intent as GenerationInput['intent']) || 'informational',
    target_words: Math.max(800, Math.min(5000, Number(body.target_words) || 2500)),
    image_count: Math.max(1, Math.min(10, Number(body.image_count) || 4)),
    brand_voice: body.brand_voice as GenerationInput['brand_voice'],
    business: body.business as GenerationInput['business'],
    layout_preferences: (body.layout_preferences as GenerationInput['layout_preferences']) || {
      use_tables: true, use_callouts: true, use_lists: true, use_key_takeaways: true,
    },
  };

  return { valid: true, input };
}

// Helper: wait ms
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate input
    const body = await req.json();
    const validation = validateInput(body);
    if (!validation.valid || !validation.input) {
      return new Response(JSON.stringify({ error: `VALIDATION_FAILED: ${validation.error}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const input = validation.input;

    // Check blog ownership
    const { data: blog, error: blogError } = await supabase
      .from('blogs').select('id, user_id').eq('id', input.blog_id).maybeSingle();

    if (blogError || !blog) {
      return new Response(JSON.stringify({ error: "Blog not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Concurrent job limit (max 3)
    const { count: runningCount } = await supabase
      .from('generation_jobs').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).in('status', ['pending', 'running']);

    if ((runningCount || 0) >= 3) {
      return new Response(JSON.stringify({ error: "MAX_CONCURRENT_JOBS: You have 3 jobs running. Wait for one to complete." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: user.id, blog_id: input.blog_id, job_type: input.job_type,
        status: 'pending', input: input as unknown as Record<string, unknown>, max_api_calls: 15,
      })
      .select().single();

    if (jobError || !job) {
      console.error("[CREATE_JOB] Insert error:", jobError);
      return new Response(JSON.stringify({ error: "Failed to create generation job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[CREATE_JOB] ✅ Job ${job.id} created for user ${user.id} | keyword: "${input.keyword}"`);

    // === DOUBLE-START PROTECTION ===
    const { data: running } = await supabase
      .from('generation_jobs')
      .select('id')
      .eq('id', job.id)
      .eq('status', 'running')
      .maybeSingle();

    if (running) {
      console.log(`[ENGINE_ALREADY_RUNNING] job=${job.id}`);
      return new Response(
        JSON.stringify({ success: true, job_id: job.id, status: 'running' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ENGINE WAKE (async-safe, fire-and-forget via invoke) ===
    supabase.functions.invoke(
      'orchestrate-generation',
      { body: { job_id: job.id } }
    ).catch(err =>
      console.error('[ENGINE_WAKE_ASYNC_ERROR]', err)
    );

    console.log(`[ENGINE_WAKE_SENT] job=${job.id}`);

    // === START VERIFICATION (poll for INPUT_VALIDATION) ===
    let started = false;
    for (let i = 0; i < 8; i++) {
      const { data } = await supabase
        .from('generation_steps')
        .select('id')
        .eq('job_id', job.id)
        .eq('step_name', 'INPUT_VALIDATION')
        .maybeSingle();
      if (data) { started = true; break; }
      await sleep(1200);
    }

    if (!started) {
      console.warn(`[ENGINE_NOT_STARTED] job=${job.id}`);
      await supabase.from('generation_jobs').update({
        status: 'failed',
        error_message: 'ENGINE_NOT_STARTED',
        public_message: 'O motor nao iniciou. Tente novamente.',
        completed_at: new Date().toISOString(),
      }).eq('id', job.id);

      return new Response(
        JSON.stringify({ success: false, job_id: job.id, status: 'failed' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        status: 'pending',
        message: 'Generation job created. Track progress via realtime subscription.',
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[CREATE_JOB] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
