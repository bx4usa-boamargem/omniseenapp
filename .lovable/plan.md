
# Plano: Controle Editorial de WhatsApp + Correção de Artigos 404

## Análise Diagnóstica

### Problema 1: Mensagem de WhatsApp Longa/Robótica
**Causa raiz identificada:**
- O sistema usa um template global (`global_comm_config`) com mensagem complexa:
  ```
  "Olá! Encontrei sua empresa ao buscar por {service} em {neighborhood}. 
   Li o artigo "{article_title}" no blog da unidade {territory_name} 
   e gostaria de falar com um especialista local."
  ```
- O dono do negócio (subconta) NÃO tem controle sobre essa mensagem
- A mensagem é gerada automaticamente com placeholders que nem sempre fazem sentido

**Solução:**
- Adicionar campo `whatsapp_lead_template` na tabela `business_profile` por tenant
- Permitir edição em "Minha Empresa" com preview em tempo real
- Usar template do tenant quando disponível, senão fallback para global simplificado

### Problema 2: Artigos Retornando 404
**Diagnóstico realizado:**
- ✅ Edge Function `content-api` funciona corretamente (testada com sucesso)
- ✅ Tabela `tenant_domains` tem domínios cadastrados no formato correto
- ✅ RPC `resolve_domain` mapeia corretamente hostname → blog_id
- ✅ Rotas em `BlogRoutes.tsx` estão configuradas: `/:articleSlug/*` → `CustomDomainArticle`
- ✅ Hook `useBlogArticle` chama `content-api` com route `blog.article`

**Possível causa:**
O problema ocorre no ambiente de PREVIEW (lovable.app), não em produção. O `getCurrentHostname()` retorna `id-preview--xxx.lovable.app` que não está mapeado na `tenant_domains`.

**Solução:**
- Melhorar a resolução de hostname no hook `useBlogArticle` para aceitar `blogId` como override
- Garantir que `CustomDomainArticle` passe o `blogId` recebido via props para o hook
- Adicionar fallback de resolução quando hostname não resolve via RPC

---

## Implementação Técnica

### PARTE 1: Controle Editorial de WhatsApp

#### 1.1 Migração de Banco
```sql
ALTER TABLE business_profile 
ADD COLUMN IF NOT EXISTS whatsapp_lead_template TEXT;

COMMENT ON COLUMN business_profile.whatsapp_lead_template IS 
'Template customizado para mensagens de WhatsApp. Suporta: {{titulo}}, {{pagina}}, {{servico}}';
```

#### 1.2 Atualizar Hook useGlobalWhatsApp
Modificar para aceitar template override do tenant:

```typescript
interface WhatsAppContext {
  phone: string;
  companyName?: string;
  service?: string;
  city?: string;
  articleTitle?: string;
  pageSlug?: string;           // NOVO: slug da página
  tenantTemplate?: string;     // NOVO: template customizado do tenant
}
```

Lógica de interpolação:
```typescript
function interpolateTenantTemplate(template: string, context: WhatsAppContext): string {
  return template
    .replace(/\{\{titulo\}\}/g, context.articleTitle || 'seu site')
    .replace(/\{\{pagina\}\}/g, context.pageSlug || '')
    .replace(/\{\{servico\}\}/g, context.service || 'seus serviços');
}
```

#### 1.3 Atualizar ClientCompany.tsx
Adicionar campo de template com preview:

```tsx
{/* Template de Mensagem WhatsApp */}
<div className="space-y-2">
  <Label>Mensagem automática de contato</Label>
  <Textarea
    placeholder="Olá! Vi seu site e gostaria de saber mais sobre seus serviços."
    value={whatsappTemplate}
    onChange={(e) => setWhatsappTemplate(e.target.value)}
    className="min-h-[80px]"
  />
  <p className="text-xs text-muted-foreground">
    Placeholders disponíveis: <code>{"{{titulo}}"}</code>, <code>{"{{pagina}}"}</code>, <code>{"{{servico}}"}</code>
  </p>
  
  {/* Preview da mensagem */}
  {whatsappTemplate && (
    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
      <p className="text-sm font-medium text-green-600 flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        Preview:
      </p>
      <p className="text-sm text-muted-foreground italic">
        "{interpolatePreview(whatsappTemplate)}"
      </p>
    </div>
  )}
</div>
```

#### 1.4 Valor Default Humano
Se o tenant não definir template, usar mensagem simples:
```
"Olá! Vi seu site e gostaria de saber mais sobre seus serviços."
```

#### 1.5 Atualizar Componentes de CTA
Modificar `CTABanner.tsx`, `WhatsAppFloatButton.tsx`, e `CTABannerBlock.tsx`:
- Buscar `whatsapp_lead_template` do `business_profile`
- Usar template do tenant quando disponível
- Fallback para default simples (não o template global longo)

---

### PARTE 2: Correção de Artigos 404

#### 2.1 Atualizar useBlogArticle Hook
Permitir passar `blogId` diretamente para bypass da resolução por hostname:

