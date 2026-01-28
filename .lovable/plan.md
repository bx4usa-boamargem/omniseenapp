
# Correção Completa - Rotas de Artigos (Published vs Preview)

## Resumo do Problema
Ao clicar em "Editar" ou "Visualizar" artigos no ambiente **Published** (`omniseenapp.lovable.app`), a navegação resulta em **404**. Isso acontece porque:

1. **Rota inválida no menu "Conteúdo"**: `/client/articles/new` não existe (a rota correta é `/client/create`)
2. **Detecção incorreta de ambiente**: O sistema não diferencia corretamente Preview vs Published
3. **Navegação inconsistente**: Usa `navigate()` (SPA) em todos os ambientes, mas Published precisa de URLs absolutas (hard reload)

---

## Estratégia de Solução

### Detecção Correta de Ambiente
```
┌────────────────────────────────────────────────────────────┐
│  Ambiente                        │ Hostname               │
├────────────────────────────────────────────────────────────┤
│  Preview (SPA)                   │ id-preview--...        │
│  Published (URL Absoluta)        │ omniseenapp.lovable.app│
│  Desenvolvimento (SPA)           │ localhost              │
└────────────────────────────────────────────────────────────┘
```

- **Preview**: `hostname.startsWith('id-preview--')` ou `localhost`
- **Published**: Qualquer outro hostname → usar URL absoluta com hard reload

---

## Arquivos a Modificar

### 1. `src/utils/platformUrls.ts`
Adicionar funções helper:
- `isLovablePreviewHost()` - detecta se está em Preview ou localhost
- `toAbsoluteUrl(path)` - converte path relativo para URL absoluta
- `getClientArticlesListPath()` - retorna `/client/articles`
- `getClientArticleCreatePath()` - retorna `/client/create`
- `getClientArticleEditPath(id)` - retorna `/client/articles/{id}/edit`
- `smartNavigate(navigate, path)` - navega corretamente baseado no ambiente

### 2. `src/components/layout/PremiumSidebar/ContentHubPanel.tsx`
Corrigir rota do "Gerar Artigo":
- **Antes**: `/client/articles/new` (404)
- **Depois**: `/client/create` (correto)

### 3. `src/pages/client/ClientArticles.tsx`
Atualizar `handleEdit()` para usar `smartNavigate`

### 4. `src/components/mobile/MobileArticlesList.tsx`
Atualizar `handleEdit()` para usar `smartNavigate`

### 5. `src/lib/autoCreateArticle.ts`
Atualizar navegação após conversão de oportunidade

### 6. `src/pages/client/ClientArticleEditor.tsx`
Atualizar navegações internas (redirecionamento pós-criação)

### 7. `src/components/client/MiniContentCalendar.tsx`
Atualizar `handleArticleClick()` para usar `smartNavigate`

### 8. `src/components/content/FunnelModal.tsx`
Atualizar navegação após criação de artigos

### 9. `src/components/client/automation/QueueTab.tsx`
Atualizar `handleViewArticle()` para usar `smartNavigate`

### 10. `src/pages/client/ClientQueue.tsx`
Atualizar `handleViewArticle()` para usar `smartNavigate`

### 11. `src/pages/client/ClientReviewCenter.tsx`
Atualizar navegação para editor

### 12. `src/components/dashboard/GenerationHistoryCard.tsx`
Atualizar `handleItemClick()` para usar `smartNavigate`

### 13. `src/components/client/ArticlesWithoutImagesDrawer.tsx`
Atualizar `handleOpenEditor()` para usar `smartNavigate`

---

## Detalhes Técnicos

### Funções a Adicionar em `platformUrls.ts`

```typescript
// Detecta se está em Preview do Lovable
export const isLovablePreviewHost = (): boolean => {
  const hostname = window.location.hostname;
  return hostname.startsWith('id-preview--') || hostname === 'localhost';
};

// Converte path relativo para URL absoluta
export const toAbsoluteUrl = (path: string): string => {
  return `${window.location.origin}${path}`;
};

// Helpers de path para artigos
export const getClientArticlesListPath = (): string => '/client/articles';
export const getClientArticleCreatePath = (): string => '/client/create';
export const getClientArticleEditPath = (id: string): string => {
  if (!id) return '/client/articles';
  return `/client/articles/${id}/edit`;
};

// Navegação inteligente
export const smartNavigate = (
  navigate: (path: string) => void,
  path: string
): void => {
  if (isLovablePreviewHost()) {
    navigate(path);
  } else {
    window.location.assign(toAbsoluteUrl(path));
  }
};
```

### Padrão de Uso nos Componentes

```typescript
// ANTES (causa 404 em Published)
const handleEdit = (id: string) => {
  navigate(`/client/articles/${id}/edit`);
};

// DEPOIS (funciona em todos os ambientes)
import { smartNavigate, getClientArticleEditPath } from '@/utils/platformUrls';

const handleEdit = (id: string) => {
  smartNavigate(navigate, getClientArticleEditPath(id));
};
```

---

## Testes de Validação

### Published (`omniseenapp.lovable.app`)
- Menu "Conteúdo" → "Gerar Artigo" → abre `/client/create` sem 404
- Lista de artigos → "Editar" → abre `/client/articles/:id/edit` sem 404
- Editor → "Voltar" → volta para `/client/articles` sem 404
- Radar → "Converter para Artigo" → abre editor sem 404

### Preview (`id-preview--...lovable.app`)
- Mesmos fluxos funcionando
- Navegação permanece SPA (sem reloads desnecessários)

---

## Ordem de Implementação
1. Adicionar funções em `platformUrls.ts`
2. Corrigir rota no `ContentHubPanel.tsx`
3. Atualizar `ClientArticles.tsx`
4. Atualizar `MobileArticlesList.tsx`
5. Atualizar `autoCreateArticle.ts`
6. Atualizar `ClientArticleEditor.tsx`
7. Atualizar componentes secundários (Calendar, Queue, Review, etc.)
8. Testar em ambos os ambientes
