import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refresh access token if expired
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const data = await response.json();
    if (data.error) {
      console.error('Token refresh error:', data);
      return null;
    }

    return { access_token: data.access_token, expires_in: data.expires_in };
  } catch (e) {
    console.error('Failed to refresh token:', e);
    return null;
  }
}

// Calculate position distribution
function calculatePositionDistribution(rows: any[]): any {
  const distribution = {
    top3: { count: 0, percentage: 0 },
    positions4_10: { count: 0, percentage: 0 },
    positions11_20: { count: 0, percentage: 0 },
    positions21_50: { count: 0, percentage: 0 },
    positions51_100: { count: 0, percentage: 0 }
  };

  if (!rows || rows.length === 0) return distribution;

  rows.forEach(row => {
    const pos = row.position || 100;
    if (pos <= 3) distribution.top3.count++;
    else if (pos <= 10) distribution.positions4_10.count++;
    else if (pos <= 20) distribution.positions11_20.count++;
    else if (pos <= 50) distribution.positions21_50.count++;
    else distribution.positions51_100.count++;
  });

  const total = rows.length;
  if (total > 0) {
    distribution.top3.percentage = Math.round((distribution.top3.count / total) * 100);
    distribution.positions4_10.percentage = Math.round((distribution.positions4_10.count / total) * 100);
    distribution.positions11_20.percentage = Math.round((distribution.positions11_20.count / total) * 100);
    distribution.positions21_50.percentage = Math.round((distribution.positions21_50.count / total) * 100);
    distribution.positions51_100.percentage = Math.round((distribution.positions51_100.count / total) * 100);
  }

  return distribution;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blogId, startDate, endDate } = await req.json();

    if (!blogId) {
      return new Response(
        JSON.stringify({ error: 'Blog ID é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch connection
    const { data: connection, error: connError } = await supabase
      .from('gsc_connections')
      .select('*')
      .eq('blog_id', blogId)
      .eq('is_active', true)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ 
          error: 'Conexão GSC não encontrada ou inativa',
          needsConnection: true 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (connection.site_url === 'pending_selection') {
      return new Response(
        JSON.stringify({ 
          error: 'Selecione uma propriedade do Search Console',
          needsSiteSelection: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt tokens
    const { data: decAccessToken } = await supabase.rpc('decrypt_gsc_token', { ciphertext: connection.access_token_encrypted, p_blog_id: blogId });
    const { data: decRefreshToken } = await supabase.rpc('decrypt_gsc_token', { ciphertext: connection.refresh_token_encrypted, p_blog_id: blogId });
    let accessToken = decAccessToken;
    const refreshToken = decRefreshToken;
    const tokenExpiresAt = new Date(connection.token_expires_at);

    // Refresh token if expired
    if (tokenExpiresAt <= new Date()) {
      console.log('Token expired, refreshing...');
      const newTokens = await refreshAccessToken(refreshToken);
      
      if (!newTokens) {
        return new Response(
          JSON.stringify({ 
            error: 'Sessão expirada. Por favor, reconecte sua conta Google.',
            needsReconnect: true 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessToken = newTokens.access_token;
      const newExpiresAt = new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString();
      const { data: encNewToken } = await supabase.rpc('encrypt_gsc_token', { plaintext: accessToken, p_blog_id: blogId });

      // Update tokens in database
      await supabase
        .from('gsc_connections')
        .update({ 
          access_token_encrypted: encNewToken, 
          token_expires_at: newExpiresAt 
        })
        .eq('blog_id', blogId);
    }

    // Calculate date range (default: last 28 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000);
    
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    const siteUrl = connection.site_url;

    // Fetch aggregated data
    const aggregatedResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: [],
          rowLimit: 1
        })
      }
    );

    // Fetch daily data
    const dailyResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['date'],
          rowLimit: 100
        })
      }
    );

    // Fetch top queries
    const queriesResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['query'],
          rowLimit: 50
        })
      }
    );

    // Fetch top pages
    const pagesResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['page'],
          rowLimit: 50
        })
      }
    );

    // Parse responses
    const aggregatedData = await aggregatedResponse.json();
    const dailyData = await dailyResponse.json();
    const queriesData = await queriesResponse.json();
    const pagesData = await pagesResponse.json();

    // Extract aggregated metrics
    const aggRow = aggregatedData.rows?.[0] || {};
    const aggregated = {
      totalClicks: aggRow.clicks || 0,
      totalImpressions: aggRow.impressions || 0,
      avgCtr: (aggRow.ctr || 0) * 100,
      avgPosition: aggRow.position || 0
    };

    // Process daily data
    const daily = (dailyData.rows || []).map((row: any) => ({
      date: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: (row.ctr || 0) * 100,
      position: row.position || 0
    }));

    // Process top queries
    const topQueries = (queriesData.rows || []).map((row: any) => ({
      query: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: (row.ctr || 0) * 100,
      position: row.position || 0
    }));

    // Process top pages
    const topPages = (pagesData.rows || []).map((row: any) => ({
      page: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: (row.ctr || 0) * 100,
      position: row.position || 0
    }));

    // Calculate position distribution from queries
    const positionDistribution = calculatePositionDistribution(queriesData.rows || []);

    // Update last sync timestamp
    await supabase
      .from('gsc_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('blog_id', blogId);

    return new Response(JSON.stringify({
      success: true,
      siteUrl,
      googleEmail: connection.google_email,
      dateRange: { startDate: startDateStr, endDate: endDateStr },
      aggregated,
      positionDistribution,
      dailyData: daily,
      topQueries,
      topPages,
      lastSyncAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in gsc-fetch-performance:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao buscar dados de performance'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
