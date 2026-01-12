import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Radar, Loader2, TrendingUp, HelpCircle, Search, 
  Lightbulb, ExternalLink, Download, FileJson, FileSpreadsheet,
  Calendar, RefreshCw, AlertCircle, Sparkles, Target, Users
} from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { TrendCard } from './TrendCard';
import { QuestionCard } from './QuestionCard';
import { ContentIdeaCard } from './ContentIdeaCard';
import { MarketIntelExport } from './MarketIntelExport';

interface MarketIntel {
  id: string;
  blog_id: string;
  week_of: string;
  source: string;
  market_snapshot: string;
  trends: Array<{
    topic: string;
    why_trending: string;
    growth_signal: string;
    sources: string[];
  }>;
  questions: Array<{
    question: string;
    intent: string;
    audience_pain: string;
  }>;
  keywords: Array<{
    keyword: string;
    context: string;
  }>;
  competitor_gaps: Array<{
    competitor_topic: string;
    who_is_using_it: string;
    gap_opportunity: string;
  }>;
  content_ideas: Array<{
    title: string;
    angle: string;
    keywords: string[];
    goal: string;
    why_now: string;
    sources: string[];
  }>;
  query_cost_usd: number;
  created_at: string;
}

interface MarketRadarTabProps {
  blogId: string;
}

