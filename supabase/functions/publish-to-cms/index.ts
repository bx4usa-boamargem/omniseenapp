import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CMSPayload {
  action: "test" | "create" | "update" | "delete" | "detect-blog";
  integrationId: string;
  articleId?: string;
}

interface WordPressCredentials {
  siteUrl: string;
  username: string;
  apiKey: string;
}

interface WordPressComCredentials {
  accessToken: string;
  siteId: string;
  siteUrl: string;
}

interface WixCredentials {
  siteUrl: string;
  apiKey: string;
}

interface ArticleData {
  title: string;
  content: string;
  excerpt: string;
  featuredImageUrl: string | null;
  status: "publish" | "draft";
  category?: string;
  tags?: string[];
}

// Detect if URL is WordPress.com hosted
function isWordPressDotCom(siteUrl: string): boolean {
  const url = siteUrl.toLowerCase();
  return url.includes('.wordpress.com') || url.includes('wpcomstaging.com');
}

// WordPress.org API Functions (self-hosted)
async function testWordPressConnection(creds: WordPressCredentials): Promise<{ success: boolean; message: string }> {
  try {
    const authHeader = btoa(`${creds.username}:${creds.apiKey}`);
    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (response.ok) {
      const user = await response.json();
      return { success: true, message: `Conectado como ${user.name}` };
    } else if (response.status === 401) {
      return { success: false, message: "Credenciais inválidas. Verifique o usuário e a senha de aplicativo." };
    } else {
      return { success: false, message: `Erro ao conectar: HTTP ${response.status}` };
    }
  } catch (error) {
    console.error("WordPress connection test error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro de conexão: ${errorMessage}` };
  }
}

// WordPress.com API Functions (OAuth)
async function testWordPressComConnection(creds: WordPressComCredentials): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${creds.siteId}`, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
      },
    });

    if (response.ok) {
      const site = await response.json();
      return { success: true, message: `Conectado ao site: ${site.name}` };
    } else if (response.status === 401) {
      return { success: false, message: "Token expirado. Reconecte sua conta WordPress.com." };
    } else {
      const errorText = await response.text();
      console.error("WordPress.com test error:", errorText);
      return { success: false, message: `Erro ao conectar: HTTP ${response.status}` };
    }
  } catch (error) {
    console.error("WordPress.com connection test error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro de conexão: ${errorMessage}` };
  }
}

// Detect WordPress Blog Capability (self-hosted)
async function detectWordPressBlog(creds: WordPressCredentials): Promise<{
  success: boolean;
  hasBlog: boolean;
  postsEndpoint: boolean;
  categories: boolean;
  message: string;
}> {
  try {
    const authHeader = btoa(`${creds.username}:${creds.apiKey}`);
    
    const postsRes = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
      headers: { Authorization: `Basic ${authHeader}` },
    });
    
    const catsRes = await fetch(`${creds.siteUrl}/wp-json/wp/v2/categories?per_page=1`, {
      headers: { Authorization: `Basic ${authHeader}` },
    });
    
    const postsOk = postsRes.ok;
    const catsOk = catsRes.ok;
    
    console.log(`[detect-blog] WordPress.org: posts=${postsOk}, categories=${catsOk}`);
    
    return {
      success: true,
      hasBlog: postsOk,
      postsEndpoint: postsOk,
      categories: catsOk,
      message: postsOk 
        ? "Blog WordPress detectado e pronto para publicação" 
        : "Endpoint de posts não disponível",
    };
  } catch (error) {
    console.error("WordPress detect blog error:", error);
    return { 
      success: false, hasBlog: false, postsEndpoint: false, categories: false, 
      message: "Erro ao detectar blog WordPress" 
    };
  }
}

