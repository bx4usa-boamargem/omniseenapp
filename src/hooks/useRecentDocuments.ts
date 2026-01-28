import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDocumentScore } from '@/lib/metricsDefinitions';

export interface RecentDocument {
  id: string;
  title: string;
  type: 'article' | 'landing_page';
  typeLabel: string;
  wordCount: number;
  createdAt: Date;
  status: string;
  score: number;
  path: string;
}

interface UseRecentDocumentsReturn {
  documents: RecentDocument[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRecentDocuments(blogId: string | undefined, limit = 5): UseRecentDocumentsReturn {
  const [documents, setDocuments] = useState<RecentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!blogId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch articles
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('id, title, status, created_at, content')
        .eq('blog_id', blogId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (articlesError) throw articlesError;

      // Fetch landing pages
      const { data: landingPages, error: lpError } = await supabase
        .from('landing_pages')
        .select('id, title, status, created_at, page_data')
        .eq('blog_id', blogId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (lpError) throw lpError;

      // Transform articles
      const articleDocs: RecentDocument[] = (articles || []).map((article) => ({
        id: article.id,
        title: article.title || 'Sem título',
        type: 'article' as const,
        typeLabel: 'Artigo',
        wordCount: article.content ? article.content.split(/\s+/).length : 0,
        createdAt: new Date(article.created_at),
        status: article.status || 'draft',
        score: calculateDocumentScore(article.status || 'draft'),
        path: `/client/articles`,
      }));

      // Transform landing pages
      const lpDocs: RecentDocument[] = (landingPages || []).map((lp) => {
        // Estimate word count from page_data
        let wordCount = 0;
        if (lp.page_data && typeof lp.page_data === 'object') {
          const jsonStr = JSON.stringify(lp.page_data);
          wordCount = jsonStr.split(/\s+/).length;
        }

        return {
          id: lp.id,
          title: lp.title || 'Sem título',
          type: 'landing_page' as const,
          typeLabel: 'Super Página',
          wordCount,
          createdAt: new Date(lp.created_at),
          status: lp.status || 'draft',
          score: calculateDocumentScore(lp.status || 'draft'),
          path: `/client/landing-pages`,
        };
      });

      // Combine and sort by date
      const combined = [...articleDocs, ...lpDocs]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);

      setDocuments(combined);
    } catch (err) {
      console.error('Error fetching recent documents:', err);
      setError('Erro ao carregar documentos');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [blogId, limit]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments };
}
