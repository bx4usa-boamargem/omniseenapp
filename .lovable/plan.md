

# V4.7.3 — Timeout Fallback Seguro

## Diagnostico Tecnico

### Fluxo Real Mapeado

```text
1. handleGenerate() cria PLACEHOLDER (status='generating', sem conteudo)
2. Navega para /client/articles/{placeholderId}/edit
3. loadExistingArticle() detecta status='generating'
4. Chama streamArticle() com theme=data.title, blogId=blog.id
5. streamArticle() faz invoke('generate-article-structured')
6. Backend cria OUTRO artigo (com seu proprio ID) e retorna
7. Se invoke retorna OK: onDone atualiza o PLACEHOLDER com o conteudo
8. Se invoke TIMEOUT: exception cai no catch -> onError -> UI trava
```

### Problema do article_id

O placeholder (`data.id`) e o artigo gerado pelo backend sao REGISTROS DIFERENTES:
- **Placeholder**: criado pelo frontend com `status: 'generating'`, sem conteudo
- **Artigo real**: criado pela edge function, com conteudo, `status: 'published'`

Apos timeout, o placeholder continua sem conteudo. O artigo real existe no banco mas com ID diferente.

### Solucao em 2 Camadas

**Camada 1** (streamArticle.ts): Detectar timeout no catch, emitir `onStage('finalizing')`, esperar 5s, buscar artigo recente por `blog_id` (unica forma sem mudar backend).

**Camada 2** (ClientArticleEditor.tsx): No `onError`, detectar timeout, esperar 5s, buscar artigo por `blog_id` com `status='published'` criado nos ultimos 5 minutos. Se encontrar, carregar no editor e atualizar o placeholder.

## Alteracoes

### Arquivo 1: `src/utils/streamArticle.ts`

**Adicionar `articleId` como opcao opcional** na interface `StreamArticleOptions` para permitir fallback seguro quando disponivel:

```typescript
export interface StreamArticleOptions {
  // ... existentes
  articleId?: string; // V4.7.3: ID do placeholder para fallback
}
```

**Modificar o catch externo (linha 280-283)** para detectar timeout e tentar recuperar:

```typescript
} catch (error) {
  console.error('Article generation error:', error);
  const errorMsg = error instanceof Error ? error.message : '';
  const isTimeout =
    errorMsg.includes('Failed to fetch') ||
    errorMsg.includes('FunctionsFetchError') ||
    errorMsg.includes('Failed to send');

  if (isTimeout && blogId) {
    console.log('[V4.7.3] Timeout detectado. Tentando recuperar artigo...');
    onStage?.('finalizing');
    onProgress?.(90);

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Buscar artigo criado pelo backend (por blog_id, status published, ultimos 5 min)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recovered } = await supabase
      .from('articles')
      .select('id, title, slug, status, content, excerpt, meta_description, faq')
      .eq('blog_id', blogId)
      .eq('status', 'published')
      .gte('created_at', fiveMinAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recovered && recovered.content) {
      console.log('[V4.7.3] Artigo recuperado com sucesso:', recovered.id);
      onProgress?.(95);

      // Simular streaming rapido
      const words = recovered.content.split(' ');
      for (let i = 0; i < words.length; i++) {
        onDelta(words[i] + ' ');
        if (i % 30 === 0) await new Promise(r => setTimeout(r, 5));
      }

      onProgress?.(100);
      onDone({
        id: recovered.id,
        slug: recovered.slug,
        title: recovered.title,
        content: recovered.content,
        excerpt: recovered.excerpt || '',
        meta_description: recovered.meta_description || '',
        faq: Array.isArray(recovered.faq) ? recovered.faq : [],
      });
      return;
    }

    console.log('[V4.7.3] Artigo NAO encontrado apos timeout.');
  }

  onError(error instanceof Error ? error.message : 'Erro de conexao');
}
```

