/**
 * CONTENT GUARD - Arquitetura Determinística por Camadas
 * 
 * Este módulo implementa controle total sobre alterações de artigos:
 * - Feature Flags por subconta
 * - Versionamento de conteúdo
 * - Log de alterações de score
 * - Proteção contra sobrescritas silenciosas
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TIPOS
// ============================================================================

export type ChangeSource = 
  | 'user_generate'    // Clicou "Gerar"
  | 'user_rewrite'     // Clicou "Reescrever"
  | 'user_edit'        // Salvou manualmente
  | 'user_boost'       // Clicou "Aumentar Score"
  | 'user_fix'         // Clicou "Corrigir automaticamente"
  | 'seo_optimize'     // Otimização SEO automática
  | 'auto_fix'         // Quality Gate auto-fix
  | 'internal_links'   // Inserção de links internos
  | 'polish_final'     // Polish pré-save
  | 'background_job';  // Job em background

export type LayerType = 'base' | 'semantic' | 'optimized';

export type TriggeredBy = 'user' | 'system' | 'background';

// ============================================================================
// CONSTANTES
// ============================================================================

// REGRA INVIOLÁVEL: Apenas estas fontes podem alterar o conteúdo base
export const BASE_CONTENT_SOURCES: ChangeSource[] = [
  'user_generate',
  'user_rewrite',
  'user_edit',
  'user_fix'  // Quando usuário clica em "Corrigir"
];

// Fontes que geram sugestões (não alteram diretamente)
export const SUGGESTION_SOURCES: ChangeSource[] = [
  'seo_optimize',
  'auto_fix',
  'polish_final',
  'background_job'
];

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Verifica se uma feature flag está ativa para o blog
 */
export async function isFeatureEnabled(
  supabase: SupabaseClient,
  blogId: string,
  flagName: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('blog_feature_flags')
      .select('is_enabled')
      .eq('blog_id', blogId)
      .eq('flag_name', flagName)
      .single();

    if (error || !data) {
      console.log(`[CONTENT-GUARD] Feature flag ${flagName} not found for blog ${blogId}`);
      return false;
    }

    return data.is_enabled === true;
  } catch (err) {
    console.error(`[CONTENT-GUARD] Error checking feature flag:`, err);
    return false;
  }
}

/**
 * Atalho para verificar FEATURE_VERSIONED_CONTENT
 */
export async function isVersionedContentEnabled(
  supabase: SupabaseClient,
  blogId: string
): Promise<boolean> {
  return isFeatureEnabled(supabase, blogId, 'FEATURE_VERSIONED_CONTENT');
}

// ============================================================================
// CONTROLE DE ALTERAÇÃO
// ============================================================================

/**
 * Verifica se a fonte pode modificar o conteúdo base diretamente
 */
export function canModifyBaseContent(source: ChangeSource): boolean {
  return BASE_CONTENT_SOURCES.includes(source);
}

/**
 * Verifica se a fonte requer aprovação do usuário
 */
export function requiresUserApproval(source: ChangeSource): boolean {
  return SUGGESTION_SOURCES.includes(source);
}

// ============================================================================
// VERSIONAMENTO DE CONTEÚDO
// ============================================================================

/**
 * Busca a versão atual do artigo
 */
export async function getCurrentVersion(
  supabase: SupabaseClient,
  articleId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('articles')
    .select('content_version')
    .eq('id', articleId)
    .single();

  if (error || !data) {
    console.warn(`[CONTENT-GUARD] Could not get version for article ${articleId}`);
    return 1;
  }

  return data.content_version || 1;
}

/**
 * Registra uma nova versão do conteúdo
 */
