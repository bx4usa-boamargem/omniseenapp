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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blogId } = await req.json();

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
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Conexão GSC não encontrada', properties: [] }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt tokens
    const { data: decAccessToken } = await supabase.rpc('decrypt_gsc_token', { ciphertext: connection.access_token_encrypted, p_blog_id: blogId });
    const { data: decRefreshToken } = await supabase.rpc('decrypt_gsc_token', { ciphertext: connection.refresh_token_encrypted, p_blog_id: blogId });
    let accessToken = decAccessToken || connection.access_token;
    const refreshToken = decRefreshToken || connection.refresh_token;
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

    // Fetch sites from Google
    const sitesResponse = await fetch(
      'https://www.googleapis.com/webmasters/v3/sites',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!sitesResponse.ok) {
      console.error('GSC API error:', await sitesResponse.text());
      return new Response(
        JSON.stringify({ 
          error: 'Não foi possível obter propriedades do Google Search Console.',
          properties: []
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sitesData = await sitesResponse.json();
    const sites = sitesData.siteEntry || [];

    return new Response(JSON.stringify({
      properties: sites.map((s: any) => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel
      })),
      googleEmail: connection.google_email,
      selectedSiteUrl: connection.site_url !== 'pending_selection' ? connection.site_url : null,
      isActive: connection.is_active
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in gsc-list-properties:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao listar propriedades',
        properties: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
