import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Package, 
  Loader2, 
  Clock, 
  CheckCircle, 
  CheckCircle2, 
  XCircle, 
  SkipForward,
  Search,
  RefreshCw,
  Eye,
  Send,
  Trash2,
  RotateCcw,
  ExternalLink,
  Play,
  Settings2,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePublishValidation, PublishValidationResult } from '@/hooks/usePublishValidation';
import { PublishWithBoostDialog } from '@/components/editor/PublishWithBoostDialog';

interface QueueItem {
  id: string;
  suggested_theme: string;
  scheduled_for: string | null;
  status: string;
  article_id: string | null;
  generation_source: string | null;
  error_message: string | null;
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'generating' | 'generated' | 'published' | 'skipped' | 'failed';

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}> = {
  pending: {
    label: 'Aguardando',
    icon: Clock,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  generating: {
    label: 'Gerando',
    icon: Loader2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  generated: {
    label: 'Pronto p/ Revisão',
    icon: CheckCircle,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  published: {
    label: 'Publicado',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-600/10',
  },
  skipped: {
    label: 'Ignorado',
    icon: SkipForward,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
  },
  failed: {
    label: 'Falhou',
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  automation: 'Automação',
  chat: 'Chat IA',
  manual: 'Manual',
};

export default function ClientQueue() {
  const { blog } = useBlog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<QueueItem | null>(null);

  // Publish validation
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<PublishValidationResult | null>(null);
  const [selectedItemForPublish, setSelectedItemForPublish] = useState<QueueItem | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!blog?.id) return;

    try {
      const { data, error } = await supabase
        .from('article_queue')
        .select('*')
        .eq('blog_id', blog.id)
        .order('scheduled_for', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setQueue(data || []);
    } catch (error) {
      console.error('Error fetching queue:', error);
      toast.error('Erro ao carregar fila');
    }
  }, [blog?.id]);

  useEffect(() => {
    if (!blog?.id) return;

    const loadData = async () => {
      setLoading(true);
      await fetchQueue();
      setLoading(false);
    };

    loadData();

    // Realtime subscription
    const channel = supabase
      .channel(`queue-${blog.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'article_queue',
          filter: `blog_id=eq.${blog.id}`,
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [blog?.id, fetchQueue]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchQueue();
    setRefreshing(false);
    toast.success('Fila atualizada!');
  };

  const handleCancel = async (item: QueueItem) => {
    setActionLoading(item.id);
    try {
      const { error } = await supabase
        .from('article_queue')
        .update({ status: 'skipped' })
        .eq('id', item.id);

      if (error) throw error;
      toast.success('Artigo cancelado');
      fetchQueue();
    } catch (error) {
      console.error('Error canceling item:', error);
      toast.error('Erro ao cancelar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (item: QueueItem) => {
    setActionLoading(item.id);
    try {
      const { error } = await supabase
        .from('article_queue')
        .update({ status: 'pending', error_message: null })
        .eq('id', item.id);

      if (error) throw error;

      // Trigger processing
      await supabase.functions.invoke('process-queue');

      toast.success('Reprocessando artigo...');
      fetchQueue();
    } catch (error) {
      console.error('Error retrying item:', error);
      toast.error('Erro ao reprocessar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (item: QueueItem) => {
    setActionLoading(item.id);
    try {
      const { error } = await supabase
        .from('article_queue')
        .update({ status: 'pending' })
        .eq('id', item.id);

      if (error) throw error;
      toast.success('Artigo reativado');
      fetchQueue();
    } catch (error) {
      console.error('Error reactivating item:', error);
      toast.error('Erro ao reativar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.id);
    try {
      const { error } = await supabase
        .from('article_queue')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;
      toast.success('Artigo removido da fila');
      fetchQueue();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Erro ao remover');
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  };

  const handlePublishNow = async (item: QueueItem) => {
    if (!item.article_id || !blog?.id) return;
    
    // STEP 1: Validate SERP Score
    setActionLoading(item.id);
    
    // Fetch article data for validation
    const { data: articleData } = await supabase
      .from('articles')
      .select('content, title, keywords')
      .eq('id', item.article_id)
      .single();

    // Create temporary validation hook call
    const { data: scoreData } = await supabase
      .from('article_content_scores')
      .select('total_score, serp_analysis_id')
      .eq('article_id', item.article_id)
      .maybeSingle();

    const { data: blogConfig } = await supabase
      .from('blog_config')
      .select('minimum_score_to_publish')
      .eq('blog_id', blog.id)
      .maybeSingle();

    const minScore = blogConfig?.minimum_score_to_publish ?? 70;

    // Check validation
    if (!scoreData || !scoreData.serp_analysis_id || scoreData.total_score < minScore) {
      setSelectedItemForPublish(item);
      setValidationResult({
        canPublish: false,
        reason: !scoreData ? 'Análise SERP não realizada' 
          : !scoreData.serp_analysis_id ? 'Análise de concorrência não realizada'
          : `Score ${scoreData.total_score} abaixo do mínimo (${minScore})`,
        showBoost: !!scoreData?.serp_analysis_id && scoreData.total_score < minScore,
        showAnalyze: !scoreData?.serp_analysis_id,
        currentScore: scoreData?.total_score ?? null,
        minScore,
        serpAnalyzed: !!scoreData?.serp_analysis_id,
      });
      setBoostDialogOpen(true);
      setActionLoading(null);
      return; // Block publication
    }

    // STEP 2: Proceed with publication
    try {
      // Update article status
      const { error: articleError } = await supabase
        .from('articles')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', item.article_id);

      if (articleError) throw articleError;

      // Update queue item
      const { error: queueError } = await supabase
        .from('article_queue')
        .update({ status: 'published' })
        .eq('id', item.id);

      if (queueError) throw queueError;

      toast.success('🚀 Artigo publicado!');
      fetchQueue();
    } catch (error) {
      console.error('Error publishing:', error);
      toast.error('Erro ao publicar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBoostComplete = async (newScore: number, newContent: string) => {
    if (!selectedItemForPublish?.article_id) return;
    
    // Update article with optimized content
    await supabase
      .from('articles')
      .update({ content: newContent })
      .eq('id', selectedItemForPublish.article_id);

    // Re-check validation
    const { data: blogConfig } = await supabase
      .from('blog_config')
      .select('minimum_score_to_publish')
      .eq('blog_id', blog?.id)
      .maybeSingle();

    const minScore = blogConfig?.minimum_score_to_publish ?? 70;

    setValidationResult(prev => prev ? {
      ...prev,
      currentScore: newScore,
      canPublish: newScore >= minScore,
    } : null);
  };

  const handlePublishAfterBoost = () => {
    setBoostDialogOpen(false);
    if (selectedItemForPublish) {
      // Direct publish without validation (already validated)
      handleDirectPublish(selectedItemForPublish);
    }
  };

  const handleDirectPublish = async (item: QueueItem) => {
    if (!item.article_id) return;
    setActionLoading(item.id);
    try {
      const { error: articleError } = await supabase
        .from('articles')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', item.article_id);

      if (articleError) throw articleError;

      const { error: queueError } = await supabase
        .from('article_queue')
        .update({ status: 'published' })
        .eq('id', item.id);

      if (queueError) throw queueError;

      toast.success('🚀 Artigo publicado!');
      fetchQueue();
    } catch (error) {
      console.error('Error publishing:', error);
      toast.error('Erro ao publicar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReview = (item: QueueItem) => {
    if (item.article_id) {
      navigate(`/client/review/${item.article_id}`);
    }
  };

  const handleViewArticle = (item: QueueItem) => {
    if (item.article_id) {
      navigate(`/client/articles/${item.article_id}/edit`);
    }
  };

  // Filter queue items
  const filteredQueue = queue.filter((item) => {
    const matchesSearch = item.suggested_theme.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
            <Package className="h-8 w-8 text-primary" />
            Fila de Produção
          </h1>
          <p className="text-muted-foreground mt-1">
            Aqui você vê tudo que está sendo preparado para o seu blog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/client/automation')}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="client-card">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tema..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Aguardando</SelectItem>
                <SelectItem value="generating">Gerando</SelectItem>
                <SelectItem value="generated">Prontos</SelectItem>
                <SelectItem value="published">Publicados</SelectItem>
                <SelectItem value="skipped">Ignorados</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Queue Table */}
      <Card className="client-card overflow-hidden">
        {filteredQueue.length === 0 ? (
          <CardContent className="py-16">
            <div className="text-center">
              <Inbox className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {queue.length === 0 ? 'Sua fila está vazia' : 'Nenhum resultado encontrado'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {queue.length === 0
                  ? 'A máquina está pronta. Ative o Piloto Automático para começar a produzir.'
                  : 'Tente ajustar os filtros para encontrar o que procura.'}
              </p>
              {queue.length === 0 && (
                <Button
                  onClick={() => navigate('/client/automation')}
                  className="client-btn-primary"
                >
                  Configurar Automação
                </Button>
              )}
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px]">Tema</TableHead>
                  <TableHead className="min-w-[140px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Data</TableHead>
                  <TableHead className="min-w-[100px]">Origem</TableHead>
                  <TableHead className="min-w-[180px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.map((item) => {
                  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const isLoading = actionLoading === item.id;

                  return (
                    <TableRow key={item.id} className="group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground line-clamp-2">
                            {item.suggested_theme}
                          </span>
                          {item.error_message && (
                            <span className="text-xs text-red-500 mt-1">
                              {item.error_message}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "gap-1.5",
                            statusConfig.bgColor,
                            statusConfig.color
                          )}
                        >
                          <StatusIcon className={cn(
                            "h-3.5 w-3.5",
                            item.status === 'generating' && "animate-spin"
                          )} />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.scheduled_for
                          ? format(new Date(item.scheduled_for), "dd MMM, HH:mm", { locale: ptBR })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {SOURCE_LABELS[item.generation_source || 'automation'] || item.generation_source}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              {/* Pending actions */}
                              {item.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancel(item)}
                                  className="text-muted-foreground hover:text-red-500"
                                >
                                  Cancelar
                                </Button>
                              )}

                              {/* Generating actions */}
                              {item.status === 'generating' && item.article_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewArticle(item)}
                                  className="gap-1"
                                >
                                  <Eye className="h-4 w-4" />
                                  Acompanhar
                                </Button>
                              )}

                              {/* Generated actions */}
                              {item.status === 'generated' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReview(item)}
                                    className="gap-1"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Revisar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePublishNow(item)}
                                    className="gap-1 text-emerald-600 hover:text-emerald-700"
                                  >
                                    <Send className="h-4 w-4" />
                                    Publicar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirm(item)}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}

                              {/* Published actions */}
                              {item.status === 'published' && item.article_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewArticle(item)}
                                  className="gap-1"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Ver
                                </Button>
                              )}

                              {/* Skipped actions */}
                              {item.status === 'skipped' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReactivate(item)}
                                  className="gap-1"
                                >
                                  <Play className="h-4 w-4" />
                                  Reativar
                                </Button>
                              )}

                              {/* Failed actions */}
                              {item.status === 'failed' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRetry(item)}
                                    className="gap-1"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Tentar Novamente
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirm(item)}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desistir deste artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O artigo será removido permanentemente da fila de produção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Sim, desistir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish Validation Dialog */}
      {selectedItemForPublish && validationResult && (
        <PublishWithBoostDialog
          open={boostDialogOpen}
          onOpenChange={(open) => {
            setBoostDialogOpen(open);
            if (!open) setSelectedItemForPublish(null);
          }}
          articleId={selectedItemForPublish.article_id || ''}
          blogId={blog?.id || ''}
          currentScore={validationResult.currentScore}
          minimumScore={validationResult.minScore}
          serpAnalyzed={validationResult.serpAnalyzed}
          content={''}
          title={selectedItemForPublish.suggested_theme}
          keyword={selectedItemForPublish.suggested_theme}
          onBoostComplete={handleBoostComplete}
          onAnalyzeComplete={() => {
            setBoostDialogOpen(false);
            setSelectedItemForPublish(null);
            toast.info('Análise concluída. Tente publicar novamente.');
          }}
          onPublishAfterBoost={handlePublishAfterBoost}
        />
      )}
    </div>
  );
}
