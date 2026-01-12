// Contrato Editorial Obrigatório - CTA Padrão
// Este arquivo define o CTA obrigatório que DEVE estar em TODOS os artigos

export const MANDATORY_CTA_SECTION = `## Próximo passo

Você não precisa continuar perdendo clientes por falta de resposta, organização ou tempo.

Hoje já existem ferramentas simples que fazem o trabalho pesado por você — mesmo enquanto você está atendendo clientes ou trabalhando no campo.

Se você quer transformar seu site, seu WhatsApp e seus leads em uma máquina de vendas automática, o próximo passo é conversar com um especialista.

**👉 [Fale com um especialista agora]**`;

export const MANDATORY_FINAL_TITLE = '## Próximo passo';

// Padrões de seções finais genéricas que devem ser removidas
const GENERIC_END_PATTERNS = [
  /##\s*(conclusão|considerações finais|para finalizar|concluindo)[\s\S]*$/i,
  /##\s*(saiba mais|entre em contato|fale conosco|contato)[\s\S]*$/i,
  /##\s*(o que fazer agora|tome uma atitude|aja agora)[\s\S]*$/i,
  /##\s*(resumo|resumindo|em resumo)[\s\S]*$/i
];

/**
 * Verifica se o artigo possui CTA válido no formato correto
 */
export function hasValidCTA(content: string): boolean {
  const h2Matches = content.match(/^## .+$/gm) || [];
  if (h2Matches.length === 0) return false;
  
  const lastH2 = h2Matches[h2Matches.length - 1].trim().toLowerCase();
  return lastH2 === MANDATORY_FINAL_TITLE.toLowerCase();
}

/**
 * Garante que o artigo termine com o CTA obrigatório do contrato editorial.
 * Remove seções genéricas e anexa o CTA padrão se necessário.
 */
export function ensureCTA(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Verificar se já tem o CTA correto com conteúdo adequado
  if (hasValidCTA(content)) {
    // Verificar se o conteúdo após o H2 contém os elementos chave
    const parts = content.split(/##\s*Próximo\s*passo/i);
    if (parts.length > 1) {
      const ctaContent = parts[parts.length - 1].toLowerCase();
      if (ctaContent.includes('especialista') && ctaContent.includes('fale')) {
        console.log('[EDITORIAL CONTRACT] CTA já está válido');
        return content;
      }
    }
  }
  
  console.log('[EDITORIAL CONTRACT] CTA ausente ou inválido - aplicando auto-correção');
  
  // Remover seções finais genéricas
  let cleanContent = content;
  for (const pattern of GENERIC_END_PATTERNS) {
    cleanContent = cleanContent.replace(pattern, '');
  }
  
  // Também remover qualquer "## Próximo passo" existente com conteúdo incorreto
  cleanContent = cleanContent.replace(/##\s*Próximo\s*passo[\s\S]*$/i, '');
  
  // Limpar espaços extras no final
  cleanContent = cleanContent.trim();
  
  // Anexar CTA padrão do contrato
  const result = cleanContent + '\n\n' + MANDATORY_CTA_SECTION;
  
  console.log('[EDITORIAL CONTRACT] CTA obrigatório anexado com sucesso');
  
  return result;
}

/**
 * Valida se o conteúdo atende ao contrato editorial mínimo
 */
export function validateEditorialContract(content: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // 1. Verificar se tem H1
  if (!content.match(/^# .+$/m)) {
    issues.push('Artigo não possui título H1');
  }
  
  // 2. Verificar se tem H2s
  const h2Count = (content.match(/^## .+$/gm) || []).length;
  if (h2Count < 2) {
    issues.push('Artigo precisa de pelo menos 2 seções H2');
  }
  
  // 3. Verificar CTA obrigatório
  if (!hasValidCTA(content)) {
    issues.push('Artigo não possui seção "## Próximo passo" válida');
  }
  
  // 4. Verificar se CTA tem o conteúdo correto
  if (hasValidCTA(content)) {
    const parts = content.split(/##\s*Próximo\s*passo/i);
    if (parts.length > 1) {
      const ctaContent = parts[parts.length - 1].toLowerCase();
      if (!ctaContent.includes('especialista')) {
        issues.push('CTA não contém chamada para especialista');
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
