import DOMPurify from 'dompurify';

/**
 * Extract the body content from a full HTML document.
 * If the content has <!DOCTYPE> or <html>/<body> wrappers, strips them
 * and preserves any <style> blocks found in <head> or <body>.
 */
const extractBodyContent = (html: string): string => {
  // If it's a full HTML document, extract body + styles
  if (/<!DOCTYPE|<html[\s>]/i.test(html)) {
    const styles: string[] = [];
    // Collect all <style> blocks
    html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
      styles.push(css);
      return '';
    });

    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;

    // Strip remaining wrapper tags
    const cleaned = bodyContent
      .replace(/<\/?(html|head|body|meta|link|!DOCTYPE)[^>]*>/gi, '')
      .replace(/<div class="container">/gi, '<div>')
      .trim();

    if (styles.length > 0) {
      return `<style>${styles.join('\n')}</style>${cleaned}`;
    }
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
      'style',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'src', 'alt', 'style', 'loading',
      'id', 'title', 'width', 'height', 'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
};
