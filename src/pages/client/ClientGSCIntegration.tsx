import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, XCircle, Loader2, ExternalLink, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBlog } from '@/hooks/useBlog';
import { useGSCConnection } from '@/hooks/useGSCConnection';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientGSCIntegration() {
  const navigate = useNavigate();
  const { blog, loading: blogLoading } = useBlog();
  const { 
    connection, 
    isLoading: connectionLoading, 
    isConnecting, 
    connect, 
    disconnect,
    error 
  } = useGSCConnection(blog?.id);

  const isLoading = blogLoading || connectionLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/client/performance')}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Google Search Console</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Conecte para ver métricas reais do seu blog no Google</p>
        </div>
      </div>

      {/* Main Card */}
      <Card className="client-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 dark:bg-white/10 flex items-center justify-center">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-gray-900 dark:text-white">Google Search Console</CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Monitore cliques, impressões e palavras-chave do seu site
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5">
            {connection ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-green-400 font-medium">Conectado</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Domínio:</span>
                    <a 
                      href={connection.site_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {connection.site_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  
                  {connection.last_sync_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Última sincronização:</span>
                      <span className="text-white">
                        {format(new Date(connection.last_sync_at), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  
                  {connection.connected_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Conectado em:</span>
                      <span className="text-white">
                        {format(new Date(connection.connected_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={disconnect}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full sm:w-auto"
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-gray-500" />
                  <span className="text-gray-400 font-medium">Não conectado</span>
                </div>

                <p className="text-sm text-gray-500">
                  Conecte sua conta do Google para ver cliques, impressões e palavras-chave 
                  que estão trazendo tráfego para o seu blog.
                </p>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  onClick={connect}
                  disabled={isConnecting}
                  className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Conectar com Google
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <h4 className="text-sm font-medium text-blue-400 mb-2">
              Como funciona?
            </h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Você autoriza o acesso à sua conta do Google</li>
              <li>• Sincronizamos automaticamente as métricas do seu site</li>
              <li>• Atualizamos os dados diariamente</li>
              <li>• Se você acabou de conectar, aguarde 48-72h para os primeiros dados</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
