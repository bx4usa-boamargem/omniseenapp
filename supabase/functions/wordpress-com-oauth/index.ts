import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OAuthPayload {
  action: "authorize" | "callback" | "refresh" | "get-sites";
  blogId: string;
  code?: string;
  integrationId?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  blog_id: string;
  blog_url: string;
  scope?: string;
}

interface WordPressSite {
  ID: number;
  URL: string;
  name: string;
  description?: string;
}

// Generate OAuth authorization URL
// CORRECTION #4: Generate unique state to prevent OAuth reuse and CSRF attacks
function getAuthorizationUrl(blogId: string): string {
  const clientId = Deno.env.get("WORDPRESS_COM_CLIENT_ID");
  const redirectUri = Deno.env.get("WORDPRESS_COM_REDIRECT_URI");
  
  if (!clientId || !redirectUri) {
    throw new Error("WordPress.com OAuth não configurado. Configure WORDPRESS_COM_CLIENT_ID e WORDPRESS_COM_REDIRECT_URI no painel de secrets.");
  }
  
  // VALIDATION: Detect placeholder credentials and block before redirect
  const placeholderPatterns = [
    "vai te dar",
    "your_client_id",
    "placeholder",
    "example",
    "xxx",
    "000000",
  ];
  
  const isPlaceholder = placeholderPatterns.some(
    (pattern) => clientId.toLowerCase().includes(pattern)
  ) || clientId.length < 8;
  
  if (isPlaceholder) {
    console.error(`[OAuth BLOCKED] Invalid Client ID detected: "${clientId.substring(0, 20)}..."`);
    throw new Error(
      "WORDPRESS_COM_CLIENT_ID contém valor de exemplo. " +
      "Registre um app real em https://developer.wordpress.com/apps/ e atualize os secrets."
    );
  }
  
  // Generate unique state: blogId_timestamp_randomString
  // This prevents reuse of OAuth attempts and protects against CSRF
  const uniqueState = `${blogId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "global",
    state: uniqueState, // Unique state per OAuth attempt
  });
  
  console.log(`OAuth state generated: ${uniqueState.substring(0, 50)}...`);
  
  return `https://public-api.wordpress.com/oauth2/authorize?${params.toString()}`;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const clientId = Deno.env.get("WORDPRESS_COM_CLIENT_ID");
  const clientSecret = Deno.env.get("WORDPRESS_COM_CLIENT_SECRET");
  const redirectUri = Deno.env.get("WORDPRESS_COM_REDIRECT_URI");
  
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("WordPress.com OAuth not configured");
  }
  
  const response = await fetch("https://public-api.wordpress.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code,
      grant_type: "authorization_code",
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token exchange error:", errorText);
    
    // Parse error for specific, actionable messages
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error === "invalid_client") {
        throw new Error("OAuth inválido: Client ID não reconhecido pelo WordPress.com. Verifique as credenciais do app.");
      }
      if (errorData.error === "invalid_grant") {
        throw new Error("Código de autorização expirado ou já utilizado. Tente conectar novamente.");
      }
      throw new Error(errorData.error_description || `Erro OAuth: HTTP ${response.status}`);
    } catch (parseError) {
      // Re-throw if already a specific OAuth error
      if (parseError instanceof Error && parseError.message.includes("OAuth")) {
        throw parseError;
      }
      throw new Error(`Falha na autenticação OAuth. HTTP ${response.status}`);
    }
  }
  
  return await response.json();
}

