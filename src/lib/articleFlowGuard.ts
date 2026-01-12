/**
 * OMNISEEN ARTICLE FLOW GUARD
 * 
 * FLUXO OFICIAL (INVIOLÁVEL):
 * 1. Criar artigo base → INSERT → retorna article_id
 * 2. Gerar imagens → UPDATE articles SET featured_image_url, content_images
 * 3. Melhorias com IA / SEO → UPDATE
 * 4. Regenerar imagens → UPDATE
 * 
 * NUNCA criar novo artigo após o passo 1.
 * 
 * REGRA DE OURO: 1 título = 1 registro no banco
 */

import { supabase } from "@/integrations/supabase/client";

export interface ArticleFlowResult {
  action: 'insert' | 'update';
  articleId?: string;
}

/**
 * Verifica se já existe um artigo com o mesmo título no blog.
 * Se existir, retorna ação 'update' com o ID existente.
 * Se não existir, retorna ação 'insert'.
 * 
 * Esta função DEVE ser chamada antes de qualquer INSERT na tabela articles.
 */
export async function ensureSingleArticle(
  blogId: string,
  title: string
): Promise<ArticleFlowResult> {
  if (!blogId || !title) {
    console.log('[FLOW GUARD] Missing blogId or title, allowing INSERT');
    return { action: 'insert' };
  }

  const normalizedTitle = title.trim().toLowerCase();

  // Check for existing article with same title (case-insensitive)
  const { data, error } = await supabase
    .from('articles')
    .select('id, title')
    .eq('blog_id', blogId)
    .ilike('title', normalizedTitle)
    .maybeSingle();

  if (error) {
    console.error('[FLOW GUARD] Error checking for existing article:', error);
    // On error, allow INSERT but log warning
    return { action: 'insert' };
  }

  if (data) {
    console.log(`[FLOW GUARD] Article exists with same title, will UPDATE: id=${data.id}`);
    return { action: 'update', articleId: data.id };
  }

  console.log('[FLOW GUARD] No existing article found, will INSERT');
  return { action: 'insert' };
}

/**
 * Log padronizado para ações de artigo (auditoria)
 */
export function logArticleAction(
  action: 'INSERT' | 'UPDATE' | 'GUARD',
  articleId: string | null,
  details: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${action} Article]`;
  
  if (action === 'GUARD') {
    console.warn(`${logPrefix} [${timestamp}] Prevented duplicate:`, details);
  } else {
    console.log(`${logPrefix} [${timestamp}] id=${articleId}`, details);
  }
}
