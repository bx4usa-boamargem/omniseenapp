/**
 * Hook for polling generation_jobs table for real-time progress.
 * Replaces useGenerationPolling which polled a placeholder article.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type JobStageType =
  | 'pending'
  | 'running'
  | 'classifying'
  | 'researching'
  | 'writing'
  | 'seo'
  | 'images'
  | 'finalizing'
  | 'completed'
  | 'failed';

interface JobStatus {
  stage: JobStageType;
  progress: number;
  articleId: string | null;
  status: string | null;
  errorMessage: string | null;
}

// Map job status/current_step to UI stage
function deriveStage(status: string, currentStep: string | null): JobStageType {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'pending') return 'pending';

  // Map current_step from orchestrator to UI stages
  if (!currentStep) return 'running';
  const step = currentStep.toUpperCase();
  if (step.includes('INPUT') || step.includes('VALIDATE')) return 'classifying';
  if (step.includes('SERP') || step.includes('RESEARCH')) return 'researching';
  if (step.includes('ARTICLE') || step.includes('CONTENT') || step.includes('WRITE')) return 'writing';
  if (step.includes('SEO') || step.includes('SCORE')) return 'seo';
  if (step.includes('IMAGE')) return 'images';
  if (step.includes('SAVE') || step.includes('PUBLISH') || step.includes('FINAL')) return 'finalizing';
  return 'running';
}

const STAGE_PROGRESS: Record<JobStageType, number> = {
  pending: 5,
  running: 10,
  classifying: 15,
  researching: 35,
  writing: 60,
  seo: 75,
  images: 88,
  finalizing: 95,
  completed: 100,
  failed: 0,
};

interface UseJobPollingOptions {
  jobId: string | null;
  enabled: boolean;
  intervalMs?: number;
  onComplete?: (articleId: string) => void;
  onError?: (error: string) => void;
}

export function useJobPolling({
  jobId,
  enabled,
  intervalMs = 2000,
  onComplete,
  onError,
}: UseJobPollingOptions) {
  const [status, setStatus] = useState<JobStatus>({
    stage: 'pending',
    progress: 5,
    articleId: null,
    status: null,
    errorMessage: null,
  });
  const [isPolling, setIsPolling] = useState(false);
  const [stuckCounter, setStuckCounter] = useState(0);
  const lastStageRef = useRef<JobStageType>('pending');
  const completedRef = useRef(false);

  const pollStatus = useCallback(async () => {
    if (!jobId || completedRef.current) return;

    try {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('status, current_step, article_id, error_message')
        .eq('id', jobId)
        .maybeSingle();

      if (error || !data) {
        console.warn('[JobPolling] Poll error:', error);
        return;
      }

      const jobStatus = data.status as string;
      const currentStep = data.current_step as string | null;
      const newStage = deriveStage(jobStatus, currentStep);
      const newProgress = STAGE_PROGRESS[newStage] || 10;

      // Stuck detection
      if (newStage === lastStageRef.current) {
        setStuckCounter((prev) => prev + 1);
      } else {
        setStuckCounter(0);
      }
      lastStageRef.current = newStage;

      setStatus({
        stage: newStage,
        progress: newProgress,
        articleId: data.article_id as string | null,
        status: jobStatus,
        errorMessage: data.error_message as string | null,
      });

      // Completion
      if (jobStatus === 'completed' && data.article_id && !completedRef.current) {
        completedRef.current = true;
        console.log('[JobPolling] ✅ Job completed, article:', data.article_id);
        onComplete?.(data.article_id as string);
      }

      // Failure
      if (jobStatus === 'failed' && !completedRef.current) {
        completedRef.current = true;
        onError?.(data.error_message as string || 'Geração falhou. Tente novamente.');
      }
    } catch (err) {
      console.error('[JobPolling] Exception:', err);
    }
  }, [jobId, onComplete, onError]);

  useEffect(() => {
    if (!enabled || !jobId) {
      setIsPolling(false);
      return;
    }

    completedRef.current = false;
    setIsPolling(true);
    setStuckCounter(0);
    lastStageRef.current = 'pending';

    pollStatus();
    const interval = setInterval(pollStatus, intervalMs);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [enabled, jobId, intervalMs, pollStatus]);

  const isStuck =
    (stuckCounter > 10 && ['pending', 'classifying', 'researching'].includes(status.stage)) ||
    (stuckCounter > 20 && status.stage === 'images') ||
    stuckCounter > 30;

  return {
    ...status,
    isPolling,
    isStuck,
    stuckCounter,
  };
}
