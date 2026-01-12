// Contrato Editorial Obrigatório - CTA Padrão
// Este arquivo define o CTA obrigatório que DEVE estar em TODOS os artigos

export interface CompanyInfo {
  name: string;
  city?: string;
  whatsapp?: string;
}

// CTA genérico de fallback (quando não há dados da empresa)
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
 * Gera CTA obrigatório personalizado com dados da empresa
 */
export function generateCompanyCTA(company: CompanyInfo): string {
  const locationText = company.city ? ` em ${company.city}` : '';
  const ctaButtonText = `Fale com a ${company.name} agora`;
  
  // Link clicável se tiver WhatsApp
  const ctaLink = company.whatsapp 
    ? `[${ctaButtonText}](https://wa.me/${company.whatsapp})`
    : `[${ctaButtonText}]`;

  return `## Próximo passo

Você não precisa continuar perdendo clientes por falta de resposta, organização ou tempo.

Hoje já existem ferramentas simples que fazem o trabalho pesado por você — mesmo enquanto você está atendendo clientes ou trabalhando no campo.

Se você quer transformar seu site, seu WhatsApp e seus leads em uma máquina de vendas automática, o próximo passo é conversar com a ${company.name}${locationText}.

**👉 ${ctaLink}**`;
}

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
 * Remove seções finais genéricas e "## Próximo passo" existente
 */
function cleanGenericEndings(content: string): string {
  let cleanContent = content;
  
  // Remover seções finais genéricas
  for (const pattern of GENERIC_END_PATTERNS) {
    cleanContent = cleanContent.replace(pattern, '');
  }
  
  // Também remover qualquer "## Próximo passo" existente com conteúdo incorreto
  cleanContent = cleanContent.replace(/##\s*Próximo\s*passo[\s\S]*$/i, '');
  
  // Limpar espaços extras no final
  return cleanContent.trim();
}

/**
 * Garante que o artigo termine com o CTA obrigatório do contrato editorial.
 * Versão genérica (sem dados da empresa) - mantida para compatibilidade.
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
      if (ctaContent.includes('especialista') || ctaContent.includes('fale')) {
        console.log('[EDITORIAL CONTRACT] CTA já está válido');
        return content;
      }
    }
  }
  
  console.log('[EDITORIAL CONTRACT] CTA ausente ou inválido - aplicando auto-correção genérica');
  
  const cleanContent = cleanGenericEndings(content);
  const result = cleanContent + '\n\n' + MANDATORY_CTA_SECTION;
  
  console.log('[EDITORIAL CONTRACT] CTA obrigatório genérico anexado');
  
  return result;
}

/**
 * Garante CTA com dados personalizados da empresa.
 * Esta é a versão preferida quando temos informações do negócio.
 */
export function ensureCompanyCTA(content: string, company: CompanyInfo): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Se não tiver nome da empresa, usar versão genérica
  if (!company.name || company.name.trim() === '') {
    return ensureCTA(content);
  }

  console.log(`[EDITORIAL CONTRACT] Aplicando CTA personalizado para: ${company.name}`);
  
  const cleanContent = cleanGenericEndings(content);
  const companyCTA = generateCompanyCTA(company);
  const result = cleanContent + '\n\n' + companyCTA;
  
  console.log('[EDITORIAL CONTRACT] CTA personalizado com empresa anexado');
  
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
