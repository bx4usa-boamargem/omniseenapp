

# Blindagem de Monetização e Controle de Volume

## Objetivo

Garantir que:
1. Backend é a fonte da verdade (verifica, bloqueia, incrementa, loga)
2. Frontend verifica limite apenas para UX (evitar tentativa inútil), NÃO incrementa
3. Frontend trata LIMIT_REACHED de forma clara
4. Nada depende de modal/rota inexistente

---

## 1. FRONTEND — ClientArticleEditor.tsx

### A) Adicionar import (linha 56)

```typescript
import { usePlanLimits } from '@/hooks/usePlanLimits';
```

### B) Instanciar hook no componente (linha 80, após useAuth)

```typescript
const { checkLimit } = usePlanLimits();
```

### C) Modificar handleConvertOpportunity (linhas 237-319)

Adicionar verificação de limite ANTES de setPhase e tratamento de LIMIT_REACHED:

```typescript
const handleConvertOpportunity = async (oppId: string, blogId: string) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}][ConvertOpportunity] Starting conversion for opportunity:`, oppId);
  
  // 🔒 VERIFICAÇÃO DE LIMITE (UX - evitar tentativa inútil)
  const limitCheck = await checkLimit('articles');
  if (!limitCheck.canCreate) {
    console.log(`[${requestId}][ConvertOpportunity] BLOCKED: Article limit reached`);
    toast.error('Limite de artigos atingido', {
      description: `Você usou ${limitCheck.used}/${limitCheck.limit} artigos este mês. Faça upgrade para continuar.`,
    });
    return;
  }
  
  console.log(`[${requestId}][ConvertOpportunity] Limit OK: ${limitCheck.remaining} articles remaining`);
  
  setPhase('generating');
  setGenerationStage('analyzing');
  setGenerationProgress(10);

  const progressInterval = setInterval(() => {
    setGenerationProgress((prev) => Math.min(prev + 8, 85));
  }, 2000);

  try {
    const { data, error } = await supabase.functions.invoke('convert-opportunity-to-article', {
      body: { 
        opportunityId: oppId, 
        blogId,
        request_id: requestId
      },
    });

    if (error) {
      console.error(`[${requestId}][ConvertOpportunity] Edge function error:`, error);
      const errorMessage = error.message || 'Erro desconhecido';
      
      // Tratamento específico para LIMIT_REACHED
      if (errorMessage.includes('LIMIT_REACHED')) {
        toast.error('Limite de artigos atingido', {
          description: 'Faça upgrade do seu plano para continuar.',
        });
        setPhase('form');
        setGenerationProgress(0);
        setGenerationStage(null);
        return;
      }
      
      if (errorMessage.includes('insufficient_sections') || errorMessage.includes('QUALITY_GATE')) {
        toast.error('Estrutura do artigo insuficiente. Tente com outro tema.');
      } else if (errorMessage.includes('insufficient_faq')) {
        toast.error('FAQ insuficiente. Tente novamente.');
      } else if (errorMessage.includes('missing_introduction')) {
        toast.error('Introdução muito curta. Tente novamente.');
      } else {
        toast.error(`Erro ao gerar: ${errorMessage}`);
      }
      
      setPhase('form');
      setGenerationProgress(0);
      setGenerationStage(null);
      return;
    }

    if (!data?.success) {
      console.error(`[${requestId}][ConvertOpportunity] Conversion failed:`, data);
      
      const errorType = data?.error_type || '';
      const reasonCode = data?.reason_code || '';
      const failReason = data?.message || data?.details || data?.error || 'Erro na conversão';
      
      // Tratamento específico para LIMIT_REACHED
      if (errorType === 'LIMIT_REACHED') {
        toast.error('Limite de artigos atingido', {
          description: failReason || 'Faça upgrade do seu plano para continuar.',
        });
        setPhase('form');
        setGenerationProgress(0);
        setGenerationStage(null);
        return;
      }
      
      if (errorType === 'QUALITY_GATE_FAILED' || reasonCode.includes('insufficient')) {
        toast.error(`Validação falhou: ${failReason}`);
      } else {
        toast.error(failReason);
      }
      
      setPhase('form');
      setGenerationProgress(0);
      setGenerationStage(null);
      return;
    }

    // ✅ SUCESSO - NÃO incrementar usage (backend já fez)
    setGenerationProgress(100);
    toast.success('Artigo criado com sucesso!');
    console.log(`[${requestId}][ConvertOpportunity] Success, redirecting to article:`, data.article_id);
    smartNavigate(navigate, getClientArticleEditPath(data.article_id));
    
  } catch (err) {
    console.error(`[${requestId}][ConvertOpportunity] Unexpected error:`, err);
    const errorMsg = err instanceof Error ? err.message : 'Erro inesperado';
    toast.error(`Erro ao criar artigo: ${errorMsg}`);
    setPhase('form');
    setGenerationProgress(0);
    setGenerationStage(null);
  } finally {
    clearInterval(progressInterval);
  }
};
```

---

## 2. BACKEND — convert-opportunity-to-article/index.ts

### A) Buscar user_id do blog e verificar limites (após linha 74, antes de buscar profile)

Inserir após a verificação de oportunidade convertida (linha 74):

```typescript
    // 🔒 LIMIT CHECK - Buscar user_id do blog
    const { data: blogData } = await supabase
      .from('blogs')
      .select('user_id')
      .eq('id', blogId)
      .single();

    if (!blogData?.user_id) {
      throw new Error('Blog not found or no user associated');
    }

    console.log(`[${requestId}][CONVERT] Checking limits for user ${blogData.user_id}`);

    // Chamar check-limits
    const limitCheckResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/check-limits`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          userId: blogData.user_id,
          action: 'check',
          resource: 'articles',
        }),
      }
    );

    const limitData = await limitCheckResponse.json();

    if (limitData.limitReached) {
      console.log(`[${requestId}][CONVERT] BLOCKED: Limit reached for user ${blogData.user_id}`);
      return new Response(
        JSON.stringify({
          success: false,
          error_type: 'LIMIT_REACHED',
          message: `Limite de artigos atingido (${limitData.usage?.articles_used || 0}/${limitData.limits?.articles_limit || 0})`,
          request_id: requestId,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}][CONVERT] Limit OK: ${limitData.remaining} remaining`);
