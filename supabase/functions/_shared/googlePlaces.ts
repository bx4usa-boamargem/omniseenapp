// ============================================================================
// GOOGLE PLACES API INTEGRATION (pSEO Engine)
// ============================================================================
// Service to extract hyper-local context (competitors, ratings, addresses)
// to ground the GEO Writer with real world local businesses.
// ============================================================================

export interface LocalSearchResult {
  places: Array<{
    name: string;
    rating: number;
    user_ratings_total: number;
    formatted_address: string;
    types: string[];
  }>;
  formattedMarkdownContext: string;
  success: boolean;
}

/**
 * Searches Google Places purely by text query (e.g. "Contador em Pinheiros, São Paulo")
 * and formats the top competitors into a markdown block to inject into the LLM context.
 */
export async function fetchGooglePlacesPSEOContext(
  keyword: string,
  cityOrRegion: string,
  apiKey: string
): Promise<LocalSearchResult> {
  const query = `${keyword} in ${cityOrRegion}`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=pt-BR`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[fetchGooglePlacesPSEOContext] Google API error:", data.status, data.error_message);
      return { places: [], formattedMarkdownContext: "", success: false };
    }

    const results = data.results || [];
    
    // Get top 5 results, sort by rating and popularity
    const topPlaces = results
      .slice(0, 5)
      .map((p: any) => ({
        name: p.name,
        rating: p.rating || 0,
        user_ratings_total: p.user_ratings_total || 0,
        formatted_address: p.formatted_address || "",
        types: p.types || []
      }));

    if (topPlaces.length === 0) {
      return { places: [], formattedMarkdownContext: "", success: true };
    }

    const markdownContext = `
## DADOS LOCAIS REAIS DO GOOGLE PLACES (ESTRATÉGIA pSEO)
O sistema buscou no mapa as empresas reais que atendem à intenção "${keyword}" em "${cityOrRegion}".
Aqui estão os principais estabelecimentos físicos reais da região:

${topPlaces.map((p: any, i: number) => `
### ${i + 1}. ${p.name}
- **Avaliação:** ${p.rating} estrelas (${p.user_ratings_total} reviews)
- **Endereço Completo:** ${p.formatted_address}
`).join('')}

**INSTRUÇÃO SUPREMA DADA A VOCÊ (PROMPT ENGINE):**
Se você estiver escrevendo um artigo focado em SEO Local (para ${cityOrRegion}), é ALTAMENTE RECOMENDADO que você cite os endereços, bairros e nomes listados acima como *pontos de referência* ou *exemplos do que os clientes da região procuram*. ISSO É O QUE FAZ O ARTIGO RANQUEAR EM 30 DIAS NA REGIÃO MENCIONADA.
`;

    return {
      places: topPlaces,
      formattedMarkdownContext: markdownContext,
      success: true
    };

  } catch (error) {
    console.error("[fetchGooglePlacesPSEOContext] Exception:", error);
    return { places: [], formattedMarkdownContext: "", success: false };
  }
}
