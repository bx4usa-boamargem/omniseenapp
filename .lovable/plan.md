
# Sprint 4: Interface de Geração Manual de Artigos

## Contexto Atual

### O que já existe:
| Recurso | Localização | Status |
|---------|-------------|--------|
| **Backend - Template Selector** | `supabase/functions/_shared/templateSelector.ts` | ✅ Implementado |
| **Backend - Pipeline Stages** | `supabase/functions/_shared/pipelineStages.ts` | ✅ Implementado |
| **Backend - E-E-A-T por Nicho** | `supabase/functions/_shared/geoWriterCore.ts` | ✅ Implementado |
| **Backend - ALT de Imagens** | `supabase/functions/_shared/imageAltGenerator.ts` | ✅ Implementado |
| **Frontend - Types** | `src/lib/article-engine/types.ts` | ✅ Implementado |
| **Frontend - Templates** | `src/lib/article-engine/templates.ts` | ✅ Implementado |
| **Frontend - Niches** | `src/lib/article-engine/niches.ts` | ✅ Implementado |
| **Formulário Simples** | `src/components/client/SimpleArticleForm.tsx` | ✅ Existe (inspiração) |
| **Editor de Artigos** | `src/pages/client/ClientArticleEditor.tsx` | ✅ Existe (1351 linhas) |
| **Lista de Artigos** | `src/pages/client/ClientArticles.tsx` | ✅ Existe (487 linhas) |
| **Edge Function** | `generate-article-structured` | ✅ Existe |

### Rotas Atuais (`/client/*`):
- `/client/create` → `ClientArticleEditor` (formulário simplificado)
- `/client/articles/:id/edit` → `ClientArticleEditor` (edição)
- `/client/articles` → `ClientArticles` (listagem)

---

## Objetivo do Sprint 4

Criar uma **interface avançada de geração** que expõe os novos recursos do Article Engine (seleção de template, E-E-A-T, preview de estrutura) para usuários avançados, mantendo o fluxo simples existente para usuários básicos.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE GERAÇÃO AVANÇADA                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [1] /client/articles/generate                                      │
│      └── ArticleGenerator.tsx (Formulário Avançado)                 │
│          ├── Campos: keyword, cidade, estado, nicho                 │
│          ├── Modo: Entry vs Authority                               │
│          ├── Template: Auto ou Manual (5 opções)                    │
│          ├── Toggles: Web Research, E-E-A-T, ALT de Imagens         │
│          └── Botões: [PREVIEW TEMPLATE] [GERAR ARTIGO]              │
│                                                                     │
│  [2] Modal: ArticleTemplatePreviewModal                             │
│      └── Mostra estrutura do template selecionado                   │
│          ├── Template + Variante + Intent                           │
│          ├── Word Count Range + H2 Count                            │
│          ├── Lista de seções com targetWords                        │
│          └── Reason (por que este template foi escolhido)           │
│                                                                     │
│  [3] /client/articles/:id/preview                                   │
│      └── ArticlePreview.tsx (Preview Completo)                      │
│          ├── Metadados: Word Count, SEO Score, H2 Count             │
│          ├── Renderização: H1, TL;DR, Seções, FAQ, CTA              │
│          ├── Imagens: ALT contextualizado                           │
│          └── Ações: [EDITAR] [PUBLICAR] [REGENERAR]                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar

### 1. Página Principal: `ArticleGenerator.tsx`

**Caminho:** `src/pages/client/ArticleGenerator.tsx`

**Estrutura do formulário:**

