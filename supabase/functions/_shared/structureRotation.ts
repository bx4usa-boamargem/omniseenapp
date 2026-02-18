// DEPRECATED – Replaced by editorialOrchestrator.ts (Elite Engine V2)
// Do not use. Maintained temporarily for reference.

/**
 * STRUCTURE ROTATION MODULE
 * 
 * Responsável por:
 * 1. Determinar o próximo tipo de estrutura para um artigo
 * 2. Garantir rotação cíclica entre os 4 modelos
 * 3. Evitar repetição consecutiva de estruturas
 * 4. Buscar template correspondente na tabela activity_structure_templates
 */

// deno-lint-ignore-file no-explicit-any

export type StructureType = 'educational' | 'problem_solution' | 'guide' | 'comparison';

export interface StructureTemplate {
  id: string;
  activity_slug: string;
  structure_type: StructureType;
  display_name: string;
  required_sections: string[];
  validation_rules: Record<string, any>;
  generation_prompt: string;
}

// Ordem fixa de rotação - nunca muda
const STRUCTURE_ROTATION: StructureType[] = [
  'educational',
  'problem_solution', 
  'guide',
  'comparison'
];

// Mapeamento de nichos para activity_slug
const NICHE_TO_ACTIVITY: Record<string, string> = {
  // Serviços gerais
  'serviços': 'servicos_gerais',
  'servicos': 'servicos_gerais',
  'geral': 'servicos_gerais',
  'outros': 'servicos_gerais',
  
  // Saúde
  'saúde': 'saude',
  'saude': 'saude',
  'medicina': 'saude',
  'médico': 'saude',
  'medico': 'saude',
  'clínica': 'saude',
  'clinica': 'saude',
  'hospital': 'saude',
  'dentista': 'saude',
  'odontologia': 'saude',
  'fisioterapia': 'saude',
  'psicologia': 'saude',
  'nutrição': 'saude',
  'nutricao': 'saude',
  
  // Advocacia
  'advocacia': 'advocacia',
  'advogado': 'advocacia',
  'jurídico': 'advocacia',
  'juridico': 'advocacia',
  'direito': 'advocacia',
  'legal': 'advocacia',
  
  // Construção
  'construção': 'construcao',
  'construcao': 'construcao',
  'reforma': 'construcao',
  'arquitetura': 'construcao',
  'engenharia': 'construcao',
  'empreiteira': 'construcao',
  
  // Home services
  'desentupidora': 'home_services',
  'desentupimento': 'home_services',
  'encanador': 'home_services',
  'hidráulica': 'home_services',
  'hidraulica': 'home_services',
  'eletricista': 'home_services',
  'elétrica': 'home_services',
  'eletrica': 'home_services',
  'limpeza': 'home_services',
  'manutenção': 'home_services',
  'manutencao': 'home_services',
  'ar condicionado': 'home_services',
  'refrigeração': 'home_services',
  'refrigeracao': 'home_services',
  'controle de pragas': 'home_services',
  'dedetização': 'home_services',
  'dedetizacao': 'home_services',
  
  // Tecnologia
  'tecnologia': 'tecnologia',
  'tech': 'tecnologia',
  'ti': 'tecnologia',
  'software': 'tecnologia',
  'desenvolvimento': 'tecnologia',
  'programação': 'tecnologia',
  'programacao': 'tecnologia',
  'aplicativo': 'tecnologia',
  'app': 'tecnologia',
  'saas': 'tecnologia',
  
  // Educação
  'educação': 'educacao',
  'educacao': 'educacao',
  'escola': 'educacao',
  'curso': 'educacao',
  'treinamento': 'educacao',
  'ensino': 'educacao',
  'professor': 'educacao',
  'aula': 'educacao',
  
  // Finanças
  'finanças': 'financas',
  'financas': 'financas',
  'contabilidade': 'financas',
  'contador': 'financas',
  'investimento': 'financas',
  'banco': 'financas',
  'crédito': 'financas',
  'credito': 'financas',
  
  // E-commerce
  'e-commerce': 'ecommerce',
  'ecommerce': 'ecommerce',
  'loja virtual': 'ecommerce',
  'loja online': 'ecommerce',
  'marketplace': 'ecommerce',
  'vendas online': 'ecommerce',
  
  // Alimentação
  'alimentação': 'alimentacao',
  'alimentacao': 'alimentacao',
  'restaurante': 'alimentacao',
  'gastronomia': 'alimentacao',
  'culinária': 'alimentacao',
  'culinaria': 'alimentacao',
  'café': 'alimentacao',
  'cafe': 'alimentacao',
  'padaria': 'alimentacao',
  'delivery': 'alimentacao',
  'food': 'alimentacao',
};

