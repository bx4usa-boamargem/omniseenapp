// DEPRECATED – Replaced by editorialOrchestrator.ts (Elite Engine V2)
// Do not use. Maintained temporarily for reference.

/**
 * Editorial Rotation Module
 * 
 * Implements smart rotation of editorial models for articles generated via Radar/Funnel.
 * Ensures content diversity by alternating between:
 * - traditional: Classic SEO & Authority articles
 * - strategic: Conversion-focused impact articles  
 * - visual_guided: Mobile-first visual articles
 */

export type EditorialModel = 'traditional' | 'strategic' | 'visual_guided';

// Rotation order
const EDITORIAL_ROTATION: EditorialModel[] = [
  'traditional',
  'strategic', 
  'visual_guided'
];

// Niche to preferred model mapping
const NICHE_PREFERRED_MODEL: Record<string, EditorialModel> = {
  // Formal/Technical niches prefer traditional
  'advocacia': 'traditional',
  'advogado': 'traditional',
  'juridico': 'traditional',
  'contabilidade': 'traditional',
  'contador': 'traditional',
  'saude': 'traditional',
  'medicina': 'traditional',
  'medico': 'traditional',
  'odontologia': 'traditional',
  'dentista': 'traditional',
  'engenharia': 'traditional',
  'arquitetura': 'traditional',
  
  // Conversion-focused niches prefer strategic
  'tecnologia': 'strategic',
  'software': 'strategic',
  'saas': 'strategic',
  'marketing': 'strategic',
  'vendas': 'strategic',
  'construcao': 'strategic',
  'reforma': 'strategic',
  'imobiliaria': 'strategic',
  'imoveis': 'strategic',
  'financeiro': 'strategic',
  'investimentos': 'strategic',
  'seguros': 'strategic',
  'consultoria': 'strategic',
  
  // Visual niches prefer visual_guided
  'estetica': 'visual_guided',
  'beleza': 'visual_guided',
  'moda': 'visual_guided',
  'alimentacao': 'visual_guided',
  'gastronomia': 'visual_guided',
  'restaurante': 'visual_guided',
  'fitness': 'visual_guided',
  'academia': 'visual_guided',
  'fotografia': 'visual_guided',
  'design': 'visual_guided',
  'decoracao': 'visual_guided',
  'turismo': 'visual_guided',
  'viagem': 'visual_guided',
  'pet': 'visual_guided',
  'veterinario': 'visual_guided',
};

/**
 * Get the last editorial model used by a blog
 */
export async function getLastEditorialModel(
  supabase: any, 
  blogId: string
): Promise<EditorialModel | null> {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('article_structure_type')
      .eq('blog_id', blogId)
      .not('article_structure_type', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.article_structure_type) {
      return null;
    }

    // Map structure types to editorial models
    const structureToModel: Record<string, EditorialModel> = {
      'traditional': 'traditional',
      'strategic': 'strategic',
      'visual_guided': 'visual_guided',
      'classic_seo': 'traditional',
      'impact_conversion': 'strategic',
      'mobile_visual': 'visual_guided',
    };

    return structureToModel[data.article_structure_type] || null;
  } catch (err) {
    console.error('[editorialRotation] Error getting last model:', err);
    return null;
  }
}

/**
 * Get recent editorial models used by a blog (for anti-repetition logic)
 */
export async function getRecentEditorialModels(
  supabase: any,
  blogId: string,
  limit: number = 3
): Promise<EditorialModel[]> {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('article_structure_type')
      .eq('blog_id', blogId)
      .not('article_structure_type', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    const structureToModel: Record<string, EditorialModel> = {
      'traditional': 'traditional',
      'strategic': 'strategic',
      'visual_guided': 'visual_guided',
      'classic_seo': 'traditional',
      'impact_conversion': 'strategic',
      'mobile_visual': 'visual_guided',
    };

    return data
      .map((d: any) => structureToModel[d.article_structure_type])
      .filter((m: EditorialModel | undefined): m is EditorialModel => !!m);
  } catch (err) {
    console.error('[editorialRotation] Error getting recent models:', err);
    return [];
  }
}

/**
 * Get editorial model distribution for a blog
 */
