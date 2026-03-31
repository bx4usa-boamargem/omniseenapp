# Fontes de dados SERP — auditoria (decisão documentada)

**Data da auditoria:** 2026-03-31  
**Escopo:** pipeline principal de geração (`orchestrate-generation`) vs. função dedicada `analyze-serp`.

## Conclusão executiva

| Caminho | Usa SERP “ao vivo” (API/scrape)? | Usa LLM? |
|---------|-----------------------------------|----------|
| **`SERP_ANALYSIS` em `orchestrate-generation`** → `executeSerpSummary` | **Não** | **Sim** — task `serp_summary` no `ai-router` (ex.: `google/gemini-2.5-flash`) com prompt pedindo estimativa de landscape competitivo |
| **`analyze-serp` (Edge Function)** | **Sim** — Firecrawl para páginas reais; menção a Perplexity para descoberta de URLs no cabeçalho do módulo | Sim (camadas de análise sobre conteúdo obtido) |
| **`seo-enhancer-job` / fluxos pós-artigo** | Depende da invocação; `analyze-serp` é a peça com scraping real | Híbrido |

## Evidência no código

### Pipeline principal (`orchestrate-generation`)

- Função `executeSerpSummary` (aprox. linhas 276–303) **não chama** DataForSEO, SerpAPI, Google Search API nem Firecrawl.
- Ela monta um prompt de texto com keyword, cidade, nicho e idioma e chama `callAIRouter(..., 'serp_summary', ...)`.
- O `ai-router` define `serp_summary` como chamada ao modelo configurado (LLM), não como integração com provedor SERP externo.
- O passo `SERP_GAP_ANALYSIS` (`executeSerpGapAnalysis`) usa o **texto** `serpSummaryText` produzido acima — ou seja, gaps são inferidos a partir do resumo LLM, não de SERP real.

**Implicação:** o estágio nomeado `SERP_ANALYSIS` no job é, na prática, **“resumo competitivo simulado / estimado por modelo”**, não uma reprodução verificável dos resultados do Google.

### Função `analyze-serp`

- Comentários e imports indicam **Firecrawl** obrigatório para scraping e fluxo determinístico de concorrentes.
- Este caminho é **adequado para briefs baseados em páginas reais**, alinhado a ferramentas tier-1 — desde que seja **acoplado** ao início do pipeline de geração se o produto prometer “estratégia baseada na SERP real”.

## Recomendações (produto / engenharia)

1. **Ou** integrar `analyze-serp` (ou SerpAPI/DataForSEO) **antes** de `OUTLINE_GEN` / `CONTENT_GEN` no orquestrador, persistindo URLs e snippets reais no job.  
2. **Ou** renomear/clarificar na UI o passo “Analisando SERP…” para “Análise de mercado (IA)” para alinhar expectativa ao comportamento atual.  
3. Manter `SerpProvider` tipado no `ai-router` como evolução futura; hoje o gargalo do pipeline principal é **ausência de dados SERP verificáveis** nesse passo.

## Referências de ficheiros

- `supabase/functions/orchestrate-generation/index.ts` — `executeSerpSummary`, `executeSerpGapAnalysis`
- `supabase/functions/ai-router/index.ts` — task `serp_summary`
- `supabase/functions/analyze-serp/index.ts` — Firecrawl / fluxo determinístico