```typescript
// src/hooks/useContentApi.ts

export function useBlogArticle(
  slug: string | undefined,
  options?: { blogId?: string }  // NOVO
): UseBlogArticleResult {
  // ...
  
  useEffect(() => {
    const fetch = async () => {
      // Se blogId foi passado, usar diretamente sem resolver hostname
      if (options?.blogId) {
        const result = await fetchContentApiByBlogId<BlogArticleData>(
          "blog.article", 
          options.blogId,
          { slug }
        );
        // ...
      } else {
        // Comportamento atual: resolve por hostname
        const result = await fetchContentApi<BlogArticleData>("blog.article", { slug });
        // ...
      }
    };
  }, [slug, options?.blogId]);
}
```

#### 2.2 Nova Função fetchContentApiByBlogId
```typescript
export async function fetchContentApiByBlogId<T>(
  route: ContentRoute,
  blogId: string,
  params: Record<string, unknown> = {}
): Promise<ContentApiResponse<T> | null> {
  try {
    const { data, error } = await supabase.functions.invoke("content-api", {
      body: { blog_id: blogId, route, params },  // Usa blog_id em vez de host
    });
    // ...
  }
}
```

#### 2.3 Atualizar content-api Edge Function
Aceitar `blog_id` diretamente como alternativa a `host`:

```typescript
// supabase/functions/content-api/index.ts

interface ContentRequest {
  host?: string;        // Resolução por hostname (comportamento atual)
  blog_id?: string;     // NOVO: bypass de resolução
  route: ContentRoute;
  params?: Record<string, unknown>;
}

// Na lógica principal:
let tenant: TenantResolution | null = null;

if (req.blog_id) {
  // Bypass: usar blog_id diretamente
  tenant = {
    blog_id: req.blog_id,
    tenant_id: null,
    domain: 'direct',
    domain_type: 'subdomain',
    status: 'active'
  };
} else if (req.host) {
  tenant = await resolveTenant(supabase, req.host);
}
```

#### 2.4 Atualizar CustomDomainArticle
Passar `blogId` recebido como prop para o hook:

```typescript
// src/pages/CustomDomainArticle.tsx

export default function CustomDomainArticle({ blogId }: CustomDomainArticleProps) {
  const { articleSlug } = useParams();
  
  // Passar blogId para o hook (bypass hostname resolution)
  const { blog, article, related, loading, error } = useBlogArticle(articleSlug, { blogId });
  
  // ...resto do código
}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/client/ClientCompany.tsx` | Adicionar campo whatsapp_lead_template |
| `src/lib/whatsappBuilder.ts` | Adicionar função interpolateTenantTemplate |
| `src/hooks/useGlobalWhatsApp.ts` | Suportar tenantTemplate no contexto |
| `src/components/public/CTABanner.tsx` | Usar template do tenant |
| `src/components/public/WhatsAppFloatButton.tsx` | Usar template do tenant |
| `src/components/client/landingpage/blocks/CTABannerBlock.tsx` | Usar template do tenant |
| `src/hooks/useContentApi.ts` | Aceitar blogId override no useBlogArticle |
| `supabase/functions/content-api/index.ts` | Aceitar blog_id como alternativa a host |
| `src/pages/CustomDomainArticle.tsx` | Passar blogId para useBlogArticle |

---

## Fluxo Final

### WhatsApp CTA
```
1. Usuário configura template em "Minha Empresa"
   "Olá! Vi o artigo {{titulo}} e quero saber sobre {{servico}}."

2. Ao clicar em CTA WhatsApp no artigo:
   → Sistema busca business_profile.whatsapp_lead_template
   → Interpola placeholders: "Olá! Vi o artigo 'Dedetização em Restaurantes' e quero saber sobre controle de pragas."
   → Gera link: https://wa.me/5586988887777?text=...

3. Se template não definido:
   → Usa default: "Olá! Vi seu site e gostaria de saber mais sobre seus serviços."
```

### Resolução de Artigos
```
1. Usuário acessa: https://trulynolen.app.omniseen.app/dedetizacao-em-restaurantes

2. BlogRoutes resolve blogId via useDomainResolution
   → blogId: 781c9714-7459-4839-80b1-940489c6d5f8

3. CustomDomainArticle recebe blogId como prop
   → Passa para useBlogArticle({ blogId })

4. useBlogArticle chama content-api com blog_id direto
   → Bypass de resolução por hostname
   → Artigo retornado corretamente

5. Artigo renderizado com sucesso ✓
```

---

## Definition of Done

| Critério | Implementação |
|----------|---------------|
| Campo de template editável | "Minha Empresa" com textarea + preview |
| Placeholders funcionais | {{titulo}}, {{pagina}}, {{servico}} |
| Default humano | "Olá! Vi seu site..." quando vazio |
| Preview em tempo real | Mostra mensagem interpolada ao digitar |
| Artigos publicados acessíveis | Via blogId passado como prop |
| content-api aceita blog_id | Alternativa a resolução por host |
| Zero mensagens "inventadas" | Sistema nunca gera texto que o dono não aprovou |
