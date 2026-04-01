import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkJobPayload {
  blogId: string;
  keywords: string[];
  settings?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json() as BulkJobPayload;
    const { blogId, keywords, settings } = payload;

    if (!blogId || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: blogId and non-empty keywords array required." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[BULK-JOB] Starting job for blog ${blogId} with ${keywords.length} keywords.`);

    // 1. Create the generation job record (requires new table `generation_jobs`)
    const { data: jobData, error: jobErr } = await supabase
      .from("generation_jobs")
      .insert({
        blog_id: blogId,
        keywords: keywords,
        status: "pending",
        job_type: "bulk",
        config: settings || {},
        total_articles: keywords.length,
        completed_articles: 0
      })
      .select()
      .single();

    if (jobErr) {
      console.error("[BULK-JOB] Failed to create job record:", jobErr);
      return new Response(JSON.stringify({ error: jobErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }

    const { id: jobId } = jobData;
    let articlesCreated = 0;

    // 2. Insert draft articles and dispatch orchestrator
    for (const kw of keywords) {
      // Create article row
      const { data: article, error: artErr } = await supabase
        .from("articles")
        .insert({
          blog_id: blogId,
          keyword: kw,
          title: `[Bulk] ${kw}`, // temporary title
          status: "draft",
          generation_status: "pending",
          generation_settings: settings || {}
        })
        .select()
        .single();

      if (artErr) {
        console.error(`[BULK-JOB] Failed to create article for keyword ${kw}:`, artErr);
        continue;
      }

      articlesCreated++;

      // Asynchronously trigger orchestrate-generation
      const orchestratorUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/orchestrate-generation`;
      
      // Fire and forget
      fetch(orchestratorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          articleId: article.id,
          keyword: kw,
          action: "generate",
          settings: settings,
          jobId: jobId
        })
      }).catch(err => {
        console.error(`[BULK-JOB] Failed to invoke orchestrator for article ${article.id}:`, err);
      });
    }

    console.log(`[BULK-JOB] Finished. Job ID: ${jobId}, Articles Created: ${articlesCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        articles_created: articlesCreated
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[BULK-JOB] Internal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
