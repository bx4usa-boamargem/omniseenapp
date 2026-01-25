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

/**
 * SERP validation is now OPTIONAL - publication is always allowed.
 * This hook only fetches data for informational display purposes.
 */
export function usePublishValidation(articleId: string | undefined, blogId: string | undefined) {
  const [validating, setValidating] = useState(false);

  const validateForPublish = useCallback(async (): Promise<PublishValidationResult> => {
    if (!articleId || !blogId) {
      // Still allow publication even without IDs
      return {
        canPublish: true,
        showBoost: false,
        showAnalyze: false,
        currentScore: null,
        minScore: 0,
        serpAnalyzed: false,
      };
    }

    setValidating(true);

    try {
      // Fetch data for informational purposes only (not blocking)
      const { data: scoreData } = await supabase
        .from('article_content_scores')
        .select('total_score, serp_analysis_id')
        .eq('article_id', articleId)
        .maybeSingle();

      const { data: blogConfig } = await supabase
        .from('blog_config')
        .select('minimum_score_to_publish')
        .eq('blog_id', blogId)
        .maybeSingle();

      const minScore = blogConfig?.minimum_score_to_publish ?? 70;

      // ALWAYS allow publication - SERP is optional
      return {
        canPublish: true,
        currentScore: scoreData?.total_score ?? null,
        minScore,
        serpAnalyzed: !!scoreData?.serp_analysis_id,
        showBoost: false,
        showAnalyze: false,
      };
    } catch (error) {
      console.error('Error fetching validation data:', error);
      // Even on error, allow publication
      return {
        canPublish: true,
        showBoost: false,
        showAnalyze: false,
        currentScore: null,
        minScore: 0,
        serpAnalyzed: false,
      };
    } finally {
      setValidating(false);
    }
  }, [articleId, blogId]);

  return { validateForPublish, validating };
}
