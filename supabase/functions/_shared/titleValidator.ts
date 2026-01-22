// ============================================================================
// TITLE VALIDATOR - REGRA ABSOLUTA DE TÍTULO (H1 E TITLE)
// ============================================================================
// Nenhum artigo pode ser salvo/publicado com prefixos proibidos no título.
// O sistema DEVE remover automaticamente ou bloquear a publicação.
// ============================================================================

/**
 * Prefixos PROIBIDOS (case insensitive)
 * Qualquer título que comece com esses termos é INVÁLIDO
 */
export const FORBIDDEN_TITLE_PREFIXES = [
  // Português - com dois pontos
  'artigo:',
  'post:',
  'guia:',
  'conteúdo:',
  'conteudo:',
  'blog:',
  'texto:',
  'matéria:',
  'materia:',
  'dica:',
  'tutorial:',
  // Português - com hífen
  'artigo -',
  'artigo –',
  'artigo—',
  'post -',
  'post –',
  'guia -',
  'guia –',
  'conteúdo -',
  'conteudo -',
  'blog -',
  'texto -',
  'matéria -',
  'materia -',
  // Inglês
  'article:',
  'article -',
  'guide:',
  'guide -',
  'content:',
  'content -',
  'post:',
  'tip:',
  'tutorial:',
];

/**
 * Padrões regex para detecção mais abrangente
 */
export const FORBIDDEN_TITLE_PATTERNS: RegExp[] = [
  // Português - variações com separadores
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
  originalTitle: string;
  sanitizedTitle: string;
  hadForbiddenPrefix: boolean;
  prefixRemoved?: string;
}

export interface TitlePublicationCheck {
  canPublish: boolean;
  title: string;
  wasAutoCorrected: boolean;
  error?: string;
}

/**
 * Verifica se o título começa com um prefixo proibido
 */
export function hasForbiddenPrefix(title: string): { has: boolean; prefix?: string; length?: number } {
  const trimmedTitle = title.trim();
  const titleLower = trimmedTitle.toLowerCase();
  
  // Check exact prefixes first
  for (const prefix of FORBIDDEN_TITLE_PREFIXES) {
    if (titleLower.startsWith(prefix)) {
      return { has: true, prefix, length: prefix.length };
    }
  }
  
  // Check regex patterns for more complex matches
  for (const pattern of FORBIDDEN_TITLE_PATTERNS) {
    const match = trimmedTitle.match(pattern);
    if (match) {
      return { has: true, prefix: match[0], length: match[0].length };
    }
  }
  
  return { has: false };
}

/**
 * Remove prefixos proibidos e capitaliza corretamente
 * Esta é a função principal de sanitização
 */
export function sanitizeTitle(title: string): TitleValidationResult {
  const original = title.trim();
  
  if (!original) {
    return {
      isValid: false,
      originalTitle: original,
      sanitizedTitle: '',
      hadForbiddenPrefix: false,
    };
  }
  
  const { has, prefix, length } = hasForbiddenPrefix(original);
  
  if (!has) {
    return {
      isValid: true,
      originalTitle: original,
      sanitizedTitle: original,
      hadForbiddenPrefix: false,
    };
  }
  
  // Remover o prefixo
  let sanitized = original.slice(length!).trim();
  
  // Capitalizar primeira letra se necessário
  if (sanitized.length > 0 && sanitized[0] === sanitized[0].toLowerCase()) {
    sanitized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
  }
  
  console.log(`[TITLE SANITIZER] ✂️ Removed prefix "${prefix}" from title`);
  console.log(`[TITLE SANITIZER] Original: "${original}"`);
  console.log(`[TITLE SANITIZER] Sanitized: "${sanitized}"`);
  
  return {
    isValid: false, // Original era inválido
    originalTitle: original,
    sanitizedTitle: sanitized,
    hadForbiddenPrefix: true,
    prefixRemoved: prefix,
  };
}

/**
 * Valida título para publicação - BLOQUEIA se inválido e não auto-corrigível
 * Usar esta função antes de publicar qualquer artigo
 */
export function validateTitleForPublication(title: string): TitlePublicationCheck {
  if (!title || !title.trim()) {
    return {
      canPublish: false,
      title: '',
      wasAutoCorrected: false,
      error: 'Título vazio ou ausente',
    };
  }
  
  const result = sanitizeTitle(title);
  
  // Se o título sanitizado estiver vazio ou muito curto
  if (result.sanitizedTitle.length < 10) {
    return {
      canPublish: false,
      title: result.sanitizedTitle,
      wasAutoCorrected: result.hadForbiddenPrefix,
      error: `Título muito curto após remoção de prefixo (${result.sanitizedTitle.length} chars, mínimo 10)`,
    };
  }
  
  // Título válido (original ou após correção)
  return {
    canPublish: true,
    title: result.sanitizedTitle,
    wasAutoCorrected: result.hadForbiddenPrefix,
  };
}