// Detect WordPress.com Blog Capability (OAuth)
async function detectWordPressComBlog(creds: WordPressComCredentials): Promise<{
  success: boolean;
  hasBlog: boolean;
  postsEndpoint: boolean;
  categories: boolean;
  message: string;
}> {
  try {
    const response = await fetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${creds.siteId}/posts?number=1`,
      { headers: { Authorization: `Bearer ${creds.accessToken}` } }
    );
    
    const postsOk = response.ok;
    
    console.log(`[detect-blog] WordPress.com: posts=${postsOk}`);
    
    return {
      success: true,
      hasBlog: postsOk,
      postsEndpoint: postsOk,
      categories: postsOk, // WordPress.com always has categories
      message: postsOk 
        ? "Blog WordPress.com detectado e pronto para publicação" 
        : "Não foi possível acessar o blog",
    };
  } catch (error) {
    console.error("WordPress.com detect blog error:", error);
    return { 
      success: false, hasBlog: false, postsEndpoint: false, categories: false, 
      message: "Erro ao detectar blog WordPress.com" 
    };
  }
}

// Create post on WordPress.org (self-hosted)
async function createWordPressPost(creds: WordPressCredentials, article: ArticleData): Promise<{ success: boolean; postId?: string; postUrl?: string; message?: string }> {
  try {
    const authHeader = btoa(`${creds.username}:${creds.apiKey}`);
    
    // Upload featured image if exists
    let featuredMediaId: number | undefined;
    if (article.featuredImageUrl) {
      try {
        const imageResponse = await fetch(article.featuredImageUrl);
        const imageBlob = await imageResponse.blob();
        const fileName = article.featuredImageUrl.split("/").pop() || "featured-image.jpg";
        
        const formData = new FormData();
        formData.append("file", imageBlob, fileName);
        
        const uploadResponse = await fetch(`${creds.siteUrl}/wp-json/wp/v2/media`, {
          method: "POST",
          headers: { Authorization: `Basic ${authHeader}` },
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const mediaData = await uploadResponse.json();
          featuredMediaId = mediaData.id;
          console.log("Featured image uploaded:", featuredMediaId);
        }
      } catch (imgError) {
        console.error("Error uploading featured image:", imgError);
      }
    }
    
    const postData: Record<string, unknown> = {
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      status: article.status,
    };
    
    if (featuredMediaId) {
      postData.featured_media = featuredMediaId;
    }
    
    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });
    
    if (response.ok) {
      const post = await response.json();
      // CRITICAL: Validate that we got real post data
      if (post && post.id && post.link) {
        console.log(`[WordPress.org] Post created successfully: ID=${post.id}, URL=${post.link}`);
        return { success: true, postId: String(post.id), postUrl: post.link };
      }
      console.error("[WordPress.org] Response OK but invalid post data:", post);
      return { success: false, message: "WordPress não retornou dados válidos do post" };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error("[WordPress.org] Create post failed:", response.status, errorData);
      return { success: false, message: errorData.message || `Erro ao criar post: HTTP ${response.status}` };
    }
  } catch (error) {
    console.error("WordPress create post error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro: ${errorMessage}` };
  }
}

// Create post on WordPress.com (OAuth)
async function createWordPressComPost(creds: WordPressComCredentials, article: ArticleData): Promise<{ success: boolean; postId?: string; postUrl?: string; message?: string }> {
  try {
    console.log(`[WordPress.com] Creating post on site ${creds.siteId}...`);
    
    const postData = {
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      status: article.status,
    };
    
    const response = await fetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${creds.siteId}/posts/new`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      }
    );
    
    if (response.ok) {
      const post = await response.json();
      // WordPress.com uses uppercase field names
      if (post && post.ID && post.URL) {
        console.log(`[WordPress.com] Post created successfully: ID=${post.ID}, URL=${post.URL}`);
        return { success: true, postId: String(post.ID), postUrl: post.URL };
      }
      console.error("[WordPress.com] Response OK but invalid post data:", JSON.stringify(post).slice(0, 500));
      return { success: false, message: "WordPress.com não retornou dados válidos do post" };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error("[WordPress.com] Create post failed:", response.status, errorData);
      return { success: false, message: errorData.message || `Erro ao criar post: HTTP ${response.status}` };
    }
  } catch (error) {
    console.error("WordPress.com create post error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro: ${errorMessage}` };
  }
}

// Update post on WordPress.org
async function updateWordPressPost(creds: WordPressCredentials, postId: string, article: ArticleData): Promise<{ success: boolean; postUrl?: string; message?: string }> {
  try {
    const authHeader = btoa(`${creds.username}:${creds.apiKey}`);
    
    const postData = {
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      status: article.status,
    };
    
    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts/${postId}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });
    
    if (response.ok) {
      const post = await response.json();
      if (post && post.link) {
        return { success: true, postUrl: post.link };
      }
      return { success: false, message: "WordPress não retornou dados válidos" };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.message || `Erro ao atualizar post: HTTP ${response.status}` };
    }
  } catch (error) {
    console.error("WordPress update post error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro: ${errorMessage}` };
  }
}

