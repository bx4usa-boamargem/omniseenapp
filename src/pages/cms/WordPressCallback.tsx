import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WordPressCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state"); // This is the blogId
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        console.error("OAuth error:", error, errorDescription);
        setStatus("error");
        setMessage(errorDescription || "Autorização cancelada ou negada");
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Parâmetros de callback inválidos");
        return;
      }

      try {
        console.log("Processing OAuth callback with code and blogId:", state);
        
        const { data, error: callbackError } = await supabase.functions.invoke(
          "wordpress-com-oauth",
          {
            body: { 
              action: "callback", 
              code, 
              blogId: state 
            },
          }
        );

        if (callbackError) {
          console.error("Callback error:", callbackError);
          throw new Error(callbackError.message);
        }

        if (data?.success) {
          setStatus("success");
          setMessage(data.message || "WordPress.com conectado com sucesso!");
          setSiteUrl(data.siteUrl || "");
        } else {
          throw new Error(data?.message || "Falha ao processar callback");
        }
      } catch (err) {
        console.error("Callback processing error:", err);
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Erro ao processar autorização");
      }
    };

    handleCallback();
  }, [searchParams]);

  const handleClose = () => {
    // Try to close if popup, otherwise navigate back
    if (window.opener) {
      window.opener.postMessage({ type: "wordpress-oauth-complete", status }, "*");
      window.close();
    } else {
      navigate("/client/automation?tab=integrations");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            )}
            {status === "success" && (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Conectando..."}
            {status === "success" && "Conectado!"}
            {status === "error" && "Erro na Conexão"}
          </CardTitle>
          <CardDescription>
            {status === "loading" 
              ? "Processando autorização do WordPress.com..." 
              : message}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          {status === "success" && siteUrl && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Site conectado:</p>
              <p className="font-medium">{siteUrl}</p>
            </div>
          )}
          
          {status !== "loading" && (
            <Button onClick={handleClose} className="w-full">
              {status === "success" ? "Continuar" : "Tentar Novamente"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