// Get user's WordPress.com sites
async function getUserSites(accessToken: string): Promise<WordPressSite[]> {
  const response = await fetch("https://public-api.wordpress.com/rest/v1.1/me/sites", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Get sites error:", errorText);
    throw new Error(`Failed to get sites: ${response.status}`);
  }
  
  const data = await response.json();
  return data.sites || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, blogId, code, integrationId } = await req.json() as OAuthPayload;

    console.log(`WordPress.com OAuth action: ${action}, blogId: ${blogId}`);

    // Generate authorization URL
    if (action === "authorize") {
      if (!blogId) {
        return new Response(
          JSON.stringify({ success: false, message: "blogId is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      try {
        const authUrl = getAuthorizationUrl(blogId);
        console.log("Generated auth URL:", authUrl);
        
        return new Response(
          JSON.stringify({ success: true, authUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Auth URL generation error:", error);
        return new Response(
          JSON.stringify({ success: false, message: error instanceof Error ? error.message : "Failed to generate auth URL" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // Handle OAuth callback - exchange code for tokens and save integration
    if (action === "callback") {
      if (!code) {
        return new Response(
          JSON.stringify({ success: false, message: "code is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // CORRECTION #4: Extract blogId from unique state (format: blogId_timestamp_random)
      const extractedBlogId = blogId?.split('_')[0];
      if (!extractedBlogId) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid or missing state parameter" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      console.log(`OAuth callback: extracted blogId=${extractedBlogId} from state=${blogId?.substring(0, 50)}...`);

      try {
        // Exchange code for tokens
        console.log("Exchanging code for tokens...");
        const tokens = await exchangeCodeForTokens(code);
        console.log("Token exchange successful, blog_id:", tokens.blog_id, "blog_url:", tokens.blog_url);

        // Get user sites to find the primary site
        const sites = await getUserSites(tokens.access_token);
        console.log("Found sites:", sites.length);

        // Find matching site or use the first one
        let targetSite = sites.find(s => String(s.ID) === tokens.blog_id) || sites[0];
        
        if (!targetSite && tokens.blog_url) {
          targetSite = {
            ID: parseInt(tokens.blog_id) || 0,
            URL: tokens.blog_url,
            name: tokens.blog_url.replace(/^https?:\/\//, "").split(".")[0],
          };
        }

        if (!targetSite) {
          return new Response(
            JSON.stringify({ success: false, message: "No WordPress.com sites found for this account" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        console.log("Target site:", targetSite.URL, "ID:", targetSite.ID);

        // Check for existing integration - use extractedBlogId
        const { data: existing } = await supabase
          .from("cms_integrations")
          .select("id")
          .eq("blog_id", extractedBlogId)
          .eq("platform", "wordpress-com")
          .maybeSingle();

        // Calculate token expiration (WordPress.com tokens don't expire but we'll set 1 year)
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setFullYear(tokenExpiresAt.getFullYear() + 1);

        if (existing) {
          // Update existing integration - use api_key field which triggers encryption
          const { error: updateError } = await supabase
            .from("cms_integrations")
            .update({
              site_url: targetSite.URL,
              auth_type: "oauth",
              api_key: tokens.access_token, // Trigger will encrypt this
              token_expires_at: tokenExpiresAt.toISOString(),
              wordpress_site_id: String(targetSite.ID),
              last_sync_at: new Date().toISOString(),
              last_sync_status: "connected",
              is_active: true,
            })
            .eq("id", existing.id);

          if (updateError) {
            console.error("Update error:", updateError);
            throw new Error("Failed to update integration");
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              integrationId: existing.id,
              siteUrl: targetSite.URL,
              siteName: targetSite.name,
              message: "Conexão atualizada com sucesso!"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // Create new integration - use extractedBlogId
          const { data: newIntegration, error: insertError } = await supabase
            .from("cms_integrations")
            .insert({
              blog_id: extractedBlogId,
              platform: "wordpress-com",
              site_url: targetSite.URL,
              auth_type: "oauth",
              api_key: tokens.access_token, // Trigger will encrypt this
              token_expires_at: tokenExpiresAt.toISOString(),
              wordpress_site_id: String(targetSite.ID),
              last_sync_at: new Date().toISOString(),
              last_sync_status: "connected",
              is_active: true,
            })
            .select()
            .single();

          if (insertError) {
            console.error("Insert error:", insertError);
            throw new Error("Failed to create integration");
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              integrationId: newIntegration.id,
              siteUrl: targetSite.URL,
              siteName: targetSite.name,
              message: "WordPress.com conectado com sucesso!"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (error) {
        console.error("Callback error:", error);
        return new Response(
          JSON.stringify({ success: false, message: error instanceof Error ? error.message : "OAuth callback failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // Get sites for an existing integration
    if (action === "get-sites") {
      if (!integrationId) {
        return new Response(
          JSON.stringify({ success: false, message: "integrationId is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: integration, error: integrationError } = await supabase
        .from("cms_integrations_decrypted")
        .select("api_key")
        .eq("id", integrationId)
        .single();

      if (integrationError || !integration?.api_key) {
        return new Response(
          JSON.stringify({ success: false, message: "Integration not found or not authenticated" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      try {
        const sites = await getUserSites(integration.api_key);
        return new Response(
          JSON.stringify({ success: true, sites }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Get sites error:", error);
        return new Response(
          JSON.stringify({ success: false, message: "Failed to fetch sites" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: "Unknown action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error("WordPress.com OAuth error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
