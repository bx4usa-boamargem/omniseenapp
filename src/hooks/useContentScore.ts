import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════════════════════════
// Content Score Types - Motor Editorial Orientado por Mercado
// ═══════════════════════════════════════════════════════════════════

export interface ScoreBreakdown {
  wordProximity: {
    score: number;
    value: number;
    target: number;
    status: 'below' | 'within' | 'above';
  };
  h2Coverage: {
    score: number;
    value: number;
    target: number;
    status: 'below' | 'within' | 'above';
  };
  semanticCoverage: {
    score: number;
    percentage: number;
    covered: string[];
    missing: string[];
  };
  introQuality: {
    score: number;
    hasAnswerFirst: boolean;
  };
  propositionClarity: {
    score: number;
    hasCTA: boolean;
  };
  thematicDepth: {
    score: number;
    coveredTopics: string[];
  };
  visualOrganization: {
    score: number;
    images: number;
    lists: number;
  };
}

export interface MarketComparison {
  words: { article: number; market: number; diff: number; diffPercent: number };
  h2: { article: number; market: number; diff: number; diffPercent: number };
  paragraphs: { article: number; market: number; diff: number; diffPercent: number };
  images: { article: number; market: number; diff: number; diffPercent: number };
}

export interface ContentScore {
  total: number;
  breakdown: ScoreBreakdown;
  comparison: MarketComparison;
  recommendations: string[];
  meetsMarketStandards: boolean;
  serpAnalyzed: boolean;
}

export interface SERPMatrix {
  keyword: string;
  territory: string | null;
  analyzedAt: string;
  averages: {
    avgWords: number;
    avgH2: number;
    avgH3: number;
    avgParagraphs: number;
    avgImages: number;
    avgLists: number;
  };
  commonTerms: string[];
  topTitles: string[];
  contentGaps: string[];
}

interface UseContentScoreReturn {
  score: ContentScore | null;
  serpMatrix: SERPMatrix | null;
  loading: boolean;
  analyzing: boolean;
  optimizing: boolean;
  serpAnalysisId: string | null;
  
  // Actions
  analyzeSERP: () => Promise<void>;
  calculateScore: () => Promise<void>;
  optimizeForSERP: () => Promise<string | null>;
  boostScore: (targetScore?: number) => Promise<string | null>;
  refresh: () => Promise<void>;
}

