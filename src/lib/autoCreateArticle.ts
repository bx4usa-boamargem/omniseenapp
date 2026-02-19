import { NavigateFunction } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { smartNavigate, getClientArticleEditPath } from '@/utils/platformUrls';

export interface QuickArticleConfig {
  blogId: string;
  theme: string;
  generationMode?: 'fast' | 'deep';
  generateImages?: boolean;
}

/**
 * Start quick article creation via Engine v1.
 * Navigates to /client/articles/engine/new with query params.
 */
export function startQuickArticle(
  config: QuickArticleConfig,
  navigate: NavigateFunction
) {
  const query = new URLSearchParams({
    quick: 'true',
    theme: config.theme,
    mode: config.generationMode || 'fast',
    images: config.generateImages !== false ? '1' : '0',
  }).toString();

  navigate(`/client/articles/engine/new?${query}`);
}

/**
 * Convert an opportunity to article via edge function.
 * This handles full article generation with images and redirects to editor.
 */
export async function startFromOpportunity(
  opportunityId: string,
  blogId: string,
  navigate: NavigateFunction
): Promise<boolean> {
  try {
    toast.info('Criando artigo a partir da oportunidade...');
    
    const { data, error } = await supabase.functions.invoke('convert-opportunity-to-article', {
      body: { opportunityId, blogId }
    });

    if (error) {
      console.error('[startFromOpportunity] Edge function error:', error);
      toast.error('Erro ao converter oportunidade');
      return false;
    }

    if (!data?.success || !data?.article_id) {
      console.error('[startFromOpportunity] Invalid response:', data);
      toast.error(data?.error || 'Erro ao criar artigo');
      return false;
    }

    toast.success('Artigo criado!');
    smartNavigate(navigate, getClientArticleEditPath(data.article_id));
    return true;
  } catch (err) {
    console.error('[startFromOpportunity] Unexpected error:', err);
    toast.error('Erro inesperado ao criar artigo');
    return false;
  }
}
