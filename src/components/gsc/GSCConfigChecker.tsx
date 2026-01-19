import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ConfigStatus {
  clientIdConfigured: boolean;
  redirectUri: string;
  error?: string;
  loading: boolean;
}

interface GSCConfigCheckerProps {
  blogId?: string;
  onStatusChange?: (ready: boolean) => void;
}

export function GSCConfigChecker({ blogId, onStatusChange }: GSCConfigCheckerProps) {
  const [status, setStatus] = useState<ConfigStatus>({
    clientIdConfigured: false,
    redirectUri: '',
    loading: true
  });

  useEffect(() => {
    checkConfiguration();
  }, [blogId]);

  const checkConfiguration = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true }));
      
      const { data, error } = await supabase.functions.invoke('get-gsc-config', {
        body: { blogId, checkOnly: true }
      });

      if (error) {
        setStatus({
          clientIdConfigured: false,
          redirectUri: '',
          error: error.message,
          loading: false
        });
        onStatusChange?.(false);
        return;
      }

      const isReady = data?.configured === true;
      
      // Check for whitespace issues in clientId
      const hasWhitespaceIssue = data?.clientId && data.clientId !== data.clientId.trim();
      
      setStatus({
        clientIdConfigured: data?.configured || false,
        redirectUri: (data?.redirectUri || '').trim(),
        error: hasWhitespaceIssue 
          ? 'O Client ID contém espaços em branco. Remova-os nas configurações de Secrets.'
          : data?.error,
        loading: false
      });
      onStatusChange?.(isReady && !hasWhitespaceIssue);
    } catch (err) {
      setStatus({
        clientIdConfigured: false,
        redirectUri: '',
        error: 'Erro ao verificar configuração',
        loading: false
      });
      onStatusChange?.(false);
    }
  };

  if (status.loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Verificando configuração...</span>
      </div>
    );
  }

  const items = [
    {
      label: 'Google Client ID',
      ok: status.clientIdConfigured,
      description: status.clientIdConfigured 
        ? 'Configurado corretamente' 
        : 'Não configurado no Google Cloud Console'
    },
    {
      label: 'URI de Redirecionamento',
      ok: !!status.redirectUri,
      description: status.redirectUri || 'Não disponível'
    }
  ];

  const allOk = items.every(item => item.ok);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        {allOk ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        )}
        <span className="font-medium text-foreground">
          {allOk ? 'Configuração OK' : 'Configuração Pendente'}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div 
            key={index}
            className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
          >
            {item.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{item.label}</div>
              <div className="text-xs text-muted-foreground truncate">
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      {status.error && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{status.error}</p>
        </div>
      )}
    </div>
  );
}
