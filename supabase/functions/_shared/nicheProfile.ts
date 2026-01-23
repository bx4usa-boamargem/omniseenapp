// ═══════════════════════════════════════════════════════════════════
// NICHE PROFILE: Motor de Pontuação por Perfil de Nicho
// ═══════════════════════════════════════════════════════════════════

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Niche Profile structure from database
 */
export interface NicheProfile {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  intent: 'local_service' | 'informational' | 'ecommerce' | 'b2b';
  minWords: number;
  maxWords: number;
  minH2: number;
  maxH2: number;
  minParagraphs: number;
  minImages: number;
  minScore: number;      // Score floor - never drops below this
  targetScore: number;   // Target score for the niche
  allowedEntities: string[];
  forbiddenEntities: string[];
  seedKeywords: string[];
}

/**
 * Result of applying score floor
 */
export interface ScoreFloorResult {
  score: number;
  floorApplied: boolean;
  originalScore: number;
  reason?: string;
}

/**
 * Content validation result for niche
 */
export interface NicheValidationResult {
  valid: boolean;
  violations: string[];
  violationCount: number;
}

// Default profile when none is found
const DEFAULT_NICHE_PROFILE: NicheProfile = {
  id: 'default',
  name: 'default',
  displayName: 'Geral',
  description: 'Perfil padrão',
  intent: 'informational',
  minWords: 1200,
  maxWords: 3000,
  minH2: 6,
  maxH2: 10,
  minParagraphs: 10,
  minImages: 2,
  minScore: 50,
  targetScore: 70,
  allowedEntities: [],
  forbiddenEntities: ['seo', 'marketing digital', 'agência de marketing', 'tráfego pago', 'google ads', 'leads', 'funil de vendas'],
  seedKeywords: []
};

/**
 * Convert database row to NicheProfile interface
 */
function dbRowToNicheProfile(row: Record<string, unknown>): NicheProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    displayName: row.display_name as string,
    description: row.description as string | null,
    intent: row.intent as NicheProfile['intent'],
    minWords: row.min_words as number,
    maxWords: row.max_words as number,
    minH2: row.min_h2 as number,
    maxH2: row.max_h2 as number,
    minParagraphs: row.min_paragraphs as number,
    minImages: row.min_images as number,
    minScore: row.min_score as number,
    targetScore: row.target_score as number,
    allowedEntities: (row.allowed_entities as string[]) || [],
    forbiddenEntities: (row.forbidden_entities as string[]) || [],
    seedKeywords: (row.seed_keywords as string[]) || []
  };
}

/**
 * Get niche profile for a blog
 * Priority: blog.niche_profile_id > business_profile.niche_profile_id > auto-detect > default
 */
export async function getNicheProfile(
  supabase: SupabaseClient,
  blogId: string
): Promise<NicheProfile> {
  try {
    // 1. Try to get from blog's niche_profile_id
    const { data: blogData } = await supabase
      .from('blogs')
      .select('niche_profile_id, niche_profiles(*)')
      .eq('id', blogId)
      .single();

    if (blogData?.niche_profiles && typeof blogData.niche_profiles === 'object' && !Array.isArray(blogData.niche_profiles)) {
      const nicheData = blogData.niche_profiles as Record<string, unknown>;
      console.log(`[NICHE] Using blog profile: ${nicheData.display_name}`);
      return dbRowToNicheProfile(nicheData);
    }

    // 2. Try to get from business_profile's niche_profile_id
    const { data: profileData } = await supabase
      .from('business_profile')
      .select('niche_profile_id, niche_profiles(*), niche, services')
      .eq('blog_id', blogId)
      .single();

    if (profileData?.niche_profiles && typeof profileData.niche_profiles === 'object' && !Array.isArray(profileData.niche_profiles)) {
      const nicheData = profileData.niche_profiles as Record<string, unknown>;
      console.log(`[NICHE] Using business_profile profile: ${nicheData.display_name}`);
      return dbRowToNicheProfile(nicheData);
    }

    // 3. Auto-detect from niche/services in business_profile
    if (profileData?.niche || profileData?.services) {
      const detectedProfile = await detectNicheFromBusinessData(
        supabase,
        profileData.niche as string | null,
        profileData.services as string[] | null
      );
      if (detectedProfile) {
        console.log(`[NICHE] Auto-detected: ${detectedProfile.displayName}`);
        return detectedProfile;
      }
    }

    // 4. Return default profile
    const { data: defaultProfile } = await supabase
      .from('niche_profiles')
      .select('*')
      .eq('name', 'default')
      .single();

    if (defaultProfile) {
      console.log('[NICHE] Using default profile');
      return dbRowToNicheProfile(defaultProfile);
    }

    return DEFAULT_NICHE_PROFILE;
  } catch (error) {
    console.error('[NICHE] Error fetching profile:', error);
    return DEFAULT_NICHE_PROFILE;
  }
}