// Update post on WordPress.com
async function updateWordPressComPost(creds: WordPressComCredentials, postId: string, article: ArticleData): Promise<{ success: boolean; postUrl?: string; message?: string }> {
  try {
    const postData = {
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      status: article.status,
    };
    
    const response = await fetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${creds.siteId}/posts/${postId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      }
    );
    
    if (response.ok) {
      const post = await response.json();
      if (post && post.URL) {
        return { success: true, postUrl: post.URL };
      }
      return { success: false, message: "WordPress.com não retornou dados válidos" };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.message || `Erro ao atualizar post: HTTP ${response.status}` };
    }
  } catch (error) {
    console.error("WordPress.com update post error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro: ${errorMessage}` };
  }
}

// Wix API Functions
async function testWixConnection(creds: WixCredentials): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`https://www.wixapis.com/blog/v3/posts`, {
      method: "GET",
      headers: {
        Authorization: creds.apiKey,
        "wix-site-id": extractWixSiteId(creds.siteUrl),
      },
    });

    if (response.ok) {
      return { success: true, message: "Conexão estabelecida com sucesso" };
    } else if (response.status === 401) {
      return { success: false, message: "API Key inválida" };
    } else {
      return { success: false, message: `Erro ao conectar: HTTP ${response.status}` };
    }
  } catch (error) {
    console.error("Wix connection test error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro de conexão: ${errorMessage}` };
  }
}

function extractWixSiteId(siteUrl: string): string {
  return siteUrl.replace("https://", "").replace("http://", "").split("/")[0];
}

