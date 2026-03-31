# OMNISEEN SUPER PAGE ENGINE V2 — Full Refactor Plan

**Objetivo:** Transformar o projeto omniseeblog (Lovable) em um motor dual (Super Pages + Articles) com pipeline unificado, SEO estruturado ao estilo SEOwriting.ai, e geração de imagens via Gemini Nano Banana.

**Status:** Pipeline V2 **implementado** em `orchestrate-generation`; este documento foi sincronizado com o código (2026-03). Roadmap abaixo cobre gaps restantes e hardening.

**Documentação relacionada:** [docs/SERP-DATA-SOURCES.md](docs/SERP-DATA-SOURCES.md) (SERP LLM vs `analyze-serp`), [docs/CONTENT-API-SECURITY.md](docs/CONTENT-API-SECURITY.md), [docs/OBSERVABILITY-METRICS.md](docs/OBSERVABILITY-METRICS.md).

---

## PARTE 1 — ARQUITETURA ATUAL (ALINHADA AO CÓDIGO)

### 1.1 Fluxo de geração (`orchestrate-generation` V2)

| Etapa | Onde | O que faz |
|-------|------|-----------|
| **Entrada** | `create-generation-job` | Cria `generation_jobs`, invoca `orchestrate-generation`. |
| **INPUT_VALIDATION** | `orchestrate-generation` + [`_shared/pipelineInputValidation.ts`](supabase/functions/_shared/pipelineInputValidation.ts) | Keyword (≥2 chars), niche obrigatórios. Coberto por testes Vitest em `tests/`. |
| **SERP_ANALYSIS** | `executeSerpSummary` → `ai-router` (`serp_summary`) | Resumo competitivo **por LLM** (~300 palavras); **não** é SERP API ao vivo. |
| **SERP_GAP_ANALYSIS** | LLM sobre o resumo anterior | Gaps semânticos / tópicos concorrentes (derivados do texto, não de SERP real). |
| **OUTLINE_GEN** | `ai-router` | Outline obrigatório antes do conteúdo. |
| **AUTO_SECTION_EXPANSION** | Pipeline V2 | Expansão de seções conforme implementação atual. |
| **ENTITY_EXTRACTION / ENTITY_COVERAGE** | Pipeline V2 | Entidades e cobertura para conteúdo e quality gate. |
| **CONTENT_GEN** | `ai-router` (ex.: `article_gen_from_outline`) | Conteúdo orientado a outline; intervalo de palavras via `resolveWordRange` e `job_type` (`article` vs `super_page`). |
| **SAVE_ARTICLE** | `orchestrate-generation` | Persistência em `articles` (incl. `content_type` quando aplicável — ver migração phase0). |
| **IMAGE_GEN** | Pipeline V2 (ex.: Gemini / gateway) | Hero + seções no fluxo principal (não só regenerate posterior). |
| **INTERNAL_LINK_ENGINE** | Pipeline V2 | Links internos no fluxo principal. |
| **SEO_SCORE** | Integrado ao job | Score antes de concluir. |
| **QUALITY_GATE** | [`_shared/superPageEngine.ts`](supabase/functions/_shared/superPageEngine.ts) | Limiares (palavras, FAQ, entidades, etc.); pode bloquear publish. |

**Outros pontos de entrada:** `process-queue`, `convert-opportunity-to-article`, `article-chat`, UIs de geração.

**Conclusão:** O motor **não** é mais single-pass de 900–1500 palavras; é um pipeline multi-etapa com `super_page` vs `article`. O gap principal de produto continua sendo **SERP verificável no passo inicial** (ver doc SERP).

---

### 1.2 Supabase — tabelas relevantes

| Tabela | Papel no motor |
|--------|-----------------|
| **articles** | Conteúdo final + **`content_type`** (`article` \| `super_page`), `schema_json` / alvos conforme migração phase0. |
| **generation_jobs** | `job_type` **`article` \| `super_page`** — **lido no orquestrador** (`resolveWordRange`, CONTENT_GEN, etc.). |
| **generation_steps** | Log por passo; nomes V2 incluem `SERP_ANALYSIS`, `OUTLINE_GEN`, `CONTENT_GEN`, `IMAGE_GEN`, `INTERNAL_LINK_ENGINE`, `SEO_SCORE`, `QUALITY_GATE`, etc. |
| **generation_queue** | Fila alternativa (batch); não é a principal para o fluxo atual. |
| **article_queue** | Fila de temas (suggested_theme, status); consumida por `process-queue` que chama `create-generation-job`. |
| **article_opportunities** | Oportunidades do Radar; convertidas via `convert-opportunity-to-article`. |
| **editorial_templates** | Template por blog (company_name, target_niche, mandatory_structure, title_guidelines, tone_rules, cta_template, image_guidelines). Usado em process-queue e contexto de geração. |
| **business_profile** | Nome, telefone, nicho, etc.; usado para CTA e contexto. |
| **content_preferences** | Preferências e `ai_model_text`. |
| **ai_content_cache** | Cache de conteúdo (article/image/seo) por hash. |
| **article_content_scores** | Scores de conteúdo/SEO. |
| **article_internal_links**, **cluster_articles** | Alimentados pelo **INTERNAL_LINK_ENGINE** no pipeline V2 (validar dados reais por ambiente). |
| **serp_analysis_cache** | Cache de análise SERP (usado por seo-enhancer-job / analyze-serp). |

