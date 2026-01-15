import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, XCircle, Loader2, ExternalLink, ArrowLeft, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBlog } from '@/hooks/useBlog';
import { useGSCConnection } from '@/hooks/useGSCConnection';
import { GSCConfigChecker } from '@/components/gsc/GSCConfigChecker';
import { GSCSetupGuide } from '@/components/gsc/GSCSetupGuide';
import { GSCTestConnection } from '@/components/gsc/GSCTestConnection';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientGSCIntegration() {
  const navigate = useNavigate();
  const { blog, loading: blogLoading } = useBlog();
  const [configReady, setConfigReady] = useState(false);
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
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Google Search Console</h1>
          <p className="text-muted-foreground mt-1">Conecte para ver métricas reais do seu blog no Google</p>
        </div>
      </div>

      {connection ? (
        // Connected State
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-foreground">Conectado ao Google</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Sua conta está sincronizando dados do Search Console
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Domínio:</span>
                <a 
                  href={connection.site_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  {connection.site_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              
              {connection.last_sync_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Última sincronização:</span>
                  <span className="text-sm text-foreground">
                    {format(new Date(connection.last_sync_at), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
              
              {connection.connected_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Conectado em:</span>
                  <span className="text-sm text-foreground">
                    {format(new Date(connection.connected_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={disconnect}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              Desconectar
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Not Connected State - Show Tabs
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-foreground">Google Search Console</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Monitore cliques, impressões e palavras-chave do seu site
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="connect" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="connect" className="gap-2">
                  <Search className="h-4 w-4" />
                  Conectar
                </TabsTrigger>
                <TabsTrigger value="setup" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configuração
                </TabsTrigger>
              </TabsList>

              <TabsContent value="connect" className="space-y-6">
                {/* Config Status */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <GSCConfigChecker blogId={blog?.id} onStatusChange={setConfigReady} />
                </div>

                {/* Test Connection */}
                <div className="p-4 rounded-lg border border-border">
                  <GSCTestConnection blogId={blog?.id} />
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {/* Connect Button */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={connect}
                    disabled={isConnecting || !configReady}
                    className="flex-1"
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

                {!configReady && (
                  <p className="text-xs text-muted-foreground text-center">
                    Configure o Google Cloud Console antes de conectar. 
                    Veja a aba "Configuração" para instruções.
                  </p>
                )}

                {/* Info Section */}
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Como funciona?
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Você autoriza o acesso à sua conta do Google</li>
                    <li>• Sincronizamos automaticamente as métricas do seu site</li>
                    <li>• Atualizamos os dados diariamente</li>
                    <li>• Se você acabou de conectar, aguarde 48-72h para os primeiros dados</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="setup" className="space-y-4">
                <GSCSetupGuide redirectUri="https://omniseeblog.lovable.app/oauth/google/callback" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
