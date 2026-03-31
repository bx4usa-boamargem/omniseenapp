import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../sanitize';

describe('sanitizeHTML', () => {
  it('strips script tags', () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHTML(dirty);
    expect(result).not.toContain('<script');
    expect(result).toContain('<p>Hello</p>');
  });

  it('allows safe HTML tags', () => {
    const safe = '<h1>Title</h1><p>Text with <strong>bold</strong> and <em>italic</em></p>';
    const result = sanitizeHTML(safe);
    expect(result).toContain('<h1>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
  });

  it('strips event handlers', () => {
    const dirty = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeHTML(dirty);
    expect(result).not.toContain('onerror');
  });

  it('strips data attributes', () => {
    const dirty = '<div data-evil="payload">content</div>';
    const result = sanitizeHTML(dirty);
    expect(result).not.toContain('data-evil');
  });

  it('allows href and target attributes on links', () => {
    const safe = '<a href="https://example.com" target="_blank">Link</a>';
    const result = sanitizeHTML(safe);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
  });

  it('extracts body content from full HTML documents', () => {
    const fullDoc = '<!DOCTYPE html><html><head><style>.x{}</style></head><body><p>Content</p></body></html>';
    const result = sanitizeHTML(fullDoc);
    expect(result).toContain('<p>Content</p>');
    expect(result).not.toContain('<!DOCTYPE');
    expect(result).not.toContain('<style');
  });

  it('handles empty string', () => {
    expect(sanitizeHTML('')).toBe('');
  });

  it('strips iframe tags', () => {
    const dirty = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
    const result = sanitizeHTML(dirty);
    expect(result).not.toContain('<iframe');
    expect(result).toContain('<p>Safe</p>');
  });
});