/**
 * Auto-detect niche profile from business data
 */
async function detectNicheFromBusinessData(
  supabase: SupabaseClient,
  niche: string | null,
  services: string[] | null
): Promise<NicheProfile | null> {
  const searchText = [
    niche || '',
    ...(services || [])
  ].join(' ').toLowerCase();

  if (!searchText.trim()) return null;

  // Keyword mapping to niche names
  const nicheKeywords: Record<string, string[]> = {
    'controle_pragas': ['dedetização', 'dedetizadora', 'pragas', 'cupim', 'desratização', 'desinsetização', 'pest control'],
    'advocacia': ['advogado', 'advocacia', 'escritório de advocacia', 'jurídico', 'direito'],
    'saude': ['médico', 'clínica médica', 'consultório', 'hospital', 'saúde'],
    'odontologia': ['dentista', 'odontologia', 'clínica odontológica', 'dental'],
    'estetica': ['estética', 'beleza', 'spa', 'salão', 'harmonização', 'botox'],
    'construcao': ['construção', 'construtora', 'reforma', 'empreiteira', 'obra'],
    'automotivo': ['oficina', 'mecânico', 'autopeças', 'veículos', 'carros'],
    'contabilidade': ['contador', 'contabilidade', 'escritório contábil', 'fiscal'],
    'imobiliario': ['imobiliária', 'imóveis', 'corretor', 'aluguel', 'venda de imóveis'],
    'educacao': ['escola', 'curso', 'educação', 'treinamento', 'formação'],
    'tecnologia': ['software', 'ti', 'tecnologia', 'desenvolvimento', 'sistemas'],
    'marketing': ['marketing', 'agência', 'publicidade', 'comunicação', 'ads'],
    'alimentacao': ['restaurante', 'delivery', 'comida', 'gastronomia', 'bar']
  };

  // Find matching niche
  for (const [nicheName, keywords] of Object.entries(nicheKeywords)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        const { data: profile } = await supabase
          .from('niche_profiles')
          .select('*')
          .eq('name', nicheName)
          .single();

        if (profile) {
          return dbRowToNicheProfile(profile);
        }
      }
    }
  }

  return null;
}

/**
 * Apply score floor based on niche profile
 * Score never drops below niche's min_score automatically
 */
export function applyScoreFloor(
  rawScore: number,
  nicheProfile: NicheProfile
): ScoreFloorResult {
  const floor = nicheProfile.minScore;
  
  if (rawScore < floor) {
    return {
      score: floor,
      floorApplied: true,
      originalScore: rawScore,
      reason: `floor_applied_by_niche_${nicheProfile.name}`
    };
  }

  return {
    score: rawScore,
    floorApplied: false,
    originalScore: rawScore
  };
}

/**
 * Filter terms by niche profile
 * Removes forbidden terms and optionally filters to allowed only
 */
