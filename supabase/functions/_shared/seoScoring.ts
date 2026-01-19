/**
 * SEO Scoring Module - Centralized SEO calculation functions
 * Used by edge functions for consistent scoring across the platform
 */

export interface SEOInput {
  title: string;
  meta_description: string;
  content_text: string; // Clean text without HTML
  keywords: string[];
  has_featured_image: boolean;
}

export interface SEOBreakdown {
  title_points: number;    // 0-15
  meta_points: number;     // 0-15
  keywords_points: number; // 0-15
  content_points: number;  // 0-20
  density_points: number;  // 0-20
  image_points: number;    // 0-15
}

export interface SEODiagnostics {
  title_length: number;
  meta_length: number;
  word_count: number;
  density: Record<string, number>;
  missing: string[];
}

export interface SEOResult {
  score_total: number; // 0-100
  breakdown: SEOBreakdown;
  diagnostics: SEODiagnostics;
}

/**
 * Strip HTML tags and extract clean text
 * Critical for accurate keyword density calculation
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  
  return html
    // Remove script tags and content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove style tags and content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Replace br and p tags with spaces for proper word separation
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<\/h[1-6]>/gi, ' ')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute word count from text
 */
export function computeWordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Compute keyword density for each keyword
 * Returns percentage of occurrences relative to total word count
 */
export function computeKeywordDensity(
  text: string, 
  keywords: string[]
): Record<string, number> {
  if (!text || !keywords || keywords.length === 0) {
    return {};
  }
  
  const textLower = text.toLowerCase();
  const wordCount = computeWordCount(text);
  
  if (wordCount === 0) {
    return keywords.reduce((acc, kw) => {
      acc[kw] = 0;
      return acc;
    }, {} as Record<string, number>);
  }
  
  return keywords.reduce((acc, kw) => {
    if (!kw) {
      acc[kw] = 0;
      return acc;
    }
    
    // Escape regex special characters
    const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKw.toLowerCase(), 'gi');
    const matches = textLower.match(regex);
    const count = matches ? matches.length : 0;
    
    // Calculate density as percentage
    acc[kw] = Number(((count / wordCount) * 100).toFixed(2));
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Compute complete SEO score with breakdown and diagnostics
 */
export function computeSeoScore(input: SEOInput): SEOResult {
  const breakdown: SEOBreakdown = {
    title_points: 0,
    meta_points: 0,
    keywords_points: 0,
    content_points: 0,
    density_points: 0,
    image_points: 0
  };
  
  const cleanText = stripHtml(input.content_text);
  const wordCount = computeWordCount(cleanText);
  const density = computeKeywordDensity(cleanText, input.keywords);
  const missing: string[] = [];
  
  // 1. Title (15 points)
  const titleLen = (input.title || '').length;
  const keywordInTitle = input.keywords.some(kw => 
    kw && input.title && input.title.toLowerCase().includes(kw.toLowerCase())
  );
  
  if (titleLen >= 50 && titleLen <= 60) {
    breakdown.title_points = keywordInTitle ? 15 : 12;
  } else if (titleLen >= 30 && titleLen <= 70) {
    breakdown.title_points = keywordInTitle ? 10 : 8;
  } else if (titleLen > 0) {
    breakdown.title_points = 5;
    missing.push('título_otimizado');
  } else {
    missing.push('título');
  }
  
  // 2. Meta Description (15 points)
  const metaLen = (input.meta_description || '').length;
  const keywordInMeta = input.keywords.some(kw => 
    kw && input.meta_description && input.meta_description.toLowerCase().includes(kw.toLowerCase())
  );
  
  if (metaLen >= 140 && metaLen <= 160) {
    breakdown.meta_points = keywordInMeta ? 15 : 12;
  } else if (metaLen >= 100 && metaLen <= 180) {
    breakdown.meta_points = keywordInMeta ? 10 : 8;
  } else if (metaLen > 50) {
    breakdown.meta_points = 5;
    missing.push('meta_otimizada');
  } else {
    missing.push('meta_description');
  }
  
  // 3. Keywords (15 points)
  const validKeywords = input.keywords.filter(k => k && k.trim().length > 0);
  if (validKeywords.length >= 3 && validKeywords.length <= 7) {
    breakdown.keywords_points = 15;
  } else if (validKeywords.length >= 1) {
    breakdown.keywords_points = 8;
  } else {
    missing.push('keywords');
  }
  
  // 4. Content Length (20 points)
  if (wordCount >= 1500 && wordCount <= 2500) {
    breakdown.content_points = 20;
  } else if (wordCount >= 1200 && wordCount <= 3000) {
    breakdown.content_points = 18;
  } else if (wordCount >= 800) {
    breakdown.content_points = 12;
  } else if (wordCount >= 300) {
    breakdown.content_points = Math.min(Math.floor(wordCount / 100), 8);
  } else {
    breakdown.content_points = Math.min(Math.floor(wordCount / 50), 5);
    missing.push('conteúdo_expandido');
  }
  
  // 5. Density (20 points) - CRITICAL: uses clean text
  const densityValues = Object.values(density);
  const avgDensity = densityValues.length > 0
    ? densityValues.reduce((a, b) => a + b, 0) / densityValues.length
    : 0;
  
  // Check if at least one keyword has good density
  const hasGoodDensity = densityValues.some(d => d >= 0.5 && d <= 2.5);
  const anyKeywordFound = densityValues.some(d => d > 0);
  
  if (hasGoodDensity && avgDensity >= 0.3 && avgDensity <= 3.0) {
    breakdown.density_points = 20;
  } else if (anyKeywordFound && avgDensity > 0) {
    // Partial points based on actual density
    if (avgDensity < 0.5) {
      breakdown.density_points = 10; // Low density
    } else if (avgDensity > 2.5) {
      breakdown.density_points = 8; // Over-optimization
    } else {
      breakdown.density_points = 15;
    }
  } else if (validKeywords.length === 0) {
    // No keywords to measure
    breakdown.density_points = 10;
  } else {
    missing.push('densidade_keywords');
  }
  
  // 6. Image (15 points)
  if (input.has_featured_image) {
    breakdown.image_points = 15;
  } else {
    missing.push('imagem_destacada');
  }
  
  // Calculate total (0-100)
  const earned = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const max = 100; // 15+15+15+20+20+15 = 100
  const score_total = Math.round((earned / max) * 100);
  
  return {
    score_total,
    breakdown,
    diagnostics: {
      title_length: titleLen,
      meta_length: metaLen,
      word_count: wordCount,
      density,
      missing
    }
  };
}
