

# Simplificação do Error Handling: handleConvertOpportunity

## Objetivo

Implementar o padrão simplificado de tratamento de erros conforme especificação, garantindo:
1. `clearInterval` imediatamente após o invoke (antes de qualquer return)
2. Estado `setGenerationStage('failed')` em erros
3. Estado `setGenerationStage('completed')` em sucesso
4. Mensagens de erro simplificadas e consistentes

---

## Alterações

**Arquivo:** `src/pages/client/ClientArticleEditor.tsx`
**Linhas:** 265-354

### Código Atual vs Novo

O código atual usa `try/finally` com `clearInterval` no finally, e tem múltiplos blocos de tratamento de erro com mensagens específicas.

O novo padrão:
- Move `clearInterval` para logo após o invoke
- Remove o `try/finally` (não mais necessário)
- Adiciona `setGenerationStage('failed')` em todos os caminhos de erro
- Adiciona `setGenerationStage('completed')` no sucesso
- Simplifica mensagens de erro

### Nova Implementação

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

  const { data, error } = await supabase.functions.invoke('convert-opportunity-to-article', {
    body: { 
      opportunityId: oppId, 
      blogId,
      request_id: requestId
    },
  });

  // 🔴 SEMPRE limpar o timer antes de qualquer return
  clearInterval(progressInterval);

  // ❌ ERRO DE EDGE FUNCTION
  if (error) {
    console.error(`[${requestId}] Edge error`, error);
    setGenerationStage('failed');
    setPhase('form');
    setGenerationProgress(0);
    toast.error('Erro ao gerar artigo', {
      description: error.message || 'Falha inesperada',
    });
    return;
  }

  // ❌ BACKEND RESPONDEU COM success=false
  if (!data?.success) {
    console.error(`[${requestId}] Backend failure`, data);
    setGenerationStage('failed');
    setPhase('form');
    setGenerationProgress(0);
    toast.error('Falha na geração do artigo', {
      description: data?.message || 'Erro de validação',
    });
    return;
  }

  // ✅ SUCESSO REAL
  setGenerationStage('completed');
  setGenerationProgress(100);
  toast.success('Artigo criado com sucesso');
  smartNavigate(navigate, getClientArticleEditPath(data.article_id));
};
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| `try/finally` com `clearInterval` no finally | `clearInterval` imediatamente após invoke |
| Múltiplas mensagens de erro específicas | 2 mensagens genéricas e claras |
| Sem estado `failed` | `setGenerationStage('failed')` explícito |
| Sucesso sem estado `completed` | `setGenerationStage('completed')` explícito |
| ~90 linhas | ~60 linhas |

---

## Resultado Esperado

1. Timer sempre limpo antes de qualquer return
2. UI reflete estado `failed` corretamente
3. UI reflete estado `completed` corretamente
4. Código mais simples e manutenível
5. Mensagens de erro consistentes para o usuário

