import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SEOScoreGauge } from '@/components/seo/SEOScoreGauge';
import { ClientRobotIllustration } from '@/components/client/ClientRobotIllustration';
import { 
  FileText, 
  Calendar, 
  Zap, 
  ExternalLink, 
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  Clock,
  BarChart3
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { getBlogUrl, getArticleUrl } from '@/utils/blogUrl';

interface Article {
  id: string;
  title: string;
  slug: string;
  published_at: string | null;
}

interface QueueItem {
  id: string;
  suggested_theme: string;
  scheduled_for: string | null;
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  const [loading, setLoading] = useState(true);
  const [automationActive, setAutomationActive] = useState(false);
  const [totalArticles, setTotalArticles] = useState(0);
  const [seoScore, setSeoScore] = useState(0);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [nextPublications, setNextPublications] = useState<QueueItem[]>([]);
  const [lastArticle, setLastArticle] = useState<Article | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  
  const isMounted = useRef(true);
  const blogIdRef = useRef<string | null>(null);
  const hasFetched = useRef(false);

  const fetchDashboardData = useCallback(async (blogId: string) => {
    if (!isMounted.current) return;
    
    try {
      // Fetch automation status
      const { data: automation } = await supabase
        .from('blog_automation')
        .select('is_active, updated_at')
        .eq('blog_id', blogId)
        .maybeSingle();

      if (!isMounted.current) return;
      setAutomationActive(automation?.is_active ?? false);
      if (automation?.updated_at) {
        setLastUpdated(new Date(automation.updated_at));
      }

      // Fetch total published articles
      const { count } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('blog_id', blogId)
        .eq('status', 'published');

      if (!isMounted.current) return;
      setTotalArticles(count ?? 0);

      // Fetch recent articles WITH slug for navigation
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, slug, published_at')
        .eq('blog_id', blogId)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(5);

      if (!isMounted.current) return;
      setRecentArticles(articles ?? []);
      if (articles && articles.length > 0) {
        setLastArticle(articles[0]);
      }

      // Calculate average SEO score
      const { data: allArticles } = await supabase
        .from('articles')
        .select('title, meta_description, content, keywords')
        .eq('blog_id', blogId)
        .eq('status', 'published')
        .limit(10);

      if (!isMounted.current) return;
      if (allArticles && allArticles.length > 0) {
        const scores = allArticles.map(article => {
          let score = 0;
          if (article.title && article.title.length > 10) score += 25;
          if (article.meta_description && article.meta_description.length > 50) score += 25;
          if (article.content && article.content.length > 500) score += 25;
          if (article.keywords && article.keywords.length > 0) score += 25;
          return score;
        });
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        setSeoScore(Math.round(avg));
      } else {
        setSeoScore(0);
      }

      // Fetch next scheduled publications
      const { data: queue } = await supabase
        .from('article_queue')
        .select('id, suggested_theme, scheduled_for')
        .eq('blog_id', blogId)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(3);

      if (!isMounted.current) return;
      setNextPublications(queue ?? []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }

    if (isMounted.current) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (blog?.id && blog.id !== blogIdRef.current) {
      blogIdRef.current = blog.id;
      hasFetched.current = false;
    }
    
    if (blog?.id && !hasFetched.current) {
      hasFetched.current = true;
      setLoading(true);
      fetchDashboardData(blog.id);
    }
  }, [blog?.id, fetchDashboardData]);

  const handleOpenBlog = () => {
    if (blog) {
      const url = getBlogUrl(blog);
      window.open(url, '_blank');
    }
  };

  const handleOpenArticle = (article: Article) => {
    if (blog && article.slug) {
      const url = getArticleUrl(blog, article.slug);
      window.open(url, '_blank');
    }
  };

  const handleCopyUrl = async () => {
    if (blog) {
      const url = getBlogUrl(blog);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const blogUrl = blog ? getBlogUrl(blog) : '';

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section - Fixed, No Carousel */}
      <div className="client-card client-card-glow p-8 relative overflow-hidden">
        {/* Decorative gradient orb */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-orange-500/20 rounded-full blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          {/* Robot Illustration */}
          <ClientRobotIllustration 
            variant={automationActive ? 'working' : 'idle'} 
            size="lg" 
          />
          
          {/* Content */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Está tudo certo.
            </h1>
            <p className="text-xl text-gray-400 mb-6">
              {automationActive 
                ? 'Seu conteúdo está sendo gerado automaticamente.'
                : 'Ative a automação para publicar artigos automaticamente.'}
            </p>
            <Button 
              onClick={handleOpenBlog}
              className="client-btn-primary text-lg px-8 py-6 gap-2"
            >
              <ExternalLink className="h-5 w-5" />
              Abrir Meu Blog
            </Button>
          </div>
        </div>
      </div>

      {/* Meu Blog - Mini Dashboard */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-400" />
          Meu Blog
        </h2>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Blog Name & URL Card */}
          <div 
            className="client-card p-5 cursor-pointer hover:border-purple-500/50 transition-all group col-span-2"
            onClick={handleCopyUrl}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-lg truncate">{blog?.name}</h3>
                <p className="text-gray-400 text-sm truncate mt-1">{blogUrl}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="shrink-0 text-gray-400 hover:text-white hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); handleCopyUrl(); }}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-4">
              <Button 
                onClick={(e) => { e.stopPropagation(); handleOpenBlog(); }}
                className="w-full client-btn-primary gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Meu Blog
              </Button>
            </div>
          </div>

          {/* Total Articles Card */}
          <div 
            className="client-card p-5 cursor-pointer hover:border-purple-500/50 transition-all group"
            onClick={handleOpenBlog}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <FileText className="h-5 w-5 text-purple-400" />
              </div>
              <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
            </div>
            <div className="text-4xl font-bold text-white client-text-glow">{totalArticles}</div>
            <p className="text-gray-500 text-sm mt-1">Artigos publicados</p>
          </div>

          {/* Automation Status Card */}
          <div 
            className={`client-card p-5 cursor-pointer hover:border-purple-500/50 transition-all group ${
              automationActive ? 'client-card-glow-success' : 'client-card-glow-warning'
            }`}
            onClick={() => navigate('/client/automation')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${automationActive ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                <Zap className={`h-5 w-5 ${automationActive ? 'text-green-400' : 'text-yellow-400'}`} />
              </div>
              <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
            </div>
            <Badge 
              className={`${
                automationActive 
                  ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              }`}
            >
              {automationActive ? '✓ Ativa' : 'Pausada'}
            </Badge>
            <p className="text-gray-500 text-sm mt-2">Automação</p>
          </div>
        </div>

        {/* Second Row - Last Article & Last Update */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Last Published Article */}
          <div 
            className="client-card p-5 cursor-pointer hover:border-purple-500/50 transition-all group"
            onClick={() => lastArticle && handleOpenArticle(lastArticle)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <CheckCircle2 className="h-5 w-5 text-orange-400" />
                </div>
                <span className="text-gray-400 text-sm">Último artigo</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
            </div>
            {lastArticle ? (
              <>
                <h4 className="text-white font-medium truncate group-hover:text-purple-300 transition-colors">
                  {lastArticle.title}
                </h4>
                {lastArticle.published_at && (
                  <p className="text-gray-500 text-sm mt-1">
                    {formatDistanceToNow(new Date(lastArticle.published_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-500">Nenhum artigo publicado ainda</p>
            )}
          </div>

          {/* Last Update */}
          <div className="client-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <span className="text-gray-400 text-sm">Última atualização</span>
            </div>
            <p className="text-white">
              {lastUpdated 
                ? formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ptBR })
                : 'Sem dados'}
            </p>
          </div>
        </div>
      </div>

      {/* SEO Health - Clickable Gauge */}
      <div 
        className="client-card client-card-glow p-8 cursor-pointer hover:border-purple-500/50 transition-all"
        onClick={() => navigate('/client/seo')}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">Saúde do seu Blog</h2>
            <p className="text-gray-400">
              Clique para ver detalhes e dicas de como melhorar seu SEO.
            </p>
          </div>
          <div className="relative">
            <SEOScoreGauge score={seoScore} size="lg" showLabel animated />
            <div className="absolute -top-2 -right-2">
              <ChevronRight className="h-6 w-6 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Articles */}
      <div className="client-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" />
            Últimos Artigos
          </h2>
          {recentArticles.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleOpenBlog} 
              className="gap-1 text-xs text-gray-400 hover:text-white"
            >
              Ver todos
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {recentArticles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Nenhum artigo publicado ainda.</p>
            <Button 
              onClick={() => navigate('/client/create')}
              className="client-btn-primary"
            >
              Criar Primeiro Artigo
            </Button>
          </div>
        ) : (
          <ul className="space-y-1">
            {recentArticles.map((article) => (
              <li 
                key={article.id} 
                onClick={() => handleOpenArticle(article)}
                className="flex items-center justify-between py-3 px-4 rounded-lg 
                           hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-white truncate group-hover:text-purple-300 transition-colors">
                    {article.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {article.published_at && (
                    <span className="text-sm text-gray-500">
                      {format(new Date(article.published_at), "dd MMM", { locale: ptBR })}
                    </span>
                  )}
                  <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Next Publications */}
      {nextPublications.length > 0 && (
        <div className="client-card p-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-orange-400" />
            Próximas Publicações
          </h2>
          <ul className="space-y-1">
            {nextPublications.map((item) => (
              <li 
                key={item.id} 
                className="flex items-center justify-between py-3 px-4 rounded-lg bg-white/5"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-white truncate">{item.suggested_theme}</span>
                </div>
                {item.scheduled_for && (
                  <Badge 
                    variant="outline" 
                    className="text-xs shrink-0 ml-2 border-orange-500/30 text-orange-400"
                  >
                    {format(new Date(item.scheduled_for), "dd MMM 'às' HH:mm", { locale: ptBR })}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
