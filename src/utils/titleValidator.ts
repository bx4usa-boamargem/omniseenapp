// ============================================================================
// TITLE VALIDATOR (FRONTEND) - REGRA ABSOLUTA DE TÍTULO
// ============================================================================
// Validação em tempo real de títulos no frontend
// Mesmas regras do backend para consistência
// ============================================================================

/**
 * Padrões regex para detecção de prefixos proibidos
 */
export const FORBIDDEN_PREFIXES: RegExp[] = [
  // Português
  /^artigo[\s]*[-–—:]\s*/i,
  /^post[\s]*[-–—:]\s*/i,
  /^guia[\s]*[-–—:]\s*/i,
  /^conteúdo[\s]*[-–—:]\s*/i,
  /^conteudo[\s]*[-–—:]\s*/i,
  /^blog[\s]*[-–—:]\s*/i,
  /^texto[\s]*[-–—:]\s*/i,
  /^matéria[\s]*[-–—:]\s*/i,
  /^materia[\s]*[-–—:]\s*/i,
  /^dica[\s]*[-–—:]\s*/i,
  /^tutorial[\s]*[-–—:]\s*/i,
  // Inglês
  /^article[\s]*[-–—:]\s*/i,
  /^guide[\s]*[-–—:]\s*/i,
  /^content[\s]*[-–—:]\s*/i,
  /^tip[\s]*[-–—:]\s*/i,
];

export interface TitleValidationResult {
  isValid: boolean;
  error?: string;
  sanitized: string;
  prefixFound?: string;
}

/**
 * Valida um título e retorna o resultado com título sanitizado
 */
export function validateTitle(title: string): TitleValidationResult {
  const trimmed = title.trim();
  
  if (!trimmed) {
    return {
      isValid: false,
      error: 'Título não pode ser vazio.',
      sanitized: '',
    };
  }
  
  for (const pattern of FORBIDDEN_PREFIXES) {
    const match = trimmed.match(pattern);
    if (match) {
      const sanitized = trimmed.replace(pattern, '').trim();
      const capitalizedSanitized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
      
      return {
        isValid: false,
        error: 'Títulos não podem começar com "Artigo:", "Post:", "Guia:" ou similares.',
        sanitized: capitalizedSanitized,
        prefixFound: match[0],
      };
    }
  }
  
  // Verificação de comprimento para SEO
  if (trimmed.length > 60) {
    return {
      isValid: true, // Não é erro crítico, apenas aviso
      sanitized: trimmed,
      error: `Título muito longo para SEO (${trimmed.length}/60 caracteres).`,
    };
  }
  
  if (trimmed.length < 10) {
    return {
      isValid: false,
      error: 'Título muito curto (mínimo 10 caracteres).',
      sanitized: trimmed,
    };
  }
  
  return { isValid: true, sanitized: trimmed };
}

/**
 * Sanitiza um título removendo prefixos proibidos
 */
export function sanitizeTitle(title: string): string {
  const result = validateTitle(title);
  return result.sanitized;
}

/**
 * Verifica rapidamente se um título tem prefixo proibido
 */
export function hasForbiddenPrefix(title: string): boolean {
  const trimmed = title.trim();
  return FORBIDDEN_PREFIXES.some(pattern => pattern.test(trimmed));
}
