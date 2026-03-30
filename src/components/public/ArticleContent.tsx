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
}

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

export const ArticleContent = ({ content, contentImages = [] }: ArticleContentProps) => {
  // Detect if content is HTML (from SEO optimization) vs Markdown
  const isHtmlContent = /<(h[1-6]|p|div|figure|ul|ol|table|section)\b/i.test(content);

  if (isHtmlContent) {
    // HTML content: process WhatsApp CTAs and render directly
    let processedHtml = content;
    
    // Convert WhatsApp links to styled buttons
    processedHtml = processedHtml.replace(
      /<a\s+href="(https:\/\/wa\.me\/[^"]+)"[^>]*>([^<]+)<\/a>/gi,
      (_, url, text) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="whatsapp-cta-inline">${text}</a>`
    );

    // Inject content_images after corresponding h2 sections
    if (contentImages && contentImages.length > 0) {
      let h2Count = 0;
      processedHtml = processedHtml.replace(/(<\/h2>)/gi, (match) => {
        h2Count++;
        const image = contentImages.find(img => img.after_section === h2Count);
        if (image) {
          const label = contextLabels[image.context] || 'Ilustração';
          return `${match}<figure class="my-10"><div class="rounded-xl overflow-hidden shadow-xl"><img src="${image.url}" alt="${label}" class="w-full aspect-video object-cover object-center" style="max-height:400px" loading="lazy" /></div><figcaption class="text-center text-sm text-muted-foreground mt-3 italic">${label}</figcaption></figure>`;
        }
        return match;
      });
    }

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
    let pendingParagraph: string[] = [];

    const flushParagraph = () => {
      if (pendingParagraph.length > 0) {
        const processedLine = pendingParagraph.join(' ')
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/_(.+?)_/g, "<em>$1</em>");
        elements.push(
          <p key={`p-${elements.length}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(processLinks(processedLine)) }} />
        );
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
      const image = contentImages.find(img => img.after_section === afterSection);
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
            <p className="text-purple-900 dark:text-purple-200 mt-1" dangerouslySetInnerHTML={{ __html: processLinks(trimmedLine.slice(3)) }} />
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
            <p className="text-red-900 dark:text-red-200 mt-1" dangerouslySetInnerHTML={{ __html: processLinks(trimmedLine.slice(3)) }} />
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
            <p className="text-blue-900 dark:text-blue-200 mt-1" dangerouslySetInnerHTML={{ __html: processLinks(trimmedLine.slice(3)) }} />
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
            <p className="text-green-900 dark:text-green-200 mt-1" dangerouslySetInnerHTML={{ __html: processLinks(trimmedLine.slice(3)) }} />
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
            <p className="text-xl italic font-serif text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: processLinks(quoteContent) }} />
          </blockquote>
        );
        return;
      }

      // Headers with ID for TOC linking
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
            <span dangerouslySetInnerHTML={{ __html: processLinks(trimmedLine.replace("> ", "")) }} />
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
