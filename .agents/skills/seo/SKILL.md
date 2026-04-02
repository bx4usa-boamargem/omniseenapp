---
name: omniseen-seo
description: >
  SEO audit e análise LLM-first para artigos e blogs da plataforma OmniSeen.
  Use quando o usuário pedir: "auditar SEO", "analisar artigo", "verificar score SEO",
  "otimizar para Google", "E-E-A-T", "Core Web Vitals", "GEO/AEO", "schema markup".
  Integra diretamente com as Edge Functions: calculate-content-score, batch-seo-suggestions,
  fix-seo-with-ai, seo-enhancer-job, save-seo-snapshot, check-broken-links.
---

# OmniSeen SEO Skill

SEO audit determinístico para artigos e blogs multi-tenant da plataforma OmniSeen.
Adaptado do `Bhanunamikaze/Agentic-SEO-Skill` para o stack Supabase + Deno Edge Functions.

## Comandos disponíveis

| Comando | O que faz | Edge Function |
|---------|-----------|---------------|
| `seo audit <article_id>` | Audit completo do artigo | `calculate-content-score` |
| `seo schema <article_id>` | Gerar/validar JSON-LD | `schema_json` column + `analyze-serp` |
| `seo geo <article_id>` | Score GEO/AEO para AI Overviews | `evaluate-geo-readiness` (pendente) |
| `seo fix <article_id>` | Corrigir itens SEO automaticamente | `fix-seo-with-ai` |
| `seo snapshot <blog_id>` | Salvar snapshot de posições | `save-seo-snapshot` |
| `seo broken <blog_id>` | Verificar links quebrados | `check-broken-links` |
| `seo batch <blog_id>` | Sugestões em lote | `batch-seo-suggestions` |

## Pesos de score (alinhado com contentScoring.ts)

| Categoria | Peso |
|-----------|------|
| Technical SEO | 25% |
| Content Quality + E-E-A-T | 20% |
| On-Page SEO (title, meta, H1) | 15% |
| Schema / Structured Data | 15% |
| Performance (CWV) | 10% |
| Image Optimization + Alt Text | 10% |
| AI Search Readiness (GEO/AEO) | 5% |

## Regras críticas (2026)

1. **INP não FID** — FID foi removido em setembro de 2024. Métrica de interatividade é INP.
2. **FAQ schema restrito** — FAQPage limitado a sites governamentais/saúde desde agosto 2023. NÃO recomendar para clientes comerciais.
3. **HowTo schema depreciado** — Removido completamente em setembro 2023.
4. **JSON-LD sempre** — Nunca recomendar Microdata ou RDFa. Usar `<script type="application/ld+json">`.
5. **E-E-A-T universal** — Desde dezembro 2025, aplica-se a TODAS as queries competitivas, não só YMYL.
6. **Mobile-first completo** — 100% mobile-first indexing desde julho 2024.
7. **AI crawlers** — Verificar robots.txt para: GPTBot, ClaudeBot, PerplexityBot, Applebot-Extended, Google-Extended.

## Fluxo de audit

```
1. Ler artigo do banco (articles table)
2. Verificar: title (50-60 chars), meta_description (140-160 chars), H1 único
3. Analisar content_score existente (caso já tenha sido calculado)
4. Verificar schema_json no artigo
5. Checar imagens sem alt_text via imageAltGenerator.ts
6. Verificar keyword density (keywordGenerator.ts)
7. Gerar ACTION-PLAN com itens priorizados por impacto
```

## Output padrão

```json
{
  "overall_score": 0-100,
  "categories": {
    "technical": { "score": 0-100, "issues": [] },
    "content": { "score": 0-100, "issues": [] },
    "on_page": { "score": 0-100, "issues": [] },
    "schema": { "score": 0-100, "issues": [] },
    "geo_readiness": { "score": 0-100, "issues": [] }
  },
  "action_plan": [
    { "priority": "critical|high|medium|low", "fix": "string", "impact": "string" }
  ]
}
```

## Integração com OmniSeen

- Score salvo em: `articles.content_score`
- Schema salvo em: `articles.schema_json`
- Snapshots em: `seo_snapshots` table
- GEO score em: `seo_geo_readiness` table (Fase 1 — migration 20260401)
