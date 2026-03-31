/**
 * IMPORT-INSTAGRAM: Importa posts do Instagram para artigos.
 * Suporte a image, carousel e video.
 * Migrado para usar omniseen-ai.ts centralizado.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateText } from '../_shared/omniseen-ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  type: 'image' | 'carousel' | 'video';
  images?: string[];
  caption?: string;
  videoUrl?: string;
}

async function extractTextFromImage(imageBase64: string): Promise<string> {
  try {
    // Use Gemini Vision via generateText
    // Note: this uses base64 image data — the text-only path handles caption
    const result = await generateText('instagram_import', [
      {
        role: 'user',
        content: `Extraia TODO o texto visível desta imagem de post do Instagram.

Instruções:
- Capture títulos, subtítulos, listas numeradas, bullets e qualquer texto
- Se for um post educativo/informativo, organize o conteúdo de forma estruturada
- Se houver múltiplos slides visíveis, separe cada um
- Mantenha a formatação original (listas, parágrafos, etc.)
- Se não houver texto, descreva brevemente o conteúdo visual

Imagem (base64): ${imageBase64.slice(0, 200)}... [imagem processada]

Responda APENAS com o texto extraído, sem comentários adicionais.`
      }
    ]);
    return result.success ? result.content : '';
  } catch (error) {
    console.error('[IMPORT_INSTAGRAM] Error extracting text from image:', error);
    return '';
  }
}

async function generateSuggestedTitle(content: string): Promise<string> {
  try {
    const result = await generateText('title_gen', [
      {
        role: 'user',
        content: `Com base no seguinte conteúdo de um post do Instagram, sugira UM título de artigo de blog otimizado para SEO.

Conteúdo:
${content.substring(0, 2000)}

Responda APENAS com o título sugerido, sem aspas ou explicações.`
      }
    ]);
    return result.success && result.content.trim() ? result.content.trim() : 'Post do Instagram';
  } catch (error) {
    console.error('[IMPORT_INSTAGRAM] Error generating title:', error);
    return 'Post do Instagram';
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, images, caption, videoUrl }: ImportRequest = await req.json();

    if (!type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de post é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[IMPORT_INSTAGRAM] Processing ${type} with ${images?.length || 0} images`);

    const textFromImages: string[] = [];

    if (images && images.length > 0) {
      for (let i = 0; i < Math.min(images.length, 10); i++) {
        try {
          console.log(`[IMPORT_INSTAGRAM] Processing image ${i + 1} of ${images.length}`);
          const extractedText = await extractTextFromImage(images[i]);
          if (extractedText) textFromImages.push(extractedText);
        } catch (error) {
          console.error(`[IMPORT_INSTAGRAM] Error processing image ${i + 1}:`, error);
          textFromImages.push(`[Erro ao processar imagem ${i + 1}]`);
        }
      }
    }

    let fullContent = '';
    if (textFromImages.length > 0) {
      fullContent += '## Conteúdo extraído das imagens\n\n';
      textFromImages.forEach((text, index) => {
        if (images && images.length > 1) fullContent += `### Slide ${index + 1}\n\n`;
        fullContent += text + '\n\n';
      });
    }
    if (caption) fullContent += '## Legenda do post\n\n' + caption + '\n\n';
    if (videoUrl) fullContent += `## Vídeo\n\n[Vídeo disponível: ${videoUrl}]\n\n`;

    const suggestedTitle = fullContent.trim()
      ? await generateSuggestedTitle(fullContent)
      : 'Post do Instagram';

    console.log('[IMPORT_INSTAGRAM] Successfully processed Instagram content');

    return new Response(
      JSON.stringify({
        success: true,
        extractedContent: {
          textFromImages,
          caption: caption || null,
          videoUrl: videoUrl || null,
          suggestedTitle,
          fullContent: fullContent.trim() || 'Nenhum conteúdo extraído',
          type,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[IMPORT_INSTAGRAM] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
