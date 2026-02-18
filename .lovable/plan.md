

# SAFE_MODE V1.1 — Estabilizacao Definitiva do Pipeline

## Diagnostico

O arquivo `generate-article-structured/index.ts` tem 3353 linhas com multiplas camadas que executam incondicionalmente. Nao existe nenhum SAFE_MODE flag. Todas as camadas (Elite Engine, footprintChecks, anti-template, mutation, SEO job, image background job, localIntelligence, outline builder, research) rodam sempre, causando:

- Timeouts por excesso de chamadas AI (writer + SEO + QA + mutation + images)
- Cidade "Brasil" porque o prompt fica gigante e o modelo ignora instrucoes
- CTA destruido pela mutation pos-CTA
- Payload null quando getEditorialDecision falha
- Imagens inconsistentes com timeout de 5s + background job complexo

## Plano de Implementacao

### 1. Adicionar flag SAFE_MODE (linha ~98)

Adicionar `const SAFE_MODE = true;` apos corsHeaders.

### 2. Corrigir prioridade de cidade (linhas 1610-1657)

A prioridade atual e: requestCity > territory > business_profile. O pedido exige business_profile primeiro.

Reordenar para:
1. business_profile.city (buscar ANTES de tudo)
2. requestCity
3. territoryData
4. regex no theme
5. google_place
6. "Brasil"

Mover o bloco de business_profile (linhas 1620-1634) para ANTES da linha 1617, e ajustar a logica de fallback.

### 3. Bypass do Elite Engine em SAFE_MODE (linhas 1686-1722)

Envolver `getEditorialDecision()` em `if (!SAFE_MODE)`. Quando SAFE_MODE, usar fallback estatico direto com `version: 'CORE_SAFE_V1.1'`.

### 4. Bypass anti-template detector (linhas 1724-1748)

Envolver em `if (!SAFE_MODE)`.

### 5. Bypass outline builder (linhas 1770-1784)

Envolver em `if (!SAFE_MODE)`.

### 6. Bypass Research/Perplexity (linhas 1801-1844)

Envolver em `if (!SAFE_MODE)`. Quando SAFE_MODE, usar pacote minimo direto (sem chamada Perplexity).

### 7. Simplificar system prompt em SAFE_MODE (linhas 2005-2035)

Quando SAFE_MODE, remover do systemPrompt:
- `nichePromptBlock`
- `outlineInstruction`
- `editorialConfig.instructions`
- `eliteEngineAngleInstructions`
- `eliteEnginePromptBlocks`
- `eliteEngineRhythm`
- `localIntelligencePrompt`
- `HEADING_BLACKLIST_PROMPT`

Manter apenas: GEO_WRITER_IDENTITY, territorial context, buildMasterPrompt, regra de localizacao, HIERARCHY_RULES.

### 8. Imagens em SAFE_MODE (linhas 2037-2041 + 2610-2660)

Quando SAFE_MODE:
- `targetImageCount = 1` (apenas capa)
- Timeout = 15000ms (em vez de 5000ms)
- Seed baseada no articleId para evitar repeticao
- Sem placeholders Unsplash automaticos — so fallback real

### 9. Bypass footprintChecks completo (linhas 2700-2884)

Envolver todo o bloco em `if (!SAFE_MODE)`. Valores default para similarity_score, h2PatternHash, etc.

### 10. Enforcement de cidade no H1 pos-writer (linhas 2406-2452)

Manter a logica atual (ja existe), mas simplificar: usar `content.replace(/^# (.*)$/m, ...)` conforme pedido do usuario — substituir "Brasil" pela cidade no H1, ou adicionar " em {city}" se ausente.

### 11. Paragrafos — usar threshold de 700 chars (linhas 2475-2484)

Ajustar threshold de 700 para 700 (ja esta). Manter logica existente que e segura.

### 12. CTA como ultimo passo (linhas 2952-2981 e 3028-3060)

A logica de CTA ja executa APOS sanitize. Em SAFE_MODE, como footprintChecks esta desativado, nao ha risco de mutation destruir o CTA. Adicionar flag `cta_injected: hasValidCTA(contentFinal)` no payload.

### 13. Persistencia SEMPRE preenchida (linhas 3083-3110 e 3148-3175)

Quando SAFE_MODE, o `source_payload` nao depende de `eliteEngineDecision` (que pode ser null). Usar payload fixo:

```text
source_payload: {
  eliteEngine: {
    version: 'CORE_SAFE_V1.1',
    safe_mode: true,
    city: city,
    niche_normalized: normalizeNiche(effectiveNiche),
    structure_type: 'complete_guide',
    similarity_score: 0,
    images_pending: false,
    serp_pending: false,
    cta_injected: hasValidCTA(finalContent)
  }
}
```

Substituir a condicao ternaria `eliteEngineDecision ? {...} : articleEnginePayload` por payload fixo em SAFE_MODE.

### 14. Desativar seo-enhancer-job dispatch (linhas 3200-3216)

Envolver em `if (!SAFE_MODE)`.

### 15. Desativar background image dispatch (linhas 3218-3267)

Envolver em `if (!SAFE_MODE)`.

## Resumo de Impacto

| Camada | Antes | SAFE_MODE V1.1 |
|--------|-------|-----------------|
| getEditorialDecision | Sempre (falha frequente) | SKIP — fallback estatico |
| Anti-Template | Sempre (query DB) | SKIP |
| Outline Builder | Sempre | SKIP |
| Research (Perplexity) | Sempre (pode falhar) | SKIP — pacote minimo |
| System Prompt | ~2000 chars de injecoes extras | Limpo e direto |
| Imagens | 3-10 com timeout 5s + background | 1 imagem, timeout 15s |
| FootprintChecks + Mutation | Sempre (query 30+ rows + AI call) | SKIP |
| SEO Enhancer Job | Fire-and-forget | SKIP |
| Background Images Job | Fire-and-forget | SKIP |
| Persistencia payload | Depende de eliteEngineDecision | Sempre preenchido |

Tempo estimado de geracao: de 60-120s para 15-30s.

## Arquivo Modificado

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/generate-article-structured/index.ts` | SAFE_MODE flag + 12 bypasses condicionais + cidade prioridade corrigida + payload fixo |

## O que NAO sera alterado

- aiProviders.ts, aiConfig.ts, templateSelector.ts
- editorialOrchestrator.ts, footprintChecks.ts, localIntelligence.ts
- editorialContract.ts (CTA injection)
- seo-enhancer-job/index.ts
- buildMasterPrompt (modelo local ja reescrito — manter como esta)
- buildImagePrompts (ja reescrito por nicho — manter)
- Queue, polling, integracoes externas

## Sequencia de Deploy

1. Adicionar SAFE_MODE flag e todos os bypasses
2. Corrigir prioridade de cidade
3. Simplificar system prompt
4. Payload fixo em SAFE_MODE
5. Deploy edge function
6. Gerar 1 artigo teste
7. Validar: cidade no H1, CTA presente, payload preenchido, sem timeout

