/**
 * IMAGE ALT GENERATOR MODULE
 * Motor de Artigos de Autoridade Local - Sprint 3
 * 
 * Referência: docs/ARTICLE_ENGINE_MASTER.md
 * 
 * Gera ALT texts contextualizados com cidade + serviço + empresa
 * Padrão: "{{service}} por {{business}} em {{city}}"
 * 
 * Tipos de imagem suportados:
 * - hero: Imagem principal do artigo
 * - service: Imagem de serviço sendo executado
 * - team: Equipe profissional
 * - equipment: Equipamentos e ferramentas
 * - before_after: Antes e depois
 * - location: Localização/mapa
 */

// =============================================================================
// TIPOS
// =============================================================================

/**
 * Tipos de imagem suportados
 */
export type ImageType = 'hero' | 'service' | 'team' | 'equipment' | 'before_after' | 'location';

/**
 * Contexto para geração de ALT
 */
export interface ImageAltContext {
  service: string;
  businessName: string;
  city: string;
  niche: string;
  imageType: ImageType;
}

/**
 * ALT gerado com metadados
 */
export interface GeneratedAlt {
  alt: string;
  title?: string;
  caption?: string;
}

// =============================================================================
// PADRÕES DE ALT POR TIPO DE IMAGEM
// =============================================================================

/**
 * Padrões de ALT para cada tipo de imagem
 * Variação para evitar repetição
 */
const ALT_PATTERNS: Record<ImageType, string[]> = {
  
  // Imagem principal/hero
  hero: [
    "{{service}} profissional em {{city}} pela {{business}}",
    "Equipe de {{service}} da {{business}} atendendo em {{city}}",
    "{{business}}: {{service}} de qualidade em {{city}}",
    "Serviço especializado de {{service}} em {{city}} - {{business}}"
  ],
  
  // Imagem de serviço sendo executado
  service: [
    "{{service}} realizado pela {{business}} em {{city}}",
    "Serviço de {{service}} da {{business}} em {{city}}",
    "{{business}} executando {{service}} em {{city}}",
    "Profissional da {{business}} realizando {{service}}"
  ],
  
  // Equipe profissional
  team: [
    "Equipe profissional da {{business}} em {{city}}",
    "Time especializado em {{service}} da {{business}}",
    "Profissionais de {{service}} da {{business}} em {{city}}",
    "Técnicos qualificados da {{business}}"
  ],
  
  // Equipamentos e ferramentas
  equipment: [
    "Equipamento profissional para {{service}} usado pela {{business}}",
    "Ferramentas especializadas em {{service}} da {{business}}",
    "Tecnologia moderna para {{service}} em {{city}}",
    "Equipamentos de última geração da {{business}} para {{service}}"
  ],
  
  // Antes e depois
  before_after: [
    "Antes e depois de {{service}} pela {{business}} em {{city}}",
    "Resultado de {{service}} realizado pela {{business}}",
    "Transformação após {{service}} da {{business}} em {{city}}",
    "Comparativo antes e depois - {{service}} em {{city}}"
  ],
  
  // Localização/mapa
  location: [
    "{{business}} atendendo em {{city}}",
    "Área de cobertura da {{business}} em {{city}}",
    "{{service}} disponível em toda {{city}}",
    "Localização da {{business}} - {{service}} em {{city}}"
  ]
};

// =============================================================================
// PADRÕES DE CAPTION POR TIPO
// =============================================================================

const CAPTION_PATTERNS: Record<ImageType, string[]> = {
  hero: [
    "{{business}}: especialistas em {{service}} em {{city}}",
    "Seu parceiro de confiança para {{service}} em {{city}}"
  ],
  service: [
    "{{service}} profissional em {{city}}",
    "Qualidade garantida em {{service}}"
  ],
  team: [
    "Equipe qualificada da {{business}}",
    "Profissionais experientes em {{service}}"
  ],
  equipment: [
    "Equipamentos de última geração para {{service}}",
    "Tecnologia avançada para resultados superiores"
  ],
  before_after: [
    "Resultado comprovado de {{service}}",
    "Veja a transformação após nosso trabalho"
  ],
  location: [
    "Atendimento em toda {{city}}",
    "Cobertura completa na região"
  ]
};

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Substitui placeholders no padrão
 */
