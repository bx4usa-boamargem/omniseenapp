

## Diagnóstico

O problema principal é que o backend está com **timeout (erro 544)** — todas as chamadas ao banco retornam "Connection terminated due to connection timeout". Isso afeta:

1. **`useAuth` → `getSession()`**: Fica pendurado para sempre, `loading` nunca vira `false`, e o formulário de login nunca aparece (fica em "Carregando..." infinito)
2. **`signInWithPassword`**: Falha com "Failed to fetch" quando o usuário tenta logar
3. **TenantContext**: Queries de memberships também falham

O timeout de 15s no Login.tsx existe mas o botão "Voltar ao login" não funciona porque `authLoading` continua `true`.

## Plano de Correção

### 1. Adicionar timeout no `useAuth` (`src/hooks/useAuth.tsx`)

Envolver `getSession()` com `Promise.race` contra um timeout de 10 segundos. Se der timeout, setar `loading = false` mesmo assim (com `user = null`), permitindo que o formulário de login renderize normalmente.

```typescript
// Em vez de:
supabase.auth.getSession().then(...)

// Fazer:
const sessionTimeout = new Promise(resolve => 
  setTimeout(() => resolve({ data: { session: null } }), 10000)
);
Promise.race([supabase.auth.getSession(), sessionTimeout])
  .then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  });
```

### 2. Corrigir o fallback "Voltar ao login" (`src/pages/auth/Login.tsx`)

Quando o timeout de loading acontece, o botão "Voltar ao login" precisa **forçar** o estado de loading para false, não apenas esconder o timeout. Alterar a lógica para que o clique em "Voltar ao login" também force `authLoading` a ser ignorado:

- Adicionar um estado local `skipAuthLoading` que quando `true`, faz o componente ignorar `authLoading` e renderizar o formulário diretamente
- Mudar a condição `if (authLoading)` para `if (authLoading && !skipAuthLoading)`

### 3. Aumentar tamanho da instância do backend

O erro 544 (connection timeout) indica que o backend está sobrecarregado. **Recomendação**: ir em **Cloud → Overview → Advanced settings** e selecionar uma instância maior para resolver os timeouts na raiz.

---

**Arquivos a editar:**
- `src/hooks/useAuth.tsx` — adicionar timeout de 10s no `getSession()`
- `src/pages/auth/Login.tsx` — adicionar `skipAuthLoading` para o fallback funcionar