**Schema:** ver migração `20260223120000_phase0_content_type_and_schema.sql` e tipos gerados em `src/integrations/supabase/types.ts`.

---

### 1.3 API routes (Edge Functions) — resumo

| Função | Propósito |
|--------|-----------|
| **create-generation-job** | Entrada do motor; cria job e invoca orchestrate-generation. |
| **orchestrate-generation** | Pipeline V2 multi-etapa (ver §1.1). |
| **process-queue** | Lê `article_queue`, chama create-generation-job. |
| **convert-opportunity-to-article** | Cria placeholder em articles, chama create-generation-job. |
| **ai-router** | Única camada de chamadas LLM (Lovable AI Gateway); tasks: serp_summary, article_gen_single_pass, title_gen, outline_gen, content_gen, etc. |
| **generate-image** | Geração genérica de imagem (prompt, context hero/cover/problem/solution/result); perfis por nicho; cache; upload em article-images. |
| **regenerate-article-images** | Regenera hero + N imagens de seção; usa `imageInjector` para injetar no HTML. |
| **regenerate-single-image** | Regenera uma imagem (capa ou interna por índice). |
| **build-article-outline** | Outline por opportunity; o pipeline principal usa passo OUTLINE_GEN interno ao orquestrador. |
| **analyze-serp** | Análise SERP (Firecrawl/LLM); usado por seo-enhancer-job. |
| **seo-enhancer-job** | Pós-geração: SERP profundo, FAQs, content gaps; não bloqueia UI. |
| **calculate-content-score** | Score de conteúdo. |
| **suggest-themes**, **suggest-keywords**, **suggest-niche-keywords** | Sugestões de tema/keyword. |
| **translate-article** | Tradução. |
| **improve-article-complete**, **improve-seo-item**, **polish-article-final** | Melhorias de texto/SEO. |
| **quality-gate** | Validação antes de publicar. |
| **publish-to-cms**, **schedule-articles**, **publish-scheduled-articles** | Publicação e agendamento. |
| **track-analytics**, **track-link-click** | Analytics. |
| Outras | send-email, weekly-market-intel, article-chat, support-chat, check-limits, check-cache, save-cache, Stripe, etc. |

---

### 1.4 Lógica de criação de conteúdo (texto)

- **Conteúdo principal:** multi-etapa: outline → entidades → **CONTENT_GEN** (não depende de `article_gen_single_pass` como único caminho).  
- **SERP:** passo **SERP_ANALYSIS** continua a ser **LLM-only**; dados Firecrawl/SerpAPI ficam em **`analyze-serp`** / jobs auxiliares — ver [docs/SERP-DATA-SOURCES.md](docs/SERP-DATA-SOURCES.md).  
- **Task legada `article_gen_single_pass`:** pode existir no `ai-router` para outros fluxos; o orquestrador V2 prioriza geração a partir de outline.

---

### 1.5 Lógica de geração de imagens

- **Pipeline V2:** passo **IMAGE_GEN** cobre hero + seções no fluxo principal (detalhe de modelo: ver `_shared/geminiImageGenerator.ts` / gateway).  
- **regenerate-article-images** permanece útil para **regeração manual** ou correções.

---

## PARTE 2 — GAPS E INCONSISTÊNCIAS (ATUALIZADO)

1. **SERP verificável no início do pipeline** — Ainda em aberto: integrar `analyze-serp` ou API SERP **antes** de outline/conteúdo, ou alinhar copy do produto com “análise de mercado por IA”.  
2. **Enums SQL legados** — Migrações antigas podem referir `generation_step_name` obsoleto; confirmar só TEXT + regex em ambientes novos.  
3. **Hardening** — CORS: [`_shared/httpCors.ts`](supabase/functions/_shared/httpCors.ts) + `ALLOWED_CORS_ORIGINS`; Content API: rate limit + cache — [docs/CONTENT-API-SECURITY.md](docs/CONTENT-API-SECURITY.md).  
4. **Testes** — Vitest em `tests/`; expandir para mais passos puros e contratos HTTP.  
5. **Observabilidade** — Métricas sugeridas em [docs/OBSERVABILITY-METRICS.md](docs/OBSERVABILITY-METRICS.md).

