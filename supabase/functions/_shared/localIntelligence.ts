/**
 * LOCAL INTELLIGENCE V2.2
 * City profile, density strategy, proof system, and micro-geo modeling.
 * 
 * IMPORTANT: This module imports ONLY from geoUtils.ts (no circular deps).
 * Never imports editorialOrchestrator.ts directly.
 */

import { getCitySize, type CitySize } from './geoUtils.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface CityProfile {
  city_size: CitySize;
  competition_level: 'high' | 'medium' | 'low';
  density_strategy: 'authority_differentiation' | 'authority' | 'trust_proximity';
  geo_language_style: 'formal_technical' | 'balanced_local' | 'conversational_local';
  geo_depth: 'bairros' | 'macro_regiao' | 'generico';
}

// ============================================================================
// MAPPINGS
// ============================================================================

const COMPETITION_MAP: Record<CitySize, CityProfile['competition_level']> = {
  large: 'high',
  medium: 'medium',
  small: 'low',
};

const DENSITY_MAP: Record<CitySize, CityProfile['density_strategy']> = {
  large: 'authority_differentiation',
  medium: 'authority',
  small: 'trust_proximity',
};

const GEO_LANGUAGE_MAP: Record<CitySize, CityProfile['geo_language_style']> = {
  large: 'formal_technical',
  medium: 'balanced_local',
  small: 'conversational_local',
};

const GEO_DEPTH_MAP: Record<CitySize, CityProfile['geo_depth']> = {
  large: 'bairros',
  medium: 'macro_regiao',
  small: 'generico',
};

// ============================================================================
// 1) BUILD CITY PROFILE
// ============================================================================

export function buildCityProfile(
  city: string | undefined,
  _niche: string | undefined,
  _historyCount: number
): CityProfile {
  const citySize = getCitySize(city);

  return {
    city_size: citySize,
    competition_level: COMPETITION_MAP[citySize],
    density_strategy: DENSITY_MAP[citySize],
    geo_language_style: GEO_LANGUAGE_MAP[citySize],
    geo_depth: GEO_DEPTH_MAP[citySize],
  };
}

// ============================================================================
// 2) BUILD LOCAL PROMPT INJECTION
// ============================================================================

