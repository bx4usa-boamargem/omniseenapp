import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CallbackState = 'processing' | 'success' | 'error' | 'site-selection';

interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

export default function GoogleOAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>('processing');
  const [message, setMessage] = useState('Processando autenticação...');
  const [sites, setSites] = useState<GSCSite[]>([]);
  const [blogId, setBlogId] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const stateParam = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setState('error');
        setMessage('Acesso negado pelo Google. Por favor, tente novamente.');
        return;
      }

      if (!code || !stateParam) {
        setState('error');
        setMessage('Parâmetros de autenticação ausentes.');
        return;
      }

      // Get code verifier from session storage (PKCE)
      const codeVerifier = sessionStorage.getItem('gsc_code_verifier');
      sessionStorage.removeItem('gsc_code_verifier');

      // Parse state to get blogId
      let parsedState;
      try {
        parsedState = JSON.parse(atob(stateParam));
        setBlogId(parsedState.blogId);
      } catch (e) {
        setState('error');
        setMessage('Estado de autenticação inválido.');
        return;
      }

      // Call callback edge function
      const { data, error: callbackError } = await supabase.functions.invoke('gsc-callback', {
        body: { code, state: stateParam, codeVerifier }
      });

      if (callbackError) {
        console.error('Callback error:', callbackError);
        setState('error');
        setMessage('Não foi possível conectar ao Google. Verifique permissões e tente novamente.');
        return;
      }

      if (!data.success) {
        setState('error');
        setMessage(data.error || 'Erro ao processar autenticação.');
        return;
      }

      setGoogleEmail(data.googleEmail);

      if (data.needsSiteSelection && data.sites?.length > 0) {
        setSites(data.sites);
        setState('site-selection');
        setMessage('Selecione uma propriedade do Search Console');
      } else if (data.sites?.length === 0) {
        setState('error');
        setMessage('Nenhuma propriedade encontrada. Verifique seu Google Search Console.');
      } else {
        setState('success');
        setMessage('Conta Google conectada com sucesso!');
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/client/integrations/gsc');
        }, 2000);
      }
    } catch (e) {
      console.error('OAuth callback error:', e);
      setState('error');
      setMessage('Erro inesperado. Por favor, tente novamente.');
    }
  };

  const handleSelectSite = async (siteUrl: string) => {
    if (!blogId) return;

    try {
      setState('processing');
      setMessage('Configurando propriedade...');

      const { error } = await supabase.functions.invoke('gsc-select-site', {
        body: { blogId, siteUrl }
      });

      if (error) {
        setState('error');
        setMessage('Erro ao selecionar propriedade.');
        return;
      }

      setState('success');
      setMessage('Propriedade configurada com sucesso!');
      
      setTimeout(() => {
        navigate('/app/integrations/google');
      }, 2000);
    } catch (e) {
      setState('error');
      setMessage('Erro ao selecionar propriedade.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {state === 'processing' && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            {state === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
            {state === 'error' && <AlertCircle className="h-6 w-6 text-destructive" />}
            {state === 'site-selection' && "Google Search Console"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
          {googleEmail && state !== 'error' && (
            <p className="text-sm text-muted-foreground mt-2">
              Conta: <strong>{googleEmail}</strong>
            </p>
          )}
        </CardHeader>
        
        <CardContent>
          {state === 'site-selection' && sites.length > 0 && (
            <div className="space-y-2">
              {sites.map((site) => (
                <Button
                  key={site.siteUrl}
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => handleSelectSite(site.siteUrl)}
                >
                  <div>
                    <div className="font-medium">{site.siteUrl}</div>
                    <div className="text-xs text-muted-foreground">
                      {site.permissionLevel === 'siteOwner' ? 'Proprietário' : 'Acesso total'}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
          
          {state === 'error' && (
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => navigate('/app/integrations/google')}
                variant="outline"
              >
                Voltar para Integrações
              </Button>
            </div>
          )}
          
          {state === 'success' && (
            <p className="text-center text-sm text-muted-foreground">
              Redirecionando...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
