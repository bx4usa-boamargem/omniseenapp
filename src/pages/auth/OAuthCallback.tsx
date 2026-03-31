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
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    
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
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setStatus('Erro ao finalizar login');
          setTimeout(() => safeRedirect('/login'), 2000);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('return_to');

        if (returnTo && session) {
          try {
            const returnUrl = new URL(returnTo);
            const isValidDomain = 
              returnUrl.hostname.endsWith('.omniseen.app') ||
              returnUrl.hostname === 'omniseen.app' ||
              returnUrl.hostname === 'localhost' ||
              returnUrl.hostname.includes('lovable.app');
            
            if (isValidDomain) {
              setStatus('Redirecionando...');
              safeRedirect(returnTo, true);
              return;
            }
          } catch {
            // Invalid URL, fall through to default redirect
          }
        }
        
        if (session) {
          safeRedirect('/client/dashboard');
        } else {
          safeRedirect('/login');
        }
      } catch {
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
