import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { NavigateFunction } from 'react-router-dom';

export interface OpportunityInput {
  id: string;
  suggested_title: string;
  suggested_keywords?: string[] | null;
  territory?: { city?: string | null; state?: string | null } | null;
  goal?: string | null;
}

/**
 * Creates an Engine v1 generation job directly from an opportunity.
 * Includes anti-duplication guard and opportunity status tracking.
 */
export async function createArticleFromOpportunity(
  opportunity: OpportunityInput,
  blogId: string,
  navigate: NavigateFunction,
  targetWords: number = 2500,
  articleType: 'normal' | 'premium' = 'premium'
): Promise<{ success: boolean; job_id?: string }> {
  const normalizedKeyword = opportunity.suggested_title?.trim().toLowerCase();

  if (!normalizedKeyword || normalizedKeyword.length < 2) {
    toast.error('Título da oportunidade inválido');
    return { success: false };
  }

  // --- ADJUSTMENT 1: Anti-Duplication Guard ---
  try {
    const { data: existingJobs } = await supabase
      .from('generation_jobs')
      .select('id')
      .eq('blog_id', blogId)
      .in('status', ['pending', 'running'])
      .limit(20);

    if (existingJobs && existingJobs.length > 0) {
      // Check input->keyword match (input is JSONB, query client-side)
      for (const job of existingJobs) {
        // Fetch input for each candidate
        const { data: jobDetail } = await supabase
          .from('generation_jobs')
          .select('id, input')
          .eq('id', job.id)
          .single();

        const jobInput = jobDetail?.input as Record<string, unknown> | null;
        const jobKeyword = (jobInput?.keyword as string)?.trim().toLowerCase();

        if (jobKeyword === normalizedKeyword) {
          toast.info('Artigo já está sendo gerado', {
            description: 'Redirecionando para o progresso...',
          });
          navigate(`/client/articles/engine/${job.id}`);
          return { success: true, job_id: job.id };
        }
      }
    }
  } catch (err) {
    console.warn('[createArticleFromOpportunity] Duplication check failed, proceeding:', err);
  }

  // --- Fetch blog niche ---
  let niche = 'default';
  let blogCity = '';
  try {
    const { data: blog } = await supabase
      .from('blogs')
      .select('city, niche_profile_id, niche_profiles(slug)')
      .eq('id', blogId)
      .single();

    if (blog) {
      blogCity = blog.city || '';
      const nicheProfile = Array.isArray(blog.niche_profiles)
        ? blog.niche_profiles[0]
        : blog.niche_profiles;
      niche = (nicheProfile as any)?.slug || 'default';
    }
  } catch {
    // fallback defaults
  }

  // --- ADJUSTMENT 3: Include origin metadata ---
  const payload = {
    keyword: opportunity.suggested_title.trim(),
    blog_id: blogId,
    city: opportunity.territory?.city || blogCity || '',
    niche,
    country: 'BR',
    language: 'pt-BR',
    job_type: 'article' as const,
    intent: (opportunity.goal as any) || 'informational',
    target_words: targetWords,
    image_count: 4,
    source: 'radar',
    opportunity_id: opportunity.id || null,
  };

  // --- Call Engine v1 ---
  const { data, error } = await supabase.functions.invoke('create-generation-job', {
    body: payload,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('429')) {
      toast.warning('Você já tem artigos em geração. Aguarde.');
    } else if (msg.includes('402')) {
      toast.warning('Créditos insuficientes.');
    } else if (msg.includes('400')) {
      toast.error('Dados inválidos: ' + msg);
    } else {
      toast.error('Erro ao criar artigo. Tente novamente.');
    }
    return { success: false };
  }

  const jobId = data?.job_id;
  if (!jobId) {
    toast.error('Resposta inesperada do servidor.');
    return { success: false };
  }

  // --- ADJUSTMENT 4: Update opportunity status ---
  if (opportunity.id) {
    try {
      await supabase
        .from('article_opportunities')
        .update({
          status: 'generating',
          generation_job_id: jobId,
        } as any)
        .eq('id', opportunity.id);
    } catch {
      // Non-blocking
    }
  }

  navigate(`/client/articles/engine/${jobId}`);
  return { success: true, job_id: jobId };
}
