import { useState, useEffect } from 'react';
import { useContentScore } from '@/hooks/useContentScore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Target,
  TrendingUp,
  TrendingDown,
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
  Loader2,
  Info
} from 'lucide-react';

interface ContentScorePanelProps {
  articleId?: string;
  content: string;
  title: string;
  keyword: string;
  blogId: string;
  onContentUpdate?: (newContent: string) => void;
}

// ═══════════════════════════════════════════════════════════════════
// SCORE GAUGE COMPONENT - Semicircular gauge like reference image
// ═══════════════════════════════════════════════════════════════════
function ScoreGauge({ score, loading }: { score: number | null; loading: boolean }) {
  const displayScore = score ?? 0;
  const radius = 80;
  const strokeWidth = 12;
  const circumference = Math.PI * radius;
  const progress = (displayScore / 100) * circumference;
  
  // Color based on score
  const getScoreColor = (s: number) => {
    if (s >= 80) return '#22c55e'; // green
    if (s >= 60) return '#eab308'; // yellow
    if (s >= 40) return '#f97316'; // orange
    return '#ef4444'; // red
  };
  
  const color = getScoreColor(displayScore);
  
  return (
    <div className="relative flex flex-col items-center justify-center py-4">
      <svg width="180" height="100" viewBox="0 0 180 100" className="overflow-visible">
        {/* Background arc */}
        <path
          d="M 10 90 A 80 80 0 0 1 170 90"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d="M 10 90 A 80 80 0 0 1 170 90"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="transition-all duration-500"
        />
        {/* Goal marker at 50 (halfway) */}
        <circle cx="90" cy="10" r="4" fill="hsl(var(--muted-foreground))" />
        <text x="90" y="3" textAnchor="middle" className="text-[10px] fill-muted-foreground">50</text>
      </svg>
      
      {/* Score display */}
      <div className="absolute top-8 flex flex-col items-center">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            <span className="text-4xl font-bold" style={{ color }}>{displayScore}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// METRIC ROW COMPONENT - Shows value with market range
// ═══════════════════════════════════════════════════════════════════
interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  marketValue: number;
  marketMin?: number;
  marketMax?: number;
  status: 'below' | 'within' | 'above';
}

function MetricRow({ icon, label, value, marketValue, marketMin, marketMax, status }: MetricRowProps) {
  const getArrowColor = () => {
    if (status === 'above') return 'text-green-500';
    if (status === 'below') return 'text-red-500';
    return 'text-yellow-500';
  };
  
  const Arrow = status === 'below' ? TrendingDown : TrendingUp;
  
  // Calculate range (±15% of market average)
  const min = marketMin ?? Math.round(marketValue * 0.85);
  const max = marketMax ?? Math.round(marketValue * 1.15);
  
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-medium">{value}</span>
        <Arrow className={`h-3.5 w-3.5 ${getArrowColor()}`} />
        <span className="text-xs text-muted-foreground font-mono">
          ({min} - {max})
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TERM BADGE COMPONENT - Colored badge for semantic terms
// ═══════════════════════════════════════════════════════════════════
interface TermBadgeProps {
  term: string;
  status: 'present' | 'partial' | 'missing';
  count?: number;
  target?: number;
}

function TermBadge({ term, status, count, target }: TermBadgeProps) {
  const getBgColor = () => {
    if (status === 'present') return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
    if (status === 'partial') return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
    return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
  };
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border ${getBgColor()}`}>
      <span className="truncate max-w-[120px]">{term}</span>
      {count !== undefined && target !== undefined && (
        <span className="font-mono opacity-70">{count}/{target}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
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

  const [termsOpen, setTermsOpen] = useState(true);
  const [recommendationsOpen, setRecommendationsOpen] = useState(true);
  const [termsTab, setTermsTab] = useState('keywords');

  // Auto-calculate score when content changes significantly
  useEffect(() => {
    if (content && keyword && blogId && content.length > 500) {
      const timer = setTimeout(() => {
        calculateScore();
      }, 2000);
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

  // Derive terms status
  const coveredTerms = score?.breakdown.semanticCoverage.covered || [];
  const missingTerms = score?.breakdown.semanticCoverage.missing || [];

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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => calculateScore()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="space-y-4 px-4 pb-4">
            {/* Score Gauge */}
            <ScoreGauge score={score?.total ?? null} loading={loading} />
            
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

            {/* Structure Metrics */}
            {score && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Estrutura
                </h4>
                
                <MetricRow
                  icon={<FileText className="h-4 w-4 text-muted-foreground" />}
                  label="Palavras"
                  value={score.comparison.words.article}
                  marketValue={score.comparison.words.market}
                  status={score.breakdown.wordProximity.status}
                />
                
                <MetricRow
                  icon={<Hash className="h-4 w-4 text-muted-foreground" />}
                  label="H2"
                  value={score.comparison.h2.article}
                  marketValue={score.comparison.h2.market}
                  status={score.breakdown.h2Coverage.status}
                />
                
                <MetricRow
                  icon={<List className="h-4 w-4 text-muted-foreground" />}
                  label="Parágrafos"
                  value={score.comparison.paragraphs.article}
                  marketValue={score.comparison.paragraphs.market}
                  status={score.comparison.paragraphs.diff >= 0 ? 'above' : 'below'}
                />
                
                <MetricRow
                  icon={<Image className="h-4 w-4 text-muted-foreground" />}
                  label="Imagens"
                  value={score.comparison.images.article}
                  marketValue={score.comparison.images.market}
                  status={score.comparison.images.diff >= 0 ? 'above' : 'below'}
                />
              </div>
            )}

            <Separator />

            {/* Terms Section with Tabs */}
            {score && (
              <Collapsible open={termsOpen} onOpenChange={setTermsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
                  <span>Termos ({coveredTerms.length + missingTerms.length})</span>
                  {termsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Tabs value={termsTab} onValueChange={setTermsTab}>
                    <TabsList className="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="keywords" className="text-xs">
                        Palavras-chave ({coveredTerms.length + missingTerms.length})
                      </TabsTrigger>
                      <TabsTrigger value="coverage" className="text-xs">
                        Cobertura ({score.breakdown.semanticCoverage.percentage}%)
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="keywords" className="mt-2">
                      <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
                        {coveredTerms.slice(0, 10).map((term) => (
                          <TermBadge key={term} term={term} status="present" />
                        ))}
                        {missingTerms.slice(0, 10).map((term) => (
                          <TermBadge key={term} term={term} status="missing" />
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="coverage" className="mt-2">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Termos cobertos</span>
                          <span className="font-medium text-green-600">{coveredTerms.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Termos faltantes</span>
                          <span className="font-medium text-red-600">{missingTerms.length}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${score.breakdown.semanticCoverage.percentage}%` }}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Separator />

            {/* Recommendations */}
            {score && score.recommendations.length > 0 && (
              <Collapsible open={recommendationsOpen} onOpenChange={setRecommendationsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Recomendações ({score.recommendations.length})
                  </div>
                  {recommendationsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {score.recommendations.slice(0, 4).map((rec, i) => (
                    <div key={i} className="text-xs p-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-md border border-amber-200 dark:border-amber-800">
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
                <Sparkles className="h-3.5 w-3.5" />
                Ações IA
              </h4>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={analyzeSERP}
                disabled={analyzing}
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Analisar Concorrência
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleOptimize}
                disabled={optimizing || !serpMatrix}
              >
                {optimizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Target className="h-4 w-4" />
                )}
                Otimizar para SERP
              </Button>

              <Button
                variant="default"
                size="sm"
                className="w-full justify-start gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                onClick={handleBoost}
                disabled={optimizing || !serpMatrix}
              >
                {optimizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Aumentar Score
              </Button>
            </div>

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
    </TooltipProvider>
  );
}
