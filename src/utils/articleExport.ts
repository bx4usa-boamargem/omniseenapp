import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export interface ExportArticle {
  title: string;
  content: string;
  excerpt?: string;
  meta_description?: string;
  featured_image_url?: string | null;
  faq?: Array<{ question: string; answer: string }>;
  keywords?: string[];
  category?: string;
}

export interface ExportOptions {
  includeImage: boolean;
  includeFaq: boolean;
  includeMeta: boolean;
}

// Convert markdown to plain text for Word export
function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/^\s*[-*]\s/gm, '• ') // Convert lists
    .replace(/^\s*\d+\.\s/gm, '') // Remove numbered list markers
    .trim();
}

// Parse markdown into sections for Word document
function parseMarkdownSections(content: string): Array<{ type: 'heading' | 'paragraph' | 'list'; level?: number; text: string }> {
  const lines = content.split('\n');
  const sections: Array<{ type: 'heading' | 'paragraph' | 'list'; level?: number; text: string }> = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check for headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      sections.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2]
      });
      continue;
    }
    
    // Check for list items
    if (trimmed.match(/^[-*]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      sections.push({
        type: 'list',
        text: trimmed.replace(/^[-*]\s+/, '• ').replace(/^\d+\.\s+/, '')
      });
      continue;
    }
    
    // Regular paragraph
    sections.push({
      type: 'paragraph',
      text: markdownToPlainText(trimmed)
    });
  }
  
  return sections;
}

export async function exportToPDF(article: ExportArticle, options: ExportOptions): Promise<void> {
  // Dynamic imports for jsPDF and html2canvas (replacing vulnerable html2pdf.js)
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');
  
  // Build HTML content
  let html = `
    <div style="font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="font-size: 28px; margin-bottom: 20px; color: #1a1a1a;">${article.title}</h1>
  `;
  
  if (options.includeMeta && article.meta_description) {
    html += `<p style="font-style: italic; color: #666; margin-bottom: 20px;">${article.meta_description}</p>`;
  }
  
  if (options.includeImage && article.featured_image_url) {
    html += `<img src="${article.featured_image_url}" style="width: 100%; max-height: 400px; object-fit: cover; margin-bottom: 20px; border-radius: 8px;" crossorigin="anonymous" />`;
  }
  
  // Convert markdown to HTML
  const contentHtml = article.content
    .replace(/^### (.+)$/gm, '<h3 style="font-size: 18px; margin-top: 24px; margin-bottom: 12px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size: 22px; margin-top: 28px; margin-bottom: 14px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size: 26px; margin-top: 32px; margin-bottom: 16px;">$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^[-*]\s+(.+)$/gm, '<li style="margin-left: 20px;">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin-bottom: 16px; line-height: 1.6;">')
    .replace(/\n/g, '<br/>');
  
  html += `<div style="line-height: 1.8; color: #333;"><p style="margin-bottom: 16px; line-height: 1.6;">${contentHtml}</p></div>`;
  
  if (options.includeFaq && article.faq && article.faq.length > 0) {
    html += `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
      <h2 style="font-size: 22px; margin-bottom: 20px;">Perguntas Frequentes</h2>`;
    for (const item of article.faq) {
      html += `
        <div style="margin-bottom: 16px;">
          <p style="font-weight: bold; margin-bottom: 8px;">${item.question}</p>
          <p style="color: #555;">${item.answer}</p>
        </div>`;
    }
    html += '</div>';
  }
  
  html += '</div>';
  
  // Create temporary element for rendering
  const element = document.createElement('div');
  element.innerHTML = html;
  element.style.position = 'absolute';
  element.style.left = '-9999px';
  element.style.width = '800px';
  element.style.background = 'white';
  document.body.appendChild(element);
  
  try {
    // Render HTML to canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    // Create PDF from canvas
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = margin;
    
    // Add first page
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
    
    // Add additional pages if content overflows
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }
    
    // Save PDF
    const filename = `${article.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    pdf.save(filename);
  } finally {
    // Defensive cleanup - check if element still exists before removing
    try {
      if (element && element.parentNode && document.contains(element)) {
        element.parentNode.removeChild(element);
      }
    } catch (e) {
      console.warn('[ArticleExport] Cleanup skipped:', e);
    }
  }
}

export async function exportToWord(article: ExportArticle, options: ExportOptions): Promise<void> {
  const children: Paragraph[] = [];
  
  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: article.title, bold: true, size: 48 })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 }
    })
  );
  
  // Meta description
  if (options.includeMeta && article.meta_description) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: article.meta_description, italics: true, color: '666666' })],
        spacing: { after: 400 }
      })
    );
  }
  
  // Parse and add content
  const sections = parseMarkdownSections(article.content);
  for (const section of sections) {
    if (section.type === 'heading') {
      const headingLevel = section.level === 1 ? HeadingLevel.HEADING_1 
        : section.level === 2 ? HeadingLevel.HEADING_2 
        : HeadingLevel.HEADING_3;
      
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.text, bold: true })],
          heading: headingLevel,
          spacing: { before: 400, after: 200 }
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.text })],
          spacing: { after: 200 }
        })
      );
    }
  }
  
  // FAQ Section
  if (options.includeFaq && article.faq && article.faq.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Perguntas Frequentes', bold: true })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 600, after: 300 }
      })
    );
    
    for (const item of article.faq) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.question, bold: true })],
          spacing: { before: 200, after: 100 }
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.answer })],
          spacing: { after: 200 }
        })
      );
    }
  }
  
  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });
  
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${article.title.replace(/[^a-zA-Z0-9]/g, '-')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToHTML(article: ExportArticle, options: ExportOptions): void {
  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title}</title>
  ${options.includeMeta && article.meta_description ? `<meta name="description" content="${article.meta_description}">` : ''}
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1a1a1a;
      background: #fff;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { font-size: 1.75rem; margin-top: 2rem; margin-bottom: 1rem; }
    h3 { font-size: 1.25rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    p { margin-bottom: 1rem; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5rem 0; }
    .meta { font-style: italic; color: #666; margin-bottom: 2rem; }
    .faq { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #eee; }
    .faq-item { margin-bottom: 1.5rem; }
    .faq-question { font-weight: bold; margin-bottom: 0.5rem; }
    .faq-answer { color: #555; }
    ul, ol { padding-left: 1.5rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <article>
    <h1>${article.title}</h1>
`;

  if (options.includeMeta && article.meta_description) {
    html += `    <p class="meta">${article.meta_description}</p>\n`;
  }

  if (options.includeImage && article.featured_image_url) {
    html += `    <img src="${article.featured_image_url}" alt="${article.title}">\n`;
  }

  // Convert markdown content to HTML
  const contentHtml = article.content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p>\n<p>')
    .replace(/^\s*<p>/gm, '<p>');

  html += `    <div class="content">\n      <p>${contentHtml}</p>\n    </div>\n`;

  if (options.includeFaq && article.faq && article.faq.length > 0) {
    html += `    <section class="faq">
      <h2>Perguntas Frequentes</h2>
`;
    for (const item of article.faq) {
      html += `      <div class="faq-item">
        <p class="faq-question">${item.question}</p>
        <p class="faq-answer">${item.answer}</p>
      </div>
`;
    }
    html += `    </section>\n`;
  }

  html += `  </article>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${article.title.replace(/[^a-zA-Z0-9]/g, '-')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
