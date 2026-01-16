import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * NOTIFY-INDEXNOW
 * 
 * Notifies search engines (Bing, Yandex) about new or updated URLs
 * using the IndexNow protocol for faster discovery.
 * 
 * https://www.indexnow.org/
 */

// IndexNow endpoints
const INDEXNOW_ENDPOINTS = [
  { name: "bing", url: "https://www.bing.com/indexnow" },
  { name: "yandex", url: "https://yandex.com/indexnow" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const INDEXNOW_KEY = Deno.env.get("INDEXNOW_KEY");

    if (!INDEXNOW_KEY) {
      console.log("[INDEXNOW] INDEXNOW_KEY not configured, skipping notification");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "IndexNow key not configured",
          skipped: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { articleId, blogId, url } = await req.json();

    if (!articleId || !blogId || !url) {
      return new Response(
        JSON.stringify({ error: "articleId, blogId, and url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[INDEXNOW] Notifying search engines about: ${url}`);

    // Extract host from URL
    const urlObj = new URL(url);
    const host = urlObj.host;

    const results: Array<{ engine: string; status: number; success: boolean }> = [];

    for (const endpoint of INDEXNOW_ENDPOINTS) {
      try {
        // Build IndexNow request URL
        const indexNowUrl = new URL(endpoint.url);
        indexNowUrl.searchParams.set("url", url);
        indexNowUrl.searchParams.set("key", INDEXNOW_KEY);

        const response = await fetch(indexNowUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent": "OmniSeen/1.0 (https://omniseen.app)",
          },
        });

        const status = response.status;
        const success = status >= 200 && status < 300;

        results.push({
          engine: endpoint.name,
          status,
          success,
        });

        // Log submission
        await supabase.from("indexnow_submissions").insert({
          article_id: articleId,
          blog_id: blogId,
          url_submitted: url,
          search_engine: endpoint.name,
          response_status: status,
          response_body: await response.text().catch(() => null),
        });

        console.log(`[INDEXNOW] ${endpoint.name}: ${status} ${success ? '✅' : '❌'}`);

      } catch (endpointError) {
        console.error(`[INDEXNOW] Failed to notify ${endpoint.name}:`, endpointError);
        results.push({
          engine: endpoint.name,
          status: 0,
          success: false,
        });
      }
    }

    const allSuccess = results.every(r => r.success);
    const anySuccess = results.some(r => r.success);

    return new Response(
      JSON.stringify({
        success: anySuccess,
        url,
        results,
        message: allSuccess 
          ? "All search engines notified successfully"
          : anySuccess 
            ? "Some search engines notified"
            : "Failed to notify search engines",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[INDEXNOW] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
