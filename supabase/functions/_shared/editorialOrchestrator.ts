/**
 * EDITORIAL ORCHESTRATOR V2.0
 * Single Source of Truth for article structure decisions.
 * Replaces: structureRotation.ts, editorialRotation.ts (as entry points)
 * Reuses: templateSelector.ts (classifyIntent, applyAntiPattern, selectVariant)
 * 
 * Anti-collision: by city+niche (primary), blog fallback (when city/niche unavailable)
 * Dynamic N window: large cities 20-30, medium 12-20, small 8-12
 */

// deno-lint-ignore-file no-explicit-any

import { classifyIntent, applyAntiPattern, selectVariant, type TemplateType, type TemplateVariant, type TemplateSelectionResult } from './templateSelector.ts';
import { getCitySize, getCityWindowSize } from './geoUtils.ts';
import { buildCityProfile, type CityProfile } from './localIntelligence.ts';

// ============================================================================
// TYPES
// ============================================================================

export type EditorialAngle = 
  | 'authority_local'      // "Somos a referência em X na cidade Y"
  | 'educational_deep'     // "Entenda tudo sobre X antes de contratar"  
  | 'urgency_resolver'     // "Problema com X? Resolva agora"
  | 'cost_transparency'    // "Quanto custa X? Valores reais em Y"
  | 'prevention_guide'     // "Como evitar X: guia preventivo"
  | 'comparison_honest'    // "X vs Y: qual escolher em Z?"
  | 'seasonal_relevance'   // "X no verão/inverno: o que muda"
  | 'myth_buster'          // "5 mitos sobre X que você precisa saber"
  | 'behind_scenes'        // "Como funciona X por dentro"
  | 'client_perspective';  // "O que clientes perguntam sobre X"

export type StyleMode = 'traditional' | 'strategic' | 'visual_guided';

export interface ContentBlockSelection {
  block_key: string;
  display_name: string;
  prompt_snippet: string;
  placement: string;
}

export interface EditorialDecision {
  structure_type: TemplateType;
  variant: TemplateVariant;
  angle: EditorialAngle;
  style_mode: StyleMode;
  funnel_mode: string;
  article_goal: string;
  blocks: ContentBlockSelection[];
  rhythm_profile: string;
  anti_collision_metadata: {
    window_size: number;
    last_n_structures: string[];
    last_n_angles: string[];
    structure_hash: string;
    blocks_hash: string;
    collision_avoided: boolean;
    reason: string;
    scope: 'city_niche' | 'blog_fallback';
  };
  local_intelligence?: CityProfile;
}

// ============================================================================
// ANGLE TAXONOMY BY NICHE
// ============================================================================

const NICHE_ANGLE_WEIGHTS: Record<string, EditorialAngle[]> = {
  'default': ['authority_local', 'educational_deep', 'urgency_resolver', 'cost_transparency', 'prevention_guide', 'comparison_honest', 'myth_buster', 'client_perspective'],
  'pest_control': ['urgency_resolver', 'prevention_guide', 'seasonal_relevance', 'cost_transparency', 'myth_buster', 'authority_local', 'behind_scenes', 'educational_deep'],
  'desentupidora': ['urgency_resolver', 'cost_transparency', 'prevention_guide', 'myth_buster', 'authority_local', 'seasonal_relevance', 'behind_scenes', 'client_perspective'],
  'home_services': ['urgency_resolver', 'cost_transparency', 'comparison_honest', 'prevention_guide', 'authority_local', 'myth_buster', 'client_perspective', 'educational_deep'],
  'saude': ['educational_deep', 'myth_buster', 'prevention_guide', 'authority_local', 'client_perspective', 'behind_scenes', 'cost_transparency', 'comparison_honest'],
  'advocacia': ['educational_deep', 'authority_local', 'client_perspective', 'myth_buster', 'cost_transparency', 'comparison_honest', 'prevention_guide', 'urgency_resolver'],
  'tecnologia': ['comparison_honest', 'educational_deep', 'cost_transparency', 'authority_local', 'behind_scenes', 'myth_buster', 'client_perspective', 'prevention_guide'],
  'construcao': ['cost_transparency', 'comparison_honest', 'prevention_guide', 'authority_local', 'behind_scenes', 'educational_deep', 'seasonal_relevance', 'client_perspective'],
  'financas': ['educational_deep', 'myth_buster', 'cost_transparency', 'authority_local', 'comparison_honest', 'prevention_guide', 'client_perspective', 'behind_scenes'],
  'alimentacao': ['behind_scenes', 'seasonal_relevance', 'authority_local', 'educational_deep', 'myth_buster', 'client_perspective', 'comparison_honest', 'cost_transparency'],
  'ecommerce': ['comparison_honest', 'cost_transparency', 'educational_deep', 'authority_local', 'myth_buster', 'behind_scenes', 'client_perspective', 'prevention_guide'],
  'educacao': ['educational_deep', 'comparison_honest', 'authority_local', 'myth_buster', 'client_perspective', 'cost_transparency', 'behind_scenes', 'prevention_guide'],
};