export function MarketRadarTab({ blogId }: MarketRadarTabProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [intels, setIntels] = useState<MarketIntel[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | '90'>('30');
  
  // Fetch market intel data
  const fetchIntels = async () => {
    if (!blogId) return;
    
    setLoading(true);
    try {
      const cutoffDate = selectedPeriod === '7' 
        ? subDays(new Date(), 7)
        : selectedPeriod === '30'
        ? subDays(new Date(), 30)
        : subMonths(new Date(), 3);
      
      const { data, error } = await supabase
        .from('market_intel_weekly')
        .select('*')
        .eq('blog_id', blogId)
        .gte('week_of', format(cutoffDate, 'yyyy-MM-dd'))
        .order('week_of', { ascending: false });
      
      if (error) throw error;
      
      // Parse JSON fields safely
      const parsed = (data || []).map(item => ({
        ...item,
        trends: Array.isArray(item.trends) ? item.trends : [],
        questions: Array.isArray(item.questions) ? item.questions : [],
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        competitor_gaps: Array.isArray(item.competitor_gaps) ? item.competitor_gaps : [],
        content_ideas: Array.isArray(item.content_ideas) ? item.content_ideas : [],
      })) as unknown as MarketIntel[];
      
      setIntels(parsed);
    } catch (error) {
      console.error('Error fetching market intel:', error);
      toast.error('Erro ao carregar dados do radar');
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchIntels();
  }, [blogId, selectedPeriod]);
  
  // Trigger new intel generation
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-market-intel', {
        body: { blog_id: blogId, forceRegenerate: true }
      });
      
      if (error) throw error;
      
      toast.success('Radar atualizado!', {
        description: 'Nova inteligência de mercado gerada com sucesso.'
      });
      
      await fetchIntels();
    } catch (error) {
      console.error('Error refreshing intel:', error);
      toast.error('Erro ao atualizar radar');
    }
    setRefreshing(false);
  };
  
  // Aggregate data from all intels in period
  const aggregatedData = useMemo(() => {
    const allTrends: MarketIntel['trends'] = [];
    const allQuestions: MarketIntel['questions'] = [];
    const allKeywords: MarketIntel['keywords'] = [];
    const allGaps: MarketIntel['competitor_gaps'] = [];
    const allIdeas: MarketIntel['content_ideas'] = [];
    
    intels.forEach(intel => {
      allTrends.push(...(intel.trends || []));
      allQuestions.push(...(intel.questions || []));
      allKeywords.push(...(intel.keywords || []));
      allGaps.push(...(intel.competitor_gaps || []));
      allIdeas.push(...(intel.content_ideas || []));
    });
    
    // Deduplicate by topic/question/keyword
    const uniqueTrends = allTrends.filter((t, i, arr) => 
      arr.findIndex(x => x.topic === t.topic) === i
    );
    const uniqueQuestions = allQuestions.filter((q, i, arr) => 
      arr.findIndex(x => x.question === q.question) === i
    );
    const uniqueKeywords = allKeywords.filter((k, i, arr) => 
      arr.findIndex(x => x.keyword === k.keyword) === i
    );
    const uniqueGaps = allGaps.filter((g, i, arr) => 
      arr.findIndex(x => x.competitor_topic === g.competitor_topic) === i
    );
    const uniqueIdeas = allIdeas.filter((idea, i, arr) => 
      arr.findIndex(x => x.title === idea.title) === i
    );
    
    return {
      trends: uniqueTrends,
      questions: uniqueQuestions,
      keywords: uniqueKeywords,
      gaps: uniqueGaps,
      ideas: uniqueIdeas,
      latestSnapshot: intels[0]?.market_snapshot || null,
      latestDate: intels[0]?.week_of || null,
    };
  }, [intels]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (intels.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Radar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhum dado de mercado disponível</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            O Radar de Mercado coleta inteligência automaticamente toda semana. 
            Você também pode gerar manualmente.
          </p>
          <Button onClick={handleRefresh} disabled={refreshing} className="gap-2">
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Primeira Análise
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <Radar className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Radar de Mercado</h2>
            <p className="text-sm text-muted-foreground">
              Inteligência em tempo real do seu nicho
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Period Filter */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setSelectedPeriod('7')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                selectedPeriod === '7' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}
            >
              7d
            </button>
            <button
              onClick={() => setSelectedPeriod('30')}
              className={`px-3 py-1.5 text-sm transition-colors border-x border-border ${
                selectedPeriod === '30' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}
            >
              30d
            </button>
            <button
              onClick={() => setSelectedPeriod('90')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                selectedPeriod === '90' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}
            >
              90d
            </button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar
          </Button>
          
          <MarketIntelExport data={aggregatedData} intels={intels} />
        </div>
      </div>
      
      {/* Market Snapshot */}
      {aggregatedData.latestSnapshot && (
        <Card className="bg-gradient-to-r from-violet-500/5 to-purple-500/5 border-violet-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-600" />
                Snapshot do Mercado
              </CardTitle>
              {aggregatedData.latestDate && (
                <Badge variant="secondary" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(aggregatedData.latestDate), "dd 'de' MMMM", { locale: ptBR })}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {aggregatedData.latestSnapshot}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Content Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="trends" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Tendências</span>
            <Badge variant="secondary" className="ml-1">{aggregatedData.trends.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-1.5 text-xs sm:text-sm">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Perguntas</span>
            <Badge variant="secondary" className="ml-1">{aggregatedData.questions.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-1.5 text-xs sm:text-sm">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Keywords</span>
            <Badge variant="secondary" className="ml-1">{aggregatedData.keywords.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="gaps" className="gap-1.5 text-xs sm:text-sm">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Gaps</span>
            <Badge variant="secondary" className="ml-1">{aggregatedData.gaps.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="ideas" className="gap-1.5 text-xs sm:text-sm">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Ideias</span>
            <Badge variant="secondary" className="ml-1">{aggregatedData.ideas.length}</Badge>
          </TabsTrigger>
        </TabsList>
        
        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          {aggregatedData.trends.length === 0 ? (
            <EmptyState icon={TrendingUp} message="Nenhuma tendência detectada ainda" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aggregatedData.trends.map((trend, i) => (
                <TrendCard key={i} {...trend} />
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Questions Tab */}
        <TabsContent value="questions" className="space-y-4">
          {aggregatedData.questions.length === 0 ? (
            <EmptyState icon={HelpCircle} message="Nenhuma pergunta do público detectada" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aggregatedData.questions.map((q, i) => (
                <QuestionCard key={i} {...q} />
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Keywords Tab */}
        <TabsContent value="keywords" className="space-y-4">
          {aggregatedData.keywords.length === 0 ? (
            <EmptyState icon={Search} message="Nenhuma keyword emergente detectada" />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-2">
                  {aggregatedData.keywords.map((kw, i) => (
                    <Badge 
                      key={i} 
                      variant="secondary" 
                      className="px-3 py-1.5 text-sm cursor-help"
                      title={kw.context}
                    >
                      {kw.keyword}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Gaps Tab */}
        <TabsContent value="gaps" className="space-y-4">
          {aggregatedData.gaps.length === 0 ? (
            <EmptyState icon={Target} message="Nenhum gap de concorrente detectado" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aggregatedData.gaps.map((gap, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <h4 className="font-medium mb-2">{gap.competitor_topic}</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      <span className="font-medium text-foreground">Usado por:</span> {gap.who_is_using_it}
                    </p>
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        <Sparkles className="h-4 w-4 inline mr-1" />
                        {gap.gap_opportunity}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Ideas Tab */}
        <TabsContent value="ideas" className="space-y-4">
          {aggregatedData.ideas.length === 0 ? (
            <EmptyState icon={Lightbulb} message="Nenhuma ideia de conteúdo gerada ainda" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aggregatedData.ideas.map((idea, i) => (
                <ContentIdeaCard key={i} {...idea} blogId={blogId} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Empty state component
function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="p-3 rounded-full bg-muted mb-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