function replacePlaceholders(
  pattern: string,
  context: ImageAltContext
): string {
  return pattern
    .replace(/\{\{service\}\}/g, context.service)
    .replace(/\{\{business\}\}/g, context.businessName)
    .replace(/\{\{city\}\}/g, context.city)
    .replace(/\{\{niche\}\}/g, context.niche);
}

/**
 * Escolhe padrão aleatório do array
 */
function pickRandomPattern(patterns: string[]): string {
  const index = Math.floor(Math.random() * patterns.length);
  return patterns[index];
}

/**
 * Capitaliza primeira letra
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// FUNÇÃO PRINCIPAL: GENERATE IMAGE ALT
// =============================================================================

/**
 * Gera ALT text contextualizado para uma imagem
 * 
 * @param context - Contexto da imagem (serviço, empresa, cidade, tipo)
 * @returns ALT gerado com title e caption opcionais
 * 
 * @example
 * generateImageAlt({
 *   service: 'dedetização',
 *   businessName: 'Truly Nolen',
 *   city: 'São Paulo',
 *   niche: 'pest_control',
 *   imageType: 'service'
 * })
 * // { alt: 'Dedetização realizada pela Truly Nolen em São Paulo', title: '...', caption: '...' }
 */
export function generateImageAlt(context: ImageAltContext): GeneratedAlt {
  console.log(`[imageAltGenerator] Gerando ALT para tipo: ${context.imageType}`);
  
  // Obter padrões para o tipo de imagem
  const altPatterns = ALT_PATTERNS[context.imageType] || ALT_PATTERNS.service;
  const captionPatterns = CAPTION_PATTERNS[context.imageType] || CAPTION_PATTERNS.service;
  
  // Escolher padrões aleatórios
  const altPattern = pickRandomPattern(altPatterns);
  const captionPattern = pickRandomPattern(captionPatterns);
  
  // Substituir placeholders
  const alt = capitalizeFirst(replacePlaceholders(altPattern, context));
  const caption = capitalizeFirst(replacePlaceholders(captionPattern, context));
  
  // Gerar title (tooltip) mais curto
  const title = `${capitalizeFirst(context.service)} - ${context.businessName}`;
  
  const result: GeneratedAlt = { alt, title, caption };
  
  console.log(`[imageAltGenerator] ALT gerado: "${alt}"`);
  
  return result;
}

// =============================================================================
// FUNÇÃO: GENERATE CAPTION
// =============================================================================

/**
 * Gera caption descritiva para imagem
 * 
 * @param context - Contexto da imagem
 * @returns Caption string
 */
export function generateCaption(context: ImageAltContext): string {
  const patterns = CAPTION_PATTERNS[context.imageType] || CAPTION_PATTERNS.service;
  const pattern = pickRandomPattern(patterns);
  return capitalizeFirst(replacePlaceholders(pattern, context));
}

// =============================================================================
// FUNÇÃO: GENERATE MULTIPLE ALTS
// =============================================================================

/**
 * Gera múltiplos ALTs para um conjunto de imagens
 * 
 * @param context - Contexto base (sem imageType)
 * @param count - Quantidade de ALTs a gerar
 * @param preferredTypes - Tipos de imagem preferidos (opcional)
 * @returns Array de ALTs gerados
 * 
 * @example
 * generateMultipleAlts(
 *   { service: 'dedetização', businessName: 'Truly Nolen', city: 'São Paulo', niche: 'pest_control' },
 *   5
 * )
 * // [{ alt: '...', title: '...', caption: '...' }, ...]
 */
export function generateMultipleAlts(
  context: Omit<ImageAltContext, 'imageType'>,
  count: number,
  preferredTypes?: ImageType[]
): GeneratedAlt[] {
  console.log(`[imageAltGenerator] Gerando ${count} ALTs em batch`);
  
  // Tipos default se não especificados
  const defaultTypes: ImageType[] = [
    'hero',
    'service',
    'service',
    'equipment',
    'team',
    'location'
  ];
  
  const types = preferredTypes || defaultTypes;
  
  // Gerar ALTs para cada tipo solicitado
  const alts: GeneratedAlt[] = [];
  
  for (let i = 0; i < count; i++) {
    const imageType = types[i % types.length]; // Cicla pelos tipos disponíveis
    
    const alt = generateImageAlt({
      ...context,
      imageType
    });
    
    alts.push(alt);
  }
  
  console.log(`[imageAltGenerator] Batch concluído: ${alts.length} ALTs gerados`);
  
  return alts;
}