// deno-lint-ignore no-explicit-any
export function buildLocalPromptInjection(
  cityProfile: CityProfile | undefined,
  city: string | undefined,
  // deno-lint-ignore no-explicit-any
  businessProfile: any
): string {
  if (!cityProfile) return '';

  const cityName = city || 'a cidade';
  const parts: string[] = [];

  parts.push('## INTELIGÊNCIA LOCAL (V2.2)\n');

  // --- Tone instructions based on geo_language_style ---
  switch (cityProfile.geo_language_style) {
    case 'formal_technical':
      parts.push(`### Tom de Escrita\nUse tom formal e técnico, adequado para ${cityName} (mercado competitivo de grande porte). Priorize terminologia profissional e dados concretos.\n`);
      break;
    case 'balanced_local':
      parts.push(`### Tom de Escrita\nUse tom equilibrado entre profissional e acessível, adequado para ${cityName} (mercado de porte médio). Combine autoridade técnica com proximidade local.\n`);
      break;
    case 'conversational_local':
      parts.push(`### Tom de Escrita\nUse tom conversacional e próximo, adequado para ${cityName} (mercado local). Priorize confiança e proximidade sobre formalidade técnica.\n`);
      break;
  }

  // --- Density strategy ---
  switch (cityProfile.density_strategy) {
    case 'authority_differentiation':
      parts.push(`### Estratégia Editorial\nEm ${cityName}, o mercado é altamente competitivo. Diferencie-se com:\n- Abordagens únicas que concorrentes não cobrem\n- Profundidade técnica superior\n- Perspectiva local exclusiva baseada em experiência real\n`);
      break;
    case 'authority':
      parts.push(`### Estratégia Editorial\nEm ${cityName}, construa autoridade com:\n- Conhecimento consistente e verificável\n- Referências à realidade local\n- Tom de especialista acessível\n`);
      break;
    case 'trust_proximity':
      parts.push(`### Estratégia Editorial\nEm ${cityName}, priorize confiança e proximidade com:\n- Linguagem que demonstre conhecimento da comunidade local\n- Tom de quem está próximo e disponível\n- Exemplos práticos do cotidiano da região\n`);
      break;
  }

  // --- Local proof rules ---
  parts.push(`### Regras de Prova Local`);

  if (businessProfile?.empresa_nome || businessProfile?.diferenciais || businessProfile?.o_que_oferece) {
    parts.push(`Use os dados reais do negócio disponíveis:`);
    if (businessProfile.empresa_nome) parts.push(`- Empresa: ${businessProfile.empresa_nome}`);
    if (businessProfile.diferenciais) parts.push(`- Diferenciais: ${businessProfile.diferenciais}`);
    if (businessProfile.o_que_oferece) parts.push(`- Serviços: ${businessProfile.o_que_oferece}`);
    parts.push('');
  } else {
    parts.push(`Sem dados específicos do negócio disponíveis. Use prova contextual estratégica:\n- Reforce autoridade através do conhecimento demonstrado sobre a região\n- Use frases como "profissionais da região", "empresas locais especializadas"\n- Contextualize o serviço na realidade de ${cityName}\n`);
  }

  // --- MANDATORY GUARDRAIL ---
  parts.push(`### GUARDRAIL OBRIGATÓRIO — PROIBIÇÕES DE PROVA LOCAL
- NUNCA inventar nomes de bairros, regiões específicas, dados demográficos ou estatísticas locais.
- NUNCA inventar tempo de mercado, número de clientes atendidos ou porcentagens.
- NUNCA citar dados numéricos sem fonte verificável.
- Caso não tenha certeza factual, utilizar termos genéricos como "região central", "zona residencial" ou apenas o nome da cidade.
- Micro-localização é ORIENTAÇÃO CONTEXTUAL, nunca requisito determinístico.
- Permitido apenas: "região central", "zona norte/sul/leste/oeste", "bairros residenciais", "área comercial", ou micro-localizações naturalmente conhecidas.
`);

  // --- Geo depth instructions ---
  const microGeo = buildMicroGeoEntities(city, cityProfile.geo_depth);
  if (microGeo) {
    parts.push(microGeo);
  }

  return parts.join('\n');
}

// ============================================================================
// 3) BUILD MICRO-GEO ENTITIES
// ============================================================================

export function buildMicroGeoEntities(
  city: string | undefined,
  geoDepth: CityProfile['geo_depth'] | undefined
): string {
  if (!geoDepth || !city) return '';

  const cityName = city;

  switch (geoDepth) {
    case 'bairros':
      return `### Profundidade Geográfica (Nível: Bairros)
Quando contextualmente relevante e com certeza factual, você PODE mencionar subdivisões conhecidas de ${cityName} (bairros, regiões, zonas).
NÃO é obrigatório. NÃO invente nomes. Se não tiver certeza sobre um bairro específico, use apenas "${cityName}" ou termos genéricos como "região central", "zona residencial".
A menção geográfica deve ser natural e contextual, nunca forçada.
`;

    case 'macro_regiao':
      return `### Profundidade Geográfica (Nível: Macro-região)
Mencione ${cityName} e, quando relevante, sua região ou zona metropolitana.
NÃO cite bairros específicos. Use apenas o nome da cidade ou termos como "região metropolitana de ${cityName}", "interior do estado".
`;

    case 'generico':
      return `### Profundidade Geográfica (Nível: Genérico)
Use apenas o nome "${cityName}" para referência geográfica. Não tente detalhar subdivisões ou regiões da cidade.
`;
  }
}
