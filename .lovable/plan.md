
# Plano: Correção do Bug de Remoção de Blocos em Super Páginas

## Problema Identificado

Ao tentar remover blocos (FAQ, Contact, Services, etc.), a Super Página **não salva** porque:

1. O sistema atual apenas **oculta** blocos visualmente via `visibility` state
2. O `visibility` **nunca é persistido** - não faz parte do `page_data`
3. O TypeScript exige campos obrigatórios como `services`, `testimonials`, `faq`, `contact`
4. Quando o usuário desmarca um bloco e salva, o `page_data` enviado continua com todos os campos

## Solução Proposta

Implementar um sistema de **remoção real de blocos**, onde:

1. Blocos desabilitados são **removidos** do JSON antes de salvar
2. Os tipos TypeScript são **flexibilizados** para aceitar campos opcionais
3. O `visibility` é **persistido** dentro do `page_data.meta`
4. O sistema de preview continua funcionando normalmente

---

## Arquitetura da Solução

### 1. Atualizar Tipos TypeScript

Modificar `landingPageTypes.ts` para tornar todos os blocos opcionais:

| Campo | Antes | Depois |
|-------|-------|--------|
| `hero` | `HeroSection` (obrigatório) | `HeroSection?` (opcional) |
| `services` | `ServiceCard[]` (obrigatório) | `ServiceCard[]?` (opcional) |
| `service_details` | `ServiceDetail[]` (obrigatório) | `ServiceDetail[]?` (opcional) |
| `testimonials` | `Testimonial[]` (obrigatório) | `Testimonial[]?` (opcional) |
| `areas_served` | `AreasServed` (obrigatório) | `AreasServed?` (opcional) |
| `faq` | `FAQItem[]` (obrigatório) | `FAQItem[]?` (opcional) |
| `contact` | `ContactInfo` (obrigatório) | `ContactInfo?` (opcional) |

### 2. Adicionar BlockVisibility ao Meta

O `page_data.meta` passará a incluir o estado de visibilidade:

```typescript
interface LandingPageMeta {
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  block_visibility?: BlockVisibility; // NOVO
}
```

### 3. Criar Função de Normalização

Nova função `normalizePageDataForSave()` que:

```typescript
function normalizePageDataForSave(
  pageData: LandingPageData, 
  visibility: BlockVisibility
): LandingPageData {
  const normalized: LandingPageData = {
    ...pageData,
    meta: {
      ...pageData.meta,
      block_visibility: visibility
    }
  };
  
  // Remover blocos desabilitados
  if (!visibility.services) delete normalized.services;
  if (!visibility.service_details) delete normalized.service_details;
  if (!visibility.emergency_banner) delete normalized.emergency_banner;
  if (!visibility.materials) delete normalized.materials;
  if (!visibility.process_steps) delete normalized.process_steps;
  if (!visibility.why_choose_us) delete normalized.why_choose_us;
  if (!visibility.testimonials) delete normalized.testimonials;
  if (!visibility.areas_served) delete normalized.areas_served;
  if (!visibility.faq) delete normalized.faq;
  if (!visibility.contact) delete normalized.contact;
  if (!visibility.cta_banner) delete normalized.cta_banner;
  
  // Limpar arrays vazios
  Object.keys(normalized).forEach(key => {
    const value = (normalized as any)[key];
    if (Array.isArray(value) && value.length === 0) {
      delete (normalized as any)[key];
    }
  });
  
  return normalized;
}
```

### 4. Modificar LandingPageEditor

#### 4.1 Carregar Visibility do Page Data
Quando carregar uma página, restaurar o `visibility` do `page_data.meta.block_visibility`:

```typescript
const loadPage = async () => {
  // ...fetch page...
  
  // Restaurar visibility do meta
  if (landingPage.page_data?.meta?.block_visibility) {
    setVisibility(landingPage.page_data.meta.block_visibility);
  } else {
    // Inferir visibility baseado em quais campos existem
    setVisibility(inferVisibilityFromPageData(landingPage.page_data));
  }
};
```

#### 4.2 Normalizar Antes de Salvar
Modificar `handleSave` para normalizar:

```typescript
const handleSave = async () => {
  if (!blog?.id || !pageData) return;

  // Normalizar antes de enviar
  const normalizedData = normalizePageDataForSave(pageData, visibility);

  const result = await savePage({
    blog_id: blog.id,
    title: title || normalizedData.hero?.title || "Nova Super Página",
    slug: slug || "super-pagina-" + Date.now(),
    page_data: normalizedData,
    status: 'draft'
  });
  // ...
};
```

### 5. Atualizar updatePage no Hook

Modificar a função `updatePage` para aceitar e normalizar o `page_data`:

