import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Plus, 
  Search, 
  MoreVertical,
  PenSquare,
  ExternalLink,
  Sparkles,
  ImagePlus,
  Archive,
  Trash2,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ArticleStatus = 'published' | 'draft' | 'archived';

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  created_at: string;
  published_at: string | null;
  featured_image_url: string | null;
}

interface StatusCounts {
  published: number;
  draft: number;
  archived: number;
  total: number;
}

const ITEMS_PER_PAGE = 10;

export default function ClientArticles() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ published: 0, draft: 0, archived: 0, total: 0 });
  const [activeTab, setActiveTab] = useState<'all' | ArticleStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate detection
  const [duplicates, setDuplicates] = useState<Map<string, Article[]>>(new Map());

  const fetchArticles = async () => {
    if (!blog?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, slug, status, created_at, published_at, featured_image_url')
        .eq('blog_id', blog.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setArticles(data || []);
      
      // Calculate status counts
      const counts = (data || []).reduce<StatusCounts>(
        (acc, article) => {
          acc.total++;
          const status = article.status as ArticleStatus | null;
          if (status === 'published') acc.published++;
          else if (status === 'archived') acc.archived++;
          else acc.draft++;
          return acc;
        },
        { published: 0, draft: 0, archived: 0, total: 0 }
      );
      setStatusCounts(counts);

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

  // Filter articles by tab and search
  const filteredArticles = useMemo(() => {
    let result = articles;

    // Filter by status
    if (activeTab !== 'all') {
      result = result.filter(a => {
        if (activeTab === 'draft') return !a.status || a.status === 'draft';
        return a.status === activeTab;
      });
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a => a.title.toLowerCase().includes(query));
    }

    return result;
  }, [articles, activeTab, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredArticles.length / ITEMS_PER_PAGE);
  const paginatedArticles = filteredArticles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Selection handlers
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedArticles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedArticles.map(a => a.id)));
    }
  };

  // Action handlers
  const handleEdit = (id: string) => {
    navigate(`/client/articles/${id}/edit`);
  };

  const handleView = (article: Article) => {
    // Use custom domain or slug-based URL
    if (blog?.custom_domain) {
      window.open(`https://${blog.custom_domain}/${article.slug}`, '_blank');
    } else if (blog?.slug) {
      window.open(`/blog/${blog.slug}/${article.slug}`, '_blank');
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`${selectedIds.size} artigos excluídos`);
      setBulkDeleteDialogOpen(false);
      setSelectedIds(new Set());
      fetchArticles();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error('Erro ao excluir artigos');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const { error } = await supabase
        .from('articles')
        .update({ status: 'archived' })
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`${selectedIds.size} artigos arquivados`);
      setSelectedIds(new Set());
      fetchArticles();
    } catch (error) {
      console.error('Error bulk archiving:', error);
      toast.error('Erro ao arquivar artigos');
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
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-3">
            <FileText className="h-7 w-7 text-primary" />
            Meus Artigos
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Gerencie todos os seus artigos em um só lugar
          </p>
        </div>
        <Button 
          onClick={() => navigate('/client/create')}
          className="gap-2 client-btn-primary"
        >
          <Plus className="h-4 w-4" />
          Criar Novo
        </Button>
      </div>

      {/* Duplicate Warning */}
      {duplicateCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {duplicateCount} possíveis duplicados detectados
            </span>
            <p className="text-amber-600/80 dark:text-amber-400/80 text-sm">
              Alguns artigos possuem títulos semelhantes
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setCurrentPage(1); }}>
        <TabsList className="grid grid-cols-4 w-full max-w-md bg-muted">
          <TabsTrigger value="all" className="gap-1.5">
            Todos
            <Badge variant="secondary" className="ml-1">{statusCounts.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="published" className="gap-1.5">
            Publicados
            <Badge variant="secondary" className="ml-1">{statusCounts.published}</Badge>
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-1.5">
            Rascunhos
            <Badge variant="secondary" className="ml-1">{statusCounts.draft}</Badge>
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-1.5">
            Arquivados
            <Badge variant="secondary" className="ml-1">{statusCounts.archived}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and bulk actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selecionado(s)
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkArchive}
              className="gap-1"
            >
              <Archive className="h-4 w-4" />
              Arquivar
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setBulkDeleteDialogOpen(true)}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>
        )}

        <span className="text-sm text-muted-foreground ml-auto">
          {filteredArticles.length} artigo(s)
        </span>
      </div>

      {/* Articles List */}
      <div className="client-card divide-y divide-border-soft">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 rounded-t-xl">
          <Checkbox 
            checked={paginatedArticles.length > 0 && selectedIds.size === paginatedArticles.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="flex-1 text-sm font-medium text-muted-foreground">Título</span>
          <span className="w-24 text-sm font-medium text-muted-foreground text-center">Status</span>
          <span className="w-28 text-sm font-medium text-muted-foreground text-center">Data</span>
          <span className="w-10" />
        </div>

        {/* Article rows */}
        {paginatedArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum artigo encontrado</p>
            <Button 
              variant="link" 
              onClick={() => navigate('/client/create')}
              className="mt-2"
            >
              Criar seu primeiro artigo
            </Button>
          </div>
        ) : (
          paginatedArticles.map(article => (
            <div 
              key={article.id}
              className="flex items-center gap-4 px-4 py-4 hover:bg-muted/30 transition-colors"
            >
              <Checkbox 
                checked={selectedIds.has(article.id)}
                onCheckedChange={() => toggleSelect(article.id)}
              />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-text-main truncate">{article.title}</h3>
                {!article.featured_image_url && (
                  <span className="text-xs text-amber-500">Sem imagem de capa</span>
                )}
              </div>

              <div className="w-24 flex justify-center">
                {getStatusBadge(article.status)}
              </div>

              <div className="w-28 text-center text-sm text-muted-foreground">
                {format(new Date(article.created_at), 'dd MMM yyyy', { locale: ptBR })}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleEdit(article.id)}>
                    <PenSquare className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  {article.status === 'published' && (
                    <DropdownMenuItem onClick={() => handleView(article)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visualizar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleEdit(article.id)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Reescrever com IA
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEdit(article.id)}>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    {article.featured_image_url ? 'Regenerar Imagem' : 'Gerar Imagem'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {article.status !== 'archived' && (
                    <DropdownMenuItem onClick={() => handleArchive(article.id)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Arquivar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={() => { setArticleToDelete(article.id); setDeleteDialogOpen(true); }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} artigos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os artigos selecionados serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Excluir ${selectedIds.size} artigos`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
