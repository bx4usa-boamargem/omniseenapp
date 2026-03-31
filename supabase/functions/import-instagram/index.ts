import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  type: 'image' | 'carousel' | 'video';
  images?: string[];     // base64 encoded images
  caption?: string;      // manually pasted caption
  videoUrl?: string;     // URL for video embedding
}

// Extract text from image using Lovable AI Vision
async function extractTextFromImage(imageBase64: string, googleAiKey: string): Promise<string> {
  try {
    console.log('Extracting text from image using Lovable AI Vision...');
    
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extraia TODO o texto visível desta imagem de post do Instagram. 
                
Instruções:
- Capture títulos, subtítulos, listas numeradas, bullets e qualquer texto
- Se for um post educativo/informativo, organize o conteúdo de forma estruturada
- Se houver múltiplos slides visíveis, separe cada um
- Mantenha a formatação original (listas, parágrafos, etc.)
- Se não houver texto, descreva brevemente o conteúdo visual

Responda APENAS com o texto extraído, sem comentários adicionais.`
              },
              {
                type: 'image_url',
                image_url: { url: imageBase64 }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Vision error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('API credits exhausted. Please add funds.');
      }
      
      throw new Error(`Vision API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw error;
  }
}

// Generate suggested title from content
async function generateSuggestedTitle(content: string, googleAiKey: string): Promise<string> {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: `Com base no seguinte conteúdo de um post do Instagram, sugira UM título de artigo de blog otimizado para SEO.

Conteúdo:
${content.substring(0, 2000)}

Responda APENAS com o título sugerido, sem aspas ou explicações.`
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error('Error generating title:', response.status);
      return 'Post do Instagram';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'Post do Instagram';
  } catch (error) {
    console.error('Error generating title:', error);
    return 'Post do Instagram';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, images, caption, videoUrl }: ImportRequest = await req.json();

    if (!type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de post é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing Instagram ${type} with ${images?.length || 0} images`);

    const textFromImages: string[] = [];
    
    // Process images if provided
    if (images && images.length > 0) {
      for (let i = 0; i < Math.min(images.length, 10); i++) {
        try {
          console.log(`Processing image ${i + 1} of ${images.length}`);
          const extractedText = await extractTextFromImage(images[i], GOOGLE_AI_KEY);
          if (extractedText) {
            textFromImages.push(extractedText);
          }
        } catch (error) {
          console.error(`Error processing image ${i + 1}:`, error);
          textFromImages.push(`[Erro ao processar imagem ${i + 1}]`);
        }
      }
    }

    // Combine all content
    let fullContent = '';
    
    if (textFromImages.length > 0) {
      fullContent += '## Conteúdo extraído das imagens\n\n';
      textFromImages.forEach((text, index) => {
        if (images && images.length > 1) {
          fullContent += `### Slide ${index + 1}\n\n`;
        }
        fullContent += text + '\n\n';
      });
    }
    
    if (caption) {
      fullContent += '## Legenda do post\n\n';
      fullContent += caption + '\n\n';
    }

    if (videoUrl) {
      fullContent += `## Vídeo\n\n[Vídeo disponível para embedding: ${videoUrl}]\n\n`;
    }

    // Generate suggested title
    const suggestedTitle = fullContent.trim() 
      ? await generateSuggestedTitle(fullContent, GOOGLE_AI_KEY)
      : 'Post do Instagram';

    console.log('Successfully processed Instagram content');

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
    console.error('Error processing Instagram content:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