/**
 * Sanitiza o H1 dentro do conteúdo Markdown
 * Procura por "# Título" e aplica sanitização
 */
export function sanitizeTitleInContent(content: string): { 
  content: string; 
  wasModified: boolean; 
  originalH1?: string;
  newH1?: string;
} {
  if (!content) {
    return { content: '', wasModified: false };
  }
  
  // Encontrar o H1 no conteúdo
  const h1Match = content.match(/^# (.+)$/m);
  
  if (!h1Match) {
    return { content, wasModified: false };
  }
  
  const originalH1 = h1Match[1].trim();
  const result = sanitizeTitle(originalH1);
  
  if (!result.hadForbiddenPrefix) {
    return { content, wasModified: false };
  }
  
  // Substituir o H1 no conteúdo
  const newContent = content.replace(
    /^# .+$/m,
    `# ${result.sanitizedTitle}`
  );
  
  console.log(`[TITLE SANITIZER] 📝 Fixed H1 in content: "${originalH1}" → "${result.sanitizedTitle}"`);
  
  return {
    content: newContent,
    wasModified: true,
    originalH1,
    newH1: result.sanitizedTitle,
  };
}

/**
 * Instruções de prompt para impedir que a IA gere prefixos
 * Adicionar ao prompt de geração de artigos
 */
export const TITLE_RULES_PROMPT = `
## ⛔ REGRAS ABSOLUTAS DE TÍTULO (VIOLAÇÃO = ARTIGO INVÁLIDO)

O campo "title" deve conter APENAS o título final do artigo, pronto para Google e WordPress.

❌ PREFIXOS PROIBIDOS (NUNCA usar no início do título):
- "Artigo:", "Post:", "Guia:", "Blog:", "Conteúdo:", "Texto:", "Matéria:", "Dica:", "Tutorial:"
- Qualquer variação com "-", "–" ou "—" após esses termos
- Versões em inglês: "Article:", "Guide:", "Content:", "Post:", "Tip:"

✅ EXEMPLOS CORRETOS:
- "5 Dicas para Negócios de Alimentos em Teresina"
- "Controle de Pragas em Caxias: Como Proteger Seu Restaurante"
- "SEO Local em Teresina: Guia Prático para PMEs"
- "Como Aumentar Vendas no WhatsApp: Estratégias Comprovadas"

❌ EXEMPLOS PROIBIDOS (REJEITADOS AUTOMATICAMENTE):
- "Artigo: 5 Dicas para Negócios de Alimentos"
- "Post: Controle de Pragas em Caxias"
- "Guia: SEO Local em Teresina"
- "Guia – Como Aumentar Vendas"
- "Article: How to Increase Sales"

⚠️ REGRA DE BLOQUEIO: Se o título iniciar com qualquer prefixo proibido, o artigo NÃO pode ser publicado.

O título deve ser:
1. Direto e objetivo (máximo 60 caracteres para SEO)
2. Incluir a palavra-chave principal
3. Engajador e específico
4. Sem prefixos descritivos
`;

/**
 * Verifica se o conteúdo gerado tem título válido
 * Usar após receber resposta da IA
 */
export function validateGeneratedTitle(generatedTitle: string): {
  isValid: boolean;
  correctedTitle: string;
  hadError: boolean;
  errorMessage?: string;
} {
  if (!generatedTitle) {
    return {
      isValid: false,
      correctedTitle: '',
      hadError: true,
      errorMessage: 'Título não foi gerado',
    };
  }
  
  const result = sanitizeTitle(generatedTitle);
  
  if (result.hadForbiddenPrefix) {
    console.log(`[TITLE VALIDATOR] ⚠️ IA gerou título com prefixo proibido: "${generatedTitle}"`);
    console.log(`[TITLE VALIDATOR] ✅ Auto-corrigido para: "${result.sanitizedTitle}"`);
  }
  
  return {
    isValid: !result.hadForbiddenPrefix,
    correctedTitle: result.sanitizedTitle,
    hadError: result.hadForbiddenPrefix,
    errorMessage: result.hadForbiddenPrefix 
      ? `Prefixo proibido "${result.prefixRemoved}" removido automaticamente` 
      : undefined,
  };
}
