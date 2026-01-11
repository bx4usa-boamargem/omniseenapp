import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { calculateSEOScore, SEOScoreResult } from '@/utils/seoScore';
import { SEOScoreGauge } from '@/components/seo/SEOScoreGauge';
import { SEOOptimizationDrawer } from '@/components/seo/SEOOptimizationDrawer';
import { ArticlesWithoutImagesDrawer } from '@/components/client/ArticlesWithoutImagesDrawer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Type, 
  FileText, 
  Hash, 
  AlignLeft, 
  Search, 
  Image,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Sparkles
} from 'lucide-react';
import { OptimizationType } from '@/config/seoOptimizationTypes';

interface ArticleSEO {
  id: string;
  title: string;
  meta_description: string | null;
  content: string | null;
  keywords: string[] | null;
  featured_image_url: string | null;
}

interface SEOTip {
  icon: typeof Lightbulb;
  text: string;
  priority: 'high' | 'medium' | 'low';
}

export default function ClientSEO() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleSEO[]>([]);
  const [aggregatedScore, setAggregatedScore] = useState(0);
  const [aggregatedDetails, setAggregatedDetails] = useState<SEOScoreResult['details'] | null>(null);
  const [tips, setTips] = useState<SEOTip[]>([]);
  
  // Optimization drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<OptimizationType | null>(null);
  
  // Image drawer state for contextual image generation
  const [imageDrawerOpen, setImageDrawerOpen] = useState(false);

  const fetchSEOData = useCallback(async (blogId: string) => {
    try {
      const { data } = await supabase
        .from('articles')
        .select('id, title, meta_description, content, keywords, featured_image_url')
        .eq('blog_id', blogId)
        .eq('status', 'published')
        .limit(20);

      if (data && data.length > 0) {
        setArticles(data);
        
        // Calculate individual scores and aggregate
        const scores = data.map(article => 
          calculateSEOScore({
            title: article.title,
            metaDescription: article.meta_description || '',
            content: article.content,
            keywords: article.keywords || [],
            featuredImage: article.featured_image_url
          })
        );

        // Aggregate scores
        const avgScore = Math.round(
          scores.reduce((acc, s) => acc + s.totalScore, 0) / scores.length
        );
        setAggregatedScore(avgScore);

        // Aggregate details
        const aggregated: SEOScoreResult['details'] = {
          title: { score: 0, max: 15 },
          meta: { score: 0, max: 15 },
          keywords: { score: 0, max: 15 },
          content: { score: 0, max: 20 },
          density: { score: 0, max: 20 },
          image: { score: 0, max: 15 }
        };

        scores.forEach(s => {
          aggregated.title.score += s.details.title.score;
          aggregated.meta.score += s.details.meta.score;
          aggregated.keywords.score += s.details.keywords.score;
          aggregated.content.score += s.details.content.score;
          aggregated.density.score += s.details.density.score;
          aggregated.image.score += s.details.image.score;
        });

        const count = scores.length;
        aggregated.title.score = Math.round(aggregated.title.score / count);
        aggregated.meta.score = Math.round(aggregated.meta.score / count);
        aggregated.keywords.score = Math.round(aggregated.keywords.score / count);
        aggregated.content.score = Math.round(aggregated.content.score / count);
        aggregated.density.score = Math.round(aggregated.density.score / count);
        aggregated.image.score = Math.round(aggregated.image.score / count);

        setAggregatedDetails(aggregated);

        // Generate tips
        const newTips: SEOTip[] = [];
        
        const articlesWithoutMeta = data.filter(a => !a.meta_description || a.meta_description.length < 100).length;
        if (articlesWithoutMeta > 0) {
          newTips.push({
            icon: FileText,
            text: `${articlesWithoutMeta} ${articlesWithoutMeta === 1 ? 'artigo precisa' : 'artigos precisam'} de descrições melhores`,
            priority: 'high'
          });
        }

        const articlesWithoutImage = data.filter(a => !a.featured_image_url).length;
        if (articlesWithoutImage > 0) {
          newTips.push({
            icon: Image,
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
            icon: AlignLeft,
            text: `${articlesWithShortContent} ${articlesWithShortContent === 1 ? 'artigo pode' : 'artigos podem'} ter mais conteúdo`,
            priority: 'medium'
          });
        }

        const articlesWithBadTitles = data.filter(a => a.title.length < 30 || a.title.length > 70).length;
        if (articlesWithBadTitles > 0) {
          newTips.push({
            icon: Type,
            text: `Revise os títulos de ${articlesWithBadTitles} ${articlesWithBadTitles === 1 ? 'artigo' : 'artigos'}`,
            priority: 'low'
          });
        }

        const articlesWithoutKeywords = data.filter(a => !a.keywords || a.keywords.length === 0).length;
        if (articlesWithoutKeywords > 0) {
          newTips.push({
            icon: Hash,
            text: `Adicione palavras-chave em ${articlesWithoutKeywords} ${articlesWithoutKeywords === 1 ? 'artigo' : 'artigos'}`,
            priority: 'high'
          });
        }

        setTips(newTips);
      } else {
        setAggregatedScore(0);
        setTips([{
          icon: Lightbulb,
          text: 'Publique seus primeiros artigos para ver a análise de SEO',
          priority: 'high'
        }]);
      }
    } catch (error) {
      console.error('Error fetching SEO data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const getScoreStatus = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 80) return { icon: CheckCircle2, color: 'text-green-500', label: 'Ótimo' };
    if (percentage >= 50) return { icon: AlertCircle, color: 'text-yellow-500', label: 'Pode melhorar' };
    return { icon: XCircle, color: 'text-red-500', label: 'Precisa atenção' };
  };

  const metrics: Array<{ key: OptimizationType; icon: typeof Type; label: string; description: string }> = [
    { key: 'title', icon: Type, label: 'Títulos', description: 'Seus títulos estão atraentes?' },
    { key: 'meta', icon: FileText, label: 'Descrições', description: 'Google mostra isso nos resultados' },
    { key: 'keywords', icon: Hash, label: 'Palavras-chave', description: 'Termos que seu público busca' },
    { key: 'content', icon: AlignLeft, label: 'Conteúdo', description: 'Artigos completos e úteis' },
    { key: 'density', icon: Search, label: 'Densidade', description: 'Palavras-chave bem distribuídas' },
    { key: 'image', icon: Image, label: 'Imagens', description: 'Imagens chamam atenção' }
  ];

  const handleOpenOptimization = (type: OptimizationType) => {
    // For images, open the contextual drawer instead of batch optimization
    if (type === 'image') {
      setImageDrawerOpen(true);
      return;
    }
    setDrawerType(type);
    setDrawerOpen(true);
  };

  const handleOptimizationComplete = () => {
    // Refresh SEO data after optimization
    if (blog?.id) {
      fetchSEOData(blog.id);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
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
          className="text-gray-500 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saúde do seu Blog</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Entenda como seu blog está otimizado</p>
        </div>
      </div>

      {/* Main Score Card */}
      <div className="client-card client-card-glow p-8">
        <div className="flex flex-col items-center text-center">
          <SEOScoreGauge score={aggregatedScore} size="lg" showLabel animated />
          <p className="text-xl text-gray-900 dark:text-white mt-4 font-medium">
            {getEmotionalMessage(aggregatedScore)}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Baseado em {articles.length} {articles.length === 1 ? 'artigo publicado' : 'artigos publicados'}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      {aggregatedDetails && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metrics.map(metric => {
            const detail = aggregatedDetails[metric.key];
            const status = getScoreStatus(detail.score, detail.max);
            const StatusIcon = status.icon;
            const MetricIcon = metric.icon;

            return (
              <div 
                key={metric.key}
                className="client-card p-4 hover:border-purple-500/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <MetricIcon className="h-5 w-5 text-purple-400" />
                  </div>
                  <StatusIcon className={`h-5 w-5 ${status.color}`} />
                </div>
                <h3 className="text-gray-900 dark:text-white font-medium">{metric.label}</h3>
                <p className="text-gray-500 text-xs mt-1">{metric.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{detail.score}/{detail.max}</span>
                  <span className={`text-xs ${status.color}`}>{status.label}</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      (detail.score / detail.max) >= 0.8 ? 'bg-green-500' :
                      (detail.score / detail.max) >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(detail.score / detail.max) * 100}%` }}
                  />
                </div>
                
                {/* AI Optimization Button - Always visible for components that need improvement */}
                {(detail.score / detail.max) < 0.8 && metric.key !== 'image' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-4 gap-2 border-purple-500/30 text-purple-600 dark:text-purple-400 
                               hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:border-purple-500/50
                               transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
                    onClick={() => handleOpenOptimization(metric.key)}
                  >
                    <Sparkles className="h-4 w-4" />
                    Melhorar com IA
                  </Button>
                )}
                
                {/* Special button for images - always visible if needs improvement */}
                {metric.key === 'image' && (detail.score / detail.max) < 0.8 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-4 gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 
                               hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-500/50
                               transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20"
                    onClick={() => handleOpenOptimization('image')}
                  >
                    <Sparkles className="h-4 w-4" />
                    Gerar Imagens
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tips Section */}
      {tips.length > 0 && (
        <div className="client-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dicas para Melhorar</h2>
          </div>
          <ul className="space-y-3">
            {tips.map((tip, index) => {
              const TipIcon = tip.icon;
              return (
                <li 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${
                    tip.priority === 'high' ? 'bg-red-500/20' :
                    tip.priority === 'medium' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                  }`}>
                    <TipIcon className={`h-4 w-4 ${
                      tip.priority === 'high' ? 'text-red-500 dark:text-red-400' :
                      tip.priority === 'medium' ? 'text-yellow-500 dark:text-yellow-400' : 'text-blue-500 dark:text-blue-400'
                    }`} />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{tip.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Back Button */}
      <div className="flex justify-center pt-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/client/dashboard')}
          className="border-gray-300 dark:border-white/20 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Início
        </Button>
      </div>

      {/* SEO Optimization Drawer */}
      {blog && user && (
        <SEOOptimizationDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          type={drawerType}
          articles={articles}
          blogId={blog.id}
          userId={user.id}
          onComplete={handleOptimizationComplete}
        />
      )}

      {/* Contextual Image Generation Drawer */}
      {blog && (
        <ArticlesWithoutImagesDrawer
          open={imageDrawerOpen}
          onOpenChange={setImageDrawerOpen}
          articles={articles}
          blogId={blog.id}
          onImageGenerated={handleOptimizationComplete}
        />
      )}
    </div>
  );
}