**Resolvido no código (frente ao plano antigo):** uso de `job_type`, pipeline multi-etapa, `content_type` em `articles`, outline/entidades/links/score/quality gate no orquestrador, imagens no fluxo principal.

---

## PARTE 3 — MÓDULOS QUE FALTAM (PARA V2)

> **Nota:** Vários itens abaixo já têm contraparte no `orchestrate-generation` V2 (outline, entidades, links, score, dual `job_type`). Use esta lista como **backlog de produto** (SERP real, schema JSON-LD completo, provider de imagem unificado, etc.), não como descrição do estado atual do código.

1. **Tipagem de conteúdo (Super Page vs Article)**  
   - Schema: `content_type` em `articles` (e/ou uso consistente de `generation_jobs.job_type`).  
   - Regras de palavra: Super Page 3000–6000; Article 1500–3000.  
   - UI: seleção de tipo ao criar job.

2. **SERP como passo de entrada**  
   - Módulo de análise SERP (real: API DataForSEO/SerpAPI/Firecrawl ou híbrido) que alimente outline e entidades.  
   - Integração no pipeline antes de outline (não só em background).

3. **Outline obrigatório no pipeline**  
   - Geração de outline (H1/H2/H3) como passo explícito após SERP, com formato estável (ex.: JSON) para o passo de conteúdo.  
   - Reutilizar/expandir `build-article-outline` e integrar em `orchestrate-generation`.

4. **Entidades semânticas**  
   - Passo que extrai/gera entidades (tópicos, termos, pessoas, lugares) a partir de keyword + SERP + outline.  
   - Armazenamento: nova tabela ou JSONB em job/artigo para uso em conteúdo e internal linking.

5. **Clusters de autoridade e internal linking**  
   - Definição de clusters (pillar + clusters) por blog/niche.  
   - Passo que sugere/insere links internos no conteúdo (usando `article_internal_links` e `cluster_articles`).  
   - Dados de entidades e outline como entrada.

6. **Conteúdo estilo SEOwriting.ai (Super Page)**  
   - Estrutura fixa: introdução, seções por H2/H3, FAQ, schema-ready.  
   - Tamanho 3000–6000 palavras; uso de entidades e clusters no prompt.  
   - Article: 1500–3000 palavras, SEO local, expansão de keywords (NLP).

7. **FAQ + schema pronto**  
   - Geração de FAQ no conteúdo e gravação em campo estruturado (já existe `articles.faq`).  
   - Geração de JSON-LD (FAQPage, Article) e armazenamento (ex.: campo `schema_json` ou similar) para publicação.

8. **Pipeline de imagens unificado (Gemini Nano Banana)**  
   - Substituir/abstrair o uso atual de Lovable Gateway para imagens por **Gemini Nano Banana** (API exata a confirmar).  
   - No pipeline: hero + imagens por seção + ilustrações contextuais, no mesmo fluxo (não só “regenerate” depois).  
   - Módulo de geração que receba outline/seções e devolva lista de imagens (hero + section + contextual) e upload em `article-images`, atualizando `articles.featured_image_url` e `content_images`.

9. **Passo de SEO score antes de publish**  
   - Cálculo de score (reutilizar/estender `calculate-content-score`) como passo do pipeline.  
   - Opcional: quality-gate que exige score mínimo para permitir publish.

10. **Orquestração dual (Super Page vs Article)**  
    - Um único orquestrador que, a partir de `job_type` (e/ou `content_type`), escolhe:  
      - tamanho e prompts (Super Page vs Article),  
      - passos de outline/entidades/clusters,  
      - número e tipo de imagens (hero + section + contextuais).  

---

## PARTE 4 — ROADMAP DE REFATORAÇÃO

### Fase 0 — Preparação (schema e contratos)

- **0.1** Adicionar em `articles`: `content_type` (`article` \| `super_page`), opcionalmente `word_count_target`, `schema_json` (JSONB) para FAQ/Article schema.  
- **0.2** Garantir que `create-generation-job` e UIs aceitem e persistam `job_type` (e que seja lido no orchestrate).  
- **0.3** Documentar contrato do pipeline V2 (passos, nomes, input/output por passo) e decidir se `generation_step_name` fica só como TEXT.

