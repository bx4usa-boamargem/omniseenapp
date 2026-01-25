
# OmniSeen CMS Integrations - Plano de Implementação

## Status Atual (Inventário Completo)

### JÁ IMPLEMENTADO
| Componente | Status | Arquivo |
|------------|--------|---------|
| Edge Function `publish-to-cms` | Funcional | `supabase/functions/publish-to-cms/index.ts` |
| Tabela `cms_integrations` | Ativa | Com criptografia de credenciais |
| Tabela `cms_publish_logs` | Ativa | Logs de publicação |
| Hook `useCMSIntegrations` | Funcional | `src/hooks/useCMSIntegrations.ts` |
| UI de configuração | Funcional | `src/components/blog-editor/CMSIntegrationsTab.tsx` |
| WordPress: connect, test, publish | Funcional | REST API + Application Password |
| Wix: connect, test, publish | Parcial | API básica implementada |

### FALTANDO (Gap Analysis)
| Funcionalidade | Prioridade | Complexidade |
|----------------|------------|--------------|
| Botão "Publicar no WordPress" no editor | ALTA | Baixa |
| Detecção automática de blog (WP) | MÉDIA | Média |
| Criação automática de blog (WP) | BAIXA | Alta |
| Wix OAuth flow | ALTA | Média |
| Detecção/criação de blog (Wix) | BAIXA | Alta |
| Sincronização de categorias | BAIXA | Média |

---

## Sprint 1: WordPress Connector Completo

### 1.1 Botão "Publicar no WordPress" no Editor
**Arquivo**: `src/pages/client/ClientArticleEditor.tsx`

Adicionar botão condicional na toolbar (após "Gerar PDF", antes de "Salvar Rascunho"):

```typescript
// Novo import
import { useCMSIntegrations } from "@/hooks/useCMSIntegrations";
import { Globe, Upload } from "lucide-react";

// Dentro do componente
const { integrations, publishArticle, getActiveIntegration } = useCMSIntegrations(blog?.id || '');
const activeIntegration = getActiveIntegration();

// Botão na toolbar (linha ~1312)
{existingArticleId && activeIntegration && (
  <Button
    variant="outline"
    size="sm"
    onClick={handlePublishToCMS}
    disabled={isPublishingCMS}
    className="gap-2 border-green-500/30 text-green-600"
  >
    {isPublishingCMS ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
    Publicar no {activeIntegration.platform === 'wordpress' ? 'WordPress' : 'Wix'}
  </Button>
)}
```

**Handler**:
```typescript
const [isPublishingCMS, setIsPublishingCMS] = useState(false);

const handlePublishToCMS = async () => {
  if (!existingArticleId || !activeIntegration) return;
  
  setIsPublishingCMS(true);
  const result = await publishArticle(activeIntegration.id, existingArticleId);
  
  if (result.success) {
    toast.success(`Publicado com sucesso! ${result.externalUrl ? 'Ver: ' + result.externalUrl : ''}`);
    if (result.externalUrl) {
      window.open(result.externalUrl, '_blank');
    }
  } else {
    toast.error(result.message || 'Erro ao publicar');
  }
  setIsPublishingCMS(false);
};
```

### 1.2 Melhorias na Edge Function `publish-to-cms`
**Arquivo**: `supabase/functions/publish-to-cms/index.ts`

Adicionar detecção de blog WordPress:

```typescript
// Nova action: "detect-blog"
async function detectWordPressBlog(creds: WordPressCredentials): Promise<{
  hasBlog: boolean;
  postsEndpoint: boolean;
  categories: boolean;
  message: string;
}> {
  try {
    const authHeader = btoa(`${creds.username}:${creds.apiKey}`);
    
    // Check posts endpoint
    const postsRes = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
      headers: { Authorization: `Basic ${authHeader}` },
    });
    
    // Check categories
    const catsRes = await fetch(`${creds.siteUrl}/wp-json/wp/v2/categories?per_page=1`, {
      headers: { Authorization: `Basic ${authHeader}` },
    });
    
    const postsOk = postsRes.ok;
    const catsOk = catsRes.ok;
    
    return {
      hasBlog: postsOk,
      postsEndpoint: postsOk,
      categories: catsOk,
      message: postsOk 
        ? "Blog WordPress detectado e pronto para publicação" 
        : "Endpoint de posts não disponível",
    };
  } catch (error) {
    return { hasBlog: false, postsEndpoint: false, categories: false, message: "Erro ao detectar blog" };
  }
}
```

### 1.3 UI de Status de Blog Detectado
**Arquivo**: `src/components/blog-editor/CMSIntegrationsTab.tsx`

Adicionar indicador visual após teste de conexão bem-sucedido:

