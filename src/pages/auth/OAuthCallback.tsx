/**
 * OAuthCallback - Centralized OAuth callback handler
 * 
 * Responsável por:
 * - Aguardar estabelecimento da sessão Supabase
 * - Redirecionar para o subdomínio/rota correta
 * - Usar guard para evitar múltiplos redirects (previne race conditions)
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Finalizando login...');
  const hasRedirectedRef = useRef(false);
  const hasStartedRef = useRef(false);

  const safeRedirect = (path: string, isExternal = false) => {
    if (hasRedirectedRef.current) {
      console.log('[OAuthCallback] Redirect already in progress, skipping');
      return;
    }
    hasRedirectedRef.current = true;
    console.log('[OAuthCallback] Safe redirect to:', path, isExternal ? '(external)' : '(internal)');
    
    if (isExternal) {
      window.location.href = path;
    } else {
      navigate(path, { replace: true });
    }
  };

  useEffect(() => {
    // Prevent multiple executions
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    
    const handleCallback = async () => {
      console.log('[OAuthCallback] Starting callback handler');
      
      try {
        // Aguardar a sessão ser estabelecida pelo Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[OAuthCallback] Session error:', error);
          setStatus('Erro ao finalizar login');
          setTimeout(() => safeRedirect('/login'), 2000);
          return;
        }

        console.log('[OAuthCallback] Session status:', session ? 'active' : 'none');

        // Ler o return_to do query string
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('return_to');

        console.log('[OAuthCallback] return_to:', returnTo);

        if (returnTo && session) {
          try {
            const returnUrl = new URL(returnTo);
            const isValidDomain = 
              returnUrl.hostname.endsWith('.omniseen.app') ||
              returnUrl.hostname === 'omniseen.app' ||
              returnUrl.hostname === 'localhost' ||
              returnUrl.hostname.includes('lovable.app');
            
            if (isValidDomain) {
              console.log('[OAuthCallback] Valid return_to domain, redirecting externally');
              setStatus('Redirecionando...');
              safeRedirect(returnTo, true);
              return;
            } else {
              console.warn('[OAuthCallback] Invalid return_to domain:', returnUrl.hostname);
            }
          } catch (urlError) {
            console.warn('[OAuthCallback] Invalid return_to URL:', returnTo, urlError);
          }
        }
        
        // Fallback paths
        if (session) {
          console.log('[OAuthCallback] Redirecting to dashboard (fallback)');
          safeRedirect('/client/dashboard');
        } else {
          console.log('[OAuthCallback] No session, redirecting to login');
          safeRedirect('/login');
        }
      } catch (err) {
        console.error('[OAuthCallback] Unexpected error:', err);
        safeRedirect('/login');
      }
    };

    handleCallback();
  }, []); // Sem dependências para executar apenas uma vez

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">{status}</p>
    </div>
  );
}
