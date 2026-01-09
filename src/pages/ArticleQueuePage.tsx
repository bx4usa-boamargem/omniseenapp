import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBlog } from "@/hooks/useBlog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  FileText, 
  RefreshCw, 
  RotateCcw, 
  ExternalLink, 
  Trash2,
  ArrowLeft,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface QueueItem {
  id: string;
  suggested_theme: string;
  status: string;
  scheduled_for: string;
  error_message?: string;
  created_at: string;
  article_id?: string;
  generation_source?: string;
}

export default function ArticleQueuePage() {
  const navigate = useNavigate();
  const { blog, loading: blogLoading } = useBlog();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const refreshTimer = useRef<number | null>(null);
  const { toast } = useToast();

  const fetchQueue = async () => {
    if (!blog?.id) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("article_queue")
        .select("*")
        .eq("blog_id", blog.id)
        .order("scheduled_for", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setItems((data || []) as QueueItem[]);
    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (blog?.id) {
      fetchQueue();
    }
  }, [blog?.id, statusFilter]);

  useEffect(() => {
    if (!blog?.id) return;

    const channel = supabase
      .channel(`article-queue-full-${blog.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "article_queue",
          filter: `blog_id=eq.${blog.id}`,
        },
        () => {
          if (refreshTimer.current) {
            window.clearTimeout(refreshTimer.current);
          }
          refreshTimer.current = window.setTimeout(() => {
            fetchQueue();
          }, 400);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) {
        window.clearTimeout(refreshTimer.current);
      }
      supabase.removeChannel(channel);
    };
  }, [blog?.id]);

  const handleRetry = async (itemId: string) => {
    setRetrying(itemId);
    try {
      const { error: updateError } = await supabase
        .from("article_queue")
        .update({
          status: "pending",
          error_message: null,
          scheduled_for: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (updateError) throw updateError;

      await supabase.functions.invoke('process-queue', { body: {} });

      toast({
        title: "Tentando novamente",
        description: "O artigo está sendo gerado novamente.",
      });
    } catch (error) {
      console.error("Error retrying:", error);
      toast({
        title: "Erro ao tentar novamente",
        description: "Não foi possível reprocessar o artigo.",
        variant: "destructive",
      });
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeleting(itemId);
    try {
      const { error } = await supabase
        .from("article_queue")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      toast({
        title: "Item removido",
        description: "O artigo foi removido da fila.",
      });
      
      setItems(items.filter(item => item.id !== itemId));
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o item da fila.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleItemClick = (item: QueueItem) => {
    if (item.article_id) {
      navigate(`/app/articles/${item.article_id}/edit`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'generating':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'generated':
      case 'published':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Agendado';
      case 'generating': return 'Gerando';
      case 'generated': return 'Gerado';
      case 'published': return 'Publicado';
      case 'failed': return 'Falhou';
      default: return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'generating': return 'default';
      case 'generated':
      case 'published': return 'default';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getOriginLabel = (source?: string) => {
    if (!source) return 'Manual';
    switch (source) {
      case 'automation': return 'Automação';
      case 'funnel': return 'Funil';
      case 'cluster': return 'Cluster';
      case 'chat': return 'Chat IA';
      default: return 'Manual';
    }
  };

  const filteredItems = items.filter(item => 
    searchQuery === "" || 
    item.suggested_theme.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (blogLoading) {
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
      <div className="container py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Fila de Artigos</h1>
            <p className="text-muted-foreground">
              Visualize e gerencie todos os artigos na fila de geração
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Agendado</SelectItem>
                  <SelectItem value="generating">Gerando</SelectItem>
                  <SelectItem value="generated">Gerado</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchQueue} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Queue List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>
                {filteredItems.length} artigo{filteredItems.length !== 1 ? 's' : ''} na fila
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum artigo na fila</p>
                <p className="text-sm">Configure a automação ou crie artigos manualmente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
                      item.article_id || item.status === 'generating' ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => (item.article_id || item.status === 'generating') && handleItemClick(item)}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {getStatusIcon(item.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-2">
                          {item.suggested_theme}
                        </p>
                        {item.error_message && (
                          <p className="text-sm text-destructive mt-1">
                            {item.error_message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-4">
                      <Badge variant={getStatusVariant(item.status)}>
                        {getStatusLabel(item.status)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(item.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getOriginLabel(item.generation_source)}
                      </Badge>

                      <div className="flex items-center gap-1">
                        {item.status === 'failed' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetry(item.id);
                              }}
                              disabled={retrying === item.id}
                            >
                              {retrying === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                              disabled={deleting === item.id}
                            >
                              {deleting === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        {item.article_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/articles/${item.article_id}/edit`);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status === 'generating' && (
                          <span className="text-xs text-blue-500 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Acompanhar
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}