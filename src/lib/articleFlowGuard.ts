/**
 * OMNISEEN ARTICLE FLOW GUARD V2.0
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
 * 
 * V2.0: Fingerprint semântico com remoção de stopwords
 * "7 Dicas para Captar Mais Clientes" = "7 Dicas para Captar Clientes"
 */

import { supabase } from "@/integrations/supabase/client";

export interface ArticleFlowResult {
  action: 'insert' | 'update';
  articleId?: string;
}

// Portuguese stopwords to remove for semantic comparison
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'as', 'os',
  'um', 'uma', 'uns', 'umas', 'para', 'por', 'com', 'em', 'no', 'na',
  'nos', 'nas', 'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'pelos', 'pelas',
  'mais', 'menos', 'seu', 'sua', 'seus', 'suas', 'este', 'esta', 'estes',
  'estas', 'esse', 'essa', 'esses', 'essas', 'aquele', 'aquela', 'aqueles',
  'aquelas', 'que', 'qual', 'quais', 'como', 'quando', 'onde', 'porque',
  'se', 'também', 'já', 'ainda', 'muito', 'muita', 'muitos', 'muitas',
  'sobre', 'entre', 'até', 'desde', 'após', 'sob', 'sem', 'ter', 'sido',
  'foi', 'era', 'será', 'pode', 'podem', 'deve', 'devem', 'fazer', 'faz',
  'feito', 'forma', 'formas', 'ano', 'anos'
]);

/**
 * Normaliza título para fingerprint semântico.
 * Remove acentos, pontuação e stopwords para comparação de duplicatas.
 * 
 * Exemplo:
 * "7 Dicas para Captar Mais Clientes e Crescer Seu Negócio em 2026"
 * → "7 dicas captar clientes crescer negocio 2026"
 */
export function normalizeForFingerprint(title: string): string {
  return title
    .toLowerCase()
    // Remove accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove punctuation
    .replace(/[^\w\s]/g, '')
    // Split into words
    .split(/\s+/)
    // Remove stopwords and empty strings
    .filter(word => word.length > 0 && !STOPWORDS.has(word))
    // Join back with single spaces
    .join(' ');
}

/**
 * Verifica se já existe um artigo com o mesmo fingerprint semântico no blog.
 * Se existir, retorna ação 'update' com o ID existente.
 * Se não existir, retorna ação 'insert'.
 * 
 * Esta função DEVE ser chamada antes de qualquer INSERT na tabela articles.
 * 
 * V2.0: Usa fingerprint semântico para detectar variações como:
 * - "Captar Mais Clientes" = "Captar Clientes"
 * - "7 Dicas para..." = "7 Dicas..."
 */
export async function ensureSingleArticle(
  blogId: string,
  title: string
): Promise<ArticleFlowResult> {
  if (!blogId || !title) {
    console.log('[FLOW GUARD] Missing blogId or title, allowing INSERT');
    return { action: 'insert' };
  }

  const fingerprint = normalizeForFingerprint(title);
  console.log(`[FLOW GUARD] Checking fingerprint: "${fingerprint}" for title: "${title}"`);

  // Check for existing article with same fingerprint
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, title_fingerprint')
    .eq('blog_id', blogId)
    .eq('title_fingerprint', fingerprint)
    .maybeSingle();

  if (error) {
    console.error('[FLOW GUARD] Error checking for existing article:', error);
    // On error, allow INSERT but log warning
    return { action: 'insert' };
  }

  if (data) {
    console.log(`[FLOW GUARD] Duplicate found by fingerprint: "${fingerprint}" → existing article id=${data.id}, title="${data.title}"`);
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
