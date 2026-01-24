
# Plano: Estabilização do Fluxo de Autenticação

## Objetivo
Eliminar o erro `removeChild` e condições de corrida de renderização tornando o fluxo de autenticação **linear, determinístico e único**.

## Diagnóstico

### Pontos de Corrida Identificados

| Arquivo | Linha | Problema |
|---------|-------|----------|
| `Login.tsx` | 107-114 | Auto-redirect durante mount via `useEffect` |
| `Login.tsx` | 161 | Navigate após login por email/senha |
| `OAuthCallback.tsx` | 29, 59, 62, 66 | Múltiplos caminhos de navigate |
| `AutoProvisionTenant.tsx` | 30, 66 | Navigate durante provisioning |

### Causa Raiz
Quando o usuário faz login:
1. `Login.tsx` executa `navigate('/app')` após sucesso
2. Simultaneamente, `onAuthStateChange` atualiza o estado `user`
3. O `useEffect` da linha 107 detecta `user` e tenta `navigate()` novamente
4. React tenta desmontar nós DOM que já estão sendo substituídos

---

## Alterações Planejadas

### 1. Login.tsx - Remover Auto-Redirect no Mount

**Problema**: Linhas 107-114 redirecionam automaticamente durante o mount.

**Solução**: Remover completamente esse useEffect. O redirect só deve acontecer:
- Após clique em "Entrar" (handleSubmit)
- Após OAuth callback

**Implementação**:
```typescript
// REMOVER COMPLETAMENTE este useEffect (linhas 107-114):
// useEffect(() => {
//   if (user && !authLoading) {
//     const from = ...
//     navigate(from, { replace: true });
//   }
// }, [user, authLoading, navigate, location]);
```

### 2. Login.tsx - Criar Guard de Redirect Único

**Adicionar** no início de `LoginContent`:
```typescript
// Guard contra múltiplos redirects
const hasRedirectedRef = useRef(false);

const safeRedirect = (path: string) => {
  if (hasRedirectedRef.current) {
    console.log('[Login] Redirect already in progress, skipping');
    return;
  }
  hasRedirectedRef.current = true;
  console.log('[Login] Safe redirect to:', path);
  navigate(path, { replace: true });
};
```

### 3. Login.tsx - Usar safeRedirect no handleSubmit

**Alterar** linha 161:
```typescript
// Antes:
navigate('/app', { replace: true });

// Depois:
safeRedirect('/app');
```

### 4. OAuthCallback.tsx - Implementar Guard e Fluxo Linear

**Reescrever** com guard de redirect e fluxo determinístico:

```typescript
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Finalizando login...');
  const hasRedirectedRef = useRef(false);

  const safeRedirect = (path: string, isExternal = false) => {
    if (hasRedirectedRef.current) {
      console.log('[OAuthCallback] Redirect already in progress, skipping');
      return;
    }
    hasRedirectedRef.current = true;
    console.log('[OAuthCallback] Safe redirect to:', path);
    
    if (isExternal) {
      window.location.href = path;
    } else {
      navigate(path, { replace: true });
    }
  };

  useEffect(() => {
    // Prevent multiple executions
    if (hasRedirectedRef.current) return;
    
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[OAuthCallback] Session error:', error);
          setStatus('Erro ao finalizar login');
          setTimeout(() => safeRedirect('/login'), 2000);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('return_to');

        if (returnTo && session) {
          try {
            const returnUrl = new URL(returnTo);
            const isValidDomain = 
              returnUrl.hostname.endsWith('.omniseen.app') ||
              returnUrl.hostname === 'omniseen.app' ||
              returnUrl.hostname === 'localhost' ||
              returnUrl.hostname.includes('lovable.app');
            
            if (isValidDomain) {
              setStatus('Redirecionando...');
              safeRedirect(returnTo, true);
              return;
            }
          } catch {
            // URL inválida, ignora
          }
        }
        
        if (session) {
          safeRedirect('/client/dashboard');
        } else {
          safeRedirect('/login');
        }
      } catch (err) {
        console.error('[OAuthCallback] Unexpected error:', err);
        safeRedirect('/login');
      }
    };

    handleCallback();
  }, []); // Dependências removidas para executar apenas uma vez

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">{status}</p>
    </div>
  );
}
```

### 5. AutoProvisionTenant.tsx - Blindar Navigate

**Adicionar** guard no componente:

```typescript
// Adicionar ref no início do componente:
const hasRedirectedRef = useRef(false);

// Criar helper:
const safeRedirect = (path: string) => {
  if (hasRedirectedRef.current) return;
  hasRedirectedRef.current = true;
  navigate(path, { replace: true });
};

// Substituir navigate() por safeRedirect() nas linhas 30, 66, 99
```

---

## Resumo das Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `Login.tsx` | Editar | Remover useEffect auto-redirect (linhas 107-114), adicionar `safeRedirect` |
| `OAuthCallback.tsx` | Editar | Reescrever com guard de redirect único |
| `AutoProvisionTenant.tsx` | Editar | Adicionar `safeRedirect` guard |

---

## Fluxo Final (Linear e Determinístico)

```text
┌─────────────────────────────────────────────────────────────────┐
│  FLUXO DE LOGIN (ÚNICO CAMINHO)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CENÁRIO A: Email/Senha                                         │
│  ─────────────────────────                                      │
│  1. Usuário clica "Entrar"                                      │
│  2. handleSubmit() executa login                                │
│  3. Aguarda confirmação de sessão                               │
│  4. Chama safeRedirect('/app') - ÚNICO PONTO                    │
│  5. TenantGuard/AutoProvision assumem                           │
│                                                                 │
│  CENÁRIO B: Google OAuth                                        │
│  ─────────────────────────                                      │
│  1. Usuário clica "Login com Google"                            │
│  2. Redirect para Google → Callback → OAuthCallback.tsx         │
│  3. OAuthCallback aguarda sessão                                │
│  4. Chama safeRedirect() - ÚNICO PONTO                          │
│  5. TenantGuard/AutoProvision assumem                           │
│                                                                 │
│  ⛔ NUNCA: useEffect no mount tentando redirect                 │
│  ⛔ NUNCA: Múltiplos navigate() simultâneos                     │
│  ⛔ NUNCA: Race condition entre auth state e navigation         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Validação

Após implementação:
1. ✅ Login com email/senha → Redirect único para /app
2. ✅ Login com Google → OAuthCallback → Redirect único
3. ✅ Refresh na página de login → Não redireciona automaticamente
4. ✅ Nenhum erro `removeChild` no console
5. ✅ Nenhuma tela branca durante transições

---

## Observações Técnicas

- O `useRef` garante persistência do flag entre re-renders sem causar novos renders
- Remover dependências do useEffect do OAuthCallback evita re-execução
- O padrão `safeRedirect` é defensivo e logga tentativas duplicadas para debug
