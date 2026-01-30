
# Correção Crítica: Bug de Salvamento e Geração Duplicada

## Problema Identificado

A análise revelou um bug confirmado no banco de dados:
- **Artigos duplicados encontrados**: A mesma oportunidade (`0d3489ca-8fd9-44d8-a6b6-c07e2df97763`) gerou 2 artigos em ~1 minuto
- **Causa raiz**: Race condition - o backend verifica `status === 'converted'`, mas esse status só é definido **após** a geração completa

### Fluxo Problemático Atual

```text
Req A: check converted? → NO → gera artigo → UPDATE converted (45s depois)
Req B: check converted? → NO → gera artigo → UPDATE converted
                   ↑ Race: ambas passam porque A ainda não terminou
```

---

## Solução Proposta

### 1. FRONTEND — `ClientArticleEditor.tsx`

**A) Adicionar guard no useEffect de auto-run (linhas 351-382)**

Reforçar a verificação: se `articleId` existe, NÃO executar nenhuma geração automática.

```typescript
// AUTO-RUN MODE: If quick=true, auto-generate or convert opportunity
useEffect(() => {
  // 🛡️ GUARD: Se estamos editando um artigo existente, NÃO auto-gerar
  if (articleId) {
    console.log('[Auto-run] Skipping - editing existing article:', articleId);
    return;
  }

  if (
    quickMode &&
    blog?.id &&
    phase === 'form' &&
    !generationLockRef.current &&
    !autoGenerationTriggeredRef.current
  ) {
    // ... resto do código
  }
}, [quickMode, fromOpportunityParam, themeParam, blog?.id, phase, articleId]);
```

**B) Limpar URL params após navegação para edição**

Quando o artigo é criado e navegamos para `/client/articles/{id}/edit`, os query params `quick`, `fromOpportunity`, etc., devem ser limpos para evitar re-trigger.

No `handleConvertOpportunity`, após sucesso:

```typescript
// ✅ SUCESSO REAL - Limpar URL params antes de navegar
setGenerationStage('finalizing');
setGenerationProgress(100);
toast.success('Artigo criado com sucesso');

// Navegar SEM query params
smartNavigate(navigate, getClientArticleEditPath(data.article_id));
```

**Nota**: A função `getClientArticleEditPath` já retorna path limpo sem params.

---

### 2. BACKEND — `convert-opportunity-to-article/index.ts`

**A) Adicionar verificação de artigo existente ANTES de gerar (após linha 76)**

Verificar se já existe artigo para o par `opportunity_id + blog_id`:

```typescript
// 🛡️ GUARD: Verificar se já existe artigo para esta oportunidade
const { data: existingArticle } = await supabase
  .from("articles")
  .select("id, title, status")
  .eq("opportunity_id", opportunityId)
  .eq("blog_id", blogId)
  .maybeSingle();

if (existingArticle) {
  console.log(`[${requestId}][CONVERT] Article already exists for opportunity ${opportunityId}: ${existingArticle.id}`);
  return new Response(
    JSON.stringify({
      success: true,
      message: "Article already exists for this opportunity",
      article_id: existingArticle.id,
      reused: true,
      request_id: requestId
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**B) Usar UPDATE atômico para marcar oportunidade "em processamento" (opcional, mas recomendado)**

Para eliminar completamente a race condition, marcar a oportunidade como `processing` antes de iniciar:

```typescript
// 🔒 LOCK: Tentar marcar como 'processing' (atômico)
const { data: lockResult, error: lockError } = await supabase
  .from("article_opportunities")
  .update({ status: 'processing' })
  .eq("id", opportunityId)
  .eq("status", "pending") // Só atualiza se ainda está pending
  .select("id")
  .single();

if (lockError || !lockResult) {
  console.log(`[${requestId}][CONVERT] Could not acquire lock - opportunity may be processing or already converted`);
  
  // Re-verificar status atual
  const { data: recheckOpp } = await supabase
    .from("article_opportunities")
    .select("status, converted_article_id")
    .eq("id", opportunityId)
    .single();
    
  if (recheckOpp?.converted_article_id) {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Opportunity was converted by another request",
        article_id: recheckOpp.converted_article_id,
        reused: true,
        request_id: requestId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  throw new Error("Opportunity is being processed by another request. Please try again.");
}

console.log(`[${requestId}][CONVERT] Lock acquired for opportunity ${opportunityId}`);
```

---

## Arquivos a Modificar

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `src/pages/client/ClientArticleEditor.tsx` | Guard no useEffect: `if (articleId) return;` | ALTA |
| `supabase/functions/convert-opportunity-to-article/index.ts` | Verificar artigo existente + Lock atômico | ALTA |

---

## Fluxo Corrigido

```text
Frontend:
1. Se articleId na URL → loadExistingArticle() → NÃO gera nada
2. Se quick=true + fromOpportunity → handleConvertOpportunity()

Backend (convert-opportunity-to-article):
1. Verificar se oportunidade já foi convertida (status = 'converted') ✅ já existe
2. 🆕 Verificar se já existe artigo em articles para esse opportunity_id
3. 🆕 Tentar UPDATE atômico: status = 'processing' WHERE status = 'pending'
4. Se falhar → retornar artigo existente ou erro
5. Se sucesso → gerar artigo normalmente
6. Após sucesso → marcar converted
```

---

## Resultado Esperado

1. **Nenhuma geração duplicada**: Backend detecta artigo existente antes de gerar
2. **Race condition eliminada**: Lock atômico impede processamento paralelo
3. **Artigos sempre editáveis**: Navegação para `/edit/{id}` sempre carrega o artigo existente
4. **Idempotência**: Chamar convert múltiplas vezes retorna o mesmo artigo
