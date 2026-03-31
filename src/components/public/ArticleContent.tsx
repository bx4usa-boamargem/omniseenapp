import { MessageCircle } from 'lucide-react';
import { sanitizeHTML } from '@/lib/sanitize';

interface ContentImage {
  context: string;
  url: string;
  after_section: number;
}

interface ArticleContentProps {
  content: string;
  contentImages?: ContentImage[];
  hideFirstH1?: boolean;
}

const normalizeContentImages = (images: ContentImage[]): ContentImage[] => {
  const seenUrls = new Set<string>();
  const seenSections = new Set<number>();

  return images
    .filter((image) => image?.url && Number.isFinite(image?.after_section))
    .sort((a, b) => a.after_section - b.after_section)
    .filter((image) => {
      if (seenUrls.has(image.url) || seenSections.has(image.after_section)) {
        return false;
      }

      seenUrls.add(image.url);
      seenSections.add(image.after_section);
      return true;
    });
};

const stripLeadingH1 = (html: string): string => {
  return html.replace(/^((?:\s*<style[^>]*>[\s\S]*?<\/style>)?\s*)<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '$1');
};

const contextLabels: Record<string, string> = {
  hero: 'Imagem de capa',
  problem: 'Ilustração do problema',
  solution: 'Ilustração da solução',
  result: 'Ilustração do resultado',
  insight: 'Insight visual',
  section: 'Imagem da seção',
  section_1: 'Imagem da seção 1',
  section_2: 'Imagem da seção 2',
  section_3: 'Imagem da seção 3',
  section_4: 'Imagem da seção 4'
};

// Generate slug from text for TOC linking
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Process markdown links [text](url) - with special handling for WhatsApp CTA buttons
const processLinks = (text: string): string => {
  return text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, linkText, url) => {
      const isWhatsApp = url.includes('wa.me/');
      const isExternal = url.startsWith('http');
      
      if (isWhatsApp) {
        // WhatsApp links get special CTA button styling (inline version)
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="whatsapp-cta-inline">${linkText}</a>`;
      }
      
      if (isExternal) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="internal-link external-link">${linkText} <span class="external-icon">↗</span></a>`;
      }
      return `<a href="${url}" class="internal-link">${linkText}</a>`;
    }
  );
};

// Extract WhatsApp CTA from markdown line
const extractWhatsAppCTA = (line: string): { text: string; url: string } | null => {
  const match = line.match(/\[([^\]]+)\]\((https:\/\/wa\.me\/[^)]+)\)/);
  if (match) {
    return { text: match[1], url: match[2] };
  }
  return null;
};

const splitLongHtmlParagraphs = (html: string): string => {
  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (_, attrs = '', inner = '') => {
    const plainText = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (plainText.length < 900) {
      return `<p${attrs}>${inner}</p>`;
    }

    const sentences = inner
      .match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean);

    if (!sentences || sentences.length < 2) {
      return `<p${attrs}>${inner}</p>`;
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const maxChunkLength = 520;

    for (const sentence of sentences) {
      const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      const candidateTextLength = candidate.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;

      if (currentChunk && candidateTextLength > maxChunkLength) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk = candidate;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.map((chunk) => `<p${attrs}>${chunk}</p>`).join('');
  });
};

const splitLongTextParagraphs = (text: string): string[] => {
  const plainText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (plainText.length < 700) {
    return [text];
  }

  const sentences = text
    .match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences || sentences.length < 2) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  const maxChunkLength = 420;

  for (const sentence of sentences) {
    const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    const candidateLength = candidate.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;

    if (currentChunk && candidateLength > maxChunkLength) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
};

const promoteLooseHeadings = (html: string): string => {
  return html.replace(/<\/p>\s*([A-ZÀ-ÿ][^<]{20,140})\s*(?=<p\b|<figure\b|<ul\b|<ol\b)/g, (match, rawHeading) => {
    const heading = rawHeading.replace(/\s+/g, ' ').trim();
    const wordCount = heading.split(/\s+/).length;

    if (/[.!?:;]$/.test(heading) || wordCount < 4 || wordCount > 16) {
      return match;
    }

    return `</p><h2>${heading}</h2>`;
  });
};