```typescript
const updatePage = async (id: string, updates: Partial<LandingPage>): Promise<boolean> => {
  // ...
  
  if (updates.page_data !== undefined) {
    // Garantir que page_data é um objeto limpo e válido
    const cleanData = typeof updates.page_data === 'string' 
      ? JSON.parse(updates.page_data) 
      : JSON.parse(JSON.stringify(updates.page_data));
    
    // Remover campos undefined/null
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === undefined || cleanData[key] === null) {
        delete cleanData[key];
      }
    });
    
    updateData.page_data = cleanData;
  }
  
  // ...
};
```

### 6. Atualizar Preview para Lidar com Campos Ausentes

O `LandingPagePreview` já faz verificações como `pageData.services?.length > 0`, mas adicionar fallbacks mais robustos:

```typescript
// Antes
if (!pageData || !pageData.hero) {
  return <div>Carregando...</div>;
}

// Depois
if (!pageData) {
  return <div>Carregando...</div>;
}
// Hero pode não existir se foi removido - renderizar fallback ou pular
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/client/landingpage/types/landingPageTypes.ts` | Tornar todos os blocos opcionais no `LandingPageData` |
| `src/components/client/landingpage/LandingPageEditor.tsx` | Adicionar `normalizePageDataForSave`, carregar visibility do meta |
| `src/components/client/landingpage/hooks/useLandingPages.ts` | Validar e limpar `page_data` antes de salvar |
| `src/components/client/landingpage/LandingPagePreview.tsx` | Melhorar fallbacks para campos ausentes |
| `src/components/client/landingpage/layouts/ServiceAuthorityLayout.tsx` | Fallbacks para blocos opcionais |
| `src/components/client/landingpage/layouts/InstitutionalLayout.tsx` | Fallbacks para blocos opcionais |
| `src/components/client/landingpage/layouts/SpecialistAuthorityLayout.tsx` | Fallbacks para blocos opcionais |

---

## Fluxo de Dados Corrigido

```text
┌────────────────────────────────────────────────────────────────────┐
│                     FLUXO ATUAL (QUEBRADO)                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [Toggle "FAQ" para OFF]                                           │
│         ↓                                                          │
│  visibility.faq = false (apenas no state React)                    │
│         ↓                                                          │
│  [Usuário clica "Salvar"]                                          │
│         ↓                                                          │
│  pageData AINDA contém page_data.faq com dados                     │
│         ↓                                                          │
│  Supabase recebe JSON completo                                     │
│         ↓                                                          │
│  Ao recarregar: FAQ reaparece ❌                                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                     FLUXO CORRIGIDO                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [Toggle "FAQ" para OFF]                                           │
│         ↓                                                          │
│  visibility.faq = false (state React)                              │
│         ↓                                                          │
│  [Usuário clica "Salvar"]                                          │
│         ↓                                                          │
│  normalizePageDataForSave() é chamado                              │
│  → Remove page_data.faq                                            │
│  → Persiste visibility em page_data.meta.block_visibility          │
│         ↓                                                          │
│  Supabase recebe JSON SEM faq                                      │
│         ↓                                                          │
│  Ao recarregar:                                                    │
│  → visibility é restaurado do meta                                 │
│  → FAQ não existe e não aparece ✓                                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Funcionalidades da Correção

### O Que Muda

| Comportamento | Antes | Depois |
|---------------|-------|--------|
| Toggle de bloco | Apenas esconde visualmente | Remove do JSON ao salvar |
| Visibility state | Perdido ao recarregar | Persistido em `meta.block_visibility` |
| Campos obrigatórios | TypeScript exige todos | Todos opcionais exceto estrutura base |
| JSON salvo | Sempre completo | Apenas blocos ativos |
| Validação | Nenhuma | Normalização antes de salvar |

### Página Mínima Válida

Uma Super Página válida poderá conter apenas:
- `hero` (título e subtítulo)
- `meta` (configurações e visibility)

Todos os outros blocos são opcionais.

---

## Detalhes Técnicos

### Nova Função: inferVisibilityFromPageData()

Para páginas existentes sem `meta.block_visibility`, inferir o estado:

```typescript
function inferVisibilityFromPageData(pageData: LandingPageData): BlockVisibility {
  return {
    hero: !!pageData.hero,
    services: !!pageData.services?.length,
    service_details: !!pageData.service_details?.length,
    emergency_banner: !!pageData.emergency_banner,
    materials: !!pageData.materials,
    process_steps: !!pageData.process_steps?.length,
    why_choose_us: !!pageData.why_choose_us?.length,
    testimonials: !!pageData.testimonials?.length,
    areas_served: !!pageData.areas_served,
    faq: !!pageData.faq?.length,
    contact: !!pageData.contact,
    cta_banner: !!pageData.cta_banner,
  };
}
```

---

## Resultado Esperado

Após a implementação:

1. Usuário pode **remover qualquer bloco** sem erros de save
2. A remoção é **persistida** no banco
3. Ao recarregar, os blocos removidos **não reaparecem**
4. O sistema aceita páginas **minimalistas** (apenas Hero)
5. O JSON salvo é **limpo e compacto**
