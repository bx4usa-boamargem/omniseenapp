import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublishValidationResult {
  canPublish: boolean;
  reason?: string;
  showBoost: boolean;
  showAnalyze: boolean;
  currentScore: number | null;
  minScore: number;
  serpAnalyzed: boolean;
}

export function usePublishValidation(articleId: string | undefined, blogId: string | undefined) {
  const [validating, setValidating] = useState(false);

  const validateForPublish = useCallback(async (): Promise<PublishValidationResult> => {
    if (!articleId || !blogId) {
      return {
        canPublish: false,
        reason: 'Artigo ou blog não identificado',
        showBoost: false,
        showAnalyze: false,
        currentScore: null,
        minScore: 70,
        serpAnalyzed: false,
      };
    }

    setValidating(true);

    try {
      // 1. Fetch article content score
      const { data: scoreData } = await supabase
        .from('article_content_scores')
        .select('total_score, serp_analysis_id')
        .eq('article_id', articleId)
        .maybeSingle();

      // 2. Fetch blog config for minimum score
      const { data: blogConfig } = await supabase
        .from('blog_config')
        .select('minimum_score_to_publish')
        .eq('blog_id', blogId)
        .maybeSingle();

      const minScore = blogConfig?.minimum_score_to_publish ?? 70;

      // 3. If no score data at all, SERP wasn't analyzed
      if (!scoreData) {
        return {
          canPublish: false,
          reason: 'Análise SERP não realizada para este artigo',
          showBoost: false,
          showAnalyze: true,
          currentScore: null,
          minScore,
          serpAnalyzed: false,
        };
      }

      // 4. Check if SERP was analyzed
      if (!scoreData.serp_analysis_id) {
        return {
          canPublish: false,
          reason: 'Análise de concorrência (SERP) não realizada',
          showBoost: false,
          showAnalyze: true,
          currentScore: scoreData.total_score,
          minScore,
          serpAnalyzed: false,
        };
      }

      // 5. Check minimum score
      if (scoreData.total_score < minScore) {
        return {
          canPublish: false,
          reason: `Score ${scoreData.total_score}/100 está abaixo do mínimo (${minScore})`,
          showBoost: true,
          showAnalyze: false,
          currentScore: scoreData.total_score,
          minScore,
          serpAnalyzed: true,
        };
      }

      // 6. All checks passed
      return {
        canPublish: true,
        currentScore: scoreData.total_score,
        minScore,
        serpAnalyzed: true,
        showBoost: false,
        showAnalyze: false,
      };
    } catch (error) {
      console.error('Error validating for publish:', error);
      return {
        canPublish: false,
        reason: 'Erro ao validar artigo',
        showBoost: false,
        showAnalyze: false,
        currentScore: null,
        minScore: 70,
        serpAnalyzed: false,
      };
    } finally {
      setValidating(false);
    }
  }, [articleId, blogId]);

  return { validateForPublish, validating };
}
