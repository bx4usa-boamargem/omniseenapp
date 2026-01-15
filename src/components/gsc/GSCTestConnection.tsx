import { useState } from 'react';
import { PlayCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
}

interface GSCTestConnectionProps {
  blogId?: string;
  onSuccess?: () => void;
}

export function GSCTestConnection({ blogId, onSuccess }: GSCTestConnectionProps) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [overallSuccess, setOverallSuccess] = useState<boolean | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResults([]);
    setOverallSuccess(null);

    const testResults: TestResult[] = [];

    // Test 1: Check secrets configuration
    try {
      const { data, error } = await supabase.functions.invoke('get-gsc-config', {
        body: { blogId, checkOnly: true }
      });

      if (error) {
        testResults.push({
          step: 'Verificar Secrets',
          success: false,
          message: `Erro: ${error.message}`
        });
      } else if (!data?.configured) {
        testResults.push({
          step: 'Verificar Secrets',
          success: false,
          message: data?.error || 'GOOGLE_CLIENT_ID não configurado'
        });
      } else {
        testResults.push({
          step: 'Verificar Secrets',
          success: true,
          message: 'Client ID configurado corretamente'
        });

        // Test 2: Check redirect URI
        if (data.redirectUri) {
          testResults.push({
            step: 'URI de Redirecionamento',
            success: true,
            message: data.redirectUri
          });
        }

        // Test 3: Check authorization URL format
        if (data.authorizationUrl) {
          const url = new URL(data.authorizationUrl);
          const hasClientId = url.searchParams.has('client_id');
          const hasRedirect = url.searchParams.has('redirect_uri');
          const hasScope = url.searchParams.has('scope');
          const hasCodeChallenge = url.searchParams.has('code_challenge');

          if (hasClientId && hasRedirect && hasScope && hasCodeChallenge) {
            testResults.push({
              step: 'URL de Autorização',
              success: true,
              message: 'Formato correto com PKCE'
            });
          } else {
            testResults.push({
              step: 'URL de Autorização',
              success: false,
              message: 'Parâmetros ausentes na URL'
            });
          }
        }
      }
    } catch (err) {
      testResults.push({
        step: 'Conexão com Backend',
        success: false,
        message: err instanceof Error ? err.message : 'Erro desconhecido'
      });
    }

    setResults(testResults);
    
    const allSuccess = testResults.every(r => r.success);
    setOverallSuccess(allSuccess);
    setTesting(false);

    if (allSuccess) {
      onSuccess?.();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Testar Configuração</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={runTest}
          disabled={testing}
          className="gap-2"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Executar Teste
            </>
          )}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 p-2 rounded-lg ${
                result.success 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-red-500/10 border border-red-500/20'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {result.step}
                </div>
                <div className="text-xs text-muted-foreground break-all">
                  {result.message}
                </div>
              </div>
            </div>
          ))}

          {overallSuccess !== null && (
            <div className={`mt-3 p-3 rounded-lg text-center ${
              overallSuccess 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-amber-500/10 border border-amber-500/20'
            }`}>
              <p className={`text-sm font-medium ${
                overallSuccess 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {overallSuccess 
                  ? '✅ Configuração pronta! Você pode conectar ao Google.' 
                  : '⚠️ Corrija os erros acima antes de conectar.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
