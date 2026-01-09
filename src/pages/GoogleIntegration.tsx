import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBlog } from "@/hooks/useBlog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Loader2, 
  RefreshCw, 
  Unlink, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GSCGoogleSearchTab } from "@/components/seo/GSCGoogleSearchTab";
import { GSCOmniseenTab } from "@/components/seo/GSCOmniseenTab";

interface GSCConnection {
  id: string;
  blog_id: string;
  site_url: string;
  google_email: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  connected_at: string | null;
}

interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

interface PerformanceData {
  aggregated: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  };
  positionDistribution: {
    top3: { count: number; percentage: number };
    positions4_10: { count: number; percentage: number };
    positions11_20: { count: number; percentage: number };
    positions21_50: { count: number; percentage: number };
    positions51_100: { count: number; percentage: number };
  };
  dailyData: any[];
  topQueries: any[];
  topPages: any[];
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'loading';

export default function GoogleIntegration() {
  const navigate = useNavigate();
  const { blog, loading: blogLoading } = useBlog();
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [connection, setConnection] = useState<GSCConnection | null>(null);
  const [properties, setProperties] = useState<GSCProperty[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchConnection = useCallback(async () => {
    if (!blog?.id) return;

    try {
      const { data, error } = await supabase
        .from('gsc_connections')
        .select('*')
        .eq('blog_id', blog.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConnection(data);
        if (data.is_active && data.site_url !== 'pending_selection') {
          setStatus('connected');
          fetchPerformance();
        } else if (data.site_url === 'pending_selection') {
          setStatus('connected');
          fetchProperties();
        } else {
          setStatus('disconnected');
        }
      } else {
        setStatus('disconnected');
      }
    } catch (e) {
      console.error('Error fetching connection:', e);
      setStatus('error');
      setErrorMessage('Erro ao verificar conexão');
    }
  }, [blog?.id]);

  const fetchProperties = async () => {
    if (!blog?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('gsc-list-properties', {
        body: { blogId: blog.id }
      });

      if (error) throw error;

      if (data.needsReconnect) {
        setStatus('error');
        setErrorMessage('Sessão expirada. Por favor, reconecte sua conta Google.');
        return;
      }

      setProperties(data.properties || []);
    } catch (e) {
      console.error('Error fetching properties:', e);
    }
  };

  const fetchPerformance = async () => {
    if (!blog?.id) return;

    setIsLoadingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-fetch-performance', {
        body: { blogId: blog.id }
      });

      if (error) throw error;

      if (data.needsConnection || data.needsReconnect) {
        setStatus(data.needsReconnect ? 'error' : 'disconnected');
        setErrorMessage(data.error);
        return;
      }

      if (data.needsSiteSelection) {
        fetchProperties();
        return;
      }

      setPerformanceData(data);
    } catch (e) {
      console.error('Error fetching performance:', e);
      setErrorMessage('Erro ao buscar dados de performance');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (blog?.id) {
      fetchConnection();
    }
  }, [blog?.id, fetchConnection]);

  const handleConnect = async () => {
    if (!blog?.id) return;

    setStatus('connecting');
    setErrorMessage(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const { data, error } = await supabase.functions.invoke('get-gsc-config', {
        body: { blogId: blog.id, userId }
      });

      if (error) throw error;

      if (!data.configured) {
        setStatus('error');
        setErrorMessage('Google OAuth não está configurado.');
        return;
      }

      // Store code verifier for PKCE
      if (data.codeVerifier) {
        sessionStorage.setItem('gsc_code_verifier', data.codeVerifier);
      }

      // Redirect to Google OAuth
      window.location.href = data.authorizationUrl;
    } catch (e) {
      console.error('Error connecting:', e);
      setStatus('error');
      setErrorMessage('Não foi possível iniciar conexão com o Google.');
    }
  };

  const handleDisconnect = async () => {
    if (!blog?.id) return;

    try {
      const { error } = await supabase.functions.invoke('disconnect-gsc', {
        body: { blogId: blog.id }
      });

      if (error) throw error;

      setConnection(null);
      setPerformanceData(null);
      setProperties([]);
      setStatus('disconnected');
      toast.success('Conta Google desconectada');
    } catch (e) {
      console.error('Error disconnecting:', e);
      toast.error('Erro ao desconectar');
    }
  };

  const handleSelectProperty = async (siteUrl: string) => {
    if (!blog?.id) return;

    try {
      const { error } = await supabase.functions.invoke('gsc-select-site', {
        body: { blogId: blog.id, siteUrl }
      });

      if (error) throw error;

      toast.success('Propriedade selecionada com sucesso');
      fetchConnection();
    } catch (e) {
      console.error('Error selecting property:', e);
      toast.error('Erro ao selecionar propriedade');
    }
  };

  const handleSync = async () => {
    setIsLoadingData(true);
    await fetchPerformance();
    toast.success('Dados sincronizados');
  };

  if (blogLoading || status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/integrations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Google Search Console</h1>
            <p className="text-muted-foreground">
              Conecte sua conta Google para ver dados reais de pesquisa orgânica
            </p>
          </div>
        </div>

        {/* Connection Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status === 'connected' ? 'bg-green-500/10' : 'bg-primary/10'}`}>
                  <Search className={`h-6 w-6 ${status === 'connected' ? 'text-green-600' : 'text-primary'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>Status da Conexão</CardTitle>
                    {status === 'connected' && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Conectado
                      </Badge>
                    )}
                    {status === 'disconnected' && (
                      <Badge variant="outline">Desconectado</Badge>
                    )}
                    {status === 'connecting' && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Conectando...
                      </Badge>
                    )}
                    {status === 'error' && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Erro
                      </Badge>
                    )}
                  </div>
                  {connection?.google_email && (
                    <CardDescription className="mt-1">
                      Conta: <strong>{connection.google_email}</strong>
                      {connection.last_sync_at && (
                        <span className="ml-2">
                          • Última sincronização: {formatDistanceToNow(new Date(connection.last_sync_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </span>
                      )}
                    </CardDescription>
                  )}
                  {!connection?.google_email && status !== 'connected' && (
                    <CardDescription>
                      Conecte sua conta Google para ver dados de pesquisa orgânica
                    </CardDescription>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {status === 'connected' && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleSync} disabled={isLoadingData}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
                      Sincronizar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                      <Unlink className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  </>
                )}
                {(status === 'disconnected' || status === 'error') && status !== 'connecting' && (
                  <Button onClick={handleConnect} disabled={status === 'connecting'}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {status === 'error' ? 'Reconectar Google' : 'Conectar Google'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          {errorMessage && (
            <CardContent>
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {errorMessage}
              </div>
            </CardContent>
          )}

          {/* Property Selection */}
          {status === 'connected' && connection?.site_url === 'pending_selection' && properties.length > 0 && (
            <CardContent>
              <div className="space-y-3">
                <h4 className="font-medium">Selecione uma propriedade:</h4>
                {properties.map((prop) => (
                  <Button
                    key={prop.siteUrl}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleSelectProperty(prop.siteUrl)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{prop.siteUrl}</div>
                      <div className="text-xs text-muted-foreground">
                        {prop.permissionLevel === 'siteOwner' ? 'Proprietário' : 'Acesso total'}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          )}

          {/* Selected Property */}
          {status === 'connected' && connection?.site_url && connection.site_url !== 'pending_selection' && (
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Propriedade:</span>
                <Badge variant="secondary">{connection.site_url}</Badge>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Performance Data Tabs */}
        {status === 'connected' && performanceData && (
          <Tabs defaultValue="google" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
              <TabsTrigger value="google">Google Search</TabsTrigger>
              <TabsTrigger value="omniseen">Omniseen</TabsTrigger>
            </TabsList>

            <TabsContent value="google">
              <GSCGoogleSearchTab data={performanceData} isLoading={isLoadingData} />
            </TabsContent>

            <TabsContent value="omniseen">
              <GSCOmniseenTab data={performanceData} isLoading={isLoadingData} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
