import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchRequest {
  blogId: string;
  startDate?: string;
  endDate?: string;
  dimension?: "date" | "page" | "query";
  rowLimit?: number;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error("Missing Google OAuth credentials");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh token:", await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { blogId, startDate, endDate, dimension = "date", rowLimit = 100 }: FetchRequest = await req.json();

    if (!blogId) {
      throw new Error("blogId is required");
    }

    // Get GSC connection
    const { data: connection, error: connectionError } = await supabase
      .from("gsc_connections")
      .select("*")
      .eq("blog_id", blogId)
      .eq("is_active", true)
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: "No active GSC connection found", connected: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt tokens
    const { data: decAccessToken } = await supabase.rpc('decrypt_gsc_token', { ciphertext: connection.access_token_encrypted, p_blog_id: blogId });
    const { data: decRefreshToken } = await supabase.rpc('decrypt_gsc_token', { ciphertext: connection.refresh_token_encrypted, p_blog_id: blogId });
    let accessToken = decAccessToken;

    // Check if token needs refresh
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      const now = new Date();
      if (expiresAt <= now) {
        const refreshToken = decRefreshToken || connection.refresh_token;
        const refreshResult = await refreshAccessToken(refreshToken);
        if (!refreshResult) {
          return new Response(
            JSON.stringify({ error: "Failed to refresh access token", connected: false }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        accessToken = refreshResult.access_token;
        const newExpiresAt = new Date(Date.now() + refreshResult.expires_in * 1000);
        const { data: encNewToken } = await supabase.rpc('encrypt_gsc_token', { plaintext: accessToken, p_blog_id: blogId });

        await supabase
          .from("gsc_connections")
          .update({
            access_token_encrypted: encNewToken,
            token_expires_at: newExpiresAt.toISOString(),
          })
          .eq("id", connection.id);
      }
    }

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000);

    const formattedStartDate = start.toISOString().split("T")[0];
    const formattedEndDate = end.toISOString().split("T")[0];

    // Fetch data from GSC API
    const gscResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(connection.site_url)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          dimensions: [dimension],
          rowLimit,
          dataState: "final",
        }),
      }
    );

    if (!gscResponse.ok) {
      const errorText = await gscResponse.text();
      console.error("GSC API error:", errorText);
      throw new Error(`GSC API error: ${gscResponse.status}`);
    }

    const gscData = await gscResponse.json();
    const rows = gscData.rows || [];

    // Process and save data based on dimension
    const processedData = rows.map((row: any) => ({
      key: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 100,
      position: Math.round((row.position || 0) * 100) / 100,
    }));

    // Save to appropriate history table
    if (dimension === "date") {
      for (const item of processedData) {
        await supabase
          .from("gsc_analytics_history")
          .upsert(
            {
              blog_id: blogId,
              date: item.key,
              clicks: item.clicks,
              impressions: item.impressions,
              ctr: item.ctr,
              position: item.position,
            },
            { onConflict: "blog_id,date" }
          );
      }
    } else if (dimension === "page") {
      const today = new Date().toISOString().split("T")[0];
      for (const item of processedData) {
        await supabase
          .from("gsc_pages_history")
          .upsert(
            {
              blog_id: blogId,
              page_url: item.key,
              date: today,
              clicks: item.clicks,
              impressions: item.impressions,
              ctr: item.ctr,
              position: item.position,
            },
            { onConflict: "blog_id,page_url,date" }
          );
      }
    } else if (dimension === "query") {
      const today = new Date().toISOString().split("T")[0];
      for (const item of processedData) {
        await supabase
          .from("gsc_queries_history")
          .upsert(
            {
              blog_id: blogId,
              query: item.key,
              date: today,
              clicks: item.clicks,
              impressions: item.impressions,
              ctr: item.ctr,
              position: item.position,
            },
            { onConflict: "blog_id,query,date" }
          );
      }
    }

    // Update last sync timestamp
    await supabase
      .from("gsc_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    // Calculate aggregated metrics
    const totalClicks = processedData.reduce((sum: number, item: any) => sum + item.clicks, 0);
    const totalImpressions = processedData.reduce((sum: number, item: any) => sum + item.impressions, 0);
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;
    const avgPosition = processedData.length > 0
      ? Math.round((processedData.reduce((sum: number, item: any) => sum + item.position, 0) / processedData.length) * 100) / 100
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        connected: true,
        siteUrl: connection.site_url,
        dimension,
        dateRange: { start: formattedStartDate, end: formattedEndDate },
        data: processedData,
        aggregated: {
          totalClicks,
          totalImpressions,
          avgCtr,
          avgPosition,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching GSC analytics:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