**Adicionar logs de diagnostico** nas posicoes corretas:
- Antes do invoke: `console.log('[V4.7.2] invoking backend');`
- No stage analyzing (ja existente): `console.log('[V4.7.2] stage analyzing');`
- Apos invoke retornar: `console.log('[V4.7.2] stage generating');`
- Antes de finalizar: `console.log('[V4.7.2] stage finalizing');`

### Arquivo 2: `src/pages/client/ClientArticleEditor.tsx`

**Modificar o `onError` handler (linhas 484-493)** para ser `async` e implementar fallback:

```typescript
onError: async (error) => {
  const isTimeout =
    error.includes('Failed to fetch') ||
    error.includes('FunctionsFetchError') ||
    error.includes('Failed to send');

  if (isTimeout && blog?.id) {
    console.log('[V4.7.3] Timeout no Editor. Verificando artigo salvo...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: article } = await supabase
      .from('articles')
      .select('id, title, slug, status, content, excerpt, meta_description, faq')
      .eq('blog_id', blog.id)
      .eq('status', 'published')
      .gte('created_at', fiveMinAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (article && article.content) {
      console.log('[V4.7.3] Artigo recuperado apos timeout:', article.id);

      // Atualizar placeholder com conteudo real
      await supabase
        .from('articles')
        .update({
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
          meta_description: article.meta_description,
          faq: article.faq || [],
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      setTitle(article.title || '');
      setContent(article.content || '');
      setExcerpt(article.excerpt || '');
      setMetaDescription(article.meta_description || '');
      setFaq(Array.isArray(article.faq) ? article.faq : []);

      setIsGenerating(false);
      setGenerationStage(null);
      generationLockRef.current = false;
      setPhase('editing');
      toast.success('Artigo gerado com sucesso!');
      return;
    }
  }

  // Erro real
  setIsGenerating(false);
  setGenerationStage(null);
  generationLockRef.current = false;
  toast.error(error || 'Erro ao gerar artigo');
  supabase.from('articles').update({ status: 'draft' }).eq('id', data.id);
  setPhase('form');
},
```

**Adicionar log de stage** no `onStage` handler (linha 444):

```typescript
onStage: (stage) => {
  console.log('[UI] stage recebido:', stage);
  setGenerationStage(stage);
},
```

## Nota sobre article_id

O usuario pediu "USAR EXCLUSIVAMENTE article_id". Porem, o fluxo atual cria 2 registros separados (placeholder + artigo real do backend). O placeholder nao tem conteudo apos timeout, e o artigo real tem ID desconhecido. A unica forma de encontrar o artigo real sem alterar o backend e buscar por `blog_id + status + created_at recente`. Isso e seguro porque:
- Filtro por blog_id (isolamento por blog)
- Filtro por status='published' (so artigos completos)
- Filtro por created_at nos ultimos 5 minutos (janela estreita)
- Ordenado por created_at DESC + limit 1 (pega o mais recente)

Para implementar fallback por article_id puro, seria necessario alterar o backend para receber e reutilizar o placeholder ID -- o que pode ser feito no V5.0.

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/utils/streamArticle.ts` | Fallback DB no catch de timeout + logs diagnostico |
| `src/pages/client/ClientArticleEditor.tsx` | onError async com fallback DB + log de stage |

## Criterios de Aceite

| # | Criterio |
|---|----------|
| 1 | Se invoke timeout mas artigo existir no DB -> UI mostra sucesso |
| 2 | Editor carrega conteudo corretamente apos recuperacao |
| 3 | Placeholder e atualizado com conteudo real |
| 4 | Se artigo NAO existir no DB -> erro real aparece |
| 5 | Logs `[V4.7.2]` e `[V4.7.3]` e `[UI]` aparecem no console |
| 6 | Sem regressao no fluxo normal (invoke < 60s) |
| 7 | Timer de progresso continua funcionando (V4.7.2) |

