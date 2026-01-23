/**
 * NICHE FILTER - Blindagem de Nicho
 * 
 * Impede contaminação de artigos com termos genéricos de marketing
 * quando o cliente NÃO é do nicho de marketing/agências.
 * 
 * REGRA: SEO deve ser INVISÍVEL ao leitor.
 */

// ============================================================================
// TERMOS PROIBIDOS POR CATEGORIA DE NICHO
// ============================================================================

export const FORBIDDEN_TERMS_BY_NICHE: Record<string, string[]> = {
  // Controle de pragas - nunca falar de marketing
  'controle_pragas': [
    'seo', 'google', 'marketing digital', 'agência', 'tráfego', 
    'inbound', 'leads', 'conversão', 'rankeamento', 'posicionamento',
    'primeira página', 'otimização', 'palavras-chave', 'backlink',
    'marketing de conteúdo', 'funil de vendas', 'landing page'
  ],
  
  // Advocacia/Jurídico
  'advocacia': [
    'seo', 'marketing digital', 'agência', 'tráfego pago', 
    'google ads', 'facebook ads', 'leads', 'inbound marketing',
    'funil', 'conversão', 'taxa de cliques'
  ],
  
  // Saúde (médicos, dentistas, etc.)
  'saude': [
    'seo', 'marketing digital', 'agência digital', 'google ads',
    'tráfego', 'leads', 'funil de vendas', 'conversão',
    'rankeamento', 'primeira página do google'
  ],
  
  // Construção civil
  'construcao': [
    'seo', 'marketing', 'agência', 'leads', 'funil',
    'tráfego pago', 'google ads', 'facebook ads', 'inbound'
  ],
  
  // Educação
  'educacao': [
    'seo', 'marketing digital', 'agência', 'tráfego pago',
    'leads', 'funil de vendas', 'conversão'
  ],
  
  // Alimentação/Restaurantes
  'alimentacao': [
    'seo', 'marketing digital', 'agência', 'tráfego',
    'rankeamento', 'primeira página', 'google ads'
  ],
  
  // Imobiliário
  'imobiliario': [
    'seo', 'marketing digital', 'agência de marketing',
    'tráfego pago', 'funil', 'inbound marketing'
  ],
  
  // Contabilidade
  'contabilidade': [
    'seo', 'marketing digital', 'agência', 'tráfego',
    'leads', 'google ads', 'facebook ads'
  ],
  
  // Pet/Veterinário
  'pet': [
    'seo', 'marketing digital', 'agência', 'tráfego pago',
    'leads', 'funil', 'rankeamento'
  ],
  
  // Beleza/Estética
  'beleza': [
    'seo', 'marketing digital', 'agência digital',
    'tráfego', 'leads', 'funil de vendas'
  ],
  
  // Tecnologia (sem restrições - pode falar de SEO)
  'tecnologia': [],
  
  // Marketing/Agências (sem restrições - é o nicho deles)
  'marketing': [],
  
  // Default: nichos não mapeados não têm restrição
  'default': []
};

// ============================================================================
// DETECÇÃO DE CATEGORIA DE NICHO
// ============================================================================

const NICHE_KEYWORDS: Record<string, string[]> = {
  'controle_pragas': [
    'praga', 'pragas', 'dedetiz', 'desinfec', 'desratiz', 
    'cupim', 'cupins', 'barata', 'baratas', 'rato', 'ratos',
    'formiga', 'formigas', 'mosquito', 'mosquitos', 'pulga', 'pulgas',
    'escorpião', 'escorpiões', 'aranha', 'aranhas', 'controle de pragas',
    'pest control', 'sanitização', 'imunização'
  ],
  'advocacia': [
    'advog', 'jurídic', 'direito', 'lei', 'tribunal',
    'processo', 'ação judicial', 'petição', 'contestação',
    'trabalhista', 'civil', 'penal', 'criminal', 'oab'
  ],
  'saude': [
    'médic', 'hospital', 'clínic', 'consult', 'saúde',
    'dentist', 'odonto', 'fisio', 'psicólog', 'nutricion',
    'enferm', 'farmác', 'laboratório', 'exame'
  ],
  'construcao': [
    'constru', 'obra', 'engenharia', 'arquitet', 'reform',
    'pedreiro', 'empreiteira', 'incorporadora', 'imóvel', 'imóveis',
    'residencial', 'comercial', 'industrial'
  ],
  'educacao': [
    'escola', 'colégio', 'universidade', 'faculdade', 'curso',
    'educação', 'ensino', 'professor', 'aula', 'treinamento',
    'capacitação', 'workshop'
  ],
  'alimentacao': [
    'restaurante', 'lanchonete', 'pizzaria', 'hamburgueria',
    'padaria', 'confeitaria', 'buffet', 'catering', 'delivery',
    'comida', 'gastronomia', 'culinária'
  ],
  'imobiliario': [
    'imobiliár', 'corretor', 'imóvel', 'imóveis', 'apartamento',
    'casa', 'terreno', 'lote', 'aluguel', 'venda', 'compra',
    'financiamento', 'escritura'
  ],
  'contabilidade': [
    'contab', 'contador', 'fiscal', 'tribut', 'imposto',
    'declaração', 'folha de pagamento', 'balancete', 'dre',
    'mei', 'simples nacional', 'lucro presumido'
  ],
  'pet': [
    'pet', 'veterinár', 'animal', 'cachorro', 'gato',
    'cão', 'felino', 'canino', 'banho', 'tosa',
    'petshop', 'pet shop', 'ração', 'vacina'
  ],
  'beleza': [
    'beleza', 'estética', 'salão', 'cabeleireiro', 'manicure',
    'pedicure', 'maquiagem', 'depilação', 'spa', 'massagem',
    'tratamento facial', 'tratamento corporal'
  ],
  'tecnologia': [
    'software', 'tecnologia', 'ti', 'desenvolvimento', 'programação',
    'app', 'aplicativo', 'sistema', 'saas', 'startup',
    'digital', 'inovação'
  ],
  'marketing': [
    'marketing', 'agência', 'publicidade', 'propaganda', 'mídia',
    'social media', 'branding', 'design', 'comunicação',
    'assessoria de imprensa', 'relações públicas'
  ]
};