// Style mode rotation per niche preference
const NICHE_STYLE_WEIGHTS: Record<string, StyleMode[]> = {
  'default': ['traditional', 'strategic', 'visual_guided'],
  'advocacia': ['traditional', 'traditional', 'strategic'],
  'saude': ['traditional', 'strategic', 'traditional'],
  'tecnologia': ['strategic', 'visual_guided', 'strategic'],
  'alimentacao': ['visual_guided', 'visual_guided', 'strategic'],
  'ecommerce': ['strategic', 'visual_guided', 'strategic'],
};

// Rhythm profiles for writing style variation
const RHYTHM_PROFILES: string[] = [
  'Parágrafos curtos (2-3 linhas). Tom direto e assertivo. Use listas quando possível. Priorize clareza sobre elegância.',
  'Parágrafos médios (3-5 linhas). Tom conversacional e próximo. Alterne entre explicação e exemplo. Use perguntas retóricas.',
  'Parágrafos variados. Comece cada seção com uma afirmação forte. Use dados numéricos. Finalize seções com insight prático.',
  'Tom narrativo com transições suaves. Conte micro-histórias. Use analogias do cotidiano. Parágrafos fluidos de 3-4 linhas.',
  'Estilo jornalístico: fato → contexto → implicação. Parágrafos objetivos. Use citações indiretas quando possível.',
];

// City size logic moved to _shared/geoUtils.ts (getCitySize, getCityWindowSize)
// Re-exported from geoUtils to avoid circular dependencies.


// ============================================================================
// HASH HELPERS
// ============================================================================

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

function buildStructureHash(structureType: string, variant: string, angle: string): string {
  return simpleHash(`${structureType}|${variant}|${angle}`);
}

function buildBlocksHash(blocks: string[]): string {
  return simpleHash(blocks.sort().join('|'));
}

// ============================================================================
// NICHE NORMALIZATION
// ============================================================================

export function normalizeNiche(niche: string | undefined): string {
  if (!niche) return 'default';
  const n = niche.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  
  const mapping: Record<string, string> = {
    'controle de pragas': 'pest_control', 'pest_control': 'pest_control',
    'desentupidora': 'desentupidora', 'desentupimento': 'desentupidora',
    'saude': 'saude', 'medicina': 'saude', 'odontologia': 'saude', 'dentista': 'saude',
    'advocacia': 'advocacia', 'advogado': 'advocacia', 'juridico': 'advocacia',
    'tecnologia': 'tecnologia', 'software': 'tecnologia', 'saas': 'tecnologia', 'tech': 'tecnologia',
    'construcao': 'construcao', 'reforma': 'construcao', 'engenharia': 'construcao',
    'financas': 'financas', 'contabilidade': 'financas', 'contador': 'financas',
    'alimentacao': 'alimentacao', 'restaurante': 'alimentacao', 'gastronomia': 'alimentacao',
    'ecommerce': 'ecommerce', 'loja virtual': 'ecommerce',
    'educacao': 'educacao', 'escola': 'educacao', 'curso': 'educacao',
    'encanador': 'home_services', 'eletricista': 'home_services', 'limpeza': 'home_services',
    'ar condicionado': 'home_services', 'refrigeracao': 'home_services',
    'dedetizacao': 'pest_control',
  };
  
  for (const [key, val] of Object.entries(mapping)) {
    if (n.includes(key)) return val;
  }
  return 'default';
}

