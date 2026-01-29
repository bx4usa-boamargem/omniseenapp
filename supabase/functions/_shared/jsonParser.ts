/**
 * Parse JSON com 2 tentativas
 * Tentativa 1: Parse direto
 * Tentativa 2: Extrair primeiro bloco JSON válido
 * Falhou = ABORT (sem retry infinito)
 */

export interface ParseResult {
  success: boolean;
  // deno-lint-ignore no-explicit-any
  data?: any;
  error?: string;
}

export function parseArticleJSONStrict(rawArgs: string): ParseResult {
  console.log('[JSONParser] Attempting parse...');

  // Tentativa 1: Parse direto
  try {
    const parsed = JSON.parse(rawArgs);
    console.log('[JSONParser] ✅ Direct parse successful');
    return { success: true, data: parsed };
  } catch (_e1) {
    console.log('[JSONParser] Direct parse failed, trying extraction...');
  }

  // Tentativa 2: Extrair primeiro bloco JSON
  try {
    // Limpar markdown code fences
    let cleaned = rawArgs
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    // Encontrar primeiro objeto JSON válido
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[JSONParser] ✅ Extraction successful');
      return { success: true, data: parsed };
    }
  } catch (_e2) {
    console.log('[JSONParser] Extraction failed');
  }

  // ABORT - Sem mais tentativas
  console.error('[JSONParser] ❌ FAILED - Invalid JSON');
  return { 
    success: false, 
    error: 'JSON inválido ou não encontrado na resposta da IA'
  };
}
