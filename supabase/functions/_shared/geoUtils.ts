/**
 * GEO UTILS - Shared geography utilities
 * Isolated to avoid circular dependencies between modules.
 */

// ============================================================================
// CITY SIZE SETS (Single Source of Truth)
// ============================================================================

const LARGE_CITIES = new Set([
  'são paulo', 'rio de janeiro', 'brasília', 'salvador', 'fortaleza',
  'belo horizonte', 'manaus', 'curitiba', 'recife', 'goiânia',
  'belém', 'porto alegre', 'guarulhos', 'campinas', 'são luís',
  'são gonçalo', 'maceió', 'duque de caxias', 'natal', 'teresina',
  'campo grande', 'são bernardo do campo', 'joão pessoa', 'santo andré',
  'osasco', 'jaboatão dos guararapes', 'são josé dos campos', 'ribeirão preto',
  'uberlândia', 'contagem', 'sorocaba', 'aracaju', 'feira de santana',
  'cuiabá', 'joinville', 'juiz de fora', 'londrina', 'aparecida de goiânia',
]);

const MEDIUM_CITIES = new Set([
  'niterói', 'ananindeua', 'belford roxo', 'campos dos goytacazes',
  'santos', 'são vicente', 'mauá', 'carapicuíba', 'olinda',
  'piracicaba', 'jundiaí', 'bauru', 'maringá', 'vila velha',
  'serra', 'diadema', 'vitória', 'betim', 'pelotas',
  'canoas', 'caucaia', 'cariacica', 'franca', 'ponta grossa',
  'blumenau', 'petrolina', 'paulista', 'uberaba', 'limeira',
  'caruaru', 'santarém', 'mossoró', 'cascavel', 'itaquaquecetuba',
  'suzano', 'governador valadares', 'nova iguaçu', 'praia grande',
  'taubaté', 'gravataí', 'barueri', 'imperatriz', 'viamão',
]);

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

export type CitySize = 'large' | 'medium' | 'small';

/**
 * Determine city size category. Pure function, no external dependencies.
 */
export function getCitySize(city: string | undefined): CitySize {
  if (!city || city === 'Brasil' || city.trim() === '') return 'small';
  const normalized = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (LARGE_CITIES.has(normalized)) return 'large';
  if (MEDIUM_CITIES.has(normalized)) return 'medium';
  return 'small';
}

/**
 * Get anti-collision window size based on city size.
 */
export function getCityWindowSize(city: string | undefined): number {
  const size = getCitySize(city);
  switch (size) {
    case 'large': return 25;
    case 'medium': return 15;
    case 'small': return 10;
  }
}
