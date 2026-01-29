import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { OptimizationStep } from '@/components/editor/OptimizeTo100Dialog';
import { validateScoreImprovement } from '@/lib/scoreThresholds';

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
  { id: 'terms', label: 'Inserindo termos semânticos...' },
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
  // URGENTE: Desabilitar temporariamente o QA automático ("Levar a 100")
  // Motivo: fluxo pode travar por tempo indeterminado dependendo do backend/LLM.
  // Reativaremos quando o motor estiver estável.
  const RUN_TO_100_DISABLED = true;

  const [steps, setSteps] = useState<OptimizationStep[]>(
    OPTIMIZATION_STEPS.map(s => ({ ...s, status: 'pending' }))
  );
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [fixingArea, setFixingArea] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const cancelledRef = useRef(false);

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
  // CRITICAL: Agora valida que o score não cai
  const callBoost = useCallback(async (
    optimizationType: 'words' | 'h2' | 'structure' | 'terms' | 'rewrite' | 'full',
    currentContent: string,
    previousScore: number
  ): Promise<{ content: string | null; newScore: number | null; rejected: boolean; message?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('boost-content-score', {
        body: {
          articleId,
          content: currentContent,
          title,
          keyword,
          blogId,
          optimizationType,
          targetScore: 100,
          userInitiated: true,
          previousScore // Passar score anterior para validação
        }
      });

      if (error) throw error;

      // Verificar se foi rejeitado por regressão de score
      if (data?.rejected) {
        console.warn(`[OPTIMIZER] Optimization rejected: ${data.message}`);
        return { 
          content: null, 
          newScore: data.previousScore || previousScore, 
          rejected: true,
          message: data.message 
        };
      }

      // Validar melhoria de score no cliente também (double-check)
      if (data?.newScore && data.newScore < previousScore) {
        console.warn(`[OPTIMIZER] Score regression detected client-side: ${previousScore} → ${data.newScore}`);
        return { 
          content: null, 
          newScore: previousScore, 
          rejected: true,
          message: `Score cairia de ${previousScore} para ${data.newScore}. Mudança bloqueada.`
        };
      }

      if (data?.optimized && data?.content) {
        return { 
          content: data.content, 
          newScore: data.newScore,
          rejected: false 
        };
      }
      
      return { content: null, newScore: data?.newScore || null, rejected: false };
    } catch (error) {
      console.error('Boost error:', error);
      return { content: null, newScore: null, rejected: false };
    }
  }, [articleId, title, keyword, blogId]);

  // Individual fix functions with regression protection
  const createFixFunction = (
    area: string,
    optimizationType: 'words' | 'h2' | 'structure' | 'terms' | 'rewrite'
  ) => {
    return async (): Promise<string | null> => {
      setFixingArea(area);
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
        
        // Obter score atual para validação
        const { data: scoreData } = await supabase.functions.invoke('calculate-content-score', {
          body: { content, title, keyword, blogId, saveScore: false }
        });
        const currentScore = scoreData?.score?.total || 0;
        
        const result = await callBoost(optimizationType, content, currentScore);
        
        if (result.rejected) {
          toast({
            title: 'Otimização bloqueada',
            description: result.message || 'Esta mudança reduziria o score. Operação cancelada.',
            variant: 'destructive'
          });
          return null;
        }
        
        if (result.content && onContentUpdate) {
          onContentUpdate(result.content);
        }
        if (result.newScore && onScoreUpdate) {
          onScoreUpdate(result.newScore);
          
          // Mostrar melhoria
          const improvement = result.newScore - currentScore;
          if (improvement > 0) {
            toast({
              title: `Score melhorou +${improvement}`,
              description: `${currentScore} → ${result.newScore}`,
            });
          }
        }
        return result.content;
      } finally {
        setFixingArea(null);
      }
    };
  };

  const fixWords = useCallback(createFixFunction('words', 'words'), [content, callBoost, onContentUpdate, onScoreUpdate, ensureSERPAnalysis]);
  const fixH2 = useCallback(createFixFunction('h2', 'h2'), [content, callBoost, onContentUpdate, onScoreUpdate, ensureSERPAnalysis]);
  const fixParagraphs = useCallback(createFixFunction('paragraphs', 'structure'), [content, callBoost, onContentUpdate, onScoreUpdate, ensureSERPAnalysis]);
  const fixTerms = useCallback(createFixFunction('terms', 'terms'), [content, callBoost, onContentUpdate, onScoreUpdate, ensureSERPAnalysis]);
  const fixCTA = useCallback(createFixFunction('cta', 'rewrite'), [content, callBoost, onContentUpdate, onScoreUpdate, ensureSERPAnalysis]);

  const fixImages = useCallback(async (): Promise<string | null> => {
    setFixingArea('images');
    try {
      toast({
        title: 'Imagens',
        description: 'Adicione imagens manualmente para melhorar o score'
      });
      return null;
    } finally {
      setFixingArea(null);
    }
  }, []);

  const fixMeta = useCallback(async (): Promise<void> => {
    setFixingArea('meta');
    try {
      toast({
        title: 'Meta Tags',
        description: 'Revise title e meta description manualmente'
      });
    } finally {
      setFixingArea(null);
    }
  }, []);

  // Run to 100 - sequential optimization with REGRESSION PROTECTION
  const runTo100 = useCallback(async () => {
    if (RUN_TO_100_DISABLED) {
      toast({
        title: 'QA automático desativado',
        description: 'O modo “Levar a 100” foi desabilitado temporariamente para evitar travamentos.',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    cancelledRef.current = false;
    setProgress(0);
    setScoreHistory([]);
    
    // Reset steps
    setSteps(OPTIMIZATION_STEPS.map(s => ({ ...s, status: 'pending' })));

    let currentContent = content;
    let stepsCompleted = 0;
    
    // STEP 1: Ensure SERP analysis exists
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
    stepsCompleted++;
    setProgress((stepsCompleted / OPTIMIZATION_STEPS.length) * 100);
    
    // Get initial score
    const { data: initialData } = await supabase.functions.invoke('calculate-content-score', {
      body: { content, title, keyword, blogId, saveScore: false }
    });
    
    let currentScore = initialData?.score?.total || 0;
    setScoreHistory([currentScore]);

    const stepFunctions: { id: string; fn: () => Promise<{ content: string | null; newScore: number | null; rejected: boolean; message?: string }> }[] = [
      { id: 'serp', fn: async () => ({ content: null, newScore: null, rejected: false }) }, // Already handled
      { id: 'words', fn: async () => callBoost('words', currentContent, currentScore) },
      { id: 'h2', fn: async () => callBoost('h2', currentContent, currentScore) },
      { id: 'terms', fn: async () => callBoost('terms', currentContent, currentScore) },
      { id: 'cta', fn: async () => callBoost('rewrite', currentContent, currentScore) },
    ];

    // Execute each step with regression protection
    for (let i = 1; i < stepFunctions.length && !cancelledRef.current; i++) {
      const step = stepFunctions[i];
      
      // Update step status to running
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'running' } : s
      ));
      
      try {
        // CRITICAL: Guardar estado anterior
        const previousContent = currentContent;
        const previousScore = currentScore;
        
        const result = await step.fn();
        
        // Verificar se foi rejeitado
        if (result.rejected) {
          console.log(`[OPTIMIZER] Step ${step.id} rejected: ${result.message}`);
          setSteps(prev => prev.map((s, idx) => 
            idx === i ? { ...s, status: 'skipped' } : s
          ));
          stepsCompleted++;
          setProgress((stepsCompleted / OPTIMIZATION_STEPS.length) * 100);
          continue;
        }
        
        if (result.content) {
          // VALIDATION: Verificar se o score realmente subiu
          const { data: newScoreData } = await supabase.functions.invoke('calculate-content-score', {
            body: { 
              content: result.content, 
              title, 
              keyword, 
              blogId, 
              saveScore: false
            }
          });
          
          const calculatedScore = newScoreData?.score?.total || previousScore;
          const validation = validateScoreImprovement(previousScore, calculatedScore);
          
          if (!validation.valid) {
            // ROLLBACK: Score caiu, reverter para conteúdo anterior
            console.warn(`[OPTIMIZER] Step ${step.id} caused regression: ${validation.message}`);
            currentContent = previousContent;
            currentScore = previousScore;
            
            setSteps(prev => prev.map((s, idx) => 
              idx === i ? { ...s, status: 'skipped' } : s
            ));
          } else {
            // SUCCESS: Score subiu ou manteve, aplicar mudança
            currentContent = result.content;
            currentScore = calculatedScore;
            
            onContentUpdate?.(result.content);
            setScoreHistory(prev => [...prev, calculatedScore]);
            onScoreUpdate?.(calculatedScore);
            
            // Salvar score se temos articleId
            if (articleId) {
              await supabase.functions.invoke('calculate-content-score', {
                body: { 
                  content: result.content, 
                  title, 
                  keyword, 
                  blogId, 
                  saveScore: true,
                  articleId 
                }
              });
            }
            
            setSteps(prev => prev.map((s, idx) => 
              idx === i ? { 
                ...s, 
                status: 'done', 
                scoreAfter: validation.improvement > 0 ? validation.improvement : undefined 
              } : s
            ));
            
            // Check if we reached 100
            if (calculatedScore >= 100) {
              // Mark remaining steps as skipped
              setSteps(prev => prev.map((s, idx) => 
                idx > i ? { ...s, status: 'skipped' } : s
              ));
              break;
            }
          }
        } else {
          // No content change, mark as skipped
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
      
      stepsCompleted++;
      setProgress((stepsCompleted / OPTIMIZATION_STEPS.length) * 100);
    }

    setIsRunning(false);
    setProgress(100);
    
    if (currentScore >= 100) {
      toast({
        title: '🎉 Meta atingida!',
        description: `Score chegou a ${currentScore}`
      });
    } else {
      const initialScore = scoreHistory[0] || initialData?.score?.total || 0;
      const improvement = currentScore - initialScore;
      toast({
        title: 'Otimização concluída',
        description: improvement > 0 
          ? `Score: ${initialScore} → ${currentScore} (+${improvement})`
          : `Score final: ${currentScore}`
      });
    }
  }, [content, title, keyword, blogId, articleId, callBoost, onContentUpdate, onScoreUpdate, ensureSERPAnalysis, scoreHistory]);

  const cancelOptimization = useCallback(() => {
    cancelledRef.current = true;
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