```text
┌────────────────────────────────────────────────────────────┐
│  🎯 Gerar Artigo de Autoridade Local                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📝 Informações Básicas                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Palavra-chave *                                      │ │
│  │ [________________________________]                   │ │
│  │                                                      │ │
│  │ Cidade *              Estado                         │ │
│  │ [______________]      [SP ▼]                        │ │
│  │                                                      │ │
│  │ Nicho *                                              │ │
│  │ [Desentupidora (plumbing) ▼]                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ⚙️ Configurações Avançadas                                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Modo de Geração                                      │ │
│  │ ○ Entry (800-1.200 palavras)                        │ │
│  │ ● Authority (1.200-3.000 palavras)                  │ │
│  │                                                      │ │
│  │ Template Estrutural                                  │ │
│  │ ● Auto-selecionar (inteligente)                     │ │
│  │ ○ Guia Completo                                     │ │
│  │ ○ Perguntas & Respostas                             │ │
│  │ ○ Comparativo Técnico                               │ │
│  │ ○ Problema → Solução                                │ │
│  │ ○ Educacional em Etapas                             │ │
│  │                                                      │ │
│  │ ☑ Usar Web Research (Perplexity)                    │ │
│  │ ☑ Incluir E-E-A-T local                             │ │
│  │ ☑ Gerar ALT de imagens contextualizado              │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [PREVIEW TEMPLATE]       [GERAR ARTIGO →]                │
└────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Carrega blog atual via `useBlog()`
- Lista de nichos do frontend (`NICHE_RULESETS`)
- Lista de templates do frontend (`ARTICLE_TEMPLATES`)
- Validação em tempo real (keyword >= 3 chars, cidade obrigatória)
- Botão "Preview Template" abre modal com estrutura
- Botão "Gerar Artigo" chama edge function

---

### 2. Componente Modal: `ArticleTemplatePreviewModal.tsx`

**Caminho:** `src/components/client/ArticleTemplatePreviewModal.tsx`

**Estrutura:**

```text
┌────────────────────────────────────────────────────────────┐
│  📋 Preview: Template Selecionado                    [✕]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🏷️ Template: Problema → Solução                          │
│  📊 Variante: urgent_first                                │
│  🎯 Intenção: transactional (urgência alta)               │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│                                                            │
│  📈 Especificações                                         │
│  • Word Count: 1.600 - 2.800 palavras                     │
│  • Seções H2: 8 - 12                                      │
│  • FAQ: 8-12 perguntas                                    │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│                                                            │
│  📑 Estrutura das Seções                                   │
│  1. Introdução (150 palavras)                             │
│  2. Sinais de que você precisa [LISTA] (200)              │
│  3. Por que isso acontece? (250)                          │
│  4. Riscos de não resolver (200)                          │
│  5. A solução: profissional (250)                         │
│  6. Fazer sozinho ou contratar? [TABELA] (300)            │
│  7. Como resolver passo a passo [LISTA] (350)             │
│  8. Como prevenir [LISTA] (250)                           │
│  9. Quando chamar profissional [E-E-A-T] (200)            │
│  10. Serviço em {{cidade}} [GEO] (200)                    │
│  11. Perguntas frequentes (300)                           │
│  12. Precisa de ajuda urgente? [CTA] (150)                │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│                                                            │
│  💡 Por que este template?                                 │
│  "A keyword 'desentupidora urgente' indica intenção       │
│   transacional com alta urgência."                        │
│                                                            │
│  [VOLTAR]                    [GERAR COM ESTE TEMPLATE]    │
└────────────────────────────────────────────────────────────┘
```

**Dados a buscar:**
- Chama `selectTemplateForBrief()` do pipelineStages (via edge function)
- Ou calcula localmente usando funções do frontend

---

### 3. Página de Preview: `ArticleAdvancedPreview.tsx`

**Caminho:** `src/pages/client/ArticleAdvancedPreview.tsx`

**Estrutura:**

```text
┌────────────────────────────────────────────────────────────┐
│  ← Voltar    Desentupidora em São Paulo: Guia 2026        │
│              [EDITAR] [PUBLICAR] [REGENERAR]               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📊 Metadados do Artigo                                    │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Word Count     SEO Score    H2 Count    FAQ Count  │   │
│  │ 2.450/2.800 ✅  85/100 ✅    10 ✅       10 ✅     │   │
│  │                                                     │   │
│  │ Imagens       E-E-A-T      Template                 │   │
│  │ 8 ✅          Presente ✅   problem_solution ✅    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [RENDERIZAÇÃO DO ARTIGO]                                  │
│                                                            │
│  # Desentupidora em São Paulo: Solução Definitiva         │
│                                                            │
│  TL;DR:                                                    │
│  • Atendimento 24h em toda São Paulo                      │
│  • Orçamento gratuito e garantia de 90 dias               │
│  • Equipamentos modernos e profissionais capacitados       │
│                                                            │
│  [Imagem Hero]                                             │
│  ALT: "Equipe de desentupidora da Desentup Rápido..."     │
│                                                            │
│  ## Sinais de que você precisa de desentupidora           │
│  ...conteúdo...                                            │
│                                                            │
│  ## Por que isso acontece?                                 │
│  ...conteúdo...                                            │
│                                                            │
│  [FAQ section com JSON-LD]                                 │
│                                                            │
│  ## Próximo passo: solicite orçamento                     │
│  [CTA com WhatsApp]                                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Rotas a Adicionar

No arquivo `src/App.tsx`, adicionar dentro do `ClientRoutes`:

