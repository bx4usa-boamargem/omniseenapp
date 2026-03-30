import DOMPurify from 'dompurify';

export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'figure', 'figcaption',
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'section',
      'article', 'header', 'footer', 'nav', 'aside', 'main', 'mark', 'sub', 'sup',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'src', 'alt', 'style', 'loading',
      'id', 'title', 'width', 'height', 'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
};
