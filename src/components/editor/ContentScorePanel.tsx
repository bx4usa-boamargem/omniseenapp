import { useState, useEffect } from 'react';
import { useContentScore, ContentScore, SERPMatrix } from '@/hooks/useContentScore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  BarChart3,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  RefreshCw,
  Search,
  Zap,
  FileText,
  Hash,
  Image,
  List,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface ContentScorePanelProps {
  articleId?: string;
  content: string;
  title: string;
  keyword: string;
  blogId: string;
  onContentUpdate?: (newContent: string) => void;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

function getStatusIcon(status: 'below' | 'within' | 'above') {
  switch (status) {
    case 'above':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'below':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-yellow-500" />;
  }
}

function getStatusBadge(status: 'below' | 'within' | 'above', diffPercent: number) {
  const absPercent = Math.abs(diffPercent);
  
  if (status === 'above') {
    return <Badge variant="default" className="bg-green-500/20 text-green-700 dark:text-green-300">+{absPercent}%</Badge>;
  }
  if (status === 'below') {
    return <Badge variant="destructive" className="bg-red-500/20 text-red-700 dark:text-red-300">-{absPercent}%</Badge>;
  }
  return <Badge variant="secondary">≈ média</Badge>;
}

export function ContentScorePanel({
  articleId,
  content,
  title,
  keyword,
  blogId,
  onContentUpdate
}: ContentScorePanelProps) {
  const {
    score,
    serpMatrix,
    loading,
    analyzing,
    optimizing,
    analyzeSERP,
    calculateScore,
    optimizeForSERP,
    boostScore
  } = useContentScore(articleId, content, title, keyword, blogId);

  const [termsOpen, setTermsOpen] = useState(false);
  const [recommendationsOpen, setRecommendationsOpen] = useState(true);

  // Auto-calculate score when content changes significantly
  useEffect(() => {
    if (content && keyword && blogId && content.length > 500) {
      const timer = setTimeout(() => {
        calculateScore();
      }, 2000); // Debounce 2s
      return () => clearTimeout(timer);
    }
  }, [content, keyword, blogId, calculateScore]);

  const handleOptimize = async () => {
    const optimizedContent = await optimizeForSERP();
    if (optimizedContent && onContentUpdate) {
      onContentUpdate(optimizedContent);
    }
  };

  const handleBoost = async () => {
    const boostedContent = await boostScore(80);
    if (boostedContent && onContentUpdate) {
      onContentUpdate(boostedContent);
    }
  };

  if (!keyword) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full p-6">
          <div className="text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Adicione uma palavra-chave para analisar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Pontuação de Conteúdo
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => calculateScore()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="space-y-4 pb-4">
            {/* Main Score */}
            <div className={`text-center p-4 rounded-lg ${score ? getScoreBgColor(score.total) : 'bg-muted'}`}>
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              ) : score ? (
                <>
                  <div className={`text-4xl font-bold ${getScoreColor(score.total)}`}>
                    {score.total}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">/ 100 pontos</div>
                  <Progress value={score.total} className="mt-2 h-2" />
                </>
              ) : (
                <>
                  <Target className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-2">Clique em "Analisar SERP" para começar</p>
                </>
              )}
            </div>

            {/* SERP Analysis Button */}
            {!serpMatrix && (
              <Button
                variant="outline"
                className="w-full"
                onClick={analyzeSERP}
                disabled={analyzing}
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {analyzing ? 'Analisando SERP...' : 'Analisar Concorrência'}
              </Button>
            )}

            {/* SERP Status */}
            {serpMatrix && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>SERP analisada: {serpMatrix.averages.avgWords} palavras médias</span>
              </div>
            )}

            <Separator />

            {/* Metrics vs Market */}
            {score && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Métricas vs Mercado
                </h4>

                {/* Words */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Palavras</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {score.comparison.words.article}/{score.comparison.words.market}
                    </span>
                    {getStatusBadge(score.breakdown.wordProximity.status, score.comparison.words.diffPercent)}
                  </div>
                </div>

                {/* H2s */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span>Seções H2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {score.comparison.h2.article}/{score.comparison.h2.market}
                    </span>
                    {getStatusBadge(score.breakdown.h2Coverage.status, score.comparison.h2.diffPercent)}
                  </div>
                </div>

                {/* Paragraphs */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span>Parágrafos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {score.comparison.paragraphs.article}/{score.comparison.paragraphs.market}
                    </span>
                    {getStatusBadge(
                      score.comparison.paragraphs.diff >= 0 ? 'above' : 'below',
                      score.comparison.paragraphs.diffPercent
                    )}
                  </div>
                </div>

                {/* Images */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-muted-foreground" />
                    <span>Imagens</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {score.comparison.images.article}/{score.comparison.images.market}
                    </span>
                    {getStatusBadge(
                      score.comparison.images.diff >= 0 ? 'above' : 'below',
                      score.comparison.images.diffPercent
                    )}
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Semantic Coverage */}
            {score && (
              <Collapsible open={termsOpen} onOpenChange={setTermsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3 w-3" />
                    Termos Principais ({score.breakdown.semanticCoverage.percentage}%)
                  </div>
                  {termsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  {score.breakdown.semanticCoverage.covered.slice(0, 5).map((term) => (
                    <div key={term} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>{term}</span>
                    </div>
                  ))}
                  {score.breakdown.semanticCoverage.missing.slice(0, 5).map((term) => (
                    <div key={term} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3 text-red-400" />
                      <span>{term}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            <Separator />

            {/* Recommendations */}
            {score && score.recommendations.length > 0 && (
              <Collapsible open={recommendationsOpen} onOpenChange={setRecommendationsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" />
                    Recomendações ({score.recommendations.length})
                  </div>
                  {recommendationsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {score.recommendations.slice(0, 4).map((rec, i) => (
                    <div key={i} className="text-xs p-2 bg-muted rounded-md">
                      {rec}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            <Separator />

            {/* AI Actions */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                Ações IA
              </h4>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleOptimize}
                disabled={optimizing || !serpMatrix}
              >
                {optimizing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Target className="h-4 w-4 mr-2" />
                )}
                Otimizar para SERP
              </Button>

              <Button
                variant="default"
                size="sm"
                className="w-full justify-start"
                onClick={handleBoost}
                disabled={optimizing || !serpMatrix}
              >
                {optimizing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Aumentar Score
              </Button>
            </div>

            {/* Quality Gate Status */}
            {score && (
              <div className={`text-xs p-3 rounded-md ${score.meetsMarketStandards ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'}`}>
                {score.meetsMarketStandards ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Artigo atende padrões do mercado</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Precisa de melhorias para competir</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>
    </TooltipProvider>
  );
}
