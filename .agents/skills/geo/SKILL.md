---
name: omniseen-geo
description: >
  Módulo GEO (Generative Engine Optimization) e AEO (Answer Engine Optimization)
  para otimizar artigos OmniSeen para citação em Google AI Overviews, ChatGPT Search
  e Perplexity. Use quando o usuário pedir: "otimizar para IA", "GEO", "AEO",
  "Google AI Overviews", "ChatGPT me citar", "aparecer no Perplexity",
  "otimização para IA generativa".
---

# OmniSeen GEO Skill

Otimização para AI Search Engines (Google AI Overviews, ChatGPT, Perplexity).
Em 2026, 65% das buscas terminam sem clique. O conteúdo precisa rankear no Google
E ser citado por IA. Este skill cobre a segunda camada — a mais negligenciada.

## Status no OmniSeen

| Componente | Status |
|-----------|--------|
| Migration `seo_geo_readiness` | ✅ Criada (20260401030000) |
| Migration `geo_recommendations` | ✅ Criada (20260401030000) |
| Edge Function `evaluate-geo-readiness` | ❌ **PENDENTE — próximo passo** |
| Hook no orchestrator pós SAVE_ARTICLE | ❌ Pendente |
| UI de score GEO | ❌ Pendente |
| `geoWriterCore.ts` | ✅ Existe (EEAT directions) |
| `geoUtils.ts` | ✅ Existe |

## As 4 dimensões do score GEO OmniSeen

Baseado na tabela `seo_geo_readiness` já criada:

| Dimensão | Peso | O que avalia |
|----------|------|-------------|
| `entity_coverage_score` | 30% | Entidades nomeadas, datas, dados factuais |
| `structure_score` | 25% | H2/H3 claros, listas, tabelas, FAQ |
| `authority_signals_score` | 25% | Autor, fontes citadas, data publicação |
| `format_readability_score` | 20% | Parágrafos curtos, definições diretas, respostas completas |

**Score total → geo_tier:** `baixo` (<40) | `medio` (40-70) | `alto` (>70)

## O que torna um artigo "AI-citável"

### 1. Entidades e facticidade (entity_coverage)
- Mencionar nomes, datas, números específicos
- Citar fontes (IBGE, estudos, pesquisas)
- Dados verificáveis, não opiniões genéricas
- Perguntas do tipo "Quem, O que, Quando, Onde, Por que" respondidas

### 2. Estrutura para extração (structure)
- H2/H3 com respostas diretas (sem rodeios)
- Listas para enumerações (LLMs extraem listas)
- Tabelas para comparações
- FAQ com perguntas reais de busca
- Parágrafos curtos (1-3 linhas máximo)

### 3. Sinais de autoridade (authority_signals)
- Nome do autor com bio
- Data de publicação e atualização
- Links para fontes primárias
- Schema de autor (Person JSON-LD)
- E-E-A-T explícito no conteúdo

### 4. Legibilidade para extração (format_readability)
- Definições no formato "X é Y" (ideal para featured snippets)
- Respostas completas em 1-2 frases para queries diretas
- Evitar dependência de contexto anterior para cada seção
- Cada H2 deve ser independentemente legível

## Comandos disponíveis

| Comando | O que faz | Status |
|---------|-----------|--------|
| `geo score <article_id>` | Calcular score GEO | ❌ evaluate-geo-readiness pendente |
| `geo optimize <article_id>` | Sugestões para melhorar GEO | ❌ Pendente |
| `geo audit <blog_id>` | Audit GEO do blog inteiro | ❌ Pendente |
| `geo check entity <article_id>` | Verificar cobertura de entidades | Parcial (entityExtraction) |

## Diferença GEO vs SEO tradicional

| Aspecto | SEO Tradicional | GEO (AI Search) |
|---------|----------------|-----------------|
| Objetivo | Rankear na página 1 | Ser citado pela IA |
| Formato ideal | Long-form fluido | Blocos extraíveis e independentes |
| Links | Backlinks importam | Autoridade E-E-A-T importa |
| Keywords | Densidade e LSI | Entidades e contexto factuais |
| Estrutura | H1-H6 para leitura | H2-H3 como "perguntas respondidas" |
| Medição | Posição no Google | Citações em AI Overviews/ChatGPT |

## Como implementar `evaluate-geo-readiness`

A Edge Function precisa:

```typescript
// Input: article_id
// 1. Buscar artigo + blog do banco
// 2. Parsear HTML para extrair entidades (nomes, datas, números)
// 3. Contar H2/H3, listas (<ul>/<ol>), tabelas (<table>)
// 4. Verificar presença de autor, data, schema JSON-LD
// 5. Calcular os 4 sub-scores
// 6. Salvar em seo_geo_readiness
// 7. Gerar recomendações em geo_recommendations
// Output: { geo_score, geo_tier, recommendations[] }
```

Tables já prontas:
- `seo_geo_readiness` (migration 20260401030000)
- `geo_recommendations` (migration 20260401030000)
