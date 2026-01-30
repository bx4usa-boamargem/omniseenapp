
# HOTFIX: Frontend Mostrar Erro Quality Gate

## Problema Identificado
Quando o backend retorna HTTP 422 (Quality Gate failed), o frontend fica "travado" em 85% porque:
1. `supabase.functions.invoke` encapsula erros - não expõe status HTTP diretamente
2. A função `handleConvertOpportunity` (linhas 237-274) tem tratamento genérico de erro
3. Mensagens de erro específicas do Quality Gate não são exibidas ao usuário

## Análise do Código Atual

```typescript
// Linha 250-258:
const { data, error } = await supabase.functions.invoke('convert-opportunity-to-article', {
  body: { opportunityId: oppId, blogId },
});

if (error || !data?.success) {
  throw new Error(data?.error || 'Erro na conversão');  // ← Mensagem genérica
}
```

O `supabase.functions.invoke` retorna:
- `error`: quando há erro de rede ou HTTP >= 400
- `data`: o body JSON da resposta

Quando o backend retorna 422, o `error` contém detalhes e `data` pode conter `message` ou `details` do Quality Gate.

## Correção Exata

**Arquivo**: `src/pages/client/ClientArticleEditor.tsx`

**Linhas a modificar**: 237-274

### Código Corrigido:

```typescript
const handleConvertOpportunity = async (oppId: string, blogId: string) => {
  setPhase('generating');
  setGenerationStage('analyzing');
  setGenerationProgress(10);

  try {
    // Gradual progress update
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => Math.min(prev + 8, 85));
    }, 2000);

    console.log('[ConvertOpportunity] Starting conversion for opportunity:', oppId);

    const { data, error } = await supabase.functions.invoke('convert-opportunity-to-article', {
      body: { opportunityId: oppId, blogId },
    });

    clearInterval(progressInterval);

    // =====================================================================
    // HOTFIX: Tratamento específico de erros do Quality Gate (HTTP 422)
    // =====================================================================
    if (error) {
      console.error('[ConvertOpportunity] Edge function error:', error);
      
      // Tentar extrair mensagem específica do Quality Gate
      const errorMessage = error.message || 'Erro desconhecido';
      
      // Detectar erros específicos do Quality Gate
      if (errorMessage.includes('insufficient_sections') || errorMessage.includes('QUALITY_GATE')) {
        toast.error('Estrutura do artigo insuficiente. Tente com outro tema.');
      } else if (errorMessage.includes('insufficient_faq')) {
        toast.error('FAQ insuficiente. Tente novamente.');
      } else if (errorMessage.includes('missing_introduction')) {
        toast.error('Introdução muito curta. Tente novamente.');
      } else {
        toast.error(`Erro ao gerar: ${errorMessage}`);
      }
      
      // Resetar estado
      setPhase('form');
      setGenerationProgress(0);
      setGenerationStage(null);
      return;
    }

    // Verificar se retornou sucesso
    if (!data?.success) {
      console.error('[ConvertOpportunity] Conversion failed:', data);
      
      // Extrair mensagem específica do backend
      const failReason = data?.message || data?.details || data?.error || 'Erro na conversão';
      
      // Detectar falhas do Quality Gate no payload
      if (failReason.includes('insufficient') || failReason.includes('QUALITY_GATE')) {
        toast.error(`Validação falhou: ${failReason}`);
      } else {
        toast.error(failReason);
      }
      
      setPhase('form');
      setGenerationProgress(0);
      setGenerationStage(null);
      return;
    }

    // Sucesso!
    setGenerationProgress(100);
    toast.success('Artigo criado com sucesso!');

    console.log('[ConvertOpportunity] Success, redirecting to article:', data.article_id);

    // Redirect to the real editor with the created article
    smartNavigate(navigate, getClientArticleEditPath(data.article_id));
  } catch (err) {
    console.error('[ConvertOpportunity] Unexpected error:', err);
    
    const errorMsg = err instanceof Error ? err.message : 'Erro inesperado';
    toast.error(`Erro ao criar artigo: ${errorMsg}`);
    
    setPhase('form');
    setGenerationProgress(0);
    setGenerationStage(null);
  }
};
```

## Resumo das Alterações

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Tratamento de `error` | Throw genérico | Detecta tipo específico e mostra mensagem |
| Tratamento de `!data.success` | Throw genérico | Extrai `message`/`details` do backend |
| Mensagens ao usuário | "Erro na conversão" | "Estrutura insuficiente", "FAQ insuficiente", etc. |
| Estado após erro | Fica em 85% | Reseta para `form` com progresso 0 |

## Resultado Esperado

1. **Quando Quality Gate falha por `insufficient_sections`**:
   - Toast: "Estrutura do artigo insuficiente. Tente com outro tema."
   - UI volta para o formulário (não fica travada)

2. **Quando Quality Gate falha por `insufficient_faq`**:
   - Toast: "FAQ insuficiente. Tente novamente."
   - UI volta para o formulário

3. **Quando ocorre erro genérico**:
   - Toast: "Erro ao gerar: [mensagem específica]"
   - UI volta para o formulário

## Arquivo a Modificar

| Arquivo | Linhas | Tipo de Alteração |
|---------|--------|-------------------|
| `src/pages/client/ClientArticleEditor.tsx` | 237-274 | Substituir função `handleConvertOpportunity` |