```typescript
// Geração avançada
<Route path="articles/generate" element={<ArticleGenerator />} />

// Preview do artigo gerado
<Route path="articles/:id/preview" element={<ArticleAdvancedPreview />} />
```

---

## Componentes Auxiliares a Criar

| Componente | Responsabilidade |
|------------|------------------|
| `ArticleGeneratorForm.tsx` | Formulário com campos e validação |
| `TemplateSelectorRadio.tsx` | Radio buttons dos 5 templates |
| `NicheSelectorDropdown.tsx` | Dropdown com 13 nichos |
| `ArticleMetadataCard.tsx` | Card com métricas (word count, SEO) |
| `OutlineSectionsList.tsx` | Lista de seções do outline |

---

## Integração com Backend

### Edge Function a chamar:

```typescript
const { data, error } = await supabase.functions.invoke('generate-article-structured', {
  body: {
    keyword: formData.keyword,
    city: formData.city,
    state: formData.state,
    niche: formData.niche,
    mode: formData.mode, // 'entry' | 'authority'
    webResearch: formData.webResearch,
    templateOverride: formData.template !== 'auto' ? formData.template : undefined,
    blogId: blog.id,
    businessName: businessProfile?.company_name,
    businessPhone: businessProfile?.phone,
    businessWhatsapp: businessProfile?.whatsapp,
    // Flags do novo Article Engine
    useEat: formData.eatInjection,
    contextualAlt: formData.imageAlt
  }
});
```

### Preview de Template (Local):

Para preview rápido sem chamar o backend, podemos calcular no frontend:

```typescript
import { classifyIntent } from '@/lib/article-engine/intent';
import { ARTICLE_TEMPLATES, getWordCountRange } from '@/lib/article-engine/templates';

const preview = {
  intent: classifyIntent(keyword),
  template: intent.recommendedTemplate,
  specs: ARTICLE_TEMPLATES[intent.recommendedTemplate],
  wordCountRange: getWordCountRange(specs, mode)
};
```

---

## Estados de Loading

```typescript
const [isPreviewingTemplate, setIsPreviewingTemplate] = useState(false);
const [isGenerating, setIsGenerating] = useState(false);
const [generationProgress, setGenerationProgress] = useState(0);
const [generationStage, setGenerationStage] = useState<string | null>(null);

// Stages possíveis:
// 'validating' → 'classifying' → 'researching' → 'outlining' → 'writing' → 'optimizing' → 'done'
```

---

## Validações

### No Formulário:
- ✅ Keyword: mínimo 3 caracteres
- ✅ Cidade: obrigatória
- ✅ Nicho: obrigatório (dropdown)
- ✅ Modo: entry ou authority (radio)
- ✅ Template: auto ou específico (radio)

### Após Geração:
- ✅ Word count dentro do range do template
- ✅ H2 count dentro do range (8-12)
- ✅ Keyword density 1-2%
- ✅ E-E-A-T presente (se habilitado)
- ✅ ALT de imagens contextualizado (se habilitado)

---

## Checklist de Implementação

### Arquivos a Criar:
- [ ] `src/pages/client/ArticleGenerator.tsx`
- [ ] `src/pages/client/ArticleAdvancedPreview.tsx`
- [ ] `src/components/client/ArticleTemplatePreviewModal.tsx`
- [ ] `src/components/client/ArticleGeneratorForm.tsx`
- [ ] `src/components/client/TemplateSelectorRadio.tsx`
- [ ] `src/components/client/NicheSelectorDropdown.tsx`
- [ ] `src/components/client/ArticleMetadataCard.tsx`
- [ ] `src/components/client/OutlineSectionsList.tsx`

### Arquivos a Modificar:
- [ ] `src/App.tsx` - adicionar rotas

### Validações:
- [ ] Formulário com validação em tempo real
- [ ] Preview de template funciona localmente
- [ ] Botão "Gerar" chama edge function corretamente
- [ ] Preview do artigo renderiza markdown
- [ ] Metadados são calculados corretamente
- [ ] Botões EDITAR/PUBLICAR/REGENERAR funcionam

---

## Resumo Técnico

| Item | Descrição |
|------|-----------|
| **Páginas novas** | 2 (`ArticleGenerator`, `ArticleAdvancedPreview`) |
| **Componentes novos** | 6 (Modal, Form, Selectors, Cards) |
| **Rotas novas** | 2 (`/articles/generate`, `/articles/:id/preview`) |
| **Integração backend** | `generate-article-structured` + preview local |
| **Dependências frontend** | `@/lib/article-engine/*` já existentes |

