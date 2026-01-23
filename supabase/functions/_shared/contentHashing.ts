// ═══════════════════════════════════════════════════════════════════
// CONTENT HASHING: Deterministic Change Detection
// V2.0: Score only changes when content or SERP changes
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate SHA-256 hash for content (Deno-compatible)
 */
export async function generateContentHashAsync(content: string): Promise<string> {
  const normalized = content
    .replace(/<[^>]*>/g, '')     // Remove HTML
    .replace(/\s+/g, ' ')        // Normalize spaces
    .trim()
    .toLowerCase();
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Generate hash for SERP results
 */
export async function generateSerpHashAsync(urls: string[]): Promise<string> {
  const sortedUrls = urls.sort().join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(sortedUrls);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Check if content or SERP has changed since last calculation
 */
export interface ContentChangeCheck {
  shouldRecalculate: boolean;
  reason: 'content_changed' | 'serp_changed' | 'no_score' | 'no_change';
  currentContentHash?: string;
  currentSerpHash?: string;
}

export async function checkContentChanged(
  supabase: ReturnType<typeof createClient>,
  articleId: string,
  newContent: string,
  currentSerpHash?: string
): Promise<ContentChangeCheck> {
  // Get current article hash
  const { data: article } = await supabase
    .from('articles')
    .select('content_hash, serp_hash_at_calculation')
    .eq('id', articleId)
    .single();

  const articleData = article as { content_hash: string | null; serp_hash_at_calculation: string | null } | null;

  if (!articleData) {
    return { shouldRecalculate: true, reason: 'no_score' };
  }

  const newContentHash = await generateContentHashAsync(newContent);

  // Check if content changed
  if (articleData.content_hash !== newContentHash) {
    return { 
      shouldRecalculate: true, 
      reason: 'content_changed',
      currentContentHash: newContentHash
    };
  }

  // Check if SERP changed
  if (currentSerpHash && articleData.serp_hash_at_calculation !== currentSerpHash) {
    return { 
      shouldRecalculate: true, 
      reason: 'serp_changed',
      currentSerpHash
    };
  }

  return { 
    shouldRecalculate: false, 
    reason: 'no_change',
    currentContentHash: newContentHash,
    currentSerpHash: articleData.serp_hash_at_calculation || undefined
  };
}

/**
 * Update content hash after score calculation
 */
export async function updateContentHash(
  supabase: ReturnType<typeof createClient>,
  articleId: string,
  contentHash: string,
  serpHash?: string
): Promise<void> {
  // Use direct update with type assertion to bypass strict typing
  const updateData: { content_hash: string; last_content_change_at: string; serp_hash_at_calculation?: string } = {
    content_hash: contentHash,
    last_content_change_at: new Date().toISOString()
  };

  if (serpHash) {
    updateData.serp_hash_at_calculation = serpHash;
  }

  // deno-lint-ignore no-explicit-any
  await (supabase as any)
    .from('articles')
    .update(updateData)
    .eq('id', articleId);
}