/**
 * Mapeia um nicho para o activity_slug correspondente
 */
export function mapNicheToActivity(niche?: string, services?: string): string {
  if (!niche && !services) return 'servicos_gerais';
  
  const searchText = `${niche || ''} ${services || ''}`.toLowerCase();
  
  // Procurar match direto
  for (const [keyword, activity] of Object.entries(NICHE_TO_ACTIVITY)) {
    if (searchText.includes(keyword)) {
      return activity;
    }
  }
  
  return 'servicos_gerais';
}

/**
 * Busca o último tipo de estrutura usado por um blog
 */
export async function getLastStructureType(
  supabase: any, 
  blogId: string
): Promise<StructureType | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('article_structure_type')
    .eq('blog_id', blogId)
    .not('article_structure_type', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('[ROTATION] Error fetching last structure:', error);
    return null;
  }
  
  return data?.article_structure_type as StructureType | null;
}

/**
 * Calcula o próximo tipo de estrutura baseado na rotação cíclica
 */
export function calculateNextStructureType(lastType: StructureType | null): StructureType {
  if (!lastType) {
    // Primeira vez - começar com educational
    return 'educational';
  }
  
  const currentIndex = STRUCTURE_ROTATION.indexOf(lastType);
  
  if (currentIndex === -1) {
    // Tipo desconhecido - reset para educational
    return 'educational';
  }
  
  // Próximo na rotação (cicla de volta ao início)
  const nextIndex = (currentIndex + 1) % STRUCTURE_ROTATION.length;
  return STRUCTURE_ROTATION[nextIndex];
}

/**
 * Obtém o próximo tipo de estrutura para um blog
 * 
 * Fluxo:
 * 1. Buscar último artigo do blog
 * 2. Calcular próximo tipo na rotação
 * 3. Retornar tipo garantindo não-repetição
 */
export async function getNextStructureType(
  supabase: any,
  blogId: string
): Promise<StructureType> {
  const lastType = await getLastStructureType(supabase, blogId);
  const nextType = calculateNextStructureType(lastType);
  
  console.log(`[ROTATION] Blog ${blogId}: Last=${lastType || 'none'} → Next=${nextType}`);
  
  return nextType;
}

/**
 * Busca o template de estrutura para uma atividade e tipo específicos
 */
export async function getStructureTemplate(
  supabase: any,
  activitySlug: string,
  structureType: StructureType
): Promise<StructureTemplate | null> {
  const { data, error } = await supabase
    .from('activity_structure_templates')
    .select('*')
    .eq('activity_slug', activitySlug)
    .eq('structure_type', structureType)
    .maybeSingle();
  
  if (error) {
    console.error('[ROTATION] Error fetching template:', error);
    return null;
  }
  
  if (!data) {
    // Fallback para servicos_gerais se não encontrar
    console.log(`[ROTATION] Template not found for ${activitySlug}/${structureType}, trying fallback`);
    
    const { data: fallback } = await supabase
      .from('activity_structure_templates')
      .select('*')
      .eq('activity_slug', 'servicos_gerais')
      .eq('structure_type', structureType)
      .maybeSingle();
    
    return fallback as StructureTemplate | null;
  }
  
  return data as StructureTemplate;
}

/**
 * Função completa: determina próximo tipo E busca template
 */
export async function getNextStructureWithTemplate(
  supabase: any,
  blogId: string,
  niche?: string,
  services?: string
): Promise<{
  structureType: StructureType;
  template: StructureTemplate | null;
  activitySlug: string;
}> {
  // 1. Determinar próximo tipo na rotação
  const structureType = await getNextStructureType(supabase, blogId);
  
  // 2. Mapear nicho para atividade
  const activitySlug = mapNicheToActivity(niche, services);
  console.log(`[ROTATION] Mapped niche "${niche}" + services "${services}" → ${activitySlug}`);
  
  // 3. Buscar template correspondente
  const template = await getStructureTemplate(supabase, activitySlug, structureType);
  
  return {
    structureType,
    template,
    activitySlug
  };
}

/**
 * Obter estatísticas de distribuição de estruturas para um blog
 */
export async function getStructureDistribution(
  supabase: any,
  blogId: string
): Promise<Record<StructureType, number>> {
  const { data, error } = await supabase
    .from('articles')
    .select('article_structure_type')
    .eq('blog_id', blogId)
    .not('article_structure_type', 'is', null);
  
  const distribution: Record<StructureType, number> = {
    educational: 0,
    problem_solution: 0,
    guide: 0,
    comparison: 0
  };
  
  if (error || !data) return distribution;
  
  for (const article of data) {
    const type = article.article_structure_type as StructureType;
    if (type && distribution[type] !== undefined) {
      distribution[type]++;
    }
  }
  
  return distribution;
}