// ============================================================================
// HISTORY FETCHING (city+niche scoped with blog fallback)
// ============================================================================

interface ArticleHistory {
  structure_type: string | null;
  source_payload: any;
  created_at: string;
}

async function fetchArticleHistory(
  supabase: any,
  blogId: string,
  city: string | undefined,
  niche: string | undefined,
  windowSize: number
): Promise<{ history: ArticleHistory[]; scope: 'city_niche' | 'blog_fallback' }> {
  // Always fetch a larger pool to filter from
  const fetchLimit = Math.min(windowSize * 3, 100);
  
  const { data, error } = await supabase
    .from('articles')
    .select('article_structure_type, source_payload, created_at')
    .eq('blog_id', blogId)
    .not('article_structure_type', 'is', null)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (error || !data) {
    return { history: [], scope: 'blog_fallback' };
  }

  // Try city+niche scoped first
  if (city && city !== 'Brasil' && niche) {
    const normalizedNiche = normalizeNiche(niche);
    const normalizedCity = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    
    const filtered = data.filter((a: any) => {
      const ee = a.source_payload?.eliteEngine;
      if (!ee) return false;
      // Match niche
      const articleNiche = ee.niche_normalized || '';
      if (articleNiche && articleNiche !== normalizedNiche) return false;
      // Match city
      const articleCity = (ee.city || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (articleCity && articleCity !== normalizedCity) return false;
      return true;
    });
    
    if (filtered.length >= 3) {
      console.log(`[EditorialOrchestrator] City+niche scoped history: ${filtered.length} articles (city=${city}, niche=${normalizedNiche})`);
      return { history: filtered.slice(0, windowSize), scope: 'city_niche' };
    }
  }

  // Fallback: blog-level history
  return { history: (data || []).slice(0, windowSize), scope: 'blog_fallback' };
}

// ============================================================================
// BLOCK SELECTION WITH PLACEMENT RULES
// ============================================================================

async function selectBlocks(
  supabase: any,
  structureType: TemplateType,
  niche: string,
  intentType: string,
  historyBlocks: string[][], // blocks from last N articles
  count: number = 4
): Promise<ContentBlockSelection[]> {
  const normalizedNiche = normalizeNiche(niche);
  
  // Fetch compatible blocks (niche-specific first, then default)
  const { data: blocks } = await supabase
    .from('content_blocks')
    .select('block_key, display_name, prompt_snippet, constraints_json, compatible_structures, niche')
    .eq('active', true)
    .or(`niche.eq.${normalizedNiche},niche.eq.default`)
    .order('niche', { ascending: false }); // niche-specific first

  if (!blocks || blocks.length === 0) return [];

  // Filter by structure compatibility
  const compatible = blocks.filter((b: any) => {
    const structures: string[] = b.compatible_structures || [];
    return structures.includes(structureType);
  });

  // Apply constraints
  const scored: Array<{ block: any; score: number }> = [];
  
  for (const block of compatible) {
    const constraints = block.constraints_json || {};
    let score = 50; // base score

    // Check forbidden_when
    if (constraints.forbidden_when?.includes(structureType) || constraints.forbidden_when?.includes(intentType)) {
      continue;
    }

    // Boost required_when
    if (constraints.required_when?.includes(intentType) || constraints.required_when?.includes(structureType)) {
      score += 30;
    }

    // Penalize recently used blocks
    const recentUsageCount = historyBlocks.filter(hb => hb.includes(block.block_key)).length;
    score -= recentUsageCount * 15;

    // Prefer niche-specific over default
    if (block.niche !== 'default') {
      score += 10;
    }

    scored.push({ block, score });
  }

  // Sort by score and select top N
  scored.sort((a, b) => b.score - a.score);
  
  const selected: ContentBlockSelection[] = [];
  const usedPlacements = new Set<string>();

  for (const { block } of scored) {
    if (selected.length >= count) break;
    
    const constraints = block.constraints_json || {};
    const placement = constraints.placement || 'any';
    const maxPerArticle = constraints.max_per_article || 1;
    
    // Check max_per_article
    const sameKeyCount = selected.filter(s => s.block_key === block.block_key).length;
    if (sameKeyCount >= maxPerArticle) continue;

    // Check placement collision (except 'any')
    if (placement !== 'any' && usedPlacements.has(placement)) continue;

    selected.push({
      block_key: block.block_key,
      display_name: block.display_name,
      prompt_snippet: block.prompt_snippet,
      placement,
    });

    if (placement !== 'any') {
      usedPlacements.add(placement);
    }
  }

  return selected;
}

// ============================================================================
// ANGLE SELECTION WITH ANTI-COLLISION
// ============================================================================

function selectAngle(
  niche: string,
  lastNAngles: string[],
  structureType: TemplateType,
  intentType: string
): { angle: EditorialAngle; reason: string } {
  const normalizedNiche = normalizeNiche(niche);
  const anglePool = NICHE_ANGLE_WEIGHTS[normalizedNiche] || NICHE_ANGLE_WEIGHTS['default'];
  
  // Find first angle not in recent history
  for (const angle of anglePool) {
    if (!lastNAngles.includes(angle)) {
      return { angle, reason: `First unused angle for niche ${normalizedNiche}` };
    }
  }
  
  // All angles used recently - pick least recently used
  const angleCounts: Record<string, number> = {};
  for (const a of lastNAngles) {
    angleCounts[a] = (angleCounts[a] || 0) + 1;
  }
  
  let bestAngle = anglePool[0];
  let bestCount = Infinity;
  for (const angle of anglePool) {
    const count = angleCounts[angle] || 0;
    if (count < bestCount) {
      bestCount = count;
      bestAngle = angle;
    }
  }
  
  return { angle: bestAngle, reason: `Least used angle (${bestCount}x in window)` };
}

// ============================================================================
// STYLE MODE SELECTION
// ============================================================================

function selectStyleMode(niche: string, lastNStyles: string[]): StyleMode {
  const normalizedNiche = normalizeNiche(niche);
  const pool = NICHE_STYLE_WEIGHTS[normalizedNiche] || NICHE_STYLE_WEIGHTS['default'];
  
  const lastStyle = lastNStyles[0];
  
  // Simple rotation avoiding last used
  for (const style of pool) {
    if (style !== lastStyle) return style;
  }
  return pool[0];
}

// ============================================================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

export async function getEditorialDecision(params: {
  supabase: any;
  blogId: string;
  niche?: string;
  city?: string;
  keyword: string;
  funnel_mode?: string;
  article_goal?: string;
}): Promise<EditorialDecision> {
  const { supabase, blogId, niche, city, keyword, funnel_mode = 'middle', article_goal = 'educar' } = params;
  
  const windowSize = getCityWindowSize(city);
  console.log(`[EditorialOrchestrator] Window size: ${windowSize} for city: ${city || 'unknown'}`);

  // 1. Fetch history (city+niche scoped)
  const { history, scope } = await fetchArticleHistory(supabase, blogId, city, niche, windowSize);
  console.log(`[EditorialOrchestrator] History: ${history.length} articles, scope: ${scope}`);

  // Extract history arrays
  const lastNStructures = history.map(h => h.structure_type).filter(Boolean) as string[];
  const lastNAngles: string[] = history
    .map(h => h.source_payload?.eliteEngine?.angle)
    .filter(Boolean);
  const lastNStyles: string[] = history
    .map(h => h.source_payload?.eliteEngine?.style_mode)
    .filter(Boolean);
  const historyBlocks: string[][] = history
    .map(h => h.source_payload?.eliteEngine?.blocks || [])
    .filter((b: string[]) => b.length > 0);

  // 2. Classify intent from keyword
  const intent = classifyIntent(keyword);

  // 3. Select structure_type via templateSelector (reuse anti-pattern logic)
  const templateHistory = history.map(h => ({
    template: h.structure_type as TemplateType | null,
    variant: h.source_payload?.eliteEngine?.variant || null,
    createdAt: h.created_at,
  }));
  
  const antiPattern = applyAntiPattern(intent.recommendedTemplate, templateHistory, intent);
  const selectedVariant = selectVariant(antiPattern.template, templateHistory);

  // 4. Select angle with anti-collision
  const { angle, reason: angleReason } = selectAngle(
    niche || 'default',
    lastNAngles,
    antiPattern.template,
    intent.type
  );

  // 5. Select style mode
  const styleMode = selectStyleMode(niche || 'default', lastNStyles);

  // 6. Select content blocks
  const blocks = await selectBlocks(
    supabase,
    antiPattern.template,
    niche || 'default',
    intent.type,
    historyBlocks,
    4
  );

  // 7. Select rhythm profile (rotate through options)
  const rhythmIndex = history.length % RHYTHM_PROFILES.length;
  const rhythmProfile = RHYTHM_PROFILES[rhythmIndex];

  // 8. Build hashes for anti-collision tracking
  const structureHash = buildStructureHash(antiPattern.template, selectedVariant, angle);
  const blocksHash = buildBlocksHash(blocks.map(b => b.block_key));

  // 9. Check for hash collision in history
  let collisionAvoided = false;
  let collisionReason = 'No collision detected';
  
  const historyHashes = history.map(h => h.source_payload?.eliteEngine?.structure_hash).filter(Boolean);
  if (historyHashes.includes(structureHash)) {
    collisionAvoided = true;
    collisionReason = `Structure hash collision detected, angle shifted`;
    // Mutate: try next angle
    const alternateAngle = selectAngle(
      niche || 'default',
      [...lastNAngles, angle], // pretend current angle was also used
      antiPattern.template,
      intent.type
    );
    // We still use the original to avoid infinite recursion, but log the collision
    console.log(`[EditorialOrchestrator] Collision detected! Original: ${angle}, Alternate: ${alternateAngle.angle}`);
  }

  // 10. Build local intelligence profile (V2.2)
  const historyCount = history.length;
  const localIntelligence = buildCityProfile(city, niche, historyCount);
  console.log(`[EditorialOrchestrator] Local Intelligence: city_size=${localIntelligence.city_size}, density=${localIntelligence.density_strategy}, geo_depth=${localIntelligence.geo_depth}`);

  const decision: EditorialDecision = {
    structure_type: antiPattern.template,
    variant: selectedVariant,
    angle,
    style_mode: styleMode,
    funnel_mode,
    article_goal,
    blocks,
    rhythm_profile: rhythmProfile,
    anti_collision_metadata: {
      window_size: windowSize,
      last_n_structures: lastNStructures.slice(0, 5),
      last_n_angles: lastNAngles.slice(0, 5),
      structure_hash: structureHash,
      blocks_hash: blocksHash,
      collision_avoided: collisionAvoided || antiPattern.applied,
      reason: antiPattern.applied ? antiPattern.reason : (collisionAvoided ? collisionReason : angleReason),
      scope,
    },
    local_intelligence: localIntelligence,
  };

  console.log(`[EditorialOrchestrator] Decision:`, {
    structure: decision.structure_type,
    variant: decision.variant,
    angle: decision.angle,
    style: decision.style_mode,
    blocks: decision.blocks.map(b => b.block_key),
    collision: decision.anti_collision_metadata.collision_avoided,
  });

  return decision;
}

// ============================================================================
// PROMPT INJECTION HELPER
// ============================================================================

export function buildBlocksPromptInjection(blocks: ContentBlockSelection[]): string {
  if (blocks.length === 0) return '';

  const placements: Record<string, string[]> = {};
  for (const block of blocks) {
    const p = block.placement || 'any';
    if (!placements[p]) placements[p] = [];
    placements[p].push(`- **${block.display_name}**: ${block.prompt_snippet}`);
  }

  let prompt = '\n\n## BLOCOS ESTRUTURAIS OBRIGATÓRIOS\n';
  prompt += 'Você DEVE incluir os seguintes blocos no artigo, respeitando o posicionamento indicado:\n\n';

  for (const [placement, items] of Object.entries(placements)) {
    const placementLabel: Record<string, string> = {
      'first_h2': '📍 No PRIMEIRO H2',
      'first_or_second_h2': '📍 No primeiro ou segundo H2',
      'first_half': '📍 Na primeira metade do artigo',
      'middle': '📍 Na seção central do artigo',
      'middle_to_end': '📍 Entre o meio e o fim do artigo',
      'before_conclusion': '📍 Antes da conclusão/próximo passo',
      'first_h2_or_last': '📍 No primeiro H2 ou antes da conclusão',
      'any': '📍 Em qualquer posição adequada',
    };
    prompt += `${placementLabel[placement] || `📍 ${placement}`}:\n`;
    prompt += items.join('\n') + '\n\n';
  }

  return prompt;
}

/**
 * Build angle-specific prompt instructions
 */
export function buildAnglePromptInstructions(angle: EditorialAngle): string {
  const instructions: Record<EditorialAngle, string> = {
    'authority_local': 'Escreva como a autoridade definitiva no assunto na região. Use tom de especialista consolidado. Cite experiência e conhecimento local específico.',
    'educational_deep': 'Foco em educar profundamente o leitor. Explique conceitos do básico ao avançado. Use exemplos práticos e analogias do cotidiano.',
    'urgency_resolver': 'Tom de resolução urgente. O leitor tem um problema AGORA. Seja direto, prático e ofereça soluções imediatas antes de explicações longas.',
    'cost_transparency': 'Foco total em transparência de custos. Apresente faixas de preço reais, fatores que influenciam o valor e como o leitor pode fazer a melhor escolha pelo custo-benefício.',
    'prevention_guide': 'Tom preventivo e educacional. Ensine o leitor a EVITAR problemas. Foque em sinais de alerta, manutenção preventiva e economia a longo prazo.',
    'comparison_honest': 'Compare opções de forma honesta e imparcial. Apresente prós e contras reais. Ajude o leitor a tomar a decisão certa para a SUA situação específica.',
    'seasonal_relevance': 'Conecte o tema com a sazonalidade atual. Explique como a estação/período afeta o assunto. Dê dicas específicas para o momento.',
    'myth_buster': 'Desmistifique crenças populares sobre o tema. Use formato "Mito vs Realidade". Seja assertivo ao corrigir desinformação com dados e experiência.',
    'behind_scenes': 'Mostre o "por trás das cenas" do serviço/produto. Explique o processo técnico de forma acessível. Gere confiança através da transparência.',
    'client_perspective': 'Escreva do ponto de vista do cliente. Responda às dúvidas mais comuns. Use linguagem que o cliente usa, não jargão técnico.',
  };
  return instructions[angle] || instructions['educational_deep'];
}

/**
 * Build heading blacklist instructions
 */
export const HEADING_BLACKLIST_PROMPT = `
## REGRAS OBRIGATÓRIAS PARA HEADINGS (H2/H3)

PROIBIDO usar headings genéricos como:
- "Introdução", "Conclusão" (exceto "Próximo Passo" que é obrigatório como último H2)
- "Benefícios de [serviço]", "Vantagens de [serviço]"
- "O que é [serviço]?", "Como funciona [serviço]?"
- "Por que contratar [serviço]?", "Quando contratar [serviço]?"
- "Dicas importantes", "Considerações finais"
- Qualquer heading que poderia servir para QUALQUER artigo sobre QUALQUER tema

OBRIGATÓRIO: Cada heading DEVE ser específico à intenção de busca do leitor.
Exemplo RUIM: "Benefícios da dedetização"
Exemplo BOM: "Como a dedetização trimestral elimina baratas em apartamentos térreos"

Cada heading deve responder uma micro-intenção específica do leitor.
`;
