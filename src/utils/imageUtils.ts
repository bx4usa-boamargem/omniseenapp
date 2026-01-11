/**
 * Image utility functions for safe base64/data URL handling
 * Prevents prefix duplication and provides consistent blob conversion
 */

/**
 * Normalizes a base64 string to a proper data URL
 * Prevents double-prefixing (data:image/...;base64,data:image/...;base64,...)
 */
export function normalizeBase64ToDataUrl(base64: string): string {
  if (!base64) return '';
  
  // If already a proper data URL, return as-is
  if (base64.startsWith('data:image/') && !base64.includes('data:image/', 20)) {
    return base64;
  }
  
  // Remove any existing data URL prefixes (handles double-prefix case)
  let cleanBase64 = base64;
  while (cleanBase64.includes('data:image/')) {
    cleanBase64 = cleanBase64.replace(/^data:image\/[^;]+;base64,/, '');
  }
  
  // Add single clean prefix
  return `data:image/png;base64,${cleanBase64}`;
}

/**
 * Converts base64/data URL string to Blob safely
 * Handles prefix normalization automatically
 */
export async function base64ToBlob(base64: string): Promise<Blob> {
  const dataUrl = normalizeBase64ToDataUrl(base64);
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Extracts the image URL from an API response, normalizing if needed
 * Returns publicUrl if available, otherwise normalizes base64
 */
export function extractImageUrl(response: { imageUrl?: string; imageBase64?: string }): string | null {
  if (response.imageUrl) {
    return response.imageUrl;
  }
  if (response.imageBase64) {
    return normalizeBase64ToDataUrl(response.imageBase64);
  }
  return null;
}
