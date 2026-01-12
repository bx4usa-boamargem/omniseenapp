/**
 * REGRA 3: META DESCRIPTION AUTOMÁTICA
 * 
 * Garante que nenhum artigo fique sem meta description válida (140-160 caracteres).
 * Se inválida, gera automaticamente com IA e persiste.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
 * @returns A meta description válida (gerada ou existente)
 */
export async function ensureValidMeta(
  supabase: SupabaseClient,
  apiKey: string,
  model: string,
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
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { 
            role: 'system', 
            content: 'Você é um especialista em SEO. Responda apenas com a meta description solicitada, sem explicações adicionais.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error('[AUTO-META] AI API error:', response.status);
      return currentMeta || '';
    }

    const data = await response.json();
    let generatedMeta = data.choices?.[0]?.message?.content?.trim() || '';

    // Remover aspas se presentes
    generatedMeta = generatedMeta.replace(/^["']|["']$/g, '');

    // Validar comprimento
    const genLen = generatedMeta.length;
    if (genLen < 140 || genLen > 160) {
      console.warn(`[AUTO-META] Generated meta has ${genLen} chars, adjusting...`);
      // Ajustar se necessário
      if (genLen > 160) {
        generatedMeta = generatedMeta.substring(0, 157) + '...';
      } else if (genLen < 140 && genLen > 100) {
        // Adicionar texto genérico no final
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
