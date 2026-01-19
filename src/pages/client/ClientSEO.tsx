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
import { BatchInternalLinksButton } from '@/components/seo/BatchInternalLinksButton';
import { useSEOTrends } from '@/hooks/useSEOTrends';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  FileText,
  Link2,
  Image,
  Type,
  Target,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SEOTip {
  icon: React.ReactNode;
  text: string;
  priority: 'high' | 'medium' | 'low';
}

interface DimensionAnalysis {
  id: string;
  label: string;
  icon: React.ReactNode;
  score: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
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
  const [dimensions, setDimensions] = useState<DimensionAnalysis[]>([]);
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
        .select('id, title, meta_description, content, keywords, featured_image_url, created_at')
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

        // Analisar dimensões
        const articlesWithBadMeta = data.filter(a => !a.meta_description || a.meta_description.length < 100).length;
        const articlesWithoutImage = data.filter(a => !a.featured_image_url).length;
        const articlesWithShortContent = data.filter(a => {
          const wordCount = (a.content || '').split(/\s+/).filter(w => w.length > 0).length;
          return wordCount < 800;
        }).length;
        const articlesWithoutKeywords = data.filter(a => !a.keywords || a.keywords.length === 0).length;
        
        // Verificar presença de CTA
        const articlesWithoutCTA = data.filter(a => {
          const content = (a.content || '').toLowerCase();
          return !content.includes('próximo passo') && !content.includes('entre em contato') && !content.includes('fale conosco');
        }).length;

        // Calcular frequência (artigos no último mês)
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const recentArticles = data.filter(a => new Date(a.created_at) >= oneMonthAgo).length;

        // Verificar links internos (simplificado - procura por links no conteúdo)
        const articlesWithInternalLinks = data.filter(a => {
          const content = a.content || '';
          return content.includes('href="') || content.includes('](/');
        }).length;

        const getStatus = (percentage: number, inverted = false): 'good' | 'warning' | 'critical' => {
          const value = inverted ? 100 - percentage : percentage;
          if (value >= 80) return 'good';
          if (value >= 50) return 'warning';
          return 'critical';
        };

        const newDimensions: DimensionAnalysis[] = [
          {
            id: 'structure',
            label: 'Estrutura (Títulos e Meta)',
            icon: <Type className="h-5 w-5" />,
            score: Math.round(((data.length - articlesWithBadMeta) / data.length) * 100),
            status: getStatus(((data.length - articlesWithBadMeta) / data.length) * 100),
            description: articlesWithBadMeta > 0 
              ? `${articlesWithBadMeta} artigos precisam de meta descriptions melhores`
              : 'Todos os artigos têm meta descriptions adequadas'
          },
          {
            id: 'content',
            label: 'Conteúdo (Tamanho e Qualidade)',
            icon: <FileText className="h-5 w-5" />,
            score: Math.round(((data.length - articlesWithShortContent) / data.length) * 100),
            status: getStatus(((data.length - articlesWithShortContent) / data.length) * 100),
            description: articlesWithShortContent > 0 
              ? `${articlesWithShortContent} artigos podem ter mais conteúdo`
              : 'Todos os artigos têm tamanho ideal'
          },
          {
            id: 'keywords',
            label: 'Palavras-chave',
            icon: <Target className="h-5 w-5" />,
            score: Math.round(((data.length - articlesWithoutKeywords) / data.length) * 100),
            status: getStatus(((data.length - articlesWithoutKeywords) / data.length) * 100),
            description: articlesWithoutKeywords > 0 
              ? `${articlesWithoutKeywords} artigos sem palavras-chave definidas`
              : 'Todos os artigos têm palavras-chave'
          },
          {
            id: 'images',
            label: 'Imagens',
            icon: <Image className="h-5 w-5" />,
            score: Math.round(((data.length - articlesWithoutImage) / data.length) * 100),
            status: getStatus(((data.length - articlesWithoutImage) / data.length) * 100),
            description: articlesWithoutImage > 0 
              ? `${articlesWithoutImage} artigos sem imagem de capa`
              : 'Todos os artigos têm imagens'
          },
          {
            id: 'frequency',
            label: 'Frequência de Publicação',
            icon: <Clock className="h-5 w-5" />,
            score: Math.min(100, recentArticles * 25),
            status: recentArticles >= 4 ? 'good' : recentArticles >= 2 ? 'warning' : 'critical',
            description: `${recentArticles} artigos publicados no último mês`
          },
          {
            id: 'links',
            label: 'Links Internos',
            icon: <Link2 className="h-5 w-5" />,
            score: Math.round((articlesWithInternalLinks / data.length) * 100),
            status: getStatus((articlesWithInternalLinks / data.length) * 100),
            description: `${articlesWithInternalLinks} de ${data.length} artigos têm links internos`
          },
          {
            id: 'cta',
            label: 'CTAs (Chamadas para Ação)',
            icon: <Target className="h-5 w-5" />,
            score: Math.round(((data.length - articlesWithoutCTA) / data.length) * 100),
            status: getStatus(((data.length - articlesWithoutCTA) / data.length) * 100),
            description: articlesWithoutCTA > 0 
              ? `${articlesWithoutCTA} artigos sem CTA claro`
              : 'Todos os artigos têm CTAs'
          }
        ];
        setDimensions(newDimensions);

