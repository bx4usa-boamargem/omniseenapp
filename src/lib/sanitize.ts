import DOMPurify from 'dompurify';

/**
 * Extract the body content from a full HTML document.
 * If the content has <!DOCTYPE> or <html>/<body> wrappers, strips them
 * Strips inline <style> blocks (they conflict with Tailwind prose/dark mode).
 */
const extractBodyContent = (html: string): string => {
  // If it's a full HTML document, extract body + styles
  if (/<!DOCTYPE|<html[\s>]/i.test(html)) {
    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;

    // Strip wrapper tags and inline <style> blocks (they conflict with Tailwind prose/dark mode)
    const cleaned = bodyContent
      .replace(/<\/?(html|head|body|meta|link|!DOCTYPE)[^>]*>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<div class="container">/gi, '<div>')
      .trim();

    return cleaned;
  }
  return html;
};

export const sanitizeHTML = (html: string): string => {
  const content = extractBodyContent(html);

  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'figure', 'figcaption',
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'section',
      'article', 'header', 'footer', 'nav', 'aside', 'main', 'mark', 'sub', 'sup',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'src', 'alt', 'loading',
      'id', 'title', 'width', 'height', 'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
};
