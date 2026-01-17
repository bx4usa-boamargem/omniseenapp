# Arquitetura Técnica OmniSeen

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Dados](#2-estrutura-de-dados)
3. [Edge Functions](#3-edge-functions)
4. [Segurança](#4-segurança)
5. [Integrações](#5-integrações)
6. [Performance](#6-performance)

---

## 1. Visão Geral

### 1.1 Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State | React Query + Context API |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Auth | Supabase Auth (Email + Google OAuth) |
| Storage | Supabase Storage |
| AI | OpenAI, Anthropic, Google, Perplexity |
| Hosting | Lovable Cloud |

### 1.2 Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  Landing Page  │  Platform App  │  Public Blog Portal       │
│  (omniseen.app)│  (app.*)       │  ({slug}.omniseen.app)   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                          │
├─────────────────────────────────────────────────────────────┤
│  Auth  │  Database (RLS)  │  Storage  │  Edge Functions     │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
├─────────────────────────────────────────────────────────────┤
│  OpenAI  │  Anthropic  │  Perplexity  │  Stripe  │  GSC     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Roteamento por Hostname

| Hostname | Modo | Descrição |
|----------|------|-----------|
| `omniseen.app` | Landing | Landing page oficial |
| `app.omniseen.app` | Platform | Dashboard e autenticação |
| `{slug}.omniseen.app` | Blog | Portal público do cliente |
| `{custom-domain}` | Blog | Domínio customizado verificado |

---

## 2. Estrutura de Dados

### 2.1 Tabelas Principais

#### Usuários e Autenticação

```sql
-- Gerenciado pelo Supabase Auth
auth.users

-- Perfis estendidos
public.profiles (
  id, user_id, email, full_name, avatar_url,
  last_login_at, phone, created_at
)

-- Roles de acesso
public.user_roles (
  id, user_id, role, created_at
)
-- Roles: 'admin', 'platform_admin', 'subaccount', 'team_member'
```

#### Tenants e Blogs

```sql
-- Organização/Empresa
public.tenants (
  id, name, owner_user_id, status, plan,
  billing_email, created_at
)

-- Blogs por tenant
public.blogs (
  id, tenant_id, user_id, name, slug,
  platform_subdomain, custom_domain, domain_verified,
  primary_color, logo_url, ...
)

-- Perfil de negócio
public.business_profile (
  id, blog_id, company_name, niche, services,
  target_audience, city, whatsapp, currency, ...
)
```

#### Conteúdo

```sql
-- Artigos
public.articles (
  id, blog_id, title, slug, content, status,
  featured_image_url, keywords, funnel_stage,
  opportunity_id, published_at, ...
)

-- Oportunidades do Radar
public.article_opportunities (
  id, blog_id, suggested_title, relevance_score,
  funnel_stage, territory_id, status, ...
)

-- Fila de geração
public.article_queue (
  id, blog_id, suggested_theme, status,
  scheduled_for, article_id, ...
)
```

#### Sistema

```sql
-- Logs de consumo de IA
public.consumption_logs (
  id, user_id, blog_id, action_type, model_used,
  input_tokens, output_tokens, estimated_cost_usd, ...
)

-- Cache de conteúdo IA
public.ai_content_cache (
  id, content_hash, response_data, hits,
  cost_saved_usd, expires_at, ...
)

-- Alertas de custo
public.admin_cost_alerts (
  id, alert_type, threshold_usd, is_active, ...
)

-- Alertas de saúde
public.admin_health_alerts (
  id, alert_type, threshold_value, is_active, ...
)
```

### 2.2 Diagrama ER Simplificado

```
tenants (1) ──────────────< blogs (n)
    │                          │
    │                          ├──< articles (n)
    │                          ├──< article_opportunities (n)
    │                          ├──< business_profile (1)
    │                          ├──< blog_automation (1)
    │                          └──< territories (n)
    │
    └───< team_members (n) >─── users
```

---

## 3. Edge Functions

### 3.1 Funções de Geração de Conteúdo

| Função | Descrição |
|--------|-----------|
| `generate-article` | Gera artigo completo com SEO |
| `generate-image` | Gera imagens via FLUX/DALL-E |
| `convert-opportunity-to-article` | Converte oportunidade em artigo |
| `auto-fix-article` | Corrige artigos reprovados no QG |

### 3.2 Funções de Inteligência

| Função | Descrição |
|--------|-----------|
| `weekly-market-intel` | Radar semanal de oportunidades |
| `suggest-niche-keywords` | Sugere keywords por nicho |
| `analyze-seo` | Análise de SEO de artigos |
| `check-content-quality` | Quality Gate de conteúdo |

### 3.3 Funções de Integração

| Função | Descrição |
|--------|-----------|
| `notify-indexnow` | Notifica buscadores sobre novo conteúdo |
| `verify-domain` | Verifica domínio customizado |
| `google-search-callback` | Callback OAuth do GSC |
| `sync-gsc-data` | Sincroniza dados do Search Console |

### 3.4 Padrão de Implementação

```typescript
// supabase/functions/example-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lógica da função

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## 4. Segurança

### 4.1 Row Level Security (RLS)

Todas as tabelas públicas têm RLS habilitado. Padrões principais:

```sql
-- Usuário acessa seus próprios dados
CREATE POLICY "Users own data"
ON public.blogs FOR ALL
USING (user_id = auth.uid());

-- Membros de equipe acessam blogs compartilhados
CREATE POLICY "Team members access"
ON public.articles FOR SELECT
USING (
  blog_id IN (
    SELECT blog_id FROM team_members
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

-- Admins acessam tudo
CREATE POLICY "Admins access all"
ON public.tenants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'platform_admin')
  )
);
```

### 4.2 Funções SECURITY DEFINER

```sql
-- Verifica role do usuário
CREATE FUNCTION has_role(user_uuid UUID, role_name app_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid AND role = role_name
  );
$$;

-- Verifica membro de equipe
CREATE FUNCTION is_team_member_of_blog(user_uuid UUID, blog_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = user_uuid AND blog_id = blog_uuid AND status = 'accepted'
  );
$$;
```

### 4.3 Tabelas Restritas

Tabelas de sistema acessíveis apenas via `service_role`:

- `ai_content_cache`
- `ai_usage_logs`
- `consumption_logs` (insert by service_role)
- `blog_traffic`

---

## 5. Integrações

### 5.1 Google Search Console

```typescript
// Fluxo OAuth
1. Usuário clica "Conectar GSC"
2. Redirect para Google OAuth
3. Callback salva tokens em gsc_connections
4. Job semanal sincroniza métricas
```

### 5.2 WhatsApp (via API Links)

```typescript
// Template global herdado
const buildWhatsAppLink = (phone: string, template: string, vars: object) => {
  const message = template
    .replace("{phone}", phone)
    .replace("{city}", vars.city)
    .replace("{service}", vars.service);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
```

### 5.3 Stripe (Billing)

```sql
-- Subscriptions
public.subscriptions (
  id, user_id, stripe_customer_id, stripe_subscription_id,
  status, plan_id, current_period_end, ...
)
```

---

## 6. Performance

### 6.1 Indexes Críticos

```sql
CREATE INDEX idx_articles_blog_status ON articles(blog_id, status);
CREATE INDEX idx_articles_published ON articles(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_opportunities_blog_score ON article_opportunities(blog_id, relevance_score DESC);
CREATE INDEX idx_consumption_date ON consumption_logs(created_at DESC);
```

### 6.2 Cache Strategy

| Tipo | TTL | Descrição |
|------|-----|-----------|
| AI Responses | 7 dias | Prompts similares |
| GSC Data | 24h | Métricas de busca |
| SEO Analysis | 1 dia | Análise de artigos |

### 6.3 Limites e Rate Limiting

| Recurso | Limite |
|---------|--------|
| Artigos/mês | Por plano (8/20/100) |
| Radar/mês | Por plano (0/10/30) |
| API calls | 1000/hora por tenant |
| Storage | 1GB por blog |

---

## Referências

- [Supabase Docs](https://supabase.com/docs)
- [Lovable Docs](https://docs.lovable.dev)
- [React Query](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com/docs)