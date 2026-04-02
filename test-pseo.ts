import { fetchGooglePlacesPSEOContext } from './supabase/functions/_shared/googlePlaces.ts';

// Test config
const keyword = "Contabilidade";
const city = "São Paulo";
const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || "SUA_API_KEY_AQUI"; // Vai avisar se faltar

async function runTest() {
  console.log(`\n🔍 Iniciando teste pSEO para: "${keyword}" em "${city}"...\n`);
  
  if (apiKey === "SUA_API_KEY_AQUI" || !apiKey) {
    console.log("⚠️ ATENÇÃO: GOOGLE_MAPS_API_KEY não encontrada no Deno.env.");
    console.log("Execute o comando usando: GOOGLE_MAPS_API_KEY=sua_chave deno run --allow-net --allow-env test-pseo.ts");
    return;
  }

  const result = await fetchGooglePlacesPSEOContext(keyword, city, apiKey);
  
  if (result.success) {
    console.log("✅ API DO GOOGLE MAPS RESPONDEU COM SUCESSO!\n");
    console.log("📍 LOCAIS ENCONTRADOS:");
    result.places.forEach((p, index) => {
      console.log(`  ${index + 1}. ${p.name} - ${p.rating}⭐ (${p.user_ratings_total} avaliações)`);
      console.log(`     Endereço: ${p.formatted_address}`);
    });
    console.log("\n📝 CONTEXTO MARKDOWN INJETADO NA IA:");
    console.log("---------------------------------------------------");
    console.log(result.formattedMarkdownContext);
    console.log("---------------------------------------------------");
  } else {
    console.log("❌ FALHA AO CONSULTAR O GOOGLE PLACES.");
  }
}

runTest();