```

### B) Incrementar usage e logar consumo após sucesso (antes do return final, linha 445)

Inserir após o log de imagens geradas e antes do return final:

```typescript
    // 🔒 INCREMENTAR USAGE após sucesso (fonte da verdade)
    console.log(`[${requestId}][CONVERT] Incrementing usage for user ${blogData.user_id}`);

    try {
      // Incrementar usage
      await fetch(
        `${SUPABASE_URL}/functions/v1/check-limits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId: blogData.user_id,
            action: 'increment',
            resource: 'articles',
          }),
        }
      );

      console.log(`[${requestId}][CONVERT] Usage incremented`);

      // Log consumption para billing
      await fetch(
        `${SUPABASE_URL}/functions/v1/log-consumption`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: blogData.user_id,
            blog_id: blogId,
            action_type: 'article_generation',
            action_description: `Artigo: ${opportunity.suggested_title}`,
            model_used: 'google/gemini-2.5-flash',
            metadata: {
              article_id: articleId,
              opportunity_id: opportunityId,
              source: 'opportunity_conversion',
              request_id: requestId,
            },
          }),
        }
      );

      console.log(`[${requestId}][CONVERT] Consumption logged`);
    } catch (billingError) {
      // Non-blocking - article was created
      console.error(`[${requestId}][CONVERT] Billing error (non-blocking):`, billingError);
    }
```

### C) Atualizar catch final para incluir request_id (linha 461-471)

```typescript
  } catch (error) {
    console.error("[CONVERT] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error_type: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : "Unknown error",
        request_id: requestId || 'unknown',
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/client/ClientArticleEditor.tsx` | Import `usePlanLimits`, instanciar `checkLimit`, verificar limite ANTES de gerar, tratar `LIMIT_REACHED`, **NÃO usar incrementUsage** |
| `supabase/functions/convert-opportunity-to-article/index.ts` | Buscar `user_id`, verificar limites no início (retornar 403 se atingido), incrementar usage e logar consumo após sucesso, incluir `request_id` no catch |

---

## Fluxo Final

```text
1. Frontend chama checkLimit('articles') [UX]
   └─ Se limitReached → toast → return (SEM navegar)

2. Frontend chama convert-opportunity-to-article
   └─ Backend busca user_id do blog
   └─ Backend chama check-limits (action: check)
      └─ Se limitReached → retorna 403 LIMIT_REACHED → FIM

3. Backend gera artigo + imagens
   └─ Se erro → retorna erro estruturado → FIM

4. Backend persiste artigo
   └─ Backend chama check-limits (action: increment) [fonte da verdade]
   └─ Backend chama log-consumption [auditoria]

5. Frontend recebe sucesso
   └─ NÃO chama incrementUsage (evita duplicidade)
   └─ Navega para editor
```

---

## Resultado Esperado

1. Frontend bloqueia tentativa sem quota (UX - evitar espera desnecessária)
2. Backend bloqueia com 403 se alguém burlar o frontend (segurança)
3. Backend incrementa 1 vez por artigo criado (fonte única da verdade)
4. Billing registra consumo com request_id (auditoria)
5. Nada depende de modal/layout inacessível nem de rota inexistente
6. ZERO DUPLICAÇÃO de incremento

