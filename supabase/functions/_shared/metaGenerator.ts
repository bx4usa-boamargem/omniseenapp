/**
 * REGRA 3: META DESCRIPTION AUTOMÁTICA
 *
 * Garante que nenhum artigo fique sem meta description válida (140-160 caracteres).
 * Se inválida, gera automaticamente com IA e persiste.
 *
 * Usa omniseen-ai.ts (API direta) — ZERO dependência do Lovable Gateway.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from './omniseen-ai.ts';

/**
 * Valida se a meta description está dentro do range ideal (140-160 caracteres)
 */
export function isValidMetaDescription(meta: string | null | undefined): boolean {
  if (!meta) return false;
  const len = meta.trim().length;
  return len >= 140 && len <= 160;
}

/**
 * Gera uma meta description automaticamente com IA se a atual estiver inválida.
 * Persiste no artigo imediatamente.
 *
 * @param supabase - Supabase client
 * @param _apiKey - Deprecated (key obtained internally by router)
 * @param _model - Deprecated (model selected by router)
 * @param articleId - Article ID
 * @param articleTitle - Article title
 * @param articleContent - Article HTML content
 * @param currentMeta - Current meta description
 * @returns A meta description válida (gerada ou existente)
 */
export async function ensureValidMeta(
  supabase: SupabaseClient,
  _apiKey: string,
  _model: string,
  articleId: string | undefined,
  articleTitle: string,
  articleContent: string | null | undefined,
  currentMeta: string | null | undefined
): Promise<string> {
  // Se já é válida, retornar
  if (isValidMetaDescription(currentMeta)) {
    return currentMeta!;
  }

  const currentLen = (currentMeta || '').length;
  console.log(`[AUTO-META] Generating for article ${articleId || 'unknown'}, current length: ${currentLen}`);

  // Construir prompt para geração
  const contentPreview = (articleContent || '').substring(0, 1500);

  const prompt = `Crie uma meta description profissional para SEO.

Título: "${articleTitle}"
Conteúdo: ${contentPreview}

Requisitos OBRIGATÓRIOS:
- EXATAMENTE entre 140-160 caracteres (conte com cuidado!)
- Inclua call-to-action implícito
- Seja persuasivo e descreva o valor do conteúdo
- NÃO use aspas na resposta
- Use linguagem clara e direta

Responda APENAS com a meta description, sem explicações ou aspas.`;

  try {
    const result = await generateText('meta_gen', [
      {
        role: 'system',
        content: 'Você é um especialista em SEO. Responda apenas com a meta description solicitada, sem explicações adicionais.'
      },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 200 });

    if (!result.success) {
      console.error('[AUTO-META] AI error:', result.error);
      return currentMeta || '';
    }

    let generatedMeta = result.content.trim();

    // Remover aspas se presentes
    generatedMeta = generatedMeta.replace(/^["']|["']$/g, '');

    // Validar comprimento
    const genLen = generatedMeta.length;
    if (genLen < 140 || genLen > 160) {
      console.warn(`[AUTO-META] Generated meta has ${genLen} chars, adjusting...`);
      if (genLen > 160) {
        generatedMeta = generatedMeta.substring(0, 157) + '...';
      } else if (genLen < 140 && genLen > 100) {
        generatedMeta += ' Saiba mais.';
      }
    }

    // Persistir no artigo imediatamente se temos article_id
    if (articleId && generatedMeta) {
      const { error: updateError } = await supabase
        .from('articles')
        .update({ meta_description: generatedMeta })
        .eq('id', articleId);

      if (updateError) {
        console.warn(`[AUTO-META] Failed to persist: ${updateError.message}`);
      } else {
        console.log(`[AUTO-META] Saved to article ${articleId} (${generatedMeta.length} chars)`);
      }
    }

    return generatedMeta;
  } catch (error) {
    console.error('[AUTO-META] Error generating:', error);
    return currentMeta || '';
  }
}
