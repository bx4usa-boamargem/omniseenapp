import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, CheckCircle, XCircle, Loader2, FileText, RefreshCw, RotateCcw, ExternalLink, Trash2, List } from "lucide-react";
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
}

interface ArticleQueueProps {
  blogId: string;
}

export function ArticleQueue({ blogId }: ArticleQueueProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const { toast } = useToast();

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("article_queue")
        .select("*")
        .eq("blog_id", blogId)
        .order("scheduled_for", { ascending: true })
        .limit(50);

      if (error) throw error;
      setItems((data || []) as QueueItem[]);
    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [blogId]);

  useEffect(() => {
    const channel = supabase
      .channel(`article-queue-${blogId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "article_queue",
          filter: `blog_id=eq.${blogId}`,
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
  }, [blogId]);

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

      const { error: invokeError } = await supabase.functions.invoke('process-queue', {
        body: {}
      });

      if (invokeError) {
        console.error("Invoke error:", invokeError);
        throw new Error(invokeError.message || "Failed to process queue");
      }

      toast({
        title: "Tentando novamente",
        description: "O artigo está sendo gerado novamente.",
      });
    } catch (error) {
      console.error("Error retrying:", error);
      toast({
        title: "Erro ao tentar novamente",
        description: error instanceof Error ? error.message : "Não foi possível reprocessar o artigo.",
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

  const handleClearPublished = async () => {
    setClearing(true);
    try {
      const { error } = await supabase
        .from("article_queue")
        .delete()
        .eq("blog_id", blogId)
        .eq("status", "published");

      if (error) throw error;

      toast({
        title: "Fila limpa",
        description: "Todos os artigos publicados foram removidos da fila.",
      });
      
      setItems(items.filter(item => item.status !== 'published'));
    } catch (error) {
      console.error("Error clearing published:", error);
      toast({
        title: "Erro ao limpar",
        description: "Não foi possível remover os itens publicados.",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const handleItemClick = (item: QueueItem) => {
    if (item.article_id) {
      navigate(`/app/articles/${item.article_id}/edit`);
    }
  };

  const publishedCount = items.filter(item => item.status === 'published').length;

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
      case 'pending':
        return 'Agendado';
      case 'generating':
        return 'Gerando';
      case 'generated':
        return 'Gerado';
      case 'published':
        return 'Publicado';
      case 'failed':
        return 'Falhou';
      default:
        return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'generating':
        return 'default';
      case 'generated':
      case 'published':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fila de Artigos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Fila de Artigos</CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => navigate("/app/articles/queue")}
          >
            <List className="h-3 w-3 mr-1" />
            Ver fila completa
          </Button>
          {publishedCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={handleClearPublished}
              disabled={clearing}
            >
              {clearing ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1" />
              )}
              Limpar ({publishedCount})
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={fetchQueue}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum artigo na fila</p>
            <p className="text-xs">Ative a automação para começar a gerar artigos</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
                    item.article_id || item.status === 'generating' ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => (item.article_id || item.status === 'generating') && handleItemClick(item)}
                >
                  <div className="mt-0.5">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm font-medium line-clamp-2 leading-snug">
                          {item.suggested_theme}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>{item.suggested_theme}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getStatusVariant(item.status)} className="text-xs">
                        {getStatusLabel(item.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.scheduled_for), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {item.error_message && (
                      <p className="text-xs text-destructive mt-1">
                        {item.error_message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {item.status === 'failed' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(item.id);
                            }}
                            disabled={retrying === item.id}
                          >
                            {retrying === item.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-1" />
                            )}
                            Tentar novamente
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            disabled={deleting === item.id}
                          >
                            {deleting === item.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3 mr-1" />
                            )}
                            Excluir
                          </Button>
                        </>
                      )}
                      {(item.status === 'published' || item.status === 'generated') && item.article_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/articles/${item.article_id}/edit`);
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ver artigo
                        </Button>
                      )}
                      {item.status === 'generating' && (
                        <span className="text-xs text-blue-500 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Clique para acompanhar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
