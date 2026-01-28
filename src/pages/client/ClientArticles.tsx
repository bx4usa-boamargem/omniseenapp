import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { getArticleUrl } from '@/utils/blogUrl';
import { smartNavigate, getClientArticleEditPath, getClientArticleCreatePath } from '@/utils/platformUrls';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Plus, 
  AlertTriangle,
  Loader2,
  Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArticleCard, Article } from '@/components/client/articles/ArticleCard';
import { ArticleFilters, useArticleFilters } from '@/components/client/articles/ArticleFilters';

export default function ClientArticles() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate detection and resolution
  const [duplicates, setDuplicates] = useState<Map<string, Article[]>>(new Map());
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [selectedToKeep, setSelectedToKeep] = useState<Map<string, string>>(new Map());
  const [isResolvingDuplicates, setIsResolvingDuplicates] = useState(false);

  // Use the filters hook
  const {
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    filteredArticles,
    statusCounts,
  } = useArticleFilters(articles);

  const fetchArticles = async () => {
    if (!blog?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, slug, status, created_at, published_at, featured_image_url, generation_source, opportunity_id, funnel_stage, category')
        .eq('blog_id', blog.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setArticles(data || []);

      // Detect duplicates
      detectDuplicates(data || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Erro ao carregar artigos');
    } finally {
      setLoading(false);
    }
  };

  const detectDuplicates = (articles: Article[]) => {
    const normalizeTitle = (title: string) => 
      title.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

    const titleMap = new Map<string, Article[]>();
    
    articles.forEach(article => {
      const normalized = normalizeTitle(article.title);
      const existing = titleMap.get(normalized) || [];
      existing.push(article);
      titleMap.set(normalized, existing);
    });

    // Filter only groups with 2+ articles
    const duplicateGroups = new Map<string, Article[]>();
    titleMap.forEach((group, key) => {
      if (group.length > 1) {
        duplicateGroups.set(key, group);
      }
    });

    setDuplicates(duplicateGroups);
  };

  useEffect(() => {
    fetchArticles();
  }, [blog?.id]);

  // Action handlers
  const handleEdit = (id: string) => {
    smartNavigate(navigate, getClientArticleEditPath(id));
  };

  const handleView = (article: Article) => {
    if (!blog) return;
    
    // Clean custom_domain of protocol and trailing slash
    let cleanDomain = blog.custom_domain;
    if (cleanDomain) {
      cleanDomain = cleanDomain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');
    }
    
    const url = getArticleUrl({
      slug: blog.slug,
      custom_domain: cleanDomain,
      domain_verified: blog.domain_verified,
      platform_subdomain: (blog as { platform_subdomain?: string }).platform_subdomain || null
    }, article.slug);
    
    window.open(url, '_blank');
  };

  const handleDuplicate = async (id: string) => {
    const article = articles.find(a => a.id === id);
    if (!article || !blog?.id) return;

    try {
      const { data, error } = await supabase
        .from('articles')
        .insert({
          blog_id: blog.id,
          title: `${article.title} (cópia)`,
          slug: `${article.slug}-copia-${Date.now()}`,
          status: 'draft',
          featured_image_url: article.featured_image_url,
          category: article.category,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Artigo duplicado com sucesso!');
      fetchArticles();
    } catch (error) {
      console.error('Error duplicating article:', error);
      toast.error('Erro ao duplicar artigo');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Artigo arquivado');
      fetchArticles();
    } catch (error) {
      console.error('Error archiving article:', error);
      toast.error('Erro ao arquivar artigo');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ status: 'draft' })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Artigo restaurado como rascunho');
      fetchArticles();
    } catch (error) {
      console.error('Error restoring article:', error);
      toast.error('Erro ao restaurar artigo');
    }
  };

  const handleDeleteClick = (id: string) => {
    setArticleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!articleToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleToDelete);

      if (error) throw error;
      
      toast.success('Artigo excluído');
      setDeleteDialogOpen(false);
      setArticleToDelete(null);
      fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Erro ao excluir artigo');
    } finally {
      setIsDeleting(false);
    }
  };

  // Resolve duplicates
  const handleResolveDuplicates = async () => {
    const toArchive: string[] = [];
    
    duplicates.forEach((group, normalizedTitle) => {
      const keepId = selectedToKeep.get(normalizedTitle) || group[0].id;
      group.forEach(article => {
        if (article.id !== keepId) {
          toArchive.push(article.id);
        }
      });
    });
    
    if (toArchive.length === 0) {
      setShowDuplicatesModal(false);
      return;
    }
    
    setIsResolvingDuplicates(true);
    try {
      const { error } = await supabase
        .from('articles')
        .update({ status: 'archived' })
        .in('id', toArchive);

      if (error) throw error;
      
      toast.success(`${toArchive.length} artigos duplicados arquivados`);
      setShowDuplicatesModal(false);
      setSelectedToKeep(new Map());
      fetchArticles();
    } catch (error) {
      console.error('Error resolving duplicates:', error);
      toast.error('Erro ao arquivar duplicados');
    } finally {
      setIsResolvingDuplicates(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">Publicado</Badge>;
      case 'archived':
        return <Badge className="bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30">Arquivado</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">Rascunho</Badge>;
    }
  };

  const duplicateCount = Array.from(duplicates.values()).reduce((acc, group) => acc + group.length - 1, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
            <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            Meus Artigos
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Gerencie todos os seus artigos em um só lugar
          </p>
        </div>
        <Button 
          onClick={() => smartNavigate(navigate, getClientArticleCreatePath())}
          className="gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Criar Novo
        </Button>
      </div>

      {/* Duplicate Warning with Action */}
      {duplicateCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {duplicateCount} possíveis duplicados detectados
            </span>
            <p className="text-amber-600/80 dark:text-amber-400/80 text-sm">
              Alguns artigos possuem títulos semelhantes
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowDuplicatesModal(true)}
            className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 flex-shrink-0"
          >
            Resolver
          </Button>
        </div>
      )}

      {/* Filters */}
      <ArticleFilters
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusCounts={statusCounts}
      />

      {/* Articles count */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filteredArticles.length} artigo(s)
        </span>
      </div>

      {/* Articles Grid */}
      {filteredArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">Nenhum artigo encontrado</p>
          <Button 
            variant="link" 
            onClick={() => smartNavigate(navigate, getClientArticleCreatePath())}
          >
            Criar seu primeiro artigo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onEdit={() => handleEdit(article.id)}
              onDuplicate={() => handleDuplicate(article.id)}
              onArchive={() => handleArchive(article.id)}
              onRestore={() => handleRestore(article.id)}
              onDelete={() => handleDeleteClick(article.id)}
              onView={() => handleView(article)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O artigo será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicates Resolution Modal */}
      <Dialog open={showDuplicatesModal} onOpenChange={setShowDuplicatesModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolver Duplicados</DialogTitle>
            <DialogDescription>
              Escolha qual artigo manter de cada grupo. Os outros serão arquivados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {Array.from(duplicates.entries()).map(([normalizedTitle, group]) => (
              <div key={normalizedTitle} className="p-4 border border-border rounded-lg bg-muted/30">
                <RadioGroup 
                  value={selectedToKeep.get(normalizedTitle) || group[0].id}
                  onValueChange={(v) => {
                    const newMap = new Map(selectedToKeep);
                    newMap.set(normalizedTitle, v);
                    setSelectedToKeep(newMap);
                  }}
                >
                  {group.map(article => (
                    <div key={article.id} className="flex items-center gap-3 py-2">
                      <RadioGroupItem value={article.id} id={article.id} />
                      <Label htmlFor={article.id} className="flex-1 cursor-pointer">
                        <span className="font-medium">{article.title}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {format(new Date(article.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <span className="ml-2">
                          {getStatusBadge(article.status)}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDuplicatesModal(false)}
              disabled={isResolvingDuplicates}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleResolveDuplicates}
              disabled={isResolvingDuplicates}
            >
              {isResolvingDuplicates ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Arquivar Duplicados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
