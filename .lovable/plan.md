

# Plano: Implementar Timeouts na Pesquisa Perplexity/Firecrawl

## Resumo Executivo

Implementar AbortController com timeout em 3 pontos críticos para evitar que o sistema trave indefinidamente quando a API Perplexity/Firecrawl não responde.

---

## Correção 1: analyze-serp/index.ts - Timeout 30s no Perplexity (CRÍTICA)

**Localização:** Linhas 398-416 (função `discoverTopURLsWithPerplexity`)

**Alteração:** Envolver o `fetch` com AbortController de 30 segundos

```typescript
// ANTES (linhas 398-416):
const response = await fetch("https://api.perplexity.ai/chat/completions", {
  method: "POST",
  headers: {...},
  body: JSON.stringify({...}),
});

// DEPOIS:
// Timeout de 30 segundos para descoberta de URLs
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

let response: Response;
try {
  response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: "You are an SEO analyst. Return ONLY valid JSON without any markdown formatting or code blocks."
        },
        { role: "user", content: serpPrompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
    }),
    signal: controller.signal
  });
} catch (error) {
  clearTimeout(timeoutId);
  if (error instanceof Error && error.name === 'AbortError') {
    console.error('[SERP] ⏱️ Perplexity TIMEOUT (30s) - aborting URL discovery');
    throw new Error('PERPLEXITY_TIMEOUT: URL discovery exceeded 30 seconds');
  }
  throw error;
}
clearTimeout(timeoutId);
```

---

## Correção 2: analyze-serp/index.ts - Timeout 15s no Firecrawl (Alta)

**Localização:** Linhas 211-227 (função `scrapeWithFirecrawl`)

**Alteração:** Envolver o `fetch` com AbortController de 15 segundos

```typescript
// ANTES (linhas 215-227):
const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
  method: 'POST',
  headers: {...},
  body: JSON.stringify({...}),
});

// DEPOIS:
// Timeout de 15 segundos por URL
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);

let response: Response;
try {
  response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: 2000
    }),
    signal: controller.signal
  });
} catch (error) {
  clearTimeout(timeoutId);
  if (error instanceof Error && error.name === 'AbortError') {
    console.warn(`[SCRAPE] ⏱️ Timeout (15s) scraping ${url}`);
    return null;
  }
  throw error;
}
clearTimeout(timeoutId);
```

---

## Correção 3: generate-article-structured/index.ts - Timeout 45s na Chamada analyze-serp (Alta)

**Localização:** Linhas 255-268 (dentro de `runResearchStage`)

**Alteração:** Envolver a chamada inter-função com AbortController de 45 segundos

```typescript
// ANTES (linhas 255-268):
const serpRes = await fetch(`${SUPABASE_URL}/functions/v1/analyze-serp`, {
  method: 'POST',
  headers: {...},
  body: JSON.stringify({...}),
});

// DEPOIS:
// Timeout de 45 segundos para análise SERP completa
const serpController = new AbortController();
const serpTimeoutId = setTimeout(() => serpController.abort(), 45000);

let serpRes: Response;
try {
  serpRes = await fetch(`${SUPABASE_URL}/functions/v1/analyze-serp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keyword: primaryKeyword,
      territory: territoryName,
      blogId,
      forceRefresh: false,
      useFirecrawl: true,
    }),
    signal: serpController.signal
  });
} catch (error) {
  clearTimeout(serpTimeoutId);
  if (error instanceof Error && error.name === 'AbortError') {
    console.error('[Research] ⏱️ analyze-serp TIMEOUT (45s) - continuing with empty SERP');
    // Continuar com SERP vazia em vez de travar
    return {
      serpMatrix: {},
      serpDuration: 45000,
      geoResearch: await fetchGeoResearchData(theme, territoryData, PERPLEXITY_API_KEY, undefined, supabase, blogId, undefined),
      geoDuration: 0,
    };
  }
  throw error;
}
clearTimeout(serpTimeoutId);
```

---

## Arquivos a Modificar

| Arquivo | Linhas | Timeout | Ação no Timeout |
|---------|--------|---------|-----------------|
| `analyze-serp/index.ts` | 398-416 | 30s | throw PERPLEXITY_TIMEOUT |
| `analyze-serp/index.ts` | 215-227 | 15s | return null (pula URL) |
| `generate-article-structured/index.ts` | 255-268 | 45s | continua com SERP vazia |

---

## Fluxo Após Correção

```text
runResearchStage
    │
    ├─ analyze-serp (timeout 45s) ✅
    │   ├─ discoverTopURLsWithPerplexity (timeout 30s) ✅
    │   │   └─ Se timeout → throw "PERPLEXITY_TIMEOUT"
    │   │
    │   └─ scrapeWithFirecrawl (timeout 15s por URL) ✅
    │       └─ Se timeout → return null (ignora URL)
    │
    └─ fetchGeoResearchData (timeout 45s via aiProviders) ✅
        └─ Se Perplexity falhar → fallback Gemini
```

---

## Logs Esperados

**Caso Normal:**
```
[SERP] Discovering URLs with Perplexity...
[SERP] Found 10 competitor URLs
[SCRAPE] Scraping URL 1/10...
[Research] ✅ SERP analysis complete
```

**Caso Timeout Perplexity:**
```
[SERP] ⏱️ Perplexity TIMEOUT (30s) - aborting URL discovery
[Research] ⚠️ Continuing with empty SERP matrix
[GEO RESEARCH] Fetching via Perplexity...
```

**Caso Timeout URL Individual:**
```
[SCRAPE] ⏱️ Timeout (15s) scraping https://example.com
[SCRAPE] Scraping URL 2/10... (continua)
```

---

## Validação Pós-Deploy

1. Aguardar deploy das edge functions
2. Converter oportunidade "Dedetização em Recife"
3. Verificar nos logs:
   - Tempo máximo de espera: 45s (não mais infinito)
   - Se houver timeout, log claro indicando onde ocorreu
   - Geração continua mesmo com SERP vazia

