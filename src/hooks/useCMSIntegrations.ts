import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CMSPlatform = "wordpress" | "wix" | "webflow" | "custom";

export interface CMSIntegration {
  id: string;
  blog_id: string;
  platform: CMSPlatform;
  site_url: string;
  api_key: string | null;
  api_secret: string | null;
  username: string | null;
  is_active: boolean;
  auto_publish: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CMSPublishLog {
  id: string;
  article_id: string;
  integration_id: string;
  action: "create" | "update" | "delete";
  external_id: string | null;
  external_url: string | null;
  status: "pending" | "success" | "error";
  error_message: string | null;
  created_at: string;
}

export function useCMSIntegrations(blogId: string) {
  const [integrations, setIntegrations] = useState<CMSIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!blogId) return;

    const { data, error } = await supabase
      .from("cms_integrations")
      .select("*")
      .eq("blog_id", blogId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching CMS integrations:", error);
    } else {
      setIntegrations(data as CMSIntegration[]);
    }
    setLoading(false);
  }, [blogId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const addIntegration = async (
    platform: CMSPlatform,
    siteUrl: string,
    credentials: { username?: string; apiKey?: string; apiSecret?: string }
  ): Promise<{ success: boolean; integrationId?: string; message?: string }> => {
    try {
      const { data, error } = await supabase
        .from("cms_integrations")
        .insert({
          blog_id: blogId,
          platform,
          site_url: siteUrl.replace(/\/$/, ""), // Remove trailing slash
          username: credentials.username || null,
          api_key: credentials.apiKey || null,
          api_secret: credentials.apiSecret || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return { success: false, message: `Já existe uma integração com ${platform} para este blog` };
        }
        console.error("Error adding integration:", error);
        return { success: false, message: error.message };
      }

      await fetchIntegrations();
      return { success: true, integrationId: data.id };
    } catch (err) {
      console.error("Error:", err);
      return { success: false, message: "Erro ao adicionar integração" };
    }
  };

  const updateIntegration = async (
    integrationId: string,
    updates: Partial<Pick<CMSIntegration, "site_url" | "username" | "api_key" | "api_secret" | "is_active" | "auto_publish">>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("cms_integrations")
        .update(updates)
        .eq("id", integrationId);

      if (error) {
        console.error("Error updating integration:", error);
        toast.error("Erro ao atualizar integração");
        return false;
      }

      await fetchIntegrations();
      return true;
    } catch (err) {
      console.error("Error:", err);
      return false;
    }
  };

  const deleteIntegration = async (integrationId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("cms_integrations")
        .delete()
        .eq("id", integrationId);

      if (error) {
        console.error("Error deleting integration:", error);
        toast.error("Erro ao remover integração");
        return false;
      }

      await fetchIntegrations();
      toast.success("Integração removida");
      return true;
    } catch (err) {
      console.error("Error:", err);
      return false;
    }
  };

  const testConnection = async (integrationId: string): Promise<{ success: boolean; message: string }> => {
    setTesting(integrationId);
    try {
      const { data, error } = await supabase.functions.invoke("publish-to-cms", {
        body: { action: "test", integrationId },
      });

      if (error) {
        console.error("Error testing connection:", error);
        return { success: false, message: error.message };
      }

      await fetchIntegrations();
      return data;
    } catch (err) {
      console.error("Error:", err);
      return { success: false, message: "Erro ao testar conexão" };
    } finally {
      setTesting(null);
    }
  };

  const publishArticle = async (
    integrationId: string,
    articleId: string,
    isUpdate = false
  ): Promise<{ success: boolean; externalUrl?: string; message?: string; code?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("publish-to-cms", {
        body: {
          action: isUpdate ? "update" : "create",
          integrationId,
          articleId,
        },
      });

      // Handle error with response body extraction
      if (error) {
        console.error("Error publishing article:", error);
        
        // Try to extract error body from context (Response object)
        const context = (error as any).context;
        if (context && typeof context.json === 'function') {
          try {
            const errorBody = await context.json();
            return {
              success: false,
              message: errorBody.message || error.message,
              code: errorBody.code,
            };
          } catch {
            // Response body already consumed or invalid
          }
        }
        
        return { 
          success: false, 
          message: error.message || "Erro ao publicar artigo" 
        };
      }

      // Handle successful response with error payload
      if (data && data.success === false) {
        return {
          success: false,
          message: data.message || "Erro ao publicar",
          code: data.code,
        };
      }
      
      // Handle success
      if (data) {
        return {
          success: true,
          externalUrl: data.postUrl,
          message: data.message,
        };
      }

      return { success: false, message: "Resposta inesperada do servidor" };
    } catch (err) {
      console.error("Error:", err);
      return { success: false, message: "Erro ao publicar artigo" };
    }
  };

  const getPublishLogs = async (articleId: string): Promise<CMSPublishLog[]> => {
    const { data, error } = await supabase
      .from("cms_publish_logs")
      .select("*")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching publish logs:", error);
      return [];
    }

    return data as CMSPublishLog[];
  };

  const getActiveIntegration = (platform?: CMSPlatform): CMSIntegration | undefined => {
    if (platform) {
      return integrations.find((i) => i.platform === platform && i.is_active);
    }
    return integrations.find((i) => i.is_active);
  };

  return {
    integrations,
    loading,
    testing,
    addIntegration,
    updateIntegration,
    deleteIntegration,
    testConnection,
    publishArticle,
    getPublishLogs,
    getActiveIntegration,
    refetch: fetchIntegrations,
  };
}
