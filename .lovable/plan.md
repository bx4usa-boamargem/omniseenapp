

# Eliminação de Propagação 422 — convert-opportunity-to-article V4.5

## Objetivo

Eliminar completamente qualquer possibilidade de propagação de status 422 no arquivo `convert-opportunity-to-article/index.ts`, garantindo que o pipeline de conversão de oportunidades nunca retorne erro 422 relacionado a Quality Gate ou conteúdo.

---

## Problema Atual

**Linhas 397-426** do arquivo `supabase/functions/convert-opportunity-to-article/index.ts`:

```typescript
// CÓDIGO ATUAL (PROBLEMÁTICO)
if (!generateResponse.ok) {
  console.error(`[${requestId}][CONVERT] Article generation failed:`, responseText);
  
  try {
    const errorData = JSON.parse(responseText);
    const statusCode = generateResponse.status === 422 ? 422 : 500;  // ⚠️ PROPAGA 422
    return new Response(
      JSON.stringify({
        success: false,
        error_type: statusCode === 422 ? 'QUALITY_GATE_FAILED' : 'GENERATION_FAILED',  // ⚠️ USA QUALITY_GATE_FAILED
        // ...
      }),
      { status: statusCode, headers: {...} }  // ⚠️ PODE RETORNAR 422
    );
  } catch {
    // ...
  }
}
```

---

## Alteração Necessária

**Substituir linhas 397-426** por:

```typescript
if (!generateResponse.ok) {
  console.error(`[${requestId}][CONVERT] Article generation failed:`, responseText);
  
  // V4.5: NUNCA propagar 422 - Quality Gate é non-blocking
  // Qualquer erro do generate-article-structured é tratado como erro interno 500
  try {
    const errorData = JSON.parse(responseText);
    const statusCode = 500; // V4.5: SEMPRE 500 - nunca propagar 422
    console.warn(`[${requestId}][PIPELINE] Forcing error response as 500 (original status: ${generateResponse.status})`);
    return new Response(
      JSON.stringify({
        success: false,
        error_type: 'GENERATION_FAILED', // V4.5: Nunca usar QUALITY_GATE_FAILED no retorno
        reason_code: errorData.code || errorData.error || 'unknown',
        message: errorData.message || `Falha na geração do artigo (erro interno)`,
        request_id: requestId,
        debug: errorData.debug || null,
      }),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error_type: 'GENERATION_FAILED',
        message: `Falha na geração do artigo (erro interno)`,
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

---

## Mudanças Específicas

| Item | Antes | Depois |
|------|-------|--------|
| statusCode | `generateResponse.status === 422 ? 422 : 500` | `500` (fixo) |
| error_type | `statusCode === 422 ? 'QUALITY_GATE_FAILED' : 'GENERATION_FAILED'` | `'GENERATION_FAILED'` (fixo) |
| Mensagem | `Falha na geração do artigo (${generateResponse.status})` | `Falha na geração do artigo (erro interno)` |
| Log adicional | Nenhum | `console.warn('[PIPELINE] Forcing error response as 500')` |

---

## Verificação Global

**Busca por `status: 422` no projeto:**

| Arquivo | Ocorrência | Ação |
|---------|------------|------|
| `generate-image/index.ts` linha 293 | Validação de input de imagem individual | Nenhuma (não é Quality Gate) |
| `convert-opportunity-to-article/index.ts` | Propagação do status 422 | **Será eliminada** |

**Busca por `statusCode === 422`:**

| Arquivo | Ocorrência | Ação |
|---------|------------|------|
| `convert-opportunity-to-article/index.ts` linha 407 | Decisão de error_type | **Será eliminada** |

---

## Arquivo a Modificar

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `supabase/functions/convert-opportunity-to-article/index.ts` | Substituir linhas 397-426 |

---

## Deploy

Realizar deploy forçado de:
1. `convert-opportunity-to-article` — Eliminação da propagação 422

---

## Validação Pós-Deploy

1. **Busca global** por `status: 422` deve retornar apenas `generate-image/index.ts` (não relacionado a Quality Gate)
2. **Busca global** por `statusCode === 422` deve retornar zero ocorrências
3. **Logs esperados** em caso de erro:
   ```text
   [abc123][CONVERT] Article generation failed: {...}
   [abc123][PIPELINE] Forcing error response as 500 (original status: 422)
   ```

---

## Seção Técnica

### Fluxo V4.5 Atualizado

```text
┌─────────────────────────────────────────────────────────────┐
│            convert-opportunity-to-article V4.5              │
├─────────────────────────────────────────────────────────────┤
│  1. Recebe oportunidade do frontend                         │
│                    ↓                                         │
│  2. Chama generate-article-structured                       │
│                    ↓                                         │
│  3. Se generate retornar erro (qualquer status):            │
│     - Log: [PIPELINE] Forcing error response as 500         │
│     - Retorna SEMPRE status 500                             │
│     - error_type: 'GENERATION_FAILED'                       │
│     - NUNCA retorna 422 ou QUALITY_GATE_FAILED             │
│                    ↓                                         │
│  4. Se sucesso:                                             │
│     - Processa normalmente                                  │
│     - Retorna 200 com article_id                            │
└─────────────────────────────────────────────────────────────┘
```

### Garantias V4.5

| Garantia | Status |
|----------|--------|
| `generate-article-structured` nunca retorna 422 | ✅ Implementado |
| `convert-opportunity-to-article` nunca propaga 422 | 🔄 Será implementado |
| Quality Gate sempre retorna `passed: true` | ✅ Implementado |
| Artigos são salvos como draft em caso de warnings | ✅ Implementado |
| `generation_stage = 'completed'` sempre executado | ✅ Implementado |