/**
 * Detecta a categoria de nicho baseado no texto do perfil
 */
export function detectNicheCategory(
  niche: string | null, 
  services: string[] | string | null
): string {
  // Normalizar input
  const servicesArray = Array.isArray(services) ? services : (services ? [services] : []);
  const text = `${niche || ''} ${servicesArray.join(' ')}`.toLowerCase();
  
  if (!text.trim()) {
    return 'default';
  }

  // Verificar cada categoria
  for (const [category, keywords] of Object.entries(NICHE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return 'default';
}

// ============================================================================
// FILTRAGEM DE TERMOS
// ============================================================================

/**
 * Filtra termos de SEO/SERP removendo termos proibidos para o nicho
 */
export function filterTermsByNiche(
  terms: string[], 
  nicheCategory: string
): string[] {
  const forbidden = FORBIDDEN_TERMS_BY_NICHE[nicheCategory] || 
                    FORBIDDEN_TERMS_BY_NICHE['default'] || 
                    [];
  
  if (forbidden.length === 0) {
    return terms; // Nichos de marketing não têm restrição
  }

  return terms.filter(term => {
    const termLower = term.toLowerCase();
    // Verificar se algum termo proibido está contido no termo
    return !forbidden.some(f => termLower.includes(f.toLowerCase()));
  });
}

/**
 * Verifica se um termo específico é proibido para o nicho
 */
export function isTermForbidden(
  term: string, 
  nicheCategory: string
): boolean {
  const forbidden = FORBIDDEN_TERMS_BY_NICHE[nicheCategory] || [];
  const termLower = term.toLowerCase();
  return forbidden.some(f => termLower.includes(f.toLowerCase()));
}

/**
 * Retorna lista de termos proibidos para um nicho
 */
export function getForbiddenTerms(nicheCategory: string): string[] {
  return FORBIDDEN_TERMS_BY_NICHE[nicheCategory] || [];
}

// ============================================================================
// VALIDAÇÃO DE CONTEÚDO
// ============================================================================

/**
 * Verifica se o conteúdo contém termos proibidos para o nicho
 * Retorna lista de violações encontradas
 */
export function findNicheViolations(
  content: string, 
  nicheCategory: string
): string[] {
  const forbidden = FORBIDDEN_TERMS_BY_NICHE[nicheCategory] || [];
  if (forbidden.length === 0) {
    return [];
  }

  const contentLower = content.toLowerCase();
  const violations: string[] = [];

  for (const term of forbidden) {
    // Usar regex para encontrar palavras completas
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(contentLower)) {
      violations.push(term);
    }
  }

  return [...new Set(violations)]; // Remover duplicatas
}

/**
 * Remove termos proibidos do conteúdo (para sanitização)
 * USAR COM CUIDADO - pode alterar significado do texto
 */
export function sanitizeContentForNiche(
  content: string, 
  nicheCategory: string
): { content: string; removed: string[] } {
  const violations = findNicheViolations(content, nicheCategory);
  
  if (violations.length === 0) {
    return { content, removed: [] };
  }

  let sanitized = content;
  for (const term of violations) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '');
  }

  // Limpar espaços duplos e pontuação órfã
  sanitized = sanitized
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();

  return { content: sanitized, removed: violations };
}
