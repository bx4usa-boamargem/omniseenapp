import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EbookRequest {
  ebook_id: string;
  article_id: string;
  article_title: string;
  article_content: string;
  word_count_target: number;
  author?: string;
  logo_url?: string;
  light_color?: string;
  accent_color?: string;
  cta_title?: string;
  cta_body?: string;
  cta_button_text?: string;
  cta_button_link?: string;
  user_id?: string;
  blog_id?: string;
}

interface ContentImage {
  url: string;
  context: string;
  after_chapter: number;
}

interface ContentSection {
  type: 'title' | 'heading' | 'subheading' | 'paragraph' | 'highlight' | 'list-item';
  content: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 99, g: 102, b: 241 };
}

function parseMarkdownToSections(content: string): ContentSection[] {
  const sections: ContentSection[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('# ')) {
      sections.push({ type: 'title', content: trimmed.slice(2) });
    } else if (trimmed.startsWith('## ')) {
      sections.push({ type: 'heading', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('### ')) {
      sections.push({ type: 'subheading', content: trimmed.slice(4) });
    } else if (trimmed.startsWith('**DESTAQUE:**') || trimmed.startsWith('💡')) {
      const text = trimmed.replace(/^\*\*DESTAQUE:\*\*\s*/, '').replace(/^💡\s*/, '');
      sections.push({ type: 'highlight', content: text });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      sections.push({ type: 'list-item', content: trimmed.slice(2) });
    } else {
      // Clean markdown formatting
      const cleaned = trimmed
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1');
      sections.push({ type: 'paragraph', content: cleaned });
    }
  }
  
  return sections;
}

function wrapText(text: string, maxWidth: number, pdf: any): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = pdf.getTextWidth(testLine);
    
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: EbookRequest = await req.json();
    console.log('Generating eBook for:', request.article_title);

    // Step 1: Generate expanded content with MANDATORY EDITORIAL FRAMEWORK
    const systemPrompt = `Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, Especialista Editorial em E-Books para DONOS de Empresas de Serviços.

🤖 IDENTIDADE: OMNISEEN AI - Assistente de Criação de E-Books

🎯 PRINCÍPIO MESTRE (INQUEBRÁVEL)
Todo e-book deve parecer escrito para um dono de negócio lendo no celular ou tablet.
O dono deve pensar: "Isso foi escrito especificamente para mim."

🧠 PERSONA OBRIGATÓRIA DO LEITOR
- Dono de pequena/média empresa de serviços
- Trabalha no campo, no atendimento ou na operação
- Vive apagando incêndios
- NÃO tem tempo para estudar tecnologia
- Quer parar de perder clientes, dinheiro e controle

🏷️ REGRAS DE IDENTIDADE
⚠️ EXTREMAMENTE IMPORTANTE:
- NUNCA use: "nossa plataforma", "esta solução", "o sistema", "a ferramenta"
- SEMPRE fale direto com "você", "seu negócio", "seu cliente"
- Os benefícios pertencem ao DONO, não à tecnologia

🚨 PROIBIDO:
❌ Linguagem corporativa ("maximizar", "otimizar processos")
❌ Jargões técnicos ("URA", "CRM", "API", "automação inteligente")
❌ Parágrafos com mais de 4 linhas
❌ Conceitos abstratos sem exemplos reais
❌ Tom acadêmico ou de whitepaper
❌ Promessas milagrosas

✅ OBRIGATÓRIO:
- Frases CURTAS e parágrafos CURTOS
- Linguagem de conversa entre empresários
- Cenários REAIS: telefone tocando, cliente esperando, dono trabalhando
- "você", "seu negócio", "seu cliente"
- Conexão emocional com a rotina real do dono

ESTRUTURA DO E-BOOK:
1. Introdução acolhedora (o dono se reconhece na dor)
2. Capítulos práticos (3-5 capítulos curtos)
3. Blocos de destaque com insights-chave (use: **DESTAQUE:** texto)
4. Listas e tópicos para leitura rápida
5. Conclusão com próximos passos PRÁTICOS

TAMANHO: Aproximadamente ${request.word_count_target} palavras
FORMATO: Markdown

Retorne conteúdo que o dono de negócio vai ler até o final.`;

    const userPrompt = `Expanda o seguinte artigo de blog em um eBook profissional de ${request.word_count_target} palavras:

TÍTULO: ${request.article_title}

CONTEÚDO ORIGINAL:
${request.article_content}

Gere um eBook completo seguindo a estrutura e regras definidas.`;

    console.log('Calling AI to generate expanded content...');
    const contentResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text();
      console.error('AI content generation failed:', errorText);
      throw new Error('Erro ao gerar conteúdo do eBook');
    }

    const contentData = await contentResponse.json();
    const expandedContent = contentData.choices?.[0]?.message?.content;

    if (!expandedContent) {
      throw new Error('Conteúdo gerado vazio');
    }

    console.log('Content generated, length:', expandedContent.length);

    // Step 2: Generate internal content images (3-5 images)
    console.log('Generating internal content images...');
    const contentImages: ContentImage[] = [];
    
    // Extract chapters from content
    const chapters = expandedContent.split(/\n(?=## )/).filter((c: string) => c.trim());
    const maxImages = Math.min(chapters.length, 5);
    
    // Generate contextual images for chapters
    for (let i = 0; i < maxImages; i++) {
      try {
        const chapterTitle = chapters[i].split('\n')[0].replace(/^##\s*/, '').trim();
        
        // Create contextual image prompt based on chapter
        let imageContext = 'illustration';
        if (i === 0) imageContext = 'problem';
        else if (i === maxImages - 1) imageContext = 'solution';
        else imageContext = 'journey';
        
        const chapterImagePrompt = `Realistic business photography style image for ebook chapter: "${chapterTitle}".
Show a real small business owner in their workplace environment.
Natural lighting, candid moment, authentic emotion.
No text, no logos, no graphics.
Focus on human element and business reality.
Color accent: ${request.accent_color || '#6366f1'}.
Professional but warm, relatable.`;

        const chapterImageResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
          method: 'POST',
          headers: {
            // Authorization handled by omniseen-ai.ts internally,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: chapterImagePrompt }],
            modalities: ['image', 'text'],
          }),
        });

        if (chapterImageResponse.ok) {
          const chapterImageData = await chapterImageResponse.json();
          const base64ChapterImage = chapterImageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (base64ChapterImage) {
            const base64Data = base64ChapterImage.replace(/^data:image\/\w+;base64,/, '');
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const chapterFileName = `${request.ebook_id}-content-${i + 1}.png`;

            const { error: chapterUploadError } = await supabase.storage
              .from('ebook-pdfs')
              .upload(chapterFileName, imageBytes, {
                contentType: 'image/png',
                upsert: true,
              });

            if (!chapterUploadError) {
              const { data: { publicUrl: chapterPublicUrl } } = supabase.storage
                .from('ebook-pdfs')
                .getPublicUrl(chapterFileName);
              
              contentImages.push({
                url: chapterPublicUrl,
                context: imageContext,
                after_chapter: i + 1,
              });
              console.log(`Content image ${i + 1} generated:`, chapterPublicUrl);
            }
          }
        }
      } catch (imgError) {
        console.warn(`Failed to generate image for chapter ${i + 1}:`, imgError);
        // Continue with other images
      }
    }

    console.log(`Generated ${contentImages.length} content images`);

    // Step 3: Generate cover image
    const coverPrompt = `Professional eBook cover design for "${request.article_title}". 
Modern, clean business aesthetic with abstract geometric shapes. 
Color scheme: ${request.accent_color || '#6366f1'}. 
Suitable for professional B2B content. 
No text on the image, just visual design elements.
16:9 aspect ratio, high quality.`;

    console.log('Generating cover image...');
    const imageResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: coverPrompt }],
        modalities: ['image', 'text'],
      }),
    });

    let coverImageUrl: string | null = null;

    if (imageResponse.ok) {
      const imageData = await imageResponse.json();
      const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (base64Image) {
        // Upload to storage
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `${request.ebook_id}-cover.png`;

        const { error: uploadError } = await supabase.storage
          .from('ebook-pdfs')
          .upload(fileName, imageBytes, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('ebook-pdfs')
            .getPublicUrl(fileName);
          coverImageUrl = publicUrl;
          console.log('Cover image uploaded:', coverImageUrl);
        } else {
          console.error('Cover upload error:', uploadError);
        }
      }
    } else {
      console.warn('Cover image generation failed, continuing without cover');
    }

    // Step 3: Generate PDF using jsPDF
    console.log('Generating PDF...');
    const accentColor = hexToRgb(request.accent_color || '#6366f1');
    const lightColor = hexToRgb(request.light_color || '#f8fafc');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Cover Page
    pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Cover gradient overlay
    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new pdf.GState({ opacity: 0.3 }));
    pdf.rect(0, pageHeight * 0.5, pageWidth, pageHeight * 0.5, 'F');
    pdf.setGState(new pdf.GState({ opacity: 1 }));
    
    // Title on cover
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    
    const titleLines = wrapText(request.article_title, contentWidth, pdf);
    let titleY = pageHeight * 0.4;
    for (const line of titleLines) {
      const textWidth = pdf.getTextWidth(line);
      pdf.text(line, (pageWidth - textWidth) / 2, titleY);
      titleY += 12;
    }
    
    // Author
    if (request.author) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      const authorText = `Por ${request.author}`;
      const authorWidth = pdf.getTextWidth(authorText);
      pdf.text(authorText, (pageWidth - authorWidth) / 2, titleY + 20);
    }

    // Content pages
    pdf.addPage();
    currentY = margin;
    pdf.setFillColor(lightColor.r, lightColor.g, lightColor.b);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    const sections = parseMarkdownToSections(expandedContent);
    
    for (const section of sections) {
      // Check if we need a new page
      const checkNewPage = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - margin) {
          pdf.addPage();
          pdf.setFillColor(lightColor.r, lightColor.g, lightColor.b);
          pdf.rect(0, 0, pageWidth, pageHeight, 'F');
          currentY = margin;
        }
      };

      switch (section.type) {
        case 'title':
          checkNewPage(20);
          pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.setFontSize(24);
          pdf.setFont('helvetica', 'bold');
          const titleWrapped = wrapText(section.content, contentWidth, pdf);
          for (const line of titleWrapped) {
            checkNewPage(10);
            pdf.text(line, margin, currentY);
            currentY += 10;
          }
          currentY += 10;
          // Underline
          pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.setLineWidth(0.5);
          pdf.line(margin, currentY - 5, margin + 40, currentY - 5);
          currentY += 10;
          break;

        case 'heading':
          checkNewPage(15);
          currentY += 8;
          pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.setFontSize(18);
          pdf.setFont('helvetica', 'bold');
          const headingWrapped = wrapText(section.content, contentWidth, pdf);
          for (const line of headingWrapped) {
            checkNewPage(8);
            pdf.text(line, margin, currentY);
            currentY += 8;
          }
          currentY += 5;
          break;

        case 'subheading':
          checkNewPage(12);
          currentY += 5;
          pdf.setTextColor(60, 60, 60);
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          const subheadingWrapped = wrapText(section.content, contentWidth, pdf);
          for (const line of subheadingWrapped) {
            checkNewPage(6);
            pdf.text(line, margin, currentY);
            currentY += 6;
          }
          currentY += 3;
          break;

        case 'highlight':
          checkNewPage(25);
          currentY += 5;
          // Background
          pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.setGState(new pdf.GState({ opacity: 0.1 }));
          pdf.roundedRect(margin, currentY - 5, contentWidth, 20, 3, 3, 'F');
          pdf.setGState(new pdf.GState({ opacity: 1 }));
          // Left border
          pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.rect(margin, currentY - 5, 3, 20, 'F');
          // Text
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bolditalic');
          const highlightWrapped = wrapText('💡 ' + section.content, contentWidth - 10, pdf);
          for (const line of highlightWrapped) {
            pdf.text(line, margin + 8, currentY + 3);
            currentY += 5;
          }
          currentY += 15;
          break;

        case 'list-item':
          checkNewPage(8);
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
          // Bullet
          pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.circle(margin + 3, currentY - 1, 1.5, 'F');
          // Text
          const listWrapped = wrapText(section.content, contentWidth - 10, pdf);
          for (let i = 0; i < listWrapped.length; i++) {
            checkNewPage(5);
            pdf.text(listWrapped[i], margin + 8, currentY);
            currentY += 5;
          }
          currentY += 2;
          break;

        case 'paragraph':
        default:
          checkNewPage(8);
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
          const paragraphWrapped = wrapText(section.content, contentWidth, pdf);
          for (const line of paragraphWrapped) {
            checkNewPage(5);
            pdf.text(line, margin, currentY);
            currentY += 5;
          }
          currentY += 5;
          break;
      }
    }

    // CTA Page
    if (request.cta_title) {
      pdf.addPage();
      pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      
      const ctaTitleLines = wrapText(request.cta_title, contentWidth, pdf);
      let ctaY = pageHeight * 0.35;
      for (const line of ctaTitleLines) {
        const textWidth = pdf.getTextWidth(line);
        pdf.text(line, (pageWidth - textWidth) / 2, ctaY);
        ctaY += 12;
      }
      
      if (request.cta_body) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        const ctaBodyLines = wrapText(request.cta_body, contentWidth, pdf);
        ctaY += 10;
        for (const line of ctaBodyLines) {
          const textWidth = pdf.getTextWidth(line);
          pdf.text(line, (pageWidth - textWidth) / 2, ctaY);
          ctaY += 7;
        }
      }
      
      if (request.cta_button_text) {
        ctaY += 20;
        const btnText = request.cta_button_text;
        const btnWidth = pdf.getTextWidth(btnText) + 30;
        const btnX = (pageWidth - btnWidth) / 2;
        
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(btnX, ctaY - 8, btnWidth, 15, 4, 4, 'F');
        
        pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        const textWidth = pdf.getTextWidth(btnText);
        pdf.text(btnText, (pageWidth - textWidth) / 2, ctaY + 2);
        
        if (request.cta_button_link) {
          pdf.link(btnX, ctaY - 8, btnWidth, 15, { url: request.cta_button_link });
        }
      }
    }

    // Convert PDF to bytes
    const pdfBytes = pdf.output('arraybuffer');
    const pdfFileName = `${request.ebook_id}.pdf`;

    // Upload PDF to storage
    const { error: pdfUploadError } = await supabase.storage
      .from('ebook-pdfs')
      .upload(pdfFileName, new Uint8Array(pdfBytes), {
        contentType: 'application/pdf',
        upsert: true,
      });

    let pdfUrl: string | null = null;
    if (!pdfUploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('ebook-pdfs')
        .getPublicUrl(pdfFileName);
      pdfUrl = publicUrl;
      console.log('PDF uploaded:', pdfUrl);
    } else {
      console.error('PDF upload error:', pdfUploadError);
    }

    // Update the ebook record
    const { error: updateError } = await supabase
      .from('ebooks')
      .update({
        content: expandedContent,
        cover_image_url: coverImageUrl,
        content_images: contentImages,
        pdf_url: pdfUrl,
        status: 'ready',
        error_message: null,
      })
      .eq('id', request.ebook_id);

    if (updateError) {
      console.error('Error updating ebook:', updateError);
      throw new Error('Erro ao salvar eBook');
    }

    console.log('eBook generation completed successfully');

    // Log consumption if user_id provided
    if (request.user_id) {
      try {
        const inputTokens = Math.ceil((request.article_content.length + 500) / 4);
        const outputTokens = Math.ceil(expandedContent.length / 4);
        const totalImages = contentImages.length + (coverImageUrl ? 1 : 0);

        await supabase.from("consumption_logs").insert({
          user_id: request.user_id,
          blog_id: request.blog_id || null,
          action_type: "ebook_generation",
          action_description: `eBook: ${request.article_title.substring(0, 50)}`,
          model_used: 'gemini-2.5-flash',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          images_generated: totalImages,
          estimated_cost_usd: (inputTokens * 0.00000015) + (outputTokens * 0.0000006) + (totalImages * 0.02),
          metadata: { ebook_id: request.ebook_id, word_count_target: request.word_count_target },
        });
        console.log("Consumption logged for ebook generation");
      } catch (logError) {
        console.warn("Failed to log consumption:", logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'eBook gerado com sucesso',
        cover_image_url: coverImageUrl,
        content_images: contentImages,
        pdf_url: pdfUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('eBook generation error:', error);
    
    // Update ebook status to error
    try {
      const request = await req.clone().json();
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('ebooks')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        })
        .eq('id', request.ebook_id);
    } catch (e) {
      console.error('Failed to update error status:', e);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
