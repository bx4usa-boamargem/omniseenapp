import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { OptimizationStep } from '@/components/editor/OptimizeTo100Dialog';

interface UseContentOptimizerProps {
  articleId?: string;
  blogId: string;
  content: string;
  title: string;
  keyword: string;
  onContentUpdate?: (newContent: string) => void;
  onScoreUpdate?: (newScore: number) => void;
}

interface UseContentOptimizerReturn {
  // Individual fix actions
  fixWords: () => Promise<string | null>;
  fixH2: () => Promise<string | null>;
  fixParagraphs: () => Promise<string | null>;
  fixImages: () => Promise<string | null>;
  fixTerms: () => Promise<string | null>;
  fixCTA: () => Promise<string | null>;
  fixMeta: () => Promise<void>;
  
  // Run to 100 mode
  runTo100: () => Promise<void>;
  cancelOptimization: () => void;
  
  // State
  steps: OptimizationStep[];
  progress: number;
  isRunning: boolean;
  fixingArea: string | null;
  scoreHistory: number[];
}

const OPTIMIZATION_STEPS: Omit<OptimizationStep, 'status'>[] = [
  { id: 'serp', label: 'Analisando concorrência (SERP)...' },
  { id: 'words', label: 'Expandindo conteúdo (palavras)...' },
  { id: 'h2', label: 'Criando/ajustando H2...' },
  { id: 'paragraphs', label: 'Melhorando estrutura de parágrafos...' },
  { id: 'terms', label: 'Inserindo termos semânticos...' },
  { id: 'images', label: 'Verificando imagens...' },
  { id: 'meta', label: 'Otimizando title/meta description...' },
  { id: 'cta', label: 'Fortalecendo CTA (Próximo passo)...' },
];

