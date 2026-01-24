
# Plano: Estabilização Multi-Tenant para Subdomínios

## Objetivo
Tornar a Omniseen funcional em subdomínios `cliente.app.omniseen.app`, eliminando tela branca, loops de login e redirects quebrados.

## Escopo Estrito
- ✅ Resolução de tenant por subdomínio
- ✅ Fluxo de login centralizado
- ✅ Redirects OAuth
- ✅ Persistência de sessão
- ❌ **NÃO** altera: SERP, Content Score, IA, editor, banco de dados

---

## Alterações Planejadas

### 1. Adicionar Helper para Tenant via Meta Tag
**Arquivo:** `src/utils/platformUrls.ts`

Adicionar nova função para leitura de slug injetado pelo Cloudflare Worker:

```typescript
/**
 * Lê o slug do tenant de uma meta tag injetada pelo reverse proxy
 * Permite que o Cloudflare Worker injete o tenant real via HTML
 * @example <meta name="x-tenant-slug" content="trulynolen" />
 */
export function getTenantSlugFromMeta(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="x-tenant-slug"]');
  return meta?.getAttribute('content') || null;
}

/**
 * Resolve o slug do tenant com prioridade:
 * 1. Meta tag injetada pelo Worker (x-tenant-slug)
 * 2. Parsing do hostname atual
 */
export function resolveCurrentTenantSlug(): string | null {
  // Prioridade 1: Meta tag do Worker
  const metaSlug = getTenantSlugFromMeta();
  if (metaSlug) return metaSlug;
  
  // Prioridade 2: Parsing do hostname
  return extractSubdomainSlug();
}
```

---

### 2. Atualizar Auth para Callback Centralizado
**Arquivo:** `src/hooks/useAuth.tsx`

Alterar o `signInWithGoogle` para usar callback centralizado em `app.omniseen.app`:

**Antes (linha 76):**
```typescript
redirectTo: `${window.location.origin}/client/dashboard`,
```

**Depois:**
```typescript
redirectTo: `https://app.omniseen.app/oauth/callback?return_to=${encodeURIComponent(window.location.origin + '/client/dashboard')}`,
```

Isso garante que o OAuth sempre retorne para a plataforma principal, que então redireciona para o subdomínio correto.

---

### 3. Criar Página de Callback OAuth
**Novo arquivo:** `src/pages/auth/OAuthCallback.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Finalizando login...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Aguardar a sessão ser estabelecida pelo Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[OAuthCallback] Session error:', error);
          setStatus('Erro ao finalizar login');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        // Ler o return_to do query string
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('return_to');

        if (returnTo && session) {
          // Redirecionar para o subdomínio original
          setStatus('Redirecionando...');
          window.location.href = returnTo;
        } else if (session) {
          // Fallback para dashboard local
          navigate('/client/dashboard');
        } else {
          // Sem sessão, volta pro login
          navigate('/login');
        }
      } catch (err) {
        console.error('[OAuthCallback] Unexpected error:', err);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">{status}</p>
    </div>
  );
}
```

---

### 4. Registrar Rota de Callback
**Arquivo:** `src/App.tsx`

Adicionar import e rota:

**Import (após linha 67):**
```typescript
import OAuthCallback from "./pages/auth/OAuthCallback";
```

**Rota (após linha 233):**
```typescript
<Route path="/oauth/callback" element={<OAuthCallback />} />
```

---

## Resumo das Alterações

| Arquivo | Ação | Linhas Afetadas |
|---------|------|-----------------|
| `src/utils/platformUrls.ts` | Adicionar 2 funções | +20 linhas no final |
| `src/hooks/useAuth.tsx` | Alterar `redirectTo` | Linha 76 |
| `src/pages/auth/OAuthCallback.tsx` | Criar novo | Arquivo novo (~50 linhas) |
| `src/App.tsx` | Adicionar import + rota | +2 linhas |

---

## Fluxo Resultante

```text
┌─────────────────────────────────────────────────────────────────┐
│  LOGIN EM SUBDOMÍNIO                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário acessa: trulynolen.app.omniseen.app/login           │
│                                                                 │
│  2. Clica em "Login com Google"                                 │
│     → OAuth inicia com return_to codificado                     │
│                                                                 │
│  3. Google redireciona para:                                    │
│     app.omniseen.app/oauth/callback?return_to=...               │
│                                                                 │
│  4. OAuthCallback.tsx:                                          │
│     → Aguarda sessão ser estabelecida                           │
│     → Lê return_to do query string                              │
│     → Redireciona: window.location.href = return_to             │
│                                                                 │
│  5. Usuário volta para:                                         │
│     trulynolen.app.omniseen.app/client/dashboard                │
│     → Sessão ativa via cookie .omniseen.app (Worker)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Requisitos de Infraestrutura (fora do código)

Para o fluxo funcionar completamente, o Cloudflare Worker deve:

1. **Injetar cookie com `Domain=.omniseen.app`** para compartilhar sessão entre subdomínios
2. **Reescrever `Location` headers** para manter o usuário no subdomínio correto
3. **Opcionalmente injetar `<meta name="x-tenant-slug">`** para resolução futura

O código preparado aqui suporta tanto o cenário atual (parsing de hostname) quanto o cenário futuro (meta tag do Worker).

---

## Validação

Após implementação, testar:

1. Login com email/senha em `trulynolen.app.omniseen.app`
2. Login com Google em subdomínio → deve voltar para o subdomínio
3. Navegação entre páginas após login → sessão deve persistir
4. Refresh da página → não deve ocorrer tela branca
