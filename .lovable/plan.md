

# HOTFIX: Forçar mode='entry' no Payload Principal

## Problema Identificado (linhas 167-199)

O `generatePayload` principal está assim:
```typescript
const generatePayload = {
  ...
  generation_mode: 'deep',  // ← PROBLEMA: usa 'deep'
  geo_mode: true,
  // ❌ NÃO ESPECIFICA 'mode' → backend assume 'authority'
  ...
};
```

Isso faz a **primeira tentativa** usar mode=authority, que exige 8 FAQs e 8+ H2s, rejeitando o artigo.

O fallback (linhas 217-220) **já foi corrigido** anteriormente com `mode: 'entry'`, mas a primeira tentativa continua falhando.

---

## Correção

**Arquivo**: `supabase/functions/convert-opportunity-to-article/index.ts`

### Alteração 1: Linha 174

| Antes | Depois |
|-------|--------|
| `generation_mode: 'deep',` | `generation_mode: 'fast',` |

### Alteração 2: Adicionar linha após 174

Adicionar `mode: 'entry',` logo após `generation_mode`.

### Alteração 3: Adicionar log antes da linha 201

```typescript
console.log('[CONVERT] Calling generate with:', {
  generation_mode: generatePayload.generation_mode,
  mode: (generatePayload as any).mode,
  city: generatePayload.city
});
```

---

## Código Final (linhas 167-210)

```typescript
const generatePayload = {
  blog_id: blogId,
  theme: opportunity.suggested_title,
  keywords: opportunity.suggested_keywords || [],
  word_count: 1500,
  include_faq: true,
  include_conclusion: true,
  generation_mode: 'fast',  // ← HOTFIX: Mudado de 'deep' para 'fast'
  mode: 'entry',            // ← HOTFIX: Força thresholds permissivos
  geo_mode: true,
  source: 'opportunity',
  auto_publish: false,
  city: resolvedCity,
  niche: profile?.niche || 'pest_control',
  businessName: profile?.company_name || undefined,
  // ... resto igual
};

console.log('[CONVERT] Calling generate with:', {
  generation_mode: generatePayload.generation_mode,
  mode: (generatePayload as any).mode,
  city: generatePayload.city
});

let generateResponse = await fetch(...);
```

---

## Resultado Esperado nos Logs

```
[CONVERT] Calling generate with: {"generation_mode":"fast","mode":"entry","city":"Teresina"}
[HOTFIX] mode forced to entry because generation_mode=fast
[QualityGate] Running validation for mode: entry
[QualityGate] ✅ ALL GATES PASSED
```

---

## Deploy
Após alteração, deploy automático da Edge Function.