export async function getEditorialDistribution(
  supabase: any,
  blogId: string
): Promise<Record<EditorialModel, number>> {
  const distribution: Record<EditorialModel, number> = {
    traditional: 0,
    strategic: 0,
    visual_guided: 0,
  };

  try {
    const { data, error } = await supabase
      .from('articles')
      .select('article_structure_type')
      .eq('blog_id', blogId)
      .not('article_structure_type', 'is', null);

    if (error || !data) {
      return distribution;
    }

    const structureToModel: Record<string, EditorialModel> = {
      'traditional': 'traditional',
      'strategic': 'strategic',
      'visual_guided': 'visual_guided',
      'classic_seo': 'traditional',
      'impact_conversion': 'strategic',
      'mobile_visual': 'visual_guided',
    };

    for (const row of data) {
      const model = structureToModel[row.article_structure_type];
      if (model) {
        distribution[model]++;
      }
    }

    return distribution;
  } catch (err) {
    console.error('[editorialRotation] Error getting distribution:', err);
    return distribution;
  }
}

/**
 * Calculate the next editorial model in rotation
 */
export function calculateNextEditorialModel(
  lastModel: EditorialModel | null,
  niche?: string
): EditorialModel {
  // If no history, use niche preference or default to traditional
  if (!lastModel) {
    if (niche) {
      const normalized = niche.toLowerCase().trim();
      return NICHE_PREFERRED_MODEL[normalized] || 'traditional';
    }
    return 'traditional';
  }

  // Rotate to next in sequence
  const currentIndex = EDITORIAL_ROTATION.indexOf(lastModel);
  const nextIndex = (currentIndex + 1) % EDITORIAL_ROTATION.length;
  return EDITORIAL_ROTATION[nextIndex];
}

/**
 * Check if all models in array are the same (anti-repetition)
 */
function allSame(models: EditorialModel[]): boolean {
  if (models.length < 2) return false;
  return models.every(m => m === models[0]);
}

/**
 * Find the least used model in distribution
 */
function findLeastUsed(distribution: Record<EditorialModel, number>): EditorialModel {
  let minModel: EditorialModel = 'traditional';
  let minCount = Infinity;

  for (const model of EDITORIAL_ROTATION) {
    if (distribution[model] < minCount) {
      minCount = distribution[model];
      minModel = model;
    }
  }

  return minModel;
}

/**
 * Get next editorial model with smart rotation
 * Considers:
 * 1. Blog history (avoids 3x repetition)
 * 2. Niche preference (initial weight)
 * 3. Distribution balance (long-term)
 */
export async function getNextEditorialModel(
  supabase: any,
  blogId: string,
  niche?: string
): Promise<EditorialModel> {
  try {
    // 1. Get recent models (last 3)
    const recentModels = await getRecentEditorialModels(supabase, blogId, 3);
    console.log(`[editorialRotation] Recent models for ${blogId}:`, recentModels);

    // 2. If all recent are the same, force rotation
    if (recentModels.length >= 3 && allSame(recentModels)) {
      const forced = calculateNextEditorialModel(recentModels[0], niche);
      console.log(`[editorialRotation] Forcing rotation from ${recentModels[0]} to ${forced}`);
      return forced;
    }

    // 3. Get distribution for balancing
    const distribution = await getEditorialDistribution(supabase, blogId);
    console.log(`[editorialRotation] Distribution:`, distribution);

    // 4. Calculate total articles
    const totalArticles = Object.values(distribution).reduce((a, b) => a + b, 0);

    // 5. If new blog (< 6 articles), use simple rotation with niche preference
    if (totalArticles < 6) {
      const lastModel = recentModels[0] || null;
      const next = calculateNextEditorialModel(lastModel, niche);
      console.log(`[editorialRotation] New blog, simple rotation: ${next}`);
      return next;
    }

    // 6. Find least used model
    const leastUsed = findLeastUsed(distribution);
    
    // 7. Get niche preference
    const nicheNormalized = niche?.toLowerCase().trim();
    const nichePreferred = nicheNormalized ? NICHE_PREFERRED_MODEL[nicheNormalized] : undefined;

    // 8. Weighted selection:
    // - If least used matches niche preference, use it (strong signal)
    // - If last model is not least used, use least used (balance)
    // - Otherwise, simple rotation
    const lastModel = recentModels[0] || null;

    if (leastUsed === nichePreferred) {
      console.log(`[editorialRotation] Using niche-preferred least-used: ${leastUsed}`);
      return leastUsed;
    }

    if (lastModel !== leastUsed) {
      console.log(`[editorialRotation] Balancing to least used: ${leastUsed}`);
      return leastUsed;
    }

    // Simple rotation as fallback
    const next = calculateNextEditorialModel(lastModel, niche);
    console.log(`[editorialRotation] Fallback rotation: ${next}`);
    return next;

  } catch (err) {
    console.error('[editorialRotation] Error in getNextEditorialModel:', err);
    // Safe fallback
    return niche ? (NICHE_PREFERRED_MODEL[niche.toLowerCase()] || 'traditional') : 'traditional';
  }
}
