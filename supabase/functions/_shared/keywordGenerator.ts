// Keyword Generator V1.0
// Gera palavras-chave automaticamente baseado no perfil do negócio

export interface BusinessProfile {
  company_name?: string | null;
  niche?: string | null;
  city?: string | null;
  services?: string[] | null;
  long_description?: string | null;
}

/**
 * Gera palavras-chave automaticamente baseado no tema e perfil do negócio
 * Usado quando o usuário não fornece keywords manualmente
 */
export function generateAutoKeywords(
  theme: string,
  profile: BusinessProfile
): { primary: string; secondary: string[] } {
  const niche = profile.niche || 'serviços';
  const city = profile.city || '';
  const cleanTheme = theme.toLowerCase().trim();
  
  // Palavra-chave principal: [tema] + [cidade se houver]
  const primary = city 
    ? `${cleanTheme} em ${city.toLowerCase()}`
    : cleanTheme;
  
  // Palavras-chave secundárias baseadas no nicho e serviços
  const secondarySet = new Set<string>();
  
  // Adicionar nicho + profissional
  secondarySet.add(`${niche.toLowerCase()} profissional`);
  
  // Adicionar serviços (máximo 2)
  if (profile.services && Array.isArray(profile.services)) {
    profile.services.slice(0, 2).forEach(service => {
      if (service) secondarySet.add(service.toLowerCase());
    });
  }
  
  // Adicionar nicho + cidade se houver cidade
  if (city) {
    secondarySet.add(`${niche.toLowerCase()} ${city.toLowerCase()}`);
  }
  
  // Adicionar tema + nicho (variação)
  secondarySet.add(`${cleanTheme} ${niche.toLowerCase()}`);
  
  // Remover a keyword primária das secundárias
  secondarySet.delete(primary);
  
  return { 
    primary, 
    secondary: Array.from(secondarySet).slice(0, 4) // Máximo 4 secundárias
  };
}

/**
 * Combina keywords geradas automaticamente com keywords fornecidas
 */
export function mergeKeywords(
  providedKeywords: string[] | undefined,
  autoKeywords: { primary: string; secondary: string[] }
): string[] {
  if (providedKeywords && providedKeywords.length > 0) {
    return providedKeywords;
  }
  return [autoKeywords.primary, ...autoKeywords.secondary];
}
