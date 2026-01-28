
# Plano: Corrigir Páginas Públicas para Usar Hooks `useContentApi`

## Problema Identificado
As páginas `PublicArticle.tsx` e `PublicLandingPage.tsx` fazem consultas diretas ao Supabase usando `supabase.from()`. Isso falha para usuários anônimos porque as políticas RLS bloqueiam o acesso. O sistema já possui hooks (`useBlogArticle`, `useLandingPage`) que usam a Edge Function `content-api` com `verify_jwt=false`, contornando essas restrições.

## Evidências

### PublicArticle.tsx (linhas 178-265)
```typescript
// ❌ QUERY DIRETA - FALHA COM RLS
const { data: blogData } = await supabase
  .from("blogs")
  .select("*")
  .eq("slug", blogSlug)
  .single();

const { data: articleData } = await supabase
  .from("articles")
  .select("*")
  .eq("blog_id", blogData.id)
  .eq("slug", articleSlug)
  .eq("status", "published")
  .single();
```

### PublicLandingPage.tsx (linhas 47-118)
```typescript
// ❌ QUERY DIRETA - FALHA COM RLS
const { data: blogRow } = await supabase
  .from("blogs")
  .select("...")
  .eq("slug", blogSlug)
  .maybeSingle();

const { data: pageRow } = await supabase
  .from("landing_pages")
  .select("*")
  .eq("blog_id", blogRow.id)
  .eq("slug", pageSlug)
  .maybeSingle();
```

### Solução Existente (Referência)
- `CustomDomainArticle.tsx` já usa `useBlogArticle` corretamente
- `CustomDomainLandingPage.tsx` já usa `useLandingPage` corretamente

---

## Modificações Necessárias

### Arquivo 1: `src/pages/PublicArticle.tsx`

**O que mudar:**
1. Remover `import { supabase }` 
2. Importar `useBlogArticle, useAgentConfig` de `useContentApi`
3. Substituir todo o `useEffect` de fetch (linhas 172-276) pelo hook
4. Manter lógica de tradução e FAQ parsing existente
5. Adaptar propriedades do blog/artigo para o formato do hook

**Antes (simplificado):**
```typescript
import { supabase } from "@/integrations/supabase/client";
// ...
const [blog, setBlog] = useState<Blog | null>(null);
const [article, setArticle] = useState<Article | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    const { data: blogData } = await supabase.from("blogs")...
    const { data: articleData } = await supabase.from("articles")...
    // ...
  };
  fetchData();
}, [blogSlug, articleSlug, t]);
```

**Depois:**
```typescript
import { useBlogArticle, useAgentConfig } from "@/hooks/useContentApi";
// ...
const { blog, article, related, loading, error } = useBlogArticle(articleSlug);
const { agentConfig, businessProfile } = useAgentConfig();
```

**Campos que precisam de mapeamento:**
| Formato Antigo (Blog) | Formato useContentApi |
|-----------------------|----------------------|
| `blog.logo_negative_url` | Não existe (usar `null`) |
| `blog.brand_display_mode` | Não existe (usar `'text'`) |
| `blog.domain_verified` | Usar `true` |
| `blog.cta_text` | `blog.header_cta_text` |
| `blog.cta_url` | `blog.header_cta_url` |

---

### Arquivo 2: `src/pages/PublicLandingPage.tsx`

**O que mudar:**
1. Remover `import { supabase }`
2. Importar `useLandingPage, useAgentConfig` de `useContentApi`
3. Eliminar todo o `useEffect` de fetch (linhas 27-140)
4. Usar o hook `useLandingPage(pageSlug)` diretamente
5. Remover estados manuais (`blog`, `page`, `agentConfig`, `businessProfile`)

**Antes:**
```typescript
import { supabase } from "@/integrations/supabase/client";
// ...
const [loading, setLoading] = useState(true);
const [blog, setBlog] = useState<any>(null);
const [page, setPage] = useState<any>(null);
const [agentConfig, setAgentConfig] = useState<any>(null);

useEffect(() => {
  const run = async () => {
    const { data: blogRow } = await supabase.from("blogs")...
    const { data: pageRow } = await supabase.from("landing_pages")...
    // ...
  };
  run();
}, [blogSlug, pageSlug]);
```

**Depois:**
```typescript
import { useLandingPage, useAgentConfig } from "@/hooks/useContentApi";
// ...
const { blog, page, loading, error } = useLandingPage(pageSlug);
const { agentConfig, businessProfile } = useAgentConfig();
```

---

## Detalhes Técnicos

### Edge Function `content-api`
- Configurada com `verify_jwt = false` em `supabase/config.toml`
- Usa `service_role` internamente para bypass de RLS
- Rotas: `blog.article`, `page.landing`, `agent.config`

### Mapeamento de Tipos

O hook `useBlogArticle` retorna `ArticleFull`:
```typescript
interface ArticleFull extends ArticleSummary {
  content: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  view_count: number | null;
  faq: { question: string; answer: string }[] | null;
  // ...
}
```

O hook `useLandingPage` retorna:
```typescript
interface LandingPage {
  id: string;
  title: string;
  slug: string;
  page_data: unknown;
  seo_title: string | null;
  seo_description: string | null;
  featured_image_url: string | null;
}
```

---

## Critérios de Aceite

| Critério | Validação |
|----------|-----------|
| `/blog/:slug/:article` funciona em aba anônima | Testar sem login |
| `/p/:pageSlug` funciona em aba anônima | Testar sem login |
| Network mostra `content-api` (não queries diretas) | DevTools > Network |
| Console não mostra erros de RLS | DevTools > Console |
| Traduções de artigo continuam funcionando | Selecionar idioma diferente |

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/PublicArticle.tsx` | Substituir queries por `useBlogArticle` |
| `src/pages/PublicLandingPage.tsx` | Substituir queries por `useLandingPage` |

---

## Impacto

- **Zero impacto** em páginas de domínio customizado (já usam hooks)
- **Resolve** erro "Página não encontrada" para visitantes anônimos
- **Mantém** todas as funcionalidades existentes (traduções, FAQ, agent widget)
- **Elimina** dependência de políticas RLS públicas nas tabelas