export function filterTermsByProfile(
  terms: string[],
  nicheProfile: NicheProfile,
  options: { strictAllowedOnly?: boolean } = {}
): string[] {
  const forbidden = nicheProfile.forbiddenEntities.map(t => t.toLowerCase());
  const allowed = nicheProfile.allowedEntities.map(t => t.toLowerCase());
  
  return terms.filter(term => {
    const normalizedTerm = term.toLowerCase();
    
    // Always reject forbidden terms
    if (forbidden.some(f => normalizedTerm.includes(f) || f.includes(normalizedTerm))) {
      return false;
    }
    
    // If strict mode and we have allowed list, only keep allowed terms
    if (options.strictAllowedOnly && allowed.length > 0) {
      return allowed.some(a => normalizedTerm.includes(a) || a.includes(normalizedTerm));
    }
    
    return true;
  });
}

/**
 * Check if a single term is valid for the niche
 */
export function isTermValidForNiche(
  term: string,
  nicheProfile: NicheProfile
): boolean {
  const normalizedTerm = term.toLowerCase();
  const forbidden = nicheProfile.forbiddenEntities.map(t => t.toLowerCase());
  
  return !forbidden.some(f => normalizedTerm.includes(f) || f.includes(normalizedTerm));
}

/**
 * Validate content against niche profile
 * Returns violations found in content
 */
export function validateContentForNiche(
  content: string,
  nicheProfile: NicheProfile
): NicheValidationResult {
  const normalizedContent = content.toLowerCase();
  const violations: string[] = [];
  
  for (const forbidden of nicheProfile.forbiddenEntities) {
    const normalizedForbidden = forbidden.toLowerCase();
    // Use word boundary matching
    const regex = new RegExp(`\\\\b${escapeRegex(normalizedForbidden)}\\\\b`, 'gi');
    
    if (regex.test(normalizedContent)) {
      violations.push(forbidden);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
    violationCount: violations.length
  };
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get niche-aware prompt instructions for AI
 */
export function getNichePromptInstructions(nicheProfile: NicheProfile): string {
  const lines: string[] = [
    `REGRAS DO NICHO "${nicheProfile.displayName}":`,
    `- Tipo de conteúdo: ${nicheProfile.intent}`,
    `- Palavras: ${nicheProfile.minWords} - ${nicheProfile.maxWords}`,
    `- H2: ${nicheProfile.minH2} - ${nicheProfile.maxH2}`,
    `- Parágrafos mínimos: ${nicheProfile.minParagraphs}`,
    `- Imagens mínimas: ${nicheProfile.minImages}`,
    `- Score alvo: ${nicheProfile.targetScore}`
  ];

  if (nicheProfile.allowedEntities.length > 0) {
    lines.push(`\nTERMOS PERMITIDOS (use preferencialmente):`);
    lines.push(nicheProfile.allowedEntities.slice(0, 20).join(', '));
  }

  if (nicheProfile.forbiddenEntities.length > 0) {
    lines.push(`\nTERMOS PROIBIDOS (NUNCA use):`);
    lines.push(nicheProfile.forbiddenEntities.join(', '));
  }

  return lines.join('\n');
}

/**
 * Get all niche profiles from database
 */
export async function getAllNicheProfiles(
  supabase: SupabaseClient
): Promise<NicheProfile[]> {
  const { data, error } = await supabase
    .from('niche_profiles')
    .select('*')
    .order('display_name');

  if (error) {
    console.error('[NICHE] Error fetching all profiles:', error);
    return [DEFAULT_NICHE_PROFILE];
  }

  return data.map(dbRowToNicheProfile);
}

/**
 * Update blog's niche profile
 */
export async function updateBlogNicheProfile(
  supabase: SupabaseClient,
  blogId: string,
  nicheProfileId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('blogs')
    .update({ niche_profile_id: nicheProfileId })
    .eq('id', blogId);

  if (error) {
    console.error('[NICHE] Error updating blog profile:', error);
    return false;
  }

  return true;
}