        // Gerar dicas contextuais
        const newTips: SEOTip[] = [];
        
        if (articlesWithBadMeta > 0) {
          newTips.push({
            icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
            text: `${articlesWithBadMeta} ${articlesWithBadMeta === 1 ? 'artigo precisa' : 'artigos precisam'} de descrições melhores`,
            priority: 'high'
          });
        }

        if (articlesWithoutImage > 0) {
          newTips.push({
            icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
            text: `Adicione imagens em ${articlesWithoutImage} ${articlesWithoutImage === 1 ? 'artigo' : 'artigos'}`,
            priority: 'medium'
          });
        }

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
        setDimensions([]);
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

  const getStatusLabel = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'Bom';
      case 'warning': return 'Pode Melhorar';
      case 'critical': return 'Crítico';
    }
  };

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-500/10';
      case 'warning': return 'text-yellow-600 bg-yellow-500/10';
      case 'critical': return 'text-red-500 bg-red-500/10';
    }
  };

  const getOverallStatus = (score: number) => {
    if (score >= 80) return { label: 'Otimizado', color: 'text-primary bg-primary/10' };
    if (score >= 60) return { label: 'Saudável', color: 'text-green-600 bg-green-500/10' };
    if (score >= 40) return { label: 'Em Atenção', color: 'text-yellow-600 bg-yellow-500/10' };
    return { label: 'Crítico', color: 'text-red-500 bg-red-500/10' };
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

  const handleOptimizeNow = () => {
    // Scroll to the article list section
    const articleListElement = document.getElementById('article-seo-list');
    if (articleListElement) {
      articleListElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  const overallStatus = getOverallStatus(aggregatedScore);

  return (
    <div className="space-y-8">
      {/* Header com Narrativa */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise de SEO</h1>
          <p className="text-muted-foreground text-sm">Saúde do seu Blog</p>
        </div>
        
        {/* Narrativa + CTA Principal */}
        <div className="client-card client-card-glow p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <p className="text-foreground leading-relaxed">
                Aqui você vê a <span className="font-semibold text-primary">saúde real do seu blog no Google</span>.
              </p>
              <p className="text-muted-foreground text-sm">
                A OmniSeen analisa seus artigos como um especialista em SEO faria e mostra exatamente o que precisa ser ajustado para você ganhar mais visibilidade.
              </p>
            </div>
            <Button 
              onClick={handleOptimizeNow}
              className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Wrench className="h-4 w-4" />
              Otimizar meus artigos agora
            </Button>
          </div>
        </div>
      </div>

      {/* Diagnóstico Geral do Blog */}
      <div className="client-card p-8">
        <h2 className="text-lg font-semibold text-foreground mb-6">Diagnóstico Geral</h2>
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex flex-col items-center text-center">
            <SEOScoreGauge score={aggregatedScore} size="lg" showLabel animated />
            <div className={cn('mt-4 px-4 py-2 rounded-full font-medium', overallStatus.color)}>
              {overallStatus.label}
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <p className="text-lg text-foreground font-medium">
              {aggregatedScore >= 80 
                ? 'Seu blog está tecnicamente pronto para crescer no Google! 🚀'
                : aggregatedScore >= 60
                ? 'Seu blog está saudável, mas algumas melhorias podem acelerar seu crescimento. ✨'
                : aggregatedScore >= 40
                ? 'Seu blog precisa de atenção. Vamos melhorar juntos!'
                : 'Seu blog precisa de otimização urgente para performar no Google.'
              }
            </p>
            <p className="text-muted-foreground text-sm">
              Baseado em {articleCount} {articleCount === 1 ? 'artigo publicado' : 'artigos publicados'}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">{articlesAbove80} acima de 80</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-muted-foreground">{articlesBelow60} abaixo de 60</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Análise por Dimensão */}
      {dimensions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Análise por Dimensão</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dimensions.map((dim) => (
              <div key={dim.id} className="client-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', getStatusColor(dim.status))}>
                      {dim.icon}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{dim.label}</p>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', getStatusColor(dim.status))}>
                        {getStatusLabel(dim.status)}
                      </span>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-foreground">{dim.score}</span>
                </div>
                <p className="text-xs text-muted-foreground">{dim.description}</p>
                
                {/* Botão de Links Internos com IA */}
                {dim.id === 'links' && dim.status !== 'good' && blog?.id && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <BatchInternalLinksButton 
                      blogId={blog.id} 
                      onComplete={handleArticleUpdated}
                      variant="compact"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEO Trends Section */}
      {articleCount > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Evolução do SEO</h2>
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
        <div id="article-seo-list">
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
        </div>
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
                <div className={cn('p-2 rounded-lg',
                  tip.priority === 'high' ? 'bg-red-500/20' :
                  tip.priority === 'medium' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                )}>
                  {tip.icon}
                </div>
                <span className="text-foreground">{tip.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
