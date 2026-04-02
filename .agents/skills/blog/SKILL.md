---
name: omniseen-blog
description: >
  Motor editorial inteligente para criação, reescrita e otimização de artigos no OmniSeen.
  Use quando o usuário pedir: "criar artigo", "reescrever", "melhorar conteúdo",
  "gerar outline", "verificar qualidade", "detectar canibalização", "repurpose".
  Integra com: orchestrate-generation, build-article-outline, improve-article-complete,
  review-article, polish-article-final, auto-fix-article.
---

# OmniSeen Blog Skill

Motor editorial baseado nos padrões do `claude-blog` adaptados ao stack OmniSeen.
O projeto já possui `promptTypeCore.ts` (funil top/mid/bottom) e `templateSelector.ts`
(5 templates + anti-padrão). Este skill ESTENDE essas capacidades.

## O que JÁ EXISTE no OmniSeen (não reimplementar)

| Feature | Arquivo | Status |
|---------|---------|--------|
| Templates estruturais (5 tipos) | `templateSelector.ts` | ✅ Implementado |
| Classificação de intenção | `templateSelector.ts:classifyIntent()` | ✅ Implementado |
| Anti-padrão (evita repetição) | `templateSelector.ts:applyAntiPattern()` | ✅ Implementado |
| Funil top/mid/bottom | `promptTypeCore.ts:FUNNEL_MODES` | ✅ Implementado |
| Identidade da IA por nicho | `promptTypeCore.ts:AI_IDENTITY` | ✅ Implementado |
| EEAT nos prompts | `geoWriterCore.ts`, `promptTypeCore.ts` | ✅ Parcial |
| Geração de imagens | `geminiImageGenerator.ts` | ✅ Implementado |
| Internal links | `batch-internal-links` | ✅ Implementado |
| Reescrita premium (GPT-4.1) | REWRITE_PREMIUM step | ✅ Implementado |
| Quality gate | `qualityGate.ts` | ✅ Implementado |
| Content scoring | `contentScoring.ts` | ✅ Implementado |

## O que FALTA implementar (gaps reais)

| Feature | Impacto | Como implementar |
|---------|---------|-----------------|
| **blog-cannibalization** | 🔴 Alto | Comparar keyword_target entre artigos do blog via similarityChecker.ts |
| **blog-factcheck** | 🟡 Médio | Adicionar step de verificação pós-geração com Google Grounding |
| **blog-repurpose** | 🟡 Médio | Edge Function nova: artigo → thread/email/post social |
| **headline-generator** | 🟡 Médio | Gerar 3-5 variações de título + score de CTR |
| **5 content types faltando** | 🟡 Médio | Adicionar: case_study, product_review, news_analysis, pillar, roundup |
| **blog-schema automático** | 🟡 Médio | Enriquecer schema_json pós-geração automaticamente |

## Templates disponíveis (mapeamento OmniSeen → claude-blog)

| OmniSeen templateSelector | claude-blog equivalente | Quando usar |
|---------------------------|------------------------|-------------|
| `complete_guide` | pillar page / how-to guide | keyword informacional ampla |
| `qa_format` | FAQ knowledge base | keyword com "o que é", "por que" |
| `comparative` | comparison / product review | keyword com "vs", "melhor", "qual" |
| `problem_solution` | case study / thought leadership | keyword transacional urgente |
| `educational_steps` | tutorial | keyword "como fazer", "passo a passo" |

**FALTAM mapear:** listicle (roundup), news analysis, data research

## Comandos disponíveis

| Comando | O que faz | Edge Function |
|---------|-----------|---------------|
| `blog write <keyword> <blog_id>` | Criar artigo completo | `orchestrate-generation` |
| `blog outline <keyword>` | Gerar outline antes de escrever | `build-article-outline` |
| `blog rewrite <article_id>` | Reescrever para premiumização | `improve-article-complete` |
| `blog analyze <article_id>` | Analisar qualidade | `review-article` |
| `blog cannibalization <blog_id>` | Detectar keywords duplicadas | ❌ A implementar |
| `blog repurpose <article_id>` | Transformar em outros formatos | ❌ A implementar |
| `blog headline <article_id>` | Gerar variações de título | ❌ A implementar |

## Fluxo de criação (pipeline orquestrado)

```
INPUT_VALIDATION
  → SERP_ANALYSIS (Google Grounding)
  → SERP_GAP_ANALYSIS (Jaccard Token Overlap)
  → OUTLINE_GEN (templateSelector + build-article-outline)
  → AUTO_SECTION_EXPANSION
  → ENTITY_EXTRACTION
  → ENTITY_COVERAGE
  → CONTENT_GEN (promptTypeCore + geoWriterCore)
  → REWRITE_PREMIUM (condicional - GPT-4.1)
  → SAVE_ARTICLE
  → IMAGE_GEN (geminiImageGenerator)
  → INTERNAL_LINK_ENGINE
  → SEO_SCORE (contentScoring)
  → QUALITY_GATE (qualityGate)
  → [PENDENTE] GEO_READINESS (evaluate-geo-readiness)
```

## Regras editoriais (do promptTypeCore.ts)

- Linguagem simples, humana, direta
- Parágrafos máximo 3 linhas
- Seção final SEMPRE → `## Próximo passo`
- Mínimo 2 blocos de destaque (`> *frase*`)
- Texto escaneável em 10 segundos
- Mobile-first
