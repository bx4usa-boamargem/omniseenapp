/**
 * Hook for real-time generation stage polling
 * 
 * Polls the article's generation_stage and generation_progress
 * from the database to show accurate UI progress.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GenerationStageType = 
  | 'classifying' 
  | 'selecting' 
  | 'researching' 
  | 'writing' 
  | 'seo'
  | 'qa'
  | 'images' 
  | 'finalizing' 
  | 'completed' 
  | 'failed';

interface GenerationStatus {
  stage: GenerationStageType;
  progress: number;
  imagesTotal: number;
  imagesCompleted: number;
  imagesPending: boolean;
  status: string | null;
}

interface UseGenerationPollingOptions {
  articleId: string | null;
  enabled: boolean;
  intervalMs?: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useGenerationPolling({
  articleId,
  enabled,
  intervalMs = 1500,
  onComplete,
  onError
}: UseGenerationPollingOptions) {
  const [status, setStatus] = useState<GenerationStatus>({
    stage: 'classifying',
    progress: 0,
    imagesTotal: 0,
    imagesCompleted: 0,
    imagesPending: false,
    status: null
  });
  const [isPolling, setIsPolling] = useState(false);
  const [stuckCounter, setStuckCounter] = useState(0);
  const lastStageRef = useRef<GenerationStageType>('classifying');
  const lastProgressRef = useRef<number>(0);

  const pollStatus = useCallback(async () => {
    if (!articleId) return;

    try {
      const { data, error } = await supabase
        .from('articles')
        .select('generation_stage, generation_progress, images_total, images_completed, images_pending, status')
        .eq('id', articleId)
        .single();

      if (error) {
        console.warn('[GenerationPolling] Poll error:', error);
        return;
      }

      if (!data) return;

      const newStage = (data.generation_stage as GenerationStageType) || 'classifying';
      const newProgress = data.generation_progress || 0;

      // Check if stuck (same stage + progress for multiple polls)
      if (newStage === lastStageRef.current && newProgress === lastProgressRef.current) {
        setStuckCounter(prev => prev + 1);
      } else {
        setStuckCounter(0);
      }

      lastStageRef.current = newStage;
      lastProgressRef.current = newProgress;

      setStatus({
        stage: newStage,
        progress: newProgress,
        imagesTotal: data.images_total || 0,
        imagesCompleted: data.images_completed || 0,
        imagesPending: data.images_pending || false,
        status: data.status
      });

      // Check for completion - V4.3: Only 'completed' is valid, no null fallback
      if (data.status === 'published' || data.status === 'draft') {
        if (newStage === 'completed') {
          console.log('[GenerationPolling] ✅ Generation completed');
          onComplete?.();
        }
      }

      // Check for failure
      if (newStage === 'failed') {
        onError?.('Geração falhou. Tente novamente.');
      }

    } catch (err) {
      console.error('[GenerationPolling] Exception:', err);
    }
  }, [articleId, onComplete, onError]);

  useEffect(() => {
    if (!enabled || !articleId) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    
    // Initial poll
    pollStatus();

    // Set up interval
    const interval = setInterval(pollStatus, intervalMs);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [enabled, articleId, intervalMs, pollStatus]);

  // Derive if we're stuck (> 10 polls = ~15s with 1.5s interval)
  const isStuck = stuckCounter > 10 && 
    (status.stage === 'classifying' || status.stage === 'researching');

  return {
    ...status,
    isPolling,
    isStuck,
    stuckCounter
  };
}
