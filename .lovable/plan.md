
# Plano: Sistema de Publicação WordPress Definitivo e Confiável

## Diagnóstico

Após análise completa do código, identifiquei os seguintes pontos:

### ✅ Já Funcionando Corretamente
1. **Edge Function `publish-to-cms`** já separa WordPress.org (REST API + Basic Auth) de WordPress.com (OAuth + Public API)
2. **Validação de resposta** já verifica `id`+`link` (WordPress.org) e `ID`+`URL` (WordPress.com)
3. **Bloqueios SERP/Score** já foram removidos do backend (linha 598-600)
4. **Normalização** já converte ambos formatos para `{ success, postId, postUrl }`

### ⚠️ Problemas Identificados

| Problema | Arquivo | Linha |
|----------|---------|-------|
| Frontend ainda exibe toasts de SERP/Score como "informativos" mas causa confusão | `ClientArticleEditor.tsx` | 1347-1355 |
| `ClientQueue.tsx` ainda recalcula `canPublish` baseado em score | `ClientQueue.tsx` | 327-331 |
| Logs não exibem HTTP status + corpo bruto para debugging | `publish-to-cms` | 238-240 |
| Erros de conexão/rede não são loggados em detalhe | `publish-to-cms` | 242-246 |

---

## Mudanças Propostas

### 1. Remover Toast Informativo de SERP/Score do Editor

**Arquivo:** `src/pages/client/ClientArticleEditor.tsx`

Remover linhas 1347-1355 que exibem toasts especiais para `SERP_NOT_ANALYZED` e `SCORE_TOO_LOW`. Esses códigos não são mais retornados pelo backend, então o código é desnecessário.

```typescript
// REMOVER COMPLETAMENTE
if (result.code === 'SERP_NOT_ANALYZED') {
  toast.info(result.message || 'Execute "Analisar Concorrência" antes de publicar.');
  return;
}

if (result.code === 'SCORE_TOO_LOW') {
  toast.info(result.message || 'Use "Aumentar Score" para otimizar antes de publicar.');
  return;
}
```

---

### 2. Corrigir ClientQueue para Não Bloquear por Score

**Arquivo:** `src/pages/client/ClientQueue.tsx`

A linha 330 ainda define `canPublish: newScore >= minScore`. Mudar para sempre `true`:

```typescript
// ANTES
canPublish: newScore >= minScore,

// DEPOIS
canPublish: true, // Publicação sempre permitida
```

---

### 3. Melhorar Logs no Edge Function

**Arquivo:** `supabase/functions/publish-to-cms/index.ts`

Adicionar logging detalhado com HTTP status e corpo bruto em todas as funções de publicação:

#### 3.1 WordPress.org - `createWordPressPost`

```typescript
const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts`, {...});

// Log detalhado
const responseText = await response.text();
console.log(`[WordPress.org] HTTP ${response.status}`);
console.log(`[WordPress.org] Response body: ${responseText}`);

// Parse após logging
let post;
try {
  post = JSON.parse(responseText);
} catch {
  return { success: false, message: `Resposta inválida do WordPress: ${responseText.slice(0, 500)}` };
}

if (response.ok && post && post.id && post.link) {
  return { success: true, postId: String(post.id), postUrl: post.link };
}

return { 
  success: false, 
  message: post?.message || `Erro HTTP ${response.status}: ${responseText.slice(0, 200)}` 
};
```

#### 3.2 WordPress.com - `createWordPressComPost`

Mesmo padrão de logging:

```typescript
const responseText = await response.text();
console.log(`[WordPress.com] HTTP ${response.status}`);
console.log(`[WordPress.com] Response body: ${responseText}`);

let post;
try {
  post = JSON.parse(responseText);
} catch {
  return { success: false, message: `Resposta inválida: ${responseText.slice(0, 500)}` };
}

if (response.ok && post && post.ID && post.URL) {
  return { success: true, postId: String(post.ID), postUrl: post.URL };
}

return { 
  success: false, 
  message: post?.error || post?.message || `Erro HTTP ${response.status}` 
};
```

---

### 4. Exibir Erro Real no Frontend

**Arquivo:** `src/pages/client/ClientArticleEditor.tsx`

O toast de erro já existe (linha 1357), mas pode ser melhorado para mostrar mais contexto:

```typescript
// Após remover os blocos SERP/SCORE, manter apenas:
toast.error(`Erro ao publicar: ${result.message || 'Erro desconhecido'}`);
```

---

### 5. Garantir Fluxo Direto "Publicar"

O botão já chama `publishArticle()` diretamente, sem validações. Confirmar que:

- Nenhuma chamada a `validateForPublish()` bloqueia
- Nenhum `if (!validation.canPublish) return` existe antes da publicação
- O fluxo é: clique → `setIsPublishingCMS(true)` → `publishArticle()` → resultado

---

## Tabela de Normalização de Resposta

| Campo | WordPress.org | WordPress.com | OmniSeen Retorno |
|-------|---------------|---------------|------------------|
| ID do Post | `post.id` | `post.ID` | `postId` |
| URL do Post | `post.link` | `post.URL` | `postUrl` |
| Sucesso | HTTP 201 + id + link | HTTP 200 + ID + URL | `success: true` |

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/client/ClientArticleEditor.tsx` | Remover toasts SERP_NOT_ANALYZED/SCORE_TOO_LOW |
| `src/pages/client/ClientQueue.tsx` | Sempre `canPublish: true` |
| `supabase/functions/publish-to-cms/index.ts` | Logging detalhado HTTP + body |

---

## Fluxo Final

```text
┌──────────────────────────────────────────────────────────────────┐
│                    FLUXO DE PUBLICAÇÃO                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Usuário clica "Publicar no WordPress"                        │
│     ↓                                                            │
│  2. Frontend chama publishArticle(integrationId, articleId)      │
│     ↓                                                            │
│  3. Edge Function detecta plataforma:                            │
│     ├─ *.wordpress.com? → OAuth + Public API                     │
│     └─ Outro? → REST API + Basic Auth                            │
│     ↓                                                            │
│  4. POST para endpoint correto                                   │
│     ↓                                                            │
│  5. Log: HTTP status + corpo bruto                               │
│     ↓                                                            │
│  6. Validar resposta:                                            │
│     ├─ WordPress.org: post.id && post.link?                      │
│     └─ WordPress.com: post.ID && post.URL?                       │
│     ↓                                                            │
│  7. Retornar { success, postId, postUrl }                        │
│     ↓                                                            │
│  8. Frontend exibe toast + abre URL                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Endpoints Utilizados

| Plataforma | Endpoint | Método | Auth |
|------------|----------|--------|------|
| WordPress.org | `{siteUrl}/wp-json/wp/v2/posts` | POST | Basic (user:app-password) |
| WordPress.com | `public-api.wordpress.com/rest/v1.1/sites/{siteId}/posts/new` | POST | Bearer (OAuth token) |

### Ordem de Implementação

1. Atualizar `publish-to-cms/index.ts` com logging melhorado
2. Remover códigos SERP do `ClientArticleEditor.tsx`
3. Corrigir `ClientQueue.tsx` para sempre permitir publicação
4. Deploy das Edge Functions
5. Testar fluxo completo
