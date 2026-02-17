
# V4.7.4 — Fix Completo: Geração de Artigos

## Diagnostico Real (com provas)

### O que esta acontecendo

1. **Backend funciona**: O artigo `033309b6` foi gerado e publicado com sucesso em 73 segundos
2. **Placeholder orfao**: O artigo `02d76280` (placeholder) ficou com `status=generating` permanentemente
3. **Existem 3 placeholders orfaos** no banco com `status=generating` que nunca serao finalizados
4. **Cancelamento pelo usuario**: O toast "Geracao cancelada" indica que o usuario clicou cancelar enquanto aguardava os 73 segundos
5. **Loop de re-geracao**: Ao visitar `/client/articles/02d76280/edit`, o `loadExistingArticle` detecta `status=generating` e dispara nova geracao — criando OUTRO artigo duplicado no backend

### Causa raiz

O `handleCancelGeneration` reseta a UI mas NAO atualiza o status do placeholder no banco:

```typescript
// Linha 149-161 - handleCancelGeneration
const handleCancelGeneration = () => {
  generationLockRef.current = false;
  setIsGenerating(false);
  setPhase('form');           // UI volta para o form
  setGenerationStage(null);
  setGenerationProgress(0);
  // ... mas NUNCA faz:
  // supabase.from('articles').update({ status: 'draft' }).eq('id', placeholderId)
};
```

Resultado: placeholder fica `generating` para sempre, e toda vez que o usuario abre esse artigo, dispara nova geracao.

### Segundo problema: onDone nao vincula o artigo real ao placeholder

Quando o `invoke()` retorna com sucesso, o `onDone` atualiza o placeholder (`data.id = 02d76280`) com o conteudo do artigo real (`033309b6`). Isso funciona, MAS o artigo real continua existindo como registro separado. Se houve timeout ou cancel antes do onDone, ambos os registros ficam orfaos.

## Correcoes (2 arquivos)

### Arquivo 1: `src/pages/client/ClientArticleEditor.tsx`

#### A) handleCancelGeneration — Limpar placeholder no banco

Quando o usuario cancela, o placeholder deve ser marcado como `draft` (nao `generating`):

```typescript
const handleCancelGeneration = () => {
  generationLockRef.current = false;
  setIsGenerating(false);
  setPhase('form');
  setGenerationStage(null);
  setGenerationProgress(0);
  setShowTimeoutWarning(false);
  setStreamingText('');
  if (timeoutWarningRef.current) {
    clearTimeout(timeoutWarningRef.current);
  }

  // V4.7.4: Limpar placeholder no banco para evitar loop de re-geracao
  if (existingArticleId) {
    supabase.from('articles')
      .update({ status: 'draft', generation_stage: 'failed' })
      .eq('id', existingArticleId)
      .then(() => console.log('[V4.7.4] Placeholder marcado como draft'));
  }

  toast.info('Geracao cancelada');
};
```

#### B) loadExistingArticle — Verificar se artigo real ja existe antes de re-gerar

Quando detecta `status=generating`, antes de chamar `streamArticle`, verificar se ja existe um artigo publicado recente para o mesmo blog com titulo similar:

```typescript
if (articleStatus === "generating") {
  // V4.7.4: Verificar se artigo real ja foi gerado pelo backend
  const fiveMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existingPublished } = await supabase
    .from('articles')
    .select('id, title, slug, content, excerpt, meta_description, faq, status')
    .eq('blog_id', blog?.id || data.blog_id)
    .eq('status', 'published')
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPublished && existingPublished.content) {
    console.log('[V4.7.4] Artigo real encontrado, atualizando placeholder');
    // Atualizar placeholder com conteudo do artigo real
    await supabase.from('articles').update({
      title: existingPublished.title,
      content: existingPublished.content,
      excerpt: existingPublished.excerpt,
      meta_description: existingPublished.meta_description,
      faq: existingPublished.faq || [],
      status: 'published',
      published_at: new Date().toISOString(),
    }).eq('id', data.id);

    // Carregar no editor
    setTitle(existingPublished.title || '');
    setContent(existingPublished.content || '');
    setExcerpt(existingPublished.excerpt || '');
    setMetaDescription(existingPublished.meta_description || '');
    setFaq(Array.isArray(existingPublished.faq) ? existingPublished.faq : []);
    setExistingArticleId(data.id);
    setPhase('editing');
    toast.success('Artigo recuperado com sucesso!');
    return; // NAO re-gerar
  }

  // Se nao encontrou artigo real, continuar com geracao normal
  // ... codigo existente de streamArticle()
}
```

### Arquivo 2: `src/utils/streamArticle.ts`

Nenhuma alteracao necessaria — o V4.7.3 fallback ja esta implementado corretamente para o caso de timeout do invoke.

### Limpeza de dados: Orfaos existentes

Apos aplicar o fix, os 3 placeholders orfaos existentes precisam ser limpos. Isso sera feito via update direto no banco:

```sql
UPDATE articles
SET status = 'draft', generation_stage = 'failed'
WHERE status = 'generating'
  AND blog_id = 'cc5acf5c-9571-4bbe-80d8-785c244a5ea4';
```

## Resumo

| Problema | Causa | Fix |
|----------|-------|-----|
| Placeholder orfao | handleCancelGeneration nao atualiza banco | Adicionar update status=draft ao cancelar |
| Re-geracao em loop | loadExistingArticle sempre re-gera ao ver status=generating | Verificar se artigo real ja existe antes |
| 3 artigos orfaos no banco | Bugs anteriores | Limpeza via SQL |

## Criterios de Aceite

| # | Criterio |
|---|----------|
| 1 | Ao cancelar geracao, placeholder muda para status=draft no banco |
| 2 | Ao abrir placeholder com status=generating, sistema verifica se artigo real ja existe |
| 3 | Se artigo real existe, carrega no editor sem re-gerar |
| 4 | Se artigo real NAO existe, inicia geracao normalmente |
| 5 | Orfaos existentes sao limpos |
| 6 | Sem regressao no fluxo normal |
