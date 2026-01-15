import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getArticleUrl } from '@/utils/blogUrl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Plus,
  ExternalLink,
  PenSquare,
  Radar,
  Target,
  Zap,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  created_at: string;
  published_at: string | null;
  generation_source: string | null;
  opportunity_id: string | null;
  funnel_stage: string | null;
}

interface MobileArticlesListProps {
  blog: {
    id: string;
    slug: string;
    custom_domain?: string | null;
    domain_verified?: boolean | null;
    platform_subdomain?: string | null;
  } | null;
}

type TabValue = 'all' | 'published' | 'draft';

export function MobileArticlesList({ blog }: MobileArticlesListProps) {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>('all');

  useEffect(() => {
    if (!blog?.id) return;

    const fetchArticles = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, slug, status, created_at, published_at, generation_source, opportunity_id, funnel_stage')
        .eq('blog_id', blog.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (!error) {
        setArticles(data || []);
      }
      setLoading(false);
    };

    fetchArticles();
  }, [blog?.id]);

  const filteredArticles = useMemo(() => {
    if (activeTab === 'all') return articles;
    if (activeTab === 'published') return articles.filter(a => a.status === 'published');
    return articles.filter(a => !a.status || a.status === 'draft');
  }, [articles, activeTab]);

  const handleView = (article: Article) => {
    if (!blog) return;
    const url = getArticleUrl({
      slug: blog.slug,
      custom_domain: blog.custom_domain?.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      domain_verified: blog.domain_verified,
      platform_subdomain: blog.platform_subdomain || null
    }, article.slug);
    window.open(url, '_blank');
  };

  const handleEdit = (id: string) => {
    navigate(`/client/articles/${id}/edit`);
  };

  const getStatusBadge = (status: string | null) => {
    if (status === 'published') {
      return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Publicado</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs">Rascunho</Badge>;
  };

  const getOriginIcon = (article: Article) => {
    if (article.opportunity_id) return <Radar className="h-3.5 w-3.5 text-purple-500" />;
    if (article.funnel_stage || article.generation_source === 'sales_funnel') return <Target className="h-3.5 w-3.5 text-orange-500" />;
    if (article.generation_source === 'automation') return <Zap className="h-3.5 w-3.5 text-blue-500" />;
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Artigos
          </h1>
        </div>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Artigos
        </h1>
        <Button 
          size="sm"
          onClick={() => navigate('/client/create')}
          className="gap-1.5 client-btn-primary"
        >
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="grid w-full grid-cols-3 h-10">
          <TabsTrigger value="all" className="text-sm">
            Todos ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="published" className="text-sm">
            Publicados
          </TabsTrigger>
          <TabsTrigger value="draft" className="text-sm">
            Rascunhos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Empty State */}
      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum artigo encontrado</p>
          <Button 
            onClick={() => navigate('/client/create')}
            className="mt-4 gap-2"
          >
            <Plus className="h-4 w-4" />
            Criar primeiro artigo
          </Button>
        </div>
      )}

      {/* Article Cards */}
      <div className="space-y-2">
        {filteredArticles.map((article) => (
          <div
            key={article.id}
            className="bg-card rounded-xl border border-border p-4 active:bg-muted transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Title with origin icon */}
                <div className="flex items-center gap-2 mb-1.5">
                  {getOriginIcon(article)}
                  <h3 className="font-medium text-foreground text-sm leading-snug line-clamp-2">
                    {article.title}
                  </h3>
                </div>

                {/* Status and date */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(article.status)}
                  <span className="text-xs text-muted-foreground">
                    {article.published_at 
                      ? format(new Date(article.published_at), "d 'de' MMM", { locale: ptBR })
                      : format(new Date(article.created_at), "d 'de' MMM", { locale: ptBR })
                    }
                  </span>
                </div>
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {article.status === 'published' && (
                    <DropdownMenuItem onClick={() => handleView(article)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver no blog
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleEdit(article.id)}>
                    <PenSquare className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