async function createWixPost(creds: WixCredentials, article: ArticleData): Promise<{ success: boolean; postId?: string; postUrl?: string; message?: string }> {
  try {
    const siteId = extractWixSiteId(creds.siteUrl);
    
    const draftResponse = await fetch(`https://www.wixapis.com/blog/v3/draft-posts`, {
      method: "POST",
      headers: {
        Authorization: creds.apiKey,
        "wix-site-id": siteId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        draftPost: {
          title: article.title,
          excerpt: article.excerpt,
          richContent: {
            nodes: [{
              type: "PARAGRAPH",
              nodes: [{ type: "TEXT", textData: { text: article.content } }]
            }]
          }
        }
      }),
    });
    
    if (!draftResponse.ok) {
      const errorData = await draftResponse.json().catch(() => ({}));
      return { success: false, message: errorData.message || `Erro ao criar rascunho: HTTP ${draftResponse.status}` };
    }
    
    const draft = await draftResponse.json();
    const draftId = draft.draftPost.id;
    
    if (article.status === "publish") {
      const publishResponse = await fetch(`https://www.wixapis.com/blog/v3/draft-posts/${draftId}/publish`, {
        method: "POST",
        headers: {
          Authorization: creds.apiKey,
          "wix-site-id": siteId,
        },
      });
      
      if (publishResponse.ok) {
        const published = await publishResponse.json();
        return { success: true, postId: published.post.id, postUrl: published.post.url };
      } else {
        return { success: true, postId: draftId, message: "Rascunho criado, mas falha ao publicar" };
      }
    }
    
    return { success: true, postId: draftId };
  } catch (error) {
    console.error("Wix create post error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro: ${errorMessage}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, integrationId, articleId } = await req.json() as CMSPayload;

    console.log(`CMS action: ${action}, integration: ${integrationId}`);

    // Fetch integration details from decrypted view
    const { data: integration, error: integrationError } = await supabaseClient
      .from("cms_integrations_decrypted")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (integrationError || !integration) {
      console.error("Integration not found:", integrationError);
      return new Response(
        JSON.stringify({ success: false, message: "Integração não encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Log credential access for audit trail
    await supabaseClient.from("cms_credential_access_log").insert({
      integration_id: integrationId,
      access_type: action === "test" ? "view" : "publish",
    });

    const platform = integration.platform;
    const isWordPressCom = platform === "wordpress-com" || 
      (platform === "wordpress" && integration.auth_type === "oauth");

    // Test connection
    if (action === "test") {
      let result;
      
      if (isWordPressCom) {
        if (!integration.api_key || !integration.wordpress_site_id) {
          result = { success: false, message: "Integração OAuth incompleta. Reconecte sua conta WordPress.com." };
        } else {
          result = await testWordPressComConnection({
            accessToken: integration.api_key,
            siteId: integration.wordpress_site_id,
            siteUrl: integration.site_url,
          });
        }
      } else if (platform === "wordpress") {
        result = await testWordPressConnection({
          siteUrl: integration.site_url,
          username: integration.username,
          apiKey: integration.api_key,
        });
      } else if (platform === "wix") {
        result = await testWixConnection({
          siteUrl: integration.site_url,
          apiKey: integration.api_key,
        });
      } else {
        result = { success: false, message: `Plataforma ${platform} não suportada ainda` };
      }

      // Update last sync status
      await supabaseClient
        .from("cms_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: result.success ? "connected" : "error",
        })
        .eq("id", integrationId);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect blog capability
    if (action === "detect-blog") {
      let result;
      
      if (isWordPressCom) {
        if (!integration.api_key || !integration.wordpress_site_id) {
          result = { success: false, hasBlog: false, postsEndpoint: false, categories: false, message: "OAuth incompleto" };
        } else {
          result = await detectWordPressComBlog({
            accessToken: integration.api_key,
            siteId: integration.wordpress_site_id,
            siteUrl: integration.site_url,
          });
        }
      } else if (platform === "wordpress") {
        result = await detectWordPressBlog({
          siteUrl: integration.site_url,
          username: integration.username,
          apiKey: integration.api_key,
        });
      } else if (platform === "wix") {
        result = { success: true, hasBlog: true, postsEndpoint: true, categories: true, message: "Wix Blog API disponível" };
      } else {
        result = { success: false, hasBlog: false, postsEndpoint: false, categories: false, message: `Plataforma ${platform} não suportada` };
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update post
    if (action === "create" || action === "update") {
      if (!articleId) {
        return new Response(
          JSON.stringify({ success: false, message: "ID do artigo é obrigatório" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Fetch article
      const { data: article, error: articleError } = await supabaseClient
        .from("articles")
        .select("*")
        .eq("id", articleId)
        .single();

      if (articleError || !article) {
        console.error("Article not found:", articleError);
        return new Response(
          JSON.stringify({ success: false, message: "Artigo não encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // SERP validation removed - publication is always allowed
      // SERP analysis is now optional, not blocking


      const articleData: ArticleData = {
        title: article.title,
        content: article.content || "",
        excerpt: article.excerpt || "",
        featuredImageUrl: article.featured_image_url,
        status: article.status === "published" ? "publish" : "draft",
        category: article.category,
        tags: article.tags,
      };

      let result: { success: boolean; postId?: string; postUrl?: string; message?: string };
      
      if (isWordPressCom) {
        if (!integration.api_key || !integration.wordpress_site_id) {
          result = { success: false, message: "Integração OAuth incompleta. Reconecte sua conta WordPress.com." };
        } else {
          const creds: WordPressComCredentials = {
            accessToken: integration.api_key,
            siteId: integration.wordpress_site_id,
            siteUrl: integration.site_url,
          };
          
          if (action === "create" || !article.external_post_id) {
            result = await createWordPressComPost(creds, articleData);
          } else {
            const updateResult = await updateWordPressComPost(creds, article.external_post_id, articleData);
            result = { ...updateResult, postId: article.external_post_id };
          }
        }
      } else if (platform === "wordpress") {
        const creds: WordPressCredentials = {
          siteUrl: integration.site_url,
          username: integration.username,
          apiKey: integration.api_key,
        };
        
        if (action === "create" || !article.external_post_id) {
          result = await createWordPressPost(creds, articleData);
        } else {
          const updateResult = await updateWordPressPost(creds, article.external_post_id, articleData);
          result = { ...updateResult, postId: article.external_post_id };
        }
      } else if (platform === "wix") {
        const creds: WixCredentials = {
          siteUrl: integration.site_url,
          apiKey: integration.api_key,
        };
        result = await createWixPost(creds, articleData);
      } else {
        result = { success: false, message: `Plataforma ${platform} não suportada ainda` };
      }

      // Log the publish action
      await supabaseClient.from("cms_publish_logs").insert({
        article_id: articleId,
        integration_id: integrationId,
        action: action,
        external_id: result.postId || null,
        external_url: result.postUrl || null,
        status: result.success ? "success" : "error",
        error_message: result.success ? null : result.message,
      });

      // Update article with external post info
      if (result.success && result.postId) {
        await supabaseClient
          .from("articles")
          .update({
            external_post_id: result.postId,
            external_post_url: result.postUrl,
          })
          .eq("id", articleId);
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Ação não reconhecida" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error) {
    console.error("CMS function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
