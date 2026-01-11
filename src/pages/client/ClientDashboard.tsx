import { useEffect, useState } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SEOScoreGauge } from '@/components/seo/SEOScoreGauge';
import { FileText, Calendar, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface Article {
  id: string;
  title: string;
  published_at: string | null;
}

interface QueueItem {
  id: string;
  suggested_theme: string;
  scheduled_for: string | null;
}

export default function ClientDashboard() {
  const { blog } = useBlog();
  const [loading, setLoading] = useState(true);
  const [automationActive, setAutomationActive] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [seoScore, setSeoScore] = useState(0);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [nextPublications, setNextPublications] = useState<QueueItem[]>([]);

  useEffect(() => {
    if (!blog?.id) return;

    const fetchDashboardData = async () => {
      setLoading(true);

      try {
        // Fetch automation status
        const { data: automation } = await supabase
          .from('blog_automation')
          .select('is_active')
          .eq('blog_id', blog.id)
          .maybeSingle();

        setAutomationActive(automation?.is_active ?? false);

        // Fetch published articles count this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true })
          .eq('blog_id', blog.id)
          .eq('status', 'published')
          .gte('published_at', startOfMonth.toISOString());

        setPublishedCount(count ?? 0);

        // Fetch recent articles
        const { data: articles } = await supabase
          .from('articles')
          .select('id, title, published_at')
          .eq('blog_id', blog.id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(5);

        setRecentArticles(articles ?? []);

        // Calculate average SEO score
        const { data: allArticles } = await supabase
          .from('articles')
          .select('title, meta_description, content, keywords')
          .eq('blog_id', blog.id)
          .eq('status', 'published')
          .limit(10);

        if (allArticles && allArticles.length > 0) {
          // Simple SEO score calculation
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
          .eq('blog_id', blog.id)
          .eq('status', 'pending')
          .order('scheduled_for', { ascending: true })
          .limit(3);

        setNextPublications(queue ?? []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }

      setLoading(false);
    };

    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [blog?.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Início</h1>
        <p className="text-muted-foreground mt-1">
          Veja como seu blog está funcionando
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Automation Status */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5" />
              Automação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge 
              variant={automationActive ? "default" : "secondary"}
              className={automationActive ? "bg-green-500 hover:bg-green-600" : ""}
            >
              {automationActive ? "✓ Ativa" : "Pausada"}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              {automationActive 
                ? "Seu blog está crescendo automaticamente" 
                : "Ative a automação para publicar artigos"}
            </p>
          </CardContent>
        </Card>

        {/* Published Count */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Artigos Publicados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{publishedCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              neste mês
            </p>
          </CardContent>
        </Card>

        {/* SEO Health */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Saúde do seu blog</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <SEOScoreGauge score={seoScore} size="md" showLabel />
          </CardContent>
        </Card>
      </div>

      {/* Recent Articles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Últimos Artigos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentArticles.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum artigo publicado ainda.
              <br />
              <span className="text-sm">Crie seu primeiro artigo!</span>
            </p>
          ) : (
            <ul className="space-y-3">
              {recentArticles.map((article) => (
                <li key={article.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium truncate flex-1 mr-4">{article.title}</span>
                  {article.published_at && (
                    <span className="text-sm text-muted-foreground shrink-0">
                      {format(new Date(article.published_at), "dd MMM", { locale: ptBR })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Next Publications */}
      {nextPublications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximas Publicações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {nextPublications.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium truncate flex-1 mr-4">{item.suggested_theme}</span>
                  {item.scheduled_for && (
                    <span className="text-sm text-muted-foreground shrink-0">
                      {format(new Date(item.scheduled_for), "dd MMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