// =============================================================================
// FUNÇÃO: GENERATE ALT FOR NICHE
// =============================================================================

/**
 * Gera ALT com terminologia específica do nicho
 * 
 * @param context - Contexto da imagem
 * @returns ALT com terminologia do nicho
 */
export function generateNicheSpecificAlt(context: ImageAltContext): GeneratedAlt {
  // Mapeamento de termos específicos por nicho
  const nicheTerms: Record<string, string> = {
    pest_control: 'controle de pragas',
    plumbing: 'serviços hidráulicos',
    roofing: 'serviços de telhado',
    dental: 'odontologia',
    legal: 'serviços jurídicos',
    accounting: 'contabilidade',
    real_estate: 'imobiliária',
    automotive: 'mecânica automotiva',
    construction: 'construção civil',
    beauty: 'estética e beleza',
    education: 'educação',
    technology: 'tecnologia',
    image_consulting: 'consultoria de imagem'
  };
  
  // Usar termo do nicho se disponível
  const nicheTerm = nicheTerms[context.niche] || context.service;
  
  // Criar contexto enriquecido
  const enrichedContext: ImageAltContext = {
    ...context,
    service: nicheTerm
  };
  
  return generateImageAlt(enrichedContext);
}

// =============================================================================
// HELPERS PÚBLICOS
// =============================================================================

/**
 * Verifica se tipo de imagem é válido
 */
export function isValidImageType(type: string): type is ImageType {
  return ['hero', 'service', 'team', 'equipment', 'before_after', 'location'].includes(type);
}

/**
 * Retorna todos os tipos de imagem disponíveis
 */
export function getAvailableImageTypes(): ImageType[] {
  return ['hero', 'service', 'team', 'equipment', 'before_after', 'location'];
}

// =============================================================================
// PROMPT OPTIMIZATION FOR AI IMAGE GENERATION
// =============================================================================

/**
 * Optimizes a prompt for AI image generation (Lovable AI / Gemini)
 * Adds professional photography style and anti-futuristic rules
 */
export function optimizePromptForImageGen(
  prompt: string, 
  context: string,
  niche?: string
): string {
  // Niche-specific style additions
  const nicheStyles: Record<string, string> = {
    pest_control: 'pest control service, professional technician with equipment, realistic work environment',
    plumbing: 'plumbing repair, professional plumber at work, realistic tools and pipes',
    roofing: 'roofing installation, professional roofer on roof, realistic construction scene',
    dental: 'modern dental clinic, professional dentist with patient, clean medical environment',
    legal: 'professional law office, business meeting, corporate legal setting',
    accounting: 'professional accounting office, business financial documents, corporate setting',
    real_estate: 'real estate property, professional agent showing home, residential neighborhood',
    automotive: 'auto repair shop, professional mechanic working on car, realistic garage',
    construction: 'construction site, professional builders at work, realistic equipment',
    beauty: 'beauty salon, professional aesthetician with client, elegant spa environment'
  };
  
  const nicheStyle = niche && nicheStyles[niche] ? nicheStyles[niche] : 'professional business setting';
  
  // Quality modifiers for photorealistic output
  const qualityModifiers = [
    'Professional business photography',
    'High quality, 4K resolution',
    'Sharp focus, natural lighting',
    'Photorealistic, editorial style',
    'Clean composition, corporate aesthetic'
  ].join(', ');
  
  // Anti-futuristic rules for realism
  const restrictions = [
    'NO holograms or futuristic interfaces',
    'NO artificial glowing effects',
    'NO sci-fi or fantasy elements',
    'NO text or watermarks',
    'Real photographic style only'
  ].join('. ');
  
  return `${qualityModifiers}. ${prompt}. Style: ${nicheStyle}. Context: ${context}. ${restrictions}`;
}

/**
 * Generates an optimized image prompt from article context
 */
export function generateImagePrompt(
  service: string,
  city: string,
  context: string,
  niche?: string
): string {
  const basePrompt = `Professional service of ${service} in ${city}, ${context}`;
  return optimizePromptForImageGen(basePrompt, context, niche);
}