```typescript
// Novo estado
const [blogStatus, setBlogStatus] = useState<Record<string, { hasBlog: boolean; message: string }>>({});

// Após testar conexão com sucesso
const handleTestConnection = async (integrationId: string) => {
  const result = await testConnection(integrationId);
  if (result.success) {
    // Detectar blog automaticamente
    const detectResult = await supabase.functions.invoke("publish-to-cms", {
      body: { action: "detect-blog", integrationId },
    });
    if (detectResult.data) {
      setBlogStatus(prev => ({ ...prev, [integrationId]: detectResult.data }));
    }
    toast.success(result.message);
  } else {
    toast.error(result.message);
  }
};

// Badge visual
{blogStatus[integration.id] && (
  <Badge variant={blogStatus[integration.id].hasBlog ? "default" : "secondary"}>
    {blogStatus[integration.id].hasBlog ? "Blog Pronto" : "Sem Blog"}
  </Badge>
)}
```

---

## Sprint 2: Wix Connector Completo

### 2.1 Wix OAuth Flow
**Novo arquivo**: `supabase/functions/wix-oauth-callback/index.ts`

```typescript
// OAuth callback handler
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // Contains tenant_id, blog_id
  
  // Exchange code for tokens
  const tokenRes = await fetch("https://www.wixapis.com/oauth/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: Deno.env.get("WIX_CLIENT_ID"),
      client_secret: Deno.env.get("WIX_CLIENT_SECRET"),
      code,
    }),
  });
  
  const tokens = await tokenRes.json();
  
  // Store in cms_integrations
  // Redirect back to OmniSeen with success
});
```

### 2.2 Botão "Conectar com Wix" (OAuth)
**Arquivo**: `src/components/blog-editor/CMSIntegrationsTab.tsx`

Para Wix, substituir campos manuais por OAuth:

```typescript
// Wix OAuth URL
const initiateWixOAuth = () => {
  const state = encodeURIComponent(JSON.stringify({ blogId, returnUrl: window.location.href }));
  const authUrl = `https://www.wix.com/installer/install?appId=${WIX_APP_ID}&redirectUrl=${WIX_CALLBACK_URL}&state=${state}`;
  window.location.href = authUrl;
};

// Na UI
{selectedPlatform === 'wix' && (
  <Button onClick={initiateWixOAuth} className="w-full">
    <Globe className="h-4 w-4 mr-2" />
    Conectar com Wix
  </Button>
)}
```

---

## Arquitetura Final

```text
┌─────────────────────────────────────────────────────────────────┐
│                     OmniSeen SaaS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ Article Editor  │    │ CMS Settings    │                    │
│  │ ─────────────── │    │ ─────────────── │                    │
│  │ [Publicar WP]   │───▶│ [+ WordPress]   │                    │
│  │ [Publicar Wix]  │    │ [+ Wix]         │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           ▼                      ▼                              │
│  ┌────────────────────────────────────────────┐                │
│  │           publish-to-cms (Edge Function)   │                │
│  │  ─────────────────────────────────────────  │                │
│  │  Actions:                                   │                │
│  │  • test       → Valida credenciais         │                │
│  │  • detect-blog → Verifica se blog existe   │                │
│  │  • create     → Publica novo post          │                │
│  │  • update     → Atualiza post existente    │                │
│  └────────────────────────────────────────────┘                │
│                        │                                        │
└────────────────────────┼────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│    WordPress API    │       │      Wix API        │
│  ─────────────────  │       │  ─────────────────  │
│  /wp-json/wp/v2/    │       │  /blog/v3/          │
│  • posts            │       │  • draft-posts      │
│  • media            │       │  • publish          │
│  • categories       │       │  • categories       │
└─────────────────────┘       └─────────────────────┘
```

---

## Arquivos a Modificar

| Sprint | Arquivo | Alteração |
|--------|---------|-----------|
| 1 | `src/pages/client/ClientArticleEditor.tsx` | Adicionar botão "Publicar no WordPress/Wix" |
| 1 | `supabase/functions/publish-to-cms/index.ts` | Adicionar action `detect-blog` |
| 1 | `src/components/blog-editor/CMSIntegrationsTab.tsx` | Mostrar status de blog detectado |
| 2 | `supabase/functions/wix-oauth-callback/index.ts` | Nova Edge Function para OAuth Wix |
| 2 | `src/components/blog-editor/CMSIntegrationsTab.tsx` | Botão OAuth para Wix |
| 2 | `supabase/config.toml` | Registrar nova função |

---

## Critério de Aceitação

### WordPress (Sprint 1)
- Conectar com Application Password em menos de 3 minutos
- Publicar 1 artigo do editor e retornar URL final
- Abrir URL do post publicado em nova aba

### Wix (Sprint 2)
- Conectar via OAuth (1 clique)
- Publicar 1 artigo e retornar URL final

---

## Secrets Necessários (Sprint 2 - Wix)

Para OAuth do Wix, será necessário configurar:
- `WIX_CLIENT_ID` - App ID do Wix Dev Center
- `WIX_CLIENT_SECRET` - Secret do app Wix

---

## Recomendação de Execução

**Começar pela Sprint 1** (WordPress) pois:
1. Infraestrutura já existe e funciona
2. Apenas precisa conectar o botão ao editor
3. Entrega valor imediato sem dependências externas
4. Wix OAuth requer configuração no Wix Dev Center (fora do Lovable)