export function useContentOptimizer({
  articleId,
  blogId,
  content,
  title,
  keyword,
  onContentUpdate,
  onScoreUpdate
}: UseContentOptimizerProps): UseContentOptimizerReturn {
  const [steps, setSteps] = useState<OptimizationStep[]>(
    OPTIMIZATION_STEPS.map(s => ({ ...s, status: 'pending' }))
  );
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [fixingArea, setFixingArea] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [cancelled, setCancelled] = useState(false);

  // Helper to ensure SERP analysis exists before optimization
  const ensureSERPAnalysis = useCallback(async (): Promise<boolean> => {
    try {
      // Check if SERP analysis exists
      const { data: existingSerp } = await supabase
        .from('serp_analysis_cache')
        .select('id')
        .eq('blog_id', blogId)
        .eq('keyword', keyword)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();

      if (existingSerp) {
        console.log('[OPTIMIZER] SERP analysis already exists');
        return true;
      }

      // Run SERP analysis if not exists
      console.log('[OPTIMIZER] Running SERP analysis...');
      const { data, error } = await supabase.functions.invoke('analyze-serp', {
        body: { keyword, blogId, forceRefresh: false }
      });

      if (error) {
        console.error('[OPTIMIZER] SERP analysis error:', error);
        toast({
          title: 'Erro na análise SERP',
          description: 'Não foi possível analisar a concorrência',
          variant: 'destructive'
        });
        return false;
      }

      console.log('[OPTIMIZER] SERP analysis completed');
      return true;
    } catch (error) {
      console.error('[OPTIMIZER] SERP check error:', error);
      return false;
    }
  }, [blogId, keyword]);

  // Helper to call boost edge function with specific optimization type
  const callBoost = useCallback(async (
    optimizationType: 'words' | 'h2' | 'structure' | 'terms' | 'rewrite' | 'full',
    currentContent: string
  ): Promise<{ content: string | null; newScore: number | null }> => {
    try {
      const { data, error } = await supabase.functions.invoke('boost-content-score', {
        body: {
          articleId,
          content: currentContent,
          title,
          keyword,
          blogId,
          optimizationType,
          targetScore: 100
        }
      });

      if (error) throw error;

      if (data?.optimized && data?.content) {
        return { content: data.content, newScore: data.newScore };
      }
      
      return { content: null, newScore: data?.newScore || null };
    } catch (error) {
      console.error('Boost error:', error);
      return { content: null, newScore: null };
    }
  }, [articleId, title, keyword, blogId]);

  // Individual fix functions - all ensure SERP analysis first
  const fixWords = useCallback(async (): Promise<string | null> => {
    setFixingArea('words');
    try {
      // Ensure SERP analysis exists before boost
      const serpReady = await ensureSERPAnalysis();
      if (!serpReady) {
        toast({
          title: 'Análise SERP necessária',
          description: 'Execute a análise de concorrência primeiro',
          variant: 'destructive'
        });
        return null;
      }
      
      const result = await callBoost('words', content);
      if (result.content && onContentUpdate) {
        onContentUpdate(result.content);
      }
      if (result.newScore && onScoreUpdate) {
        onScoreUpdate(result.newScore);
      }
      return result.content;
    } finally {
      setFixingArea(null);
    }
  }, [content, callBoost, onContentUpdate, onScoreUpdate, ensureSERPAnalysis]);

  const fixH2 = useCallback(async (): Promise<string | null> => {
    setFixingArea('h2');
    try {
      const result = await callBoost('h2', content);
      if (result.content && onContentUpdate) {
        onContentUpdate(result.content);
      }
      if (result.newScore && onScoreUpdate) {
        onScoreUpdate(result.newScore);
      }
      return result.content;
    } finally {
      setFixingArea(null);
    }
  }, [content, callBoost, onContentUpdate, onScoreUpdate]);

  const fixParagraphs = useCallback(async (): Promise<string | null> => {
    setFixingArea('paragraphs');
    try {
      const result = await callBoost('structure', content);
      if (result.content && onContentUpdate) {
        onContentUpdate(result.content);
      }
      if (result.newScore && onScoreUpdate) {
        onScoreUpdate(result.newScore);
      }
      return result.content;
    } finally {
      setFixingArea(null);
    }
  }, [content, callBoost, onContentUpdate, onScoreUpdate]);

  const fixImages = useCallback(async (): Promise<string | null> => {
    setFixingArea('images');
    try {
      // Images require special handling - for now just mark as done
      // In a full implementation, this would generate/select images
      toast({
        title: 'Imagens',
        description: 'Adicione imagens manualmente para melhorar o score'
      });
      return null;
    } finally {
      setFixingArea(null);
    }
  }, []);

  const fixTerms = useCallback(async (): Promise<string | null> => {
    setFixingArea('terms');
    try {
      const result = await callBoost('terms', content);
      if (result.content && onContentUpdate) {
        onContentUpdate(result.content);
      }
      if (result.newScore && onScoreUpdate) {
        onScoreUpdate(result.newScore);
      }
      return result.content;
    } finally {
      setFixingArea(null);
    }
  }, [content, callBoost, onContentUpdate, onScoreUpdate]);

  const fixCTA = useCallback(async (): Promise<string | null> => {
    setFixingArea('cta');
    try {
      const result = await callBoost('rewrite', content);
      if (result.content && onContentUpdate) {
        onContentUpdate(result.content);
      }
      if (result.newScore && onScoreUpdate) {
        onScoreUpdate(result.newScore);
      }
      return result.content;
    } finally {
      setFixingArea(null);
    }
  }, [content, callBoost, onContentUpdate, onScoreUpdate]);

  const fixMeta = useCallback(async (): Promise<void> => {
    setFixingArea('meta');
    try {
      // Meta optimization would update article metadata
      // For now, this is a placeholder
      toast({
        title: 'Meta Tags',
        description: 'Revise title e meta description manualmente'
      });
    } finally {
      setFixingArea(null);
    }
  }, []);

  // Run to 100 - sequential optimization
  const runTo100 = useCallback(async () => {
    setIsRunning(true);
    setCancelled(false);
    setProgress(0);
    setScoreHistory([]);
    
    // Reset steps
    setSteps(OPTIMIZATION_STEPS.map(s => ({ ...s, status: 'pending' })));

    let currentContent = content;
    let iterationCount = 0;
    const maxIterations = 5;
    
    // STEP 1: Ensure SERP analysis exists (first step in the list)
    setSteps(prev => prev.map((s, idx) => 
      idx === 0 ? { ...s, status: 'running' } : s
    ));
    
    const serpReady = await ensureSERPAnalysis();
    if (!serpReady) {
      setSteps(prev => prev.map((s, idx) => 
        idx === 0 ? { ...s, status: 'error' } : s
      ));
      setIsRunning(false);
      toast({
        title: 'Erro',
        description: 'Não foi possível analisar a concorrência',
        variant: 'destructive'
      });
      return;
    }
    
    setSteps(prev => prev.map((s, idx) => 
      idx === 0 ? { ...s, status: 'done' } : s
    ));
    setProgress((1 / OPTIMIZATION_STEPS.length) * 100);
    
    // Get initial score (now that SERP exists)
    const { data: initialData } = await supabase.functions.invoke('calculate-content-score', {
      body: { content, title, keyword, blogId, saveScore: false }
    });
    
    let currentScore = initialData?.score?.total || 0;
    setScoreHistory([currentScore]);

    const stepFunctions: Record<string, () => Promise<string | null>> = {
      serp: async () => null, // Already handled above
      words: async () => {
        const result = await callBoost('words', currentContent);
        return result.content;
      },
      h2: async () => {
        const result = await callBoost('h2', currentContent);
        return result.content;
      },
      paragraphs: async () => {
        const result = await callBoost('structure', currentContent);
        return result.content;
      },
      terms: async () => {
        const result = await callBoost('terms', currentContent);
        return result.content;
      },
      images: async () => null, // Skip for now
      meta: async () => null, // Skip for now
      cta: async () => {
        const result = await callBoost('rewrite', currentContent);
        return result.content;
      },
    };

    // Start from step 1 (step 0 is SERP which we already did)
    for (let i = 1; i < OPTIMIZATION_STEPS.length && !cancelled && iterationCount < maxIterations; i++) {
      const step = OPTIMIZATION_STEPS[i];
      
      // Update step status to running
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'running' } : s
      ));
      
      try {
        const stepFn = stepFunctions[step.id];
        if (stepFn) {
          const newContent = await stepFn();
          
          if (newContent) {
            currentContent = newContent;
            onContentUpdate?.(newContent);
            
            // Calculate new score
            const { data: scoreData } = await supabase.functions.invoke('calculate-content-score', {
              body: { 
                content: newContent, 
                title, 
                keyword, 
                blogId, 
                saveScore: !!articleId,
                articleId 
              }
            });
            
            if (scoreData?.score?.total) {
              const newScore = scoreData.score.total;
              const scoreDiff = newScore - currentScore;
              currentScore = newScore;
              
              setScoreHistory(prev => [...prev, newScore]);
              onScoreUpdate?.(newScore);
              
              // Update step with score improvement
              setSteps(prev => prev.map((s, idx) => 
                idx === i ? { ...s, status: 'done', scoreAfter: scoreDiff > 0 ? scoreDiff : undefined } : s
              ));
              
              // Check if we reached 100
              if (newScore >= 100) {
                // Mark remaining steps as skipped
                setSteps(prev => prev.map((s, idx) => 
                  idx > i ? { ...s, status: 'skipped' } : s
                ));
                break;
              }
            } else {
              setSteps(prev => prev.map((s, idx) => 
                idx === i ? { ...s, status: 'done' } : s
              ));
            }
          } else {
            // No content change, mark as skipped
            setSteps(prev => prev.map((s, idx) => 
              idx === i ? { ...s, status: 'skipped' } : s
            ));
          }
        } else {
          setSteps(prev => prev.map((s, idx) => 
            idx === i ? { ...s, status: 'skipped' } : s
          ));
        }
      } catch (error) {
        console.error(`Error in step ${step.id}:`, error);
        setSteps(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: 'error' } : s
        ));
      }
      
      // Update progress
      setProgress(((i + 1) / steps.length) * 100);
      iterationCount++;
    }

    setIsRunning(false);
    
    if (currentScore >= 100) {
      toast({
        title: '🎉 Meta atingida!',
        description: `Score chegou a ${currentScore}`
      });
    } else {
      toast({
        title: 'Otimização concluída',
        description: `Score final: ${currentScore}`
      });
    }
  }, [content, title, keyword, blogId, articleId, callBoost, onContentUpdate, onScoreUpdate, cancelled, ensureSERPAnalysis]);

  const cancelOptimization = useCallback(() => {
    setCancelled(true);
    setIsRunning(false);
  }, []);

  return {
    fixWords,
    fixH2,
    fixParagraphs,
    fixImages,
    fixTerms,
    fixCTA,
    fixMeta,
    runTo100,
    cancelOptimization,
    steps,
    progress,
    isRunning,
    fixingArea,
    scoreHistory
  };
}