export async function logContentVersion(
  supabase: SupabaseClient,
  articleId: string,
  content: string,
  source: ChangeSource,
  reason: string,
  scoreAtSave?: number
): Promise<{ version: number; success: boolean }> {
  try {
    // Buscar artigo atual
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('content_version, title, blog_id')
      .eq('id', articleId)
      .single();

    if (articleError || !article) {
      throw new Error(`Article not found: ${articleId}`);
    }

    const newVersion = (article.content_version || 0) + 1;
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const layerType: LayerType = canModifyBaseContent(source) ? 'base' : 'semantic';
    const changedBy: 'user' | 'system' = source.startsWith('user_') ? 'user' : 'system';

    // Criar registro de versão
    const { error: versionError } = await supabase
      .from('article_versions')
      .insert({
        article_id: articleId,
        version_number: newVersion,
        title: article.title,
        content: content,
        layer_type: layerType,
        change_source: source,
        change_reason: reason,
        changed_by: changedBy,
        word_count: wordCount,
        score_at_save: scoreAtSave,
        change_type: source
      });

    if (versionError) {
      console.error(`[CONTENT-GUARD] Error creating version:`, versionError);
      throw versionError;
    }

    // Atualizar versão no artigo
    const updateData: Record<string, unknown> = {
      content_version: newVersion
    };

    if (source.startsWith('user_')) {
      updateData.last_user_action = source;
      updateData.last_user_action_at = new Date().toISOString();
    }

    await supabase
      .from('articles')
      .update(updateData)
      .eq('id', articleId);

    console.log(`[CONTENT-GUARD] Created version ${newVersion} for article ${articleId} (${source})`);

    return { version: newVersion, success: true };
  } catch (err) {
    console.error(`[CONTENT-GUARD] Failed to log content version:`, err);
    return { version: 0, success: false };
  }
}

// ============================================================================
// LOG DE ALTERAÇÕES DE SCORE
// ============================================================================

/**
 * Registra uma alteração de score
 */
export async function logScoreChange(
  supabase: SupabaseClient,
  articleId: string,
  oldScore: number | null,
  newScore: number,
  reason: string,
  triggeredBy: TriggeredBy,
  contentVersion?: number,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    // Se não temos a versão, buscar
    let version = contentVersion;
    if (!version) {
      version = await getCurrentVersion(supabase, articleId);
    }

    const { error } = await supabase
      .from('score_change_log')
      .insert({
        article_id: articleId,
        old_score: oldScore,
        new_score: newScore,
        change_reason: reason,
        triggered_by: triggeredBy,
        content_version: version,
        metadata: metadata || null
      });

    if (error) {
      console.error(`[CONTENT-GUARD] Error logging score change:`, error);
      return false;
    }

    console.log(`[CONTENT-GUARD] Score change logged: ${oldScore} → ${newScore} (${reason})`);
    return true;
  } catch (err) {
    console.error(`[CONTENT-GUARD] Failed to log score change:`, err);
    return false;
  }
}

/**
 * Busca histórico de alterações de score
 */
export async function getScoreHistory(
  supabase: SupabaseClient,
  articleId: string,
  limit: number = 5
): Promise<Array<{
  old_score: number | null;
  new_score: number;
  change_reason: string;
  triggered_by: string;
  content_version: number;
  created_at: string;
}>> {
  const { data, error } = await supabase
    .from('score_change_log')
    .select('old_score, new_score, change_reason, triggered_by, content_version, created_at')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[CONTENT-GUARD] Error fetching score history:`, error);
    return [];
  }

  return data || [];
}

// ============================================================================
// RESPOSTA PADRONIZADA PARA SUGESTÕES
// ============================================================================

export interface SuggestionResponse {
  success: boolean;
  suggested_content: string;
  requires_user_approval: boolean;
  reason: string;
  changes?: {
    word_count_before: number;
    word_count_after: number;
    [key: string]: unknown;
  };
  message?: string;
}

/**
 * Cria resposta padronizada para sugestões que requerem aprovação
 */
export function createSuggestionResponse(
  suggestedContent: string,
  reason: string,
  originalContent: string,
  additionalChanges?: Record<string, unknown>
): SuggestionResponse {
  return {
    success: true,
    suggested_content: suggestedContent,
    requires_user_approval: true,
    reason,
    changes: {
      word_count_before: originalContent.split(/\s+/).filter(Boolean).length,
      word_count_after: suggestedContent.split(/\s+/).filter(Boolean).length,
      ...additionalChanges
    },
    message: "O sistema sugere uma melhoria. Clique em 'Aplicar' para salvar."
  };
}
