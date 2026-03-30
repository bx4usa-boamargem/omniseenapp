import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleClientId!,
      client_secret: googleClientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    console.error('Token refresh failed:', await response.text());
    return null;
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blogId, startDate, endDate, rowLimit = 100 } = await req.json();

    if (!blogId) {
      throw new Error('Missing required parameter: blogId');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get GSC connection
    const { data: connection, error: connError } = await supabase
      .from('gsc_connections')
      .select('*')
      .eq('blog_id', blogId)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      throw new Error('No active GSC connection found');
    }

    // Decrypt tokens
    const { data: decAccessToken } = await supabase.rpc('decrypt_gsc_token', { ciphertext: connection.access_token_encrypted, p_blog_id: blogId });
    const { data: decRefreshToken } = await supabase.rpc('decrypt_gsc_token', { ciphertext: connection.refresh_token_encrypted, p_blog_id: blogId });
    let accessToken = decAccessToken;

    // Check if token is expired
    if (new Date(connection.token_expires_at) <= new Date()) {
      console.log('Token expired, refreshing...');
      const refreshToken = decRefreshToken || connection.refresh_token;
      const newTokens = await refreshAccessToken(refreshToken);
      
      if (!newTokens) {
        throw new Error('Failed to refresh access token');
      }

      accessToken = newTokens.access_token;
      const expiresAt = new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString();
      const { data: encNewToken } = await supabase.rpc('encrypt_gsc_token', { plaintext: accessToken, p_blog_id: blogId });

      await supabase
        .from('gsc_connections')
        .update({
          access_token_encrypted: encNewToken,
          token_expires_at: expiresAt,
        })
        .eq('id', connection.id);
    }

    // Calculate date range (default: last 28 days)
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch keywords from Search Console
    const gscResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(connection.site_url)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          dimensions: ['query'],
          rowLimit,
        }),
      }
    );

    if (!gscResponse.ok) {
      const errorText = await gscResponse.text();
      console.error('GSC API error:', errorText);
      throw new Error('Failed to fetch keywords from Search Console');
    }

    const gscData = await gscResponse.json();
    const rows = gscData.rows || [];

    // Update last sync timestamp
    await supabase
      .from('gsc_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    // Transform data
    const keywords = rows.map((row: any) => ({
      keyword: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 100 * 10) / 10, // Convert to percentage
      position: Math.round(row.position * 10) / 10,
      // Estimate difficulty based on position
      difficulty: row.position <= 3 ? 75 + Math.random() * 25 :
                  row.position <= 10 ? 50 + Math.random() * 25 :
                  row.position <= 20 ? 30 + Math.random() * 20 :
                  10 + Math.random() * 20,
      // Estimate search volume based on impressions
      searchVolume: Math.round(row.impressions * (100 / (row.position || 1))),
    }));

    console.log(`Fetched ${keywords.length} keywords from GSC`);

    return new Response(JSON.stringify({
      success: true,
      keywords,
      siteUrl: connection.site_url,
      dateRange: { start, end },
      totalKeywords: keywords.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in fetch-gsc-keywords:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
