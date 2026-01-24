import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * OAuthCallback: Handler centralizado para callbacks OAuth
 * 
 * Fluxo:
 * 1. Usuário faz login OAuth em subdomínio (ex: cliente.app.omniseen.app)
 * 2. OAuth redireciona para app.omniseen.app/oauth/callback?return_to=...
 * 3. Este componente estabelece a sessão e redireciona para o subdomínio original
 * 
 * Isso resolve o problema de redirect URLs do Supabase Auth que não suportam wildcards
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Finalizando login...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Aguardar a sessão ser estabelecida pelo Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[OAuthCallback] Session error:', error);
          setStatus('Erro ao finalizar login');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        // Ler o return_to do query string
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('return_to');

        if (returnTo && session) {
          // Validar que o returnTo é um domínio omniseen válido para segurança
          try {
            const returnUrl = new URL(returnTo);
            const isValidDomain = 
              returnUrl.hostname.endsWith('.omniseen.app') ||
              returnUrl.hostname === 'omniseen.app' ||
              returnUrl.hostname === 'localhost' ||
              returnUrl.hostname.includes('lovable.app');
            
            if (isValidDomain) {
              setStatus('Redirecionando...');
              window.location.href = returnTo;
              return;
            }
          } catch {
            // URL inválida, ignora
          }
        }
        
        if (session) {
          // Fallback para dashboard local
          navigate('/client/dashboard');
        } else {
          // Sem sessão, volta pro login
          navigate('/login');
        }
      } catch (err) {
        console.error('[OAuthCallback] Unexpected error:', err);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">{status}</p>
    </div>
  );
}
