import { useState, useEffect, useMemo } from 'react';
import { useContentScore } from '@/hooks/useContentScore';
import { useContentOptimizer } from '@/hooks/useContentOptimizer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart3,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  Eye,
  EyeOff
} from 'lucide-react';

// Import modular components
import { ContentScoreGauge } from './ContentScoreGauge';
import { StructureMetricsGrid, type StructureMetrics } from './StructureMetricsGrid';
import { TermsTabsPanel } from './TermsTabsPanel';
import { RecommendationsPanel } from './RecommendationsPanel';
import { AIActionsPanel } from './AIActionsPanel';
import { OptimizeTo100Dialog } from './OptimizeTo100Dialog';

interface ContentScorePanelProps {
  articleId?: string;
  content: string;
  title: string;
  keyword: string;
  blogId: string;
  onContentUpdate?: (newContent: string) => void;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT - Refactored with modular sub-components
// ═══════════════════════════════════════════════════════════════════
export function ContentScorePanel({
  articleId,
  content,
  title,
  keyword,
  blogId,
  onContentUpdate
}: ContentScorePanelProps) {
  // Panel visibility toggle with localStorage persistence
  const [isPanelVisible, setIsPanelVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('contentScorePanelVisible') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('contentScorePanelVisible', String(isPanelVisible));
  }, [isPanelVisible]);

  // Optimize to 100 dialog
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);

  // Content score hook
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

  // Content optimizer hook
  const optimizer = useContentOptimizer({
    articleId,
    blogId,
    content,
    title,
    keyword,
    onContentUpdate,
    onScoreUpdate: (newScore) => {
      // Score will be recalculated automatically
    }
  });

  // Auto-calculate score when content changes significantly
  useEffect(() => {
    if (content && keyword && blogId && content.length > 500) {
      const timer = setTimeout(() => {
        calculateScore();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [content, keyword, blogId, calculateScore]);

  // Handle optimize actions
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

  const handleRunTo100 = () => {
    setShowOptimizeDialog(true);
    optimizer.runTo100();
  };

  // Handle individual area fixes
  const handleFixArea = async (area: 'words' | 'h2' | 'paragraphs' | 'images') => {
    let result: string | null = null;
    switch (area) {
      case 'words':
        result = await optimizer.fixWords();
        break;
      case 'h2':
        result = await optimizer.fixH2();
        break;
      case 'paragraphs':
        result = await optimizer.fixParagraphs();
        break;
      case 'images':
        result = await optimizer.fixImages();
        break;
    }
    if (result && onContentUpdate) {
      onContentUpdate(result);
      // Recalculate score after fix
      setTimeout(() => calculateScore(), 500);
    }
  };

  // Handle recommendation fix
  const handleFixRecommendation = async (rec: string | { text: string }, index: number) => {
    // For now, use full optimization to address recommendations
    const boostedContent = await boostScore(80);
    if (boostedContent && onContentUpdate) {
      onContentUpdate(boostedContent);
    }
  };

  // Derive structure metrics from score
  const structureMetrics: StructureMetrics | null = useMemo(() => {
    if (!score || !serpMatrix) return null;

    const marketAvg = serpMatrix.averages;
    const threshold = 0.15;

    const getStatus = (value: number, avg: number): 'below' | 'within' | 'above' => {
      const min = avg * (1 - threshold);
      const max = avg * (1 + threshold);
      if (value < min) return 'below';
      if (value > max) return 'above';
      return 'within';
    };

    const getRange = (avg: number) => ({
      min: Math.round(avg * 0.85),
      max: Math.round(avg * 1.15)
    });

    return {
      words: {
        value: score.comparison.words.article,
        ...getRange(marketAvg.avgWords),
        status: score.breakdown.wordProximity.status
      },
      h2: {
        value: score.comparison.h2.article,
        ...getRange(marketAvg.avgH2),
        status: score.breakdown.h2Coverage.status
      },
      paragraphs: {
        value: score.comparison.paragraphs.article,
        ...getRange(marketAvg.avgParagraphs),
        status: getStatus(score.comparison.paragraphs.article, marketAvg.avgParagraphs)
      },
      images: {
        value: score.comparison.images.article,
        ...getRange(marketAvg.avgImages),
        status: getStatus(score.comparison.images.article, marketAvg.avgImages)
      }
    };
  }, [score, serpMatrix]);

  // No keyword state
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

  // Collapsed state - just show toggle button
  if (!isPanelVisible) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPanelVisible(true)}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            <Eye className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="h-full flex flex-col border-l-0 rounded-l-none">
        {/* Header */}
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Pontuação de conteúdo
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Score baseado na análise dos 10 primeiros resultados do Google para sua palavra-chave.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => calculateScore()}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsPanelVisible(false)}
              >
                <EyeOff className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="space-y-4 px-4 pb-4">
            {/* Score Gauge - New 3-zone design */}
            <ContentScoreGauge 
              score={score?.total ?? null} 
              loading={loading}
              goalMarker={50}
            />
            
            {/* SERP Status */}
            {!serpMatrix ? (
              <div className="text-center">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={analyzeSERP}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {analyzing ? 'Analisando SERP...' : 'Analisar Concorrência'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Selecione os concorrentes para análise
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-2 rounded-md">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>SERP analisada • {Math.round(serpMatrix.averages.avgWords)} palavras médias</span>
              </div>
            )}

            <Separator />

            {/* Structure Metrics Grid - New 2x2 layout with fix buttons */}
            <StructureMetricsGrid
              metrics={structureMetrics}
              onFix={handleFixArea}
              fixingArea={optimizer.fixingArea}
              loading={loading && !score}
            />

            <Separator />

            {/* Terms Tabs Panel - Fixed "Termos (0)" bug */}
            <TermsTabsPanel
              commonTerms={serpMatrix?.commonTerms || []}
              topTitles={serpMatrix?.topTitles || []}
              coveredTerms={score?.breakdown.semanticCoverage.covered || []}
              missingTerms={score?.breakdown.semanticCoverage.missing || []}
              coveragePercentage={score?.breakdown.semanticCoverage.percentage || 0}
              loading={loading && !score}
              hasAnalysis={!!serpMatrix}
            />

            <Separator />

            {/* Recommendations Panel with auto-fix */}
            {score && score.recommendations.length > 0 && (
              <>
                <RecommendationsPanel
                  recommendations={score.recommendations}
                  onFix={handleFixRecommendation}
                />
                <Separator />
              </>
            )}

            {/* AI Actions Panel */}
            <AIActionsPanel
              onAnalyze={analyzeSERP}
              onOptimize={handleOptimize}
              onBoost={handleBoost}
              onRunTo100={handleRunTo100}
              analyzing={analyzing}
              optimizing={optimizing}
              boosting={optimizing}
              runningTo100={optimizer.isRunning}
              hasAnalysis={!!serpMatrix}
            />

            {/* Quality Gate Status */}
            {score && (
              <div className={`text-xs p-3 rounded-md flex items-center gap-2 ${
                score.meetsMarketStandards 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' 
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}>
                {score.meetsMarketStandards ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>Pronto para publicar</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    <span>Score mínimo: 70 para publicar</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Optimize to 100 Dialog */}
      <OptimizeTo100Dialog
        open={showOptimizeDialog}
        onOpenChange={setShowOptimizeDialog}
        steps={optimizer.steps}
        currentScore={score?.total || 0}
        targetScore={100}
        progress={optimizer.progress}
        isRunning={optimizer.isRunning}
        onCancel={optimizer.cancelOptimization}
        scoreHistory={optimizer.scoreHistory}
      />
    </TooltipProvider>
  );
}
