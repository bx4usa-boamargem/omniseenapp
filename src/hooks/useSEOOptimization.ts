import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  OptimizationType, 
  ArticleSEO, 
  OptimizationSuggestion, 
  filterArticlesForOptimization,
  SEO_OPTIMIZATION_TYPES 
} from '@/config/seoOptimizationTypes';
import { calculateSEOScore, SEOScoreResult } from '@/utils/seoScore';
import { toast } from 'sonner';

export type OptimizationPhase = 'idle' | 'analyzing' | 'generating' | 'ready' | 'applying' | 'complete';

export interface OptimizationProgress {
  current: number;
  total: number;
  message: string;
}

export interface ApplyResult {
  applied: number;
  failed: number;
  scoreBeforeTotal: number;
  scoreAfterTotal: number;
  changes: Array<{
    articleId: string;
    articleTitle: string;
    field: string;
    before: string;
    after: string;
    scoreBefore: number;
    scoreAfter: number;
  }>;
}

export function useSEOOptimization() {
  const [phase, setPhase] = useState<OptimizationPhase>('idle');
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [progress, setProgress] = useState<OptimizationProgress>({ current: 0, total: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [articlesToFix, setArticlesToFix] = useState<ArticleSEO[]>([]);

  const analyze = useCallback(async (
    type: OptimizationType,
    articles: ArticleSEO[],
    blogId: string,
    userId: string
  ) => {
    setPhase('analyzing');
    setError(null);
    setSuggestions([]);
    
    try {
      // Calculate scores for all articles
      const scoreDetails = new Map<string, SEOScoreResult['details']>();
      articles.forEach(article => {
        const score = calculateSEOScore({
          title: article.title,
          metaDescription: article.meta_description || '',
          content: article.content,
          keywords: article.keywords || [],
          featuredImage: article.featured_image_url
        });
        scoreDetails.set(article.id, score.details);
      });

      // Filter articles that need improvement
      const filtered = filterArticlesForOptimization(articles, type, scoreDetails);
      setArticlesToFix(filtered);
      
      if (filtered.length === 0) {
        setPhase('idle');
        toast.info(`Todos os ${SEO_OPTIMIZATION_TYPES[type].label.toLowerCase()} já estão otimizados!`);
        return;
      }

      setProgress({ 
        current: 0, 
        total: filtered.length, 
        message: `Analisando ${filtered.length} artigos...` 
      });
      
      setPhase('generating');
      setProgress({ 
        current: 0, 
        total: filtered.length, 
        message: 'Gerando sugestões com IA...' 
      });

      // Call edge function to generate suggestions
      const { data, error: fnError } = await supabase.functions.invoke('batch-seo-suggestions', {
        body: { 
          type, 
          articles: filtered.map(a => ({
            id: a.id,
            title: a.title,
            meta_description: a.meta_description,
            content: a.content?.substring(0, 5000), // Limit content size
            keywords: a.keywords
          })),
          blog_id: blogId,
          user_id: userId
        }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao gerar sugestões');
      }

      if (!data?.suggestions || data.suggestions.length === 0) {
        setPhase('idle');
        toast.info('Nenhuma sugestão de melhoria encontrada.');
        return;
      }

      const mappedSuggestions: OptimizationSuggestion[] = data.suggestions.map((s: any) => ({
        articleId: s.articleId,
        articleTitle: filtered.find(a => a.id === s.articleId)?.title || 'Artigo',
        originalValue: s.originalValue || '',
        suggestedValue: s.suggestedValue || '',
        improvement: s.improvement || '',
        predictedImpact: s.predictedImpact || 'medium',
        selected: true
      }));

      setSuggestions(mappedSuggestions);
      setPhase('ready');
      setProgress({ 
        current: mappedSuggestions.length, 
        total: mappedSuggestions.length, 
        message: `${mappedSuggestions.length} sugestões geradas!` 
      });

    } catch (err) {
      console.error('SEO optimization error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setPhase('idle');
      toast.error('Erro ao analisar artigos');
    }
  }, []);

  const toggleSuggestion = useCallback((articleId: string) => {
    setSuggestions(prev => 
      prev.map(s => 
        s.articleId === articleId ? { ...s, selected: !s.selected } : s
      )
    );
  }, []);

  const selectAll = useCallback((selected: boolean) => {
    setSuggestions(prev => prev.map(s => ({ ...s, selected })));
  }, []);

  const apply = useCallback(async (type: OptimizationType, userId: string): Promise<ApplyResult> => {
    const selectedSuggestions = suggestions.filter(s => s.selected);
    
    const result: ApplyResult = {
      applied: 0,
      failed: 0,
      scoreBeforeTotal: 0,
      scoreAfterTotal: 0,
      changes: []
    };

    if (selectedSuggestions.length === 0) {
      toast.warning('Selecione pelo menos uma sugestão para aplicar');
      return result;
    }

    setPhase('applying');
    const field = SEO_OPTIMIZATION_TYPES[type].field;

    for (const suggestion of selectedSuggestions) {
      setProgress({
        current: result.applied + result.failed + 1,
        total: selectedSuggestions.length,
        message: `Aplicando: ${suggestion.articleTitle.substring(0, 40)}...`
      });

      try {
        // First, get the current article data for score calculation
        const { data: currentArticle, error: fetchError } = await supabase
          .from('articles')
          .select('title, meta_description, content, keywords, featured_image_url')
          .eq('id', suggestion.articleId)
          .single();

        if (fetchError) {
          console.error('Error fetching article for score:', fetchError);
          result.failed++;
          continue;
        }

        // Calculate score BEFORE
        const scoreBefore = calculateSEOScore({
          title: currentArticle.title,
          metaDescription: currentArticle.meta_description || '',
          content: currentArticle.content,
          keywords: currentArticle.keywords || [],
          featuredImage: currentArticle.featured_image_url
        }).totalScore;

        // Prepare update data
        const updateData: Record<string, any> = {};
        
        if (type === 'keywords') {
          updateData[field] = suggestion.suggestedValue.split(',').map(k => k.trim());
        } else {
          updateData[field] = suggestion.suggestedValue;
        }

        // Apply the update
        const { error: updateError } = await supabase
          .from('articles')
          .update(updateData)
          .eq('id', suggestion.articleId);

        if (updateError) {
          console.error('Error updating article:', updateError);
          result.failed++;
          continue;
        }

        // Calculate score AFTER (simulate with new value)
        const afterData = { ...currentArticle, [field]: updateData[field] };
        const scoreAfter = calculateSEOScore({
          title: afterData.title,
          metaDescription: afterData.meta_description || '',
          content: afterData.content,
          keywords: Array.isArray(afterData.keywords) ? afterData.keywords : [],
          featuredImage: afterData.featured_image_url
        }).totalScore;

        // Save revision for undo capability
        try {
          await supabase.from('article_revisions').insert({
            article_id: suggestion.articleId,
            user_id: userId,
            field_changed: field,
            original_value: suggestion.originalValue,
            new_value: suggestion.suggestedValue,
            optimization_type: type,
            score_before: scoreBefore,
            score_after: scoreAfter
          });
        } catch (revisionError) {
          console.warn('Failed to save revision:', revisionError);
          // Don't fail the whole operation for this
        }

        // Track results
        result.applied++;
        result.scoreBeforeTotal += scoreBefore;
        result.scoreAfterTotal += scoreAfter;
        result.changes.push({
          articleId: suggestion.articleId,
          articleTitle: suggestion.articleTitle,
          field,
          before: suggestion.originalValue,
          after: suggestion.suggestedValue,
          scoreBefore,
          scoreAfter
        });

      } catch (err) {
        console.error('Error applying suggestion:', err);
        result.failed++;
      }
    }

    setPhase('complete');
    setProgress({
      current: result.applied,
      total: selectedSuggestions.length,
      message: `${result.applied} artigos otimizados!`
    });
    
    if (result.applied > 0) {
      const scoreDiff = result.scoreAfterTotal - result.scoreBeforeTotal;
      const message = scoreDiff > 0 
        ? `${result.applied} artigo(s) otimizado(s)! Score: +${scoreDiff} pontos`
        : `${result.applied} artigo(s) otimizado(s)!`;
      toast.success(message);
    }
    
    if (result.failed > 0) {
      toast.error(`${result.failed} artigo(s) falharam ao aplicar`);
    }

    return result;
  }, [suggestions]);

  const undo = useCallback(async (articleId: string): Promise<boolean> => {
    try {
      // Get the last revision for this article
      const { data: lastRevision, error: fetchError } = await supabase
        .from('article_revisions')
        .select('*')
        .eq('article_id', articleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !lastRevision) {
        toast.error('Nenhuma alteração para desfazer');
        return false;
      }

      // Restore the original value
      const { error: updateError } = await supabase
        .from('articles')
        .update({ [lastRevision.field_changed]: lastRevision.original_value })
        .eq('id', articleId);

      if (updateError) {
        toast.error('Erro ao desfazer alteração');
        return false;
      }

      // Delete the revision record
      await supabase
        .from('article_revisions')
        .delete()
        .eq('id', lastRevision.id);

      toast.success('Alteração desfeita com sucesso');
      return true;
    } catch (err) {
      console.error('Error undoing change:', err);
      toast.error('Erro ao desfazer alteração');
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setSuggestions([]);
    setProgress({ current: 0, total: 0, message: '' });
    setError(null);
    setArticlesToFix([]);
  }, []);

  return {
    phase,
    suggestions,
    progress,
    error,
    articlesToFix,
    analyze,
    apply,
    undo,
    toggleSuggestion,
    selectAll,
    reset
  };
}
