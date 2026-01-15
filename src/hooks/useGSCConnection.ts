import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GSCConnection {
  id: string;
  blog_id: string;
  site_url: string;
  is_active: boolean;
  last_sync_at: string | null;
  connected_at: string | null;
}

export function useGSCConnection(blogId: string | undefined) {
  const [connection, setConnection] = useState<GSCConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnection = useCallback(async () => {
    if (!blogId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from("gsc_connections")
        .select("*")
        .eq("blog_id", blogId)
        .eq("is_active", true)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setConnection(data);
    } catch (err) {
      console.error("Error fetching GSC connection:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch connection");
    } finally {
      setIsLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const connect = useCallback(async () => {
    if (!blogId) {
      console.error("useGSCConnection.connect: blogId is missing");
      setError("Blog não identificado. Recarregue a página.");
      return;
    }

    console.log("useGSCConnection.connect: Starting GSC connection for blogId:", blogId);
    setIsConnecting(true);
    setError(null);
    
    try {
      // Get user ID for state
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      console.log("useGSCConnection.connect: Calling get-gsc-config with blogId:", blogId);
      const { data: configData, error: configError } = await supabase.functions.invoke(
        "get-gsc-config",
        { body: { blogId, userId } }
      );

      console.log("useGSCConnection.connect: get-gsc-config response:", configData, configError);

      if (configError) {
        throw new Error(`Erro ao obter configuração: ${configError.message}`);
      }

      if (!configData?.configured) {
        throw new Error("Google OAuth não está configurado. Entre em contato com o suporte.");
      }

      // Use the authorizationUrl returned by the edge function (includes PKCE)
      if (configData.authorizationUrl) {
        console.log("useGSCConnection.connect: Redirecting to authorizationUrl");
        
        // Store code_verifier in sessionStorage for callback
        if (configData.codeVerifier) {
          sessionStorage.setItem('gsc_code_verifier', configData.codeVerifier);
          console.log("useGSCConnection.connect: Stored code_verifier in sessionStorage");
        }
        
        window.location.href = configData.authorizationUrl;
      } else {
        throw new Error("URL de autorização não retornada pelo servidor.");
      }
    } catch (err) {
      console.error("useGSCConnection.connect: Error initiating GSC connection:", err);
      setError(err instanceof Error ? err.message : "Falha ao conectar. Tente novamente.");
      setIsConnecting(false);
    }
  }, [blogId]);

  const disconnect = useCallback(async () => {
    if (!blogId || !connection) return;

    try {
      const { error: disconnectError } = await supabase.functions.invoke(
        "disconnect-gsc",
        { body: { blogId } }
      );

      if (disconnectError) throw disconnectError;
      setConnection(null);
    } catch (err) {
      console.error("Error disconnecting GSC:", err);
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }, [blogId, connection]);

  const handleCallback = useCallback(async (code: string, state: string) => {
    try {
      const { error: callbackError } = await supabase.functions.invoke(
        "gsc-callback",
        { body: { code, state } }
      );

      if (callbackError) throw callbackError;
      await fetchConnection();
    } catch (err) {
      console.error("Error handling GSC callback:", err);
      setError(err instanceof Error ? err.message : "Failed to complete connection");
    }
  }, [fetchConnection]);

  return {
    connection,
    isLoading,
    isConnecting,
    error,
    connect,
    disconnect,
    handleCallback,
    refetch: fetchConnection,
  };
}
