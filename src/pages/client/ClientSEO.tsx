import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { calculateSEOScore } from '@/utils/seoScore';
import { SEOScoreGauge } from '@/components/seo/SEOScoreGauge';
import { ArticleSEOList, ArticleSEOItem } from '@/components/seo/ArticleSEOList';
import { SEOAnalysisModal } from '@/components/seo/SEOAnalysisModal';
import { SEOTrendChart } from '@/components/seo/SEOTrendChart';
import { SEOTrendStats } from '@/components/seo/SEOTrendStats';
import { useSEOTrends } from '@/hooks/useSEOTrends';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Lightbulb,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface SEOTip {
  icon: React.ReactNode;
  text: string;
  priority: 'high' | 'medium' | 'low';
}

export default function ClientSEO() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aggregatedScore, setAggregatedScore] = useState(0);
  const [articleCount, setArticleCount] = useState(0);
  const [articlesBelow60, setArticlesBelow60] = useState(0);
  const [articlesAbove80, setArticlesAbove80] = useState(0);
  const [tips, setTips] = useState<SEOTip[]>([]);
  const [trendPeriod, setTrendPeriod] = useState(30);

  // Estados para o modal de análise
  const [selectedArticle, setSelectedArticle] = useState<ArticleSEOItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // SEO Trends hook
  const { data: trendData, isLoading: trendLoading, trend, refetch: refetchTrends, saveSnapshot } = useSEOTrends(blog?.id, trendPeriod);

  const fetchSEOData = useCallback(async (blogId: string) => {
    try {
      const { data } = await supabase
        .from('articles')
        .select('id, title, meta_description, content, keywords, featured_image_url')
        .eq('blog_id', blogId)
        .eq('status', 'published')
        .limit(100);

      if (data && data.length > 0) {
        setArticleCount(data.length);
        
        // Calcular scores para dicas
        const scores = data.map(article => 
          calculateSEOScore({
            title: article.title,
            metaDescription: article.meta_description || '',
            content: article.content,
            keywords: article.keywords || [],
            featuredImage: article.featured_image_url
          })
        );

        // Score médio
        const avgScore = Math.round(
          scores.reduce((acc, s) => acc + s.totalScore, 0) / scores.length
        );
        setAggregatedScore(avgScore);

        // Count articles by score threshold
        const below60 = scores.filter(s => s.totalScore < 60).length;
        const above80 = scores.filter(s => s.totalScore >= 80).length;
        setArticlesBelow60(below60);
        setArticlesAbove80(above80);

        // Gerar dicas contextuais
        const newTips: SEOTip[] = [];
        
        const articlesWithoutMeta = data.filter(a => !a.meta_description || a.meta_description.length < 100).length;
        if (articlesWithoutMeta > 0) {
          newTips.push({
            icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
            text: `${articlesWithoutMeta} ${articlesWithoutMeta === 1 ? 'artigo precisa' : 'artigos precisam'} de descrições melhores`,
            priority: 'high'
          });
        }

        const articlesWithoutImage = data.filter(a => !a.featured_image_url).length;
        if (articlesWithoutImage > 0) {
          newTips.push({
            icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
            text: `Adicione imagens em ${articlesWithoutImage} ${articlesWithoutImage === 1 ? 'artigo' : 'artigos'}`,
            priority: 'medium'
          });
        }

        const articlesWithShortContent = data.filter(a => {
          const wordCount = (a.content || '').split(/\s+/).filter(w => w.length > 0).length;
          return wordCount < 800;
        }).length;
        if (articlesWithShortContent > 0) {
          newTips.push({
            icon: <Lightbulb className="h-4 w-4 text-blue-500" />,
            text: `${articlesWithShortContent} ${articlesWithShortContent === 1 ? 'artigo pode' : 'artigos podem'} ter mais conteúdo`,
            priority: 'medium'
          });
        }

        if (avgScore >= 80) {
          newTips.push({
            icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
            text: 'Seu blog está bem otimizado! Continue assim.',
            priority: 'low'
          });
        }

        setTips(newTips);

        // Save snapshot for trends
        await saveSnapshot(avgScore, data.length, below60, above80);
      } else {
        setAggregatedScore(0);
        setArticleCount(0);
        setTips([{
          icon: <Lightbulb className="h-4 w-4 text-blue-500" />,
          text: 'Publique seus primeiros artigos para ver a análise de SEO',
          priority: 'high'
        }]);
      }
    } catch (error) {
      console.error('Error fetching SEO data:', error);
    } finally {
      setLoading(false);
    }
  }, [saveSnapshot]);

  useEffect(() => {
    if (blog?.id) {
      fetchSEOData(blog.id);
    }
  }, [blog?.id, fetchSEOData]);

  const getEmotionalMessage = (score: number): string => {
    if (score >= 90) return 'Excelente! Seu blog está voando alto! 🚀';
    if (score >= 70) return 'Muito bem! Seu blog está saudável. ✨';
    if (score >= 50) return 'Bom progresso! Algumas melhorias ajudariam.';
    if (score >= 30) return 'Vamos melhorar isso juntos!';
    return 'Seu blog precisa de atenção.';
  };

  const handleSelectArticle = (article: ArticleSEOItem) => {
    setSelectedArticle(article);
    setShowModal(true);
  };

  const handleArticleUpdated = () => {
    setRefreshKey(prev => prev + 1);
    if (blog?.id) {
      fetchSEOData(blog.id);
      refetchTrends();
    }
  };

  const handlePeriodChange = (days: number) => {
    setTrendPeriod(days);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/client/dashboard')}
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saúde do seu Blog</h1>
          <p className="text-muted-foreground text-sm">Entenda como seu blog está otimizado</p>
        </div>
      </div>

      {/* Main Score Card */}
      <div className="client-card client-card-glow p-8">
        <div className="flex flex-col items-center text-center">
          <SEOScoreGauge score={aggregatedScore} size="lg" showLabel animated />
          <p className="text-xl text-foreground mt-4 font-medium">
            {getEmotionalMessage(aggregatedScore)}
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Baseado em {articleCount} {articleCount === 1 ? 'artigo publicado' : 'artigos publicados'}
          </p>
        </div>
      </div>

      {/* SEO Trends Section */}
      {articleCount > 0 && (
        <div className="space-y-4">
          <SEOTrendChart
            data={trendData}
            isLoading={trendLoading}
            onPeriodChange={handlePeriodChange}
            currentPeriod={trendPeriod}
          />
          {trendData.length > 0 && (
            <SEOTrendStats
              data={trendData}
              trend={trend}
              currentScore={aggregatedScore}
            />
          )}
        </div>
      )}

      {/* Lista de Artigos + Modal */}
      {blog?.id && user?.id && (
        <>
          <ArticleSEOList
            key={refreshKey}
            blogId={blog.id}
            userId={user.id}
            onSelectArticle={handleSelectArticle}
            onScoreCalculated={(avgScore, total) => {
              setAggregatedScore(avgScore);
              setArticleCount(total);
            }}
          />

          <SEOAnalysisModal
            article={selectedArticle}
            open={showModal}
            onOpenChange={setShowModal}
            blogId={blog.id}
            userId={user.id}
            onArticleUpdated={handleArticleUpdated}
          />
        </>
      )}

      {/* Tips Section */}
      {tips.length > 0 && (
        <div className="client-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-foreground">Dicas para Melhorar</h2>
          </div>
          <ul className="space-y-3">
            {tips.map((tip, index) => (
              <li 
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className={`p-2 rounded-lg ${
                  tip.priority === 'high' ? 'bg-red-500/20' :
                  tip.priority === 'medium' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                }`}>
                  {tip.icon}
                </div>
                <span className="text-foreground">{tip.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Back Button */}
      <div className="flex justify-center pt-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/client/dashboard')}
          className="border-border text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Início
        </Button>
      </div>
    </div>
  );
}