export function useContentScore(
  articleId: string | undefined,
  content: string,
  title: string,
  keyword: string,
  blogId: string
): UseContentScoreReturn {
  const [score, setScore] = useState<ContentScore | null>(null);
  const [serpMatrix, setSerpMatrix] = useState<SERPMatrix | null>(null);
  const [serpAnalysisId, setSerpAnalysisId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Fetch existing score and SERP data
  const fetchExistingData = useCallback(async () => {
    if (!articleId || !blogId) return;

    setLoading(true);
    try {
      // Fetch existing content score
      const { data: scoreData } = await supabase
        .from('article_content_scores')
        .select('*, serp_analysis_cache(*)')
        .eq('article_id', articleId)
        .single();

      if (scoreData) {
        setScore({
          total: scoreData.total_score,
          breakdown: scoreData.breakdown as unknown as ScoreBreakdown,
          comparison: scoreData.comparison as unknown as MarketComparison,
          recommendations: (scoreData.recommendations as unknown as string[]) || [],
          meetsMarketStandards: scoreData.meets_market_standards || false,
          serpAnalyzed: !!scoreData.serp_analysis_id
        });

        const serpCache = scoreData.serp_analysis_cache as { matrix: unknown; id: string } | null;
        if (serpCache) {
          setSerpMatrix(serpCache.matrix as SERPMatrix);
          setSerpAnalysisId(scoreData.serp_analysis_id);
        }
      }
    } catch (error) {
      console.error('Error fetching content score:', error);
    } finally {
      setLoading(false);
    }
  }, [articleId, blogId]);

  useEffect(() => {
    fetchExistingData();
  }, [fetchExistingData]);

  // Analyze SERP for keyword
  const analyzeSERP = useCallback(async () => {
    if (!keyword || !blogId) {
      toast({
        title: 'Erro',
        description: 'Keyword e blogId são necessários',
        variant: 'destructive'
      });
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-serp', {
        body: { keyword, blogId, forceRefresh: false }
      });

      if (error) throw error;

      if (data?.matrix) {
        setSerpMatrix(data.matrix);
        setSerpAnalysisId(data.serpAnalysisId);
        
        toast({
          title: 'Análise SERP concluída',
          description: data.cached 
            ? 'Usando análise em cache' 
            : `${data.matrix.competitors?.length || 0} concorrentes analisados`
        });
      }
    } catch (error) {
      console.error('SERP analysis error:', error);
      toast({
        title: 'Erro na análise SERP',
        description: 'Não foi possível analisar a concorrência',
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
    }
  }, [keyword, blogId]);

  // Calculate content score
  const calculateScore = useCallback(async () => {
    if (!content || !keyword || !blogId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-content-score', {
        body: {
          articleId,
          title,
          content,
          keyword,
          blogId,
          serpAnalysisId,
          saveScore: !!articleId
        }
      });

      if (error) throw error;

      if (data?.score) {
        setScore(data.score);
        if (data.serpAnalysisId) {
          setSerpAnalysisId(data.serpAnalysisId);
        }
      }
    } catch (error) {
      console.error('Score calculation error:', error);
      toast({
        title: 'Erro ao calcular score',
        description: 'Não foi possível calcular a pontuação',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [articleId, title, content, keyword, blogId, serpAnalysisId]);

  // Optimize content for SERP
  const optimizeForSERP = useCallback(async (): Promise<string | null> => {
    if (!content || !keyword || !blogId) return null;

    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('boost-content-score', {
        body: {
          articleId,
          content,
          title,
          keyword,
          blogId,
          optimizationType: 'terms'
        }
      });

      if (error) throw error;

      if (data?.optimized && data?.content) {
        setScore(prev => prev ? { ...prev, total: data.newScore } : null);
        
        toast({
          title: 'Conteúdo otimizado',
          description: `Score aumentou de ${data.previousScore} para ${data.newScore}`
        });
        
        return data.content;
      }

      return null;
    } catch (error) {
      console.error('Optimization error:', error);
      toast({
        title: 'Erro na otimização',
        description: 'Não foi possível otimizar o conteúdo',
        variant: 'destructive'
      });
      return null;
    } finally {
      setOptimizing(false);
    }
  }, [articleId, content, title, keyword, blogId]);

  // Boost score to target
  const boostScore = useCallback(async (targetScore = 80): Promise<string | null> => {
    if (!content || !keyword || !blogId) return null;

    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('boost-content-score', {
        body: {
          articleId,
          content,
          title,
          keyword,
          blogId,
          targetScore,
          optimizationType: 'full'
        }
      });

      if (error) throw error;

      if (data?.optimized && data?.content) {
        setScore(prev => prev ? { ...prev, total: data.newScore } : null);
        
        toast({
          title: 'Score aumentado!',
          description: `De ${data.previousScore} para ${data.newScore} (+${data.scoreIncrease})`
        });
        
        return data.content;
      } else if (!data?.optimized) {
        toast({
          title: 'Já no alvo',
          description: 'O artigo já atinge a pontuação desejada'
        });
      }

      return null;
    } catch (error) {
      console.error('Boost error:', error);
      toast({
        title: 'Erro ao aumentar score',
        description: 'Não foi possível otimizar o conteúdo',
        variant: 'destructive'
      });
      return null;
    } finally {
      setOptimizing(false);
    }
  }, [articleId, content, title, keyword, blogId]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await analyzeSERP();
    await calculateScore();
  }, [analyzeSERP, calculateScore]);

  return {
    score,
    serpMatrix,
    loading,
    analyzing,
    optimizing,
    serpAnalysisId,
    analyzeSERP,
    calculateScore,
    optimizeForSERP,
    boostScore,
    refresh
  };
}
