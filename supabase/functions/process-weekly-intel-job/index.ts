import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function getStartOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate via CRON_SECRET
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret || cronSecret !== expectedSecret) {
      console.error("Unauthorized: Invalid or missing CRON_SECRET");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ALLOW_MULTIPLE = Deno.env.get("ALLOW_MULTIPLE_WEEKLY_CALLS") === "true";

    console.log(`[INTEL JOB] Starting weekly intel processing...`);
    console.log(`[INTEL JOB] Mode: ${ALLOW_MULTIPLE ? "TEST (multiple calls allowed)" : "PRODUCTION (1 call/week/blog)"}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const weekOf = getStartOfWeek();

    // Fetch active blogs with business_profile
    const { data: blogs, error: blogsError } = await supabase
      .from("blogs")
      .select(`
        id, user_id, name, slug,
        business_profile!inner(
          id, niche, target_audience, tone_of_voice,
          country, company_name, whatsapp, city, services
        )
      `);

    if (blogsError) {
      console.error("Failed to fetch blogs:", blogsError);
      throw new Error(`Failed to fetch blogs: ${blogsError.message}`);
    }

    if (!blogs || blogs.length === 0) {
      console.log("[INTEL JOB] No active blogs with business_profile found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No blogs to process",
          processed: 0,
          skipped: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[INTEL JOB] Found ${blogs.length} active blogs to process for week ${weekOf}`);

    const results = {
      processed: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{ blog_id: string; status: string; message?: string }>
    };

    for (const blog of blogs) {
      const blogId = blog.id;
      const blogName = blog.name || blog.slug;

      try {
        // Check if intel already exists for this week
        const { data: existingIntel } = await supabase
          .from("market_intel_weekly")
          .select("id")
          .eq("blog_id", blogId)
          .eq("week_of", weekOf)
          .maybeSingle();

        if (existingIntel && !ALLOW_MULTIPLE) {
          console.log(`[PROD MODE] Blog ${blogName} (${blogId}) already has intel for week ${weekOf}, skipping`);
          results.skipped++;
          results.details.push({ blog_id: blogId, status: "skipped", message: "Intel already exists" });
          continue;
        }

        if (existingIntel && ALLOW_MULTIPLE) {
          console.log(`[TEST MODE] Blog ${blogName} (${blogId}) already has intel but ALLOW_MULTIPLE=true, regenerating`);
          // Delete previous intel to avoid constraint violation
          await supabase.from("market_intel_weekly").delete().eq("id", existingIntel.id);
        }

        console.log(`[INTEL JOB] Processing blog: ${blogName} (${blogId})`);

        // Call weekly-market-intel function with processAllTerritories flag
        const intelResponse = await fetch(`${SUPABASE_URL}/functions/v1/weekly-market-intel`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            blogId,
            forceRegenerate: ALLOW_MULTIPLE,
            processAllTerritories: true // Process all active territories
          }),
        });

        if (!intelResponse.ok) {
          const errorText = await intelResponse.text();
          console.error(`[INTEL JOB] Failed for blog ${blogName}:`, errorText);
          results.failed++;
          results.details.push({ blog_id: blogId, status: "failed", message: errorText });
          
          // Log failed attempt
          await supabase.from("ai_usage_logs").insert({
            blog_id: blogId,
            provider: "unknown",
            endpoint: "process-weekly-intel-job",
            cost_usd: 0,
            success: false,
            error_message: `Failed to process: ${errorText}`
          });
          
          continue;
        }

        const intelData = await intelResponse.json();

        if (!intelData.success) {
          console.error(`[INTEL JOB] Intel generation failed for blog ${blogName}:`, intelData.error);
          results.failed++;
          results.details.push({ blog_id: blogId, status: "failed", message: intelData.error });
          continue;
        }

        // Create opportunities from content_ideas
        const contentIdeas = intelData.content_ideas || [];
        let opportunitiesCreated = 0;

        for (const idea of contentIdeas) {
          const { error: oppError } = await supabase.from("article_opportunities").insert({
            blog_id: blogId,
            suggested_title: idea.title,
            suggested_keywords: idea.keywords || [],
            source: "trends",
            origin: intelData.source || "perplexity",
            source_urls: idea.sources || [],
            why_now: idea.why_now || null,
            goal: idea.goal || null,
            intel_week_id: intelData.id,
            status: "pending"
          });

          if (!oppError) {
            opportunitiesCreated++;
          } else {
            console.warn(`[INTEL JOB] Failed to create opportunity for blog ${blogName}:`, oppError);
          }
        }

        console.log(`[INTEL JOB] Blog ${blogName}: Intel saved, ${opportunitiesCreated} opportunities created`);
        results.processed++;
        results.details.push({ 
          blog_id: blogId, 
          status: "processed", 
          message: `${opportunitiesCreated} opportunities created` 
        });

        // Rate limiting: 2 seconds between blogs
        if (blogs.indexOf(blog) < blogs.length - 1) {
          console.log("[INTEL JOB] Rate limiting: waiting 2s before next blog...");
          await delay(2000);
        }

      } catch (blogError) {
        console.error(`[INTEL JOB] Error processing blog ${blogName}:`, blogError);
        results.failed++;
        results.details.push({ 
          blog_id: blogId, 
          status: "failed", 
          message: blogError instanceof Error ? blogError.message : "Unknown error" 
        });

        // Log error
        await supabase.from("ai_usage_logs").insert({
          blog_id: blogId,
          provider: "unknown",
          endpoint: "process-weekly-intel-job",
          cost_usd: 0,
          success: false,
          error_message: blogError instanceof Error ? blogError.message : "Unknown error"
        });
      }
    }

    console.log(`[INTEL JOB] Completed. Processed: ${results.processed}, Skipped: ${results.skipped}, Failed: ${results.failed}`);

    // Log job completion
    await supabase.from("ai_usage_logs").insert({
      provider: "system",
      endpoint: "process-weekly-intel-job",
      cost_usd: 0,
      success: true,
      metadata: {
        week_of: weekOf,
        mode: ALLOW_MULTIPLE ? "test" : "production",
        total_blogs: blogs.length,
        ...results
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        week_of: weekOf,
        mode: ALLOW_MULTIPLE ? "test" : "production",
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[INTEL JOB] Fatal error:", error);

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