### Fase 1 — Pipeline linear único (article atual melhorado)

- **1.1** Introduzir passo **SERP_ANALYSIS** real (ou híbrido) no início: keyword → análise SERP → output usado em outline e conteúdo.  
- **1.2** Incluir passo **OUTLINE_GEN** obrigatório após SERP: chamar `build-article-outline` ou equivalente com output SERP; output estável (JSON) para o próximo passo.  
- **1.3** Alterar **ARTICLE_GEN** para ser “outline-driven”: receber outline + SERP + entidades (fase 2); manter article 1500–3000 palavras como primeiro alvo.  
- **1.4** Adicionar passo **SEO_SCORE** após SAVE_ARTICLE (e antes ou depois de imagens); persistir em `article_content_scores` e opcionalmente em job.

### Fase 2 — Super Pages e entidades

- **2.1** Implementar ramo **Super Page** no orquestrador: mesmo pipeline mas com passo de conteúdo 3000–6000 palavras, estrutura SEOwriting.ai, FAQ + schema.  
- **2.2** Módulo de **entidades semânticas**: passo que recebe keyword + SERP + outline e devolve entidades (JSON); armazenar em job ou em novo campo em `articles`.  
- **2.3** Integrar entidades nos prompts de conteúdo (Super Page e Article).  
- **2.4** Módulo de **internal linking**: usar clusters + entidades + artigos existentes para sugerir/inserir links; persistir em `article_internal_links` / `cluster_articles`.

### Fase 3 — Imagens (Gemini Nano Banana)

- **3.1** Definir API “Gemini Nano Banana” (ou Imagen/outro) e criar cliente/Edge Function para geração de imagem.  
- **3.2** Abstrair camada de imagens: interface única (ex.: “ImageProvider”) com implementação Lovable atual e implementação Gemini Nano Banana; config por env ou por blog.  
- **3.3** No pipeline: passo **IMAGE_GEN** que gera hero + N imagens de seção (a partir do outline) + ilustrações contextuais; upload e atualização de `featured_image_url` e `content_images`; usar `imageInjector` para injetar no HTML.  
- **3.4** Remover dependência de “regenerate-article-images” para o fluxo principal (manter como fallback/regeneração manual).

### Fase 4 — SEO avançado e publish

- **4.1** FAQ e JSON-LD: gerar e guardar `schema_json` (FAQPage + Article) em `articles`.  
- **4.2** Quality gate: opcionalmente bloquear publish se SEO score &lt; threshold.  
- **4.3** Passo **PUBLISH** (opcional no pipeline): marcar publicado, notificar, IndexNow, etc.

### Fase 5 — Limpeza e observabilidade

- **5.1** Deprecar/remover passos e enums órfãos; alinhar nomes de passos em código e em relatórios.  
- **5.2** Logs e métricas por passo (latência, custo, tipo de conteúdo).  
- **5.3** Documentação da arquitetura V2 e runbook de deploy (incl. Vercel).

---

## RESUMO EXECUTIVO

| Aspecto | Código atual (V2) | Próximo alvo (produto) |
|--------|-------------------|-------------------------|
| **Tipos de conteúdo** | `job_type` + `articles.content_type`; intervalos por `resolveWordRange` | Refinar UX e relatórios por tipo |
| **SERP** | LLM no passo `SERP_ANALYSIS`; Firecrawl em `analyze-serp` (fora do core) | **SERP verificável** alimentando outline (Fase 1.1) |
| **Outline** | Passo `OUTLINE_GEN` no orquestrador | Melhorar com dados SERP reais |
| **Entidades / links** | Passos `ENTITY_*`, `INTERNAL_LINK_ENGINE` | Validação em produção + clusters |
| **Imagens** | Passo `IMAGE_GEN` no pipeline | Consolidar provider / custo (Fase 3) |
| **FAQ / schema** | FAQ em `articles`; `schema_json` na migração phase0 | Garantir geração/publish JSON-LD em todos os fluxos |
| **Pipeline** | Multi-etapa até `QUALITY_GATE` | SERP real + observabilidade (ver docs) |

**Próximo passo recomendado:** (1) Integrar dados SERP reais no início do orquestrador ou ajustar messaging do produto — [docs/SERP-DATA-SOURCES.md](docs/SERP-DATA-SOURCES.md). (2) Exportar métricas de `generation_steps` — [docs/OBSERVABILITY-METRICS.md](docs/OBSERVABILITY-METRICS.md). (3) Fase 0 já aplicada no schema: validar UIs e jobs antigos.