export const ArticleContent = ({ content, contentImages = [], hideFirstH1 = false }: ArticleContentProps) => {
  const normalizedContentImages = normalizeContentImages(contentImages);
  const hasStructuredHtml = /<(h[1-6]|p|div|figure|ul|ol|table|section)\b/i.test(content);
  const hasMarkdownHeadings = /(^|\n)\s*#{1,3}\s+.+/m.test(content);
  const isHtmlContent = hasStructuredHtml && !hasMarkdownHeadings;

  if (isHtmlContent) {
    // HTML content: process WhatsApp CTAs and render directly
    let processedHtml = promoteLooseHeadings(splitLongHtmlParagraphs(content));

    if (hideFirstH1) {
      processedHtml = stripLeadingH1(processedHtml);
    }

    const alreadyHasInlineImages = /<(figure|img)\b/i.test(processedHtml);
    
    // Convert WhatsApp links to styled buttons
    processedHtml = processedHtml.replace(
      /<a\s+href="(https:\/\/wa\.me\/[^"]+)"[^>]*>([^<]+)<\/a>/gi,
      (_, url, text) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="whatsapp-cta-inline">${text}</a>`
    );

    // Inject content_images after corresponding h2 sections
    if (!alreadyHasInlineImages && normalizedContentImages.length > 0) {
      let h2Count = 0;
      processedHtml = processedHtml.replace(/(<\/h2>)/gi, (match) => {
        h2Count++;
        const image = normalizedContentImages.find(img => img.after_section === h2Count);
        if (image) {
          const label = contextLabels[image.context] || 'Ilustração';
          return `${match}<figure class="my-10 article-inline-figure"><div class="rounded-xl overflow-hidden shadow-xl"><img src="${image.url}" alt="${label}" class="w-full aspect-video object-cover object-center article-inline-image" loading="lazy" /></div><figcaption class="text-center text-sm text-muted-foreground mt-3 italic">${label}</figcaption></figure>`;
        }
        return match;
      });
    }

    return (
      <article className="prose prose-lg max-w-none text-foreground prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-h1:text-4xl prose-h1:font-black prose-h1:leading-tight prose-h1:mb-8 md:prose-h1:text-5xl prose-h2:text-3xl prose-h2:font-bold prose-h2:tracking-tight prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-border prose-h2:pb-3 md:prose-h2:text-4xl prose-h3:text-2xl prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-4 prose-p:my-5 prose-p:leading-8 prose-ul:my-5 prose-ol:my-5 prose-li:my-1 prose-blockquote:not-italic">
        <style>{`
          article.prose h2 {
            font-size: 1.75rem !important;
            font-weight: 700 !important;
            color: inherit !important;
            margin-top: 2rem !important;
            margin-bottom: 1rem !important;
            line-height: 1.3 !important;
          }
          article.prose h3 {
            font-size: 1.35rem !important;
            font-weight: 600 !important;
            color: inherit !important;
            margin-top: 1.5rem !important;
            margin-bottom: 0.75rem !important;
            line-height: 1.4 !important;
          }
          article.prose p {
            margin-bottom: 1rem !important;
          }
          article.prose ul,
          article.prose ol {
            margin: 1rem 0 !important;
            padding-left: 1.5rem !important;
          }
          article.prose li {
            margin-bottom: 0.5rem !important;
          }
          .whatsapp-cta-inline {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background-color: #25D366;
            color: white !important;
            border-radius: 0.5rem;
            font-weight: 600;
            text-decoration: none !important;
            transition: all 0.2s;
          }
          .whatsapp-cta-inline:hover {
            background-color: #1da851;
            transform: scale(1.02);
          }
          .article-inline-image {
            max-height: 400px;
          }
        `}</style>
        <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(processedHtml) }} />
      </article>
    );
  }

  // Markdown content: use existing parser
  const formatContent = (text: string) => {
    const lines = text.split("\n");
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let listType: "ul" | "ol" | null = null;
    let h2Count = 0;
    let h1Skipped = false;
    let pendingParagraph: string[] = [];

    const flushParagraph = () => {
      if (pendingParagraph.length > 0) {
        const paragraphChunks = splitLongTextParagraphs(pendingParagraph.join(' '));

        paragraphChunks.forEach((chunk) => {
          const processedLine = chunk
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/_(.+?)_/g, "<em>$1</em>");

          elements.push(
            <p key={`p-${elements.length}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(processedLine)) }} />
          );
        });

        pendingParagraph = [];
      }
    };

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={elements.length} className={listType === "ul" ? "list-disc" : "list-decimal"}>
            {listItems.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(item)) }} />
            ))}
          </ListTag>
        );
        listItems = [];
        listType = null;
      }
    };

    const insertImageIfNeeded = (afterSection: number) => {
      const image = normalizedContentImages.find(img => img.after_section === afterSection);
      if (image) {
        elements.push(
          <figure key={`img-${elements.length}`} className="my-10">
            <div className="rounded-xl overflow-hidden shadow-xl">
              <img 
                src={image.url} 
                alt={contextLabels[image.context] || `Ilustração do artigo`}
                className="w-full aspect-video object-cover object-center"
                style={{ maxHeight: '400px' }}
                loading="lazy"
              />
            </div>
            <figcaption className="text-center text-sm text-muted-foreground mt-3 italic">
              {contextLabels[image.context] || 'Ilustração'}
            </figcaption>
          </figure>
        );
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        flushParagraph();
        flushList();
        return;
      }

      // ===== WHATSAPP CTA BUTTON DETECTION =====
      // Check if this line contains a WhatsApp CTA link (wa.me)
      // Render as a prominent green button instead of inline link
      if (trimmedLine.includes('wa.me/') && trimmedLine.includes('[')) {
        flushList();
        
        const ctaData = extractWhatsAppCTA(trimmedLine);
        if (ctaData) {
          elements.push(
            <div key={index} className="my-8 text-center">
              <a
                href={ctaData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 no-underline"
              >
                <MessageCircle className="w-6 h-6" />
                {ctaData.text}
              </a>
            </div>
          );
          return;
        }
      }

      // ===== SPECIAL CTA LINE WITH EMOJI =====
      // Handle lines like: 👉 [Fale com...](https://wa.me/...)
      if (trimmedLine.startsWith('👉 ') && trimmedLine.includes('wa.me/')) {
        flushList();
        
        const lineWithoutEmoji = trimmedLine.replace('👉 ', '');
        const ctaData = extractWhatsAppCTA(lineWithoutEmoji);
        
        if (ctaData) {
          elements.push(
            <div key={index} className="my-8 text-center">
              <a
                href={ctaData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 no-underline"
              >
                <MessageCircle className="w-6 h-6" />
                {ctaData.text}
              </a>
            </div>
          );
          return;
        }
      }

      // Special blocks - Insight (💡 Verdade Dura)
      if (trimmedLine.startsWith("💡 ")) {
        flushList();
        elements.push(
          <div key={index} className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-4 rounded-r-lg my-4">
            <span className="font-bold text-purple-700 dark:text-purple-400">💡 Verdade Dura</span>
            <p className="text-purple-900 dark:text-purple-200 mt-1" dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(trimmedLine.slice(3))) }} />
          </div>
        );
        return;
      }

      // Special blocks - Alert (⚠️ Atenção)
      if (trimmedLine.startsWith("⚠️ ")) {
        flushList();
        elements.push(
          <div key={index} className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg my-4">
            <span className="font-bold text-red-700 dark:text-red-400">⚠️ Atenção</span>
            <p className="text-red-900 dark:text-red-200 mt-1" dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(trimmedLine.slice(3))) }} />
          </div>
        );
        return;
      }

      // Special blocks - Tip (📌 Dica)
      if (trimmedLine.startsWith("📌 ")) {
        flushList();
        elements.push(
          <div key={index} className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg my-4">
            <span className="font-bold text-blue-700 dark:text-blue-400">📌 Dica Prática</span>
            <p className="text-blue-900 dark:text-blue-200 mt-1" dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(trimmedLine.slice(3))) }} />
          </div>
        );
        return;
      }

      // Special blocks - Summary (✅ Resumo Rápido)
      if (trimmedLine.startsWith("✅ ")) {
        flushList();
        elements.push(
          <div key={index} className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded-r-lg my-4">
            <span className="font-bold text-green-700 dark:text-green-400">✅ Resumo Rápido</span>
            <p className="text-green-900 dark:text-green-200 mt-1" dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(trimmedLine.slice(3))) }} />
          </div>
        );
        return;
      }

      // Special blocks - Pull Quote (❝ Citação Destacada)
      if (trimmedLine.startsWith("❝ ") || trimmedLine.startsWith("❞ ")) {
        flushList();
        const quoteContent = trimmedLine.replace(/^[❝❞]\s?/, '');
        elements.push(
          <blockquote key={index} className="bg-gradient-to-r from-primary/10 to-transparent border-l-4 border-primary p-6 my-8 rounded-r-lg">
            <p className="text-xl italic font-serif text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(quoteContent)) }} />
          </blockquote>
        );
        return;
      }

      // Headers with ID for TOC linking
      if (trimmedLine.startsWith("# ")) {
        flushList();
        if (hideFirstH1 && !h1Skipped) {
          h1Skipped = true;
          return;
        }
        const headingText = trimmedLine.replace("# ", "");
        const headingId = slugify(headingText);
        elements.push(
          <h1
            key={index}
            id={headingId}
            className="font-heading text-3xl md:text-4xl font-black text-foreground mt-10 mb-6 leading-tight scroll-mt-24"
          >
            {headingText}
          </h1>
        );
        return;
      }

      if (trimmedLine.startsWith("## ")) {
        flushList();
        h2Count++;
        const headingText = trimmedLine.replace("## ", "");
        const headingId = slugify(headingText);
        elements.push(
          <h2 
            key={index} 
            id={headingId} 
            className="font-heading text-2xl md:text-3xl font-bold text-foreground mt-12 mb-6 pb-3 border-b-2 border-primary/20 scroll-mt-24 bg-gradient-to-r from-primary/5 to-transparent -mx-4 px-4 py-2 rounded-lg"
          >
            {headingText}
          </h2>
        );
        // Insert image after this H2 section
        insertImageIfNeeded(h2Count);
        return;
      }

      if (trimmedLine.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 
            key={index} 
            className="font-heading text-xl md:text-2xl font-semibold text-foreground mt-8 mb-4 pl-4 border-l-4 border-primary scroll-mt-24"
          >
            {trimmedLine.replace("### ", "")}
          </h3>
        );
        return;
      }

      // Blockquotes
      if (trimmedLine.startsWith("> ")) {
        flushList();
        elements.push(
          <blockquote key={index} className="border-l-4 border-primary pl-4 py-2 my-4 bg-primary/5 rounded-r-lg italic text-muted-foreground">
            <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(trimmedLine.replace("> ", ""))) }} />
          </blockquote>
        );
        return;
      }

      // Unordered list
      if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
        if (listType !== "ul") {
          flushList();
          listType = "ul";
        }
        listItems.push(trimmedLine.replace(/^[-*]\s/, ""));
        return;
      }

      // Ordered list
      const orderedMatch = trimmedLine.match(/^\d+\.\s/);
      if (orderedMatch) {
        if (listType !== "ol") {
          flushList();
          listType = "ol";
        }
        listItems.push(trimmedLine.replace(/^\d+\.\s/, ""));
        return;
      }

      // Regular paragraph text - accumulate for grouping
      pendingParagraph.push(trimmedLine);
    });

    flushParagraph();
    flushList();
    return elements;
  };

  return (
    <article className="prose prose-lg max-w-none prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-p:leading-relaxed prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-blockquote:not-italic">
      <style>{`
        .whatsapp-cta-inline {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background-color: #25D366;
          color: white !important;
          border-radius: 0.5rem;
          font-weight: 600;
          text-decoration: none !important;
          transition: all 0.2s;
        }
        .whatsapp-cta-inline:hover {
          background-color: #1da851;
          transform: scale(1.02);
        }
      `}</style>
      {formatContent(content)}
    </article>
  );
};
