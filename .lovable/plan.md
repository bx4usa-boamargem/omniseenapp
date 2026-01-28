
# Correção: SubaccountRouteDecider com Rotas Próprias

## Resumo do Problema
O `SubaccountRouteDecider` delega paths `/client/*` para `PlatformRoutes`, que não funciona corretamente em subdomínios porque:
1. `PlatformRoutes` redireciona `/` para `/login`
2. O `SubAccountGuard` redireciona usuários não autenticados para `/login` (path relativo)
3. No subdomínio, `/login` não existe como rota válida

## Solução
Refatorar o `SubaccountRouteDecider` para:
1. **Paths públicos** (`/`, `/:slug`, `/p/:slug`) → `BlogRoutes` (sem auth)
2. **Paths `/client/*`** → `ClientRoutes` diretamente (com `SubAccountGuard`)
3. **Paths de auth** (`/login`, `/signup`) → Redirecionar para `app.omniseen.app` (plataforma principal)
4. **Paths de admin** (`/admin`) → Redirecionar para `app.omniseen.app/admin`

---

## Arquivo a Modificar

### `src/App.tsx` - SubaccountRouteDecider (linhas 333-348)

**Código Atual:**
```typescript
const SubaccountRouteDecider = () => {
  const location = useLocation();
  const pathname = location.pathname;
  
  const platformPaths = ['/login', '/signup', '/reset-password', '/client', '/app', '/admin', '/oauth', '/invite', '/blocked', '/access-denied'];
  const isPlatformPath = platformPaths.some(p => pathname.startsWith(p));
  
  if (isPlatformPath) {
    return <PlatformRoutes />;  // ❌ PROBLEMA
  }
  
  return <BlogRoutes />;
};
```

**Código Novo:**
```typescript
const SubaccountRouteDecider = () => {
  const pathname = window.location.pathname;
  
  console.log('[SubaccountRouteDecider] pathname:', pathname);
  
  // ROTAS PROTEGIDAS (/client/*) - renderiza ClientRoutes diretamente
  if (pathname.startsWith('/client')) {
    console.log('[SubaccountRouteDecider] → ClientRoutes');
    return <ClientRoutes />;
  }
  
  // ROTAS DE AUTH - redireciona para plataforma principal
  const authPaths = ['/login', '/signup', '/reset-password', '/blocked', '/access-denied'];
  if (authPaths.some(p => pathname.startsWith(p))) {
    const targetUrl = `https://app.omniseen.app${pathname}`;
    console.log('[SubaccountRouteDecider] → Redirect to platform:', targetUrl);
    window.location.href = targetUrl;
    return null;
  }
  
  // ROTAS DE OAUTH/INVITE - redireciona para plataforma principal
  if (pathname.startsWith('/oauth') || pathname.startsWith('/invite')) {
    const targetUrl = `https://app.omniseen.app${pathname}${window.location.search}`;
    console.log('[SubaccountRouteDecider] → Redirect to platform:', targetUrl);
    window.location.href = targetUrl;
    return null;
  }
  
  // ROTAS DE ADMIN - redireciona para plataforma principal
  if (pathname.startsWith('/admin') || pathname.startsWith('/app')) {
    window.location.href = `https://app.omniseen.app${pathname}`;
    return null;
  }
  
  // ROTAS PÚBLICAS (/, /:articleSlug, /p/:pageSlug) - BlogRoutes
  console.log('[SubaccountRouteDecider] → BlogRoutes (public)');
  return <BlogRoutes />;
};
```

---

## Lógica de Roteamento Final no Subdomínio

| Path | Destino | Autenticação |
|------|---------|--------------|
| `/` | BlogRoutes → CustomDomainBlog | Não |
| `/:articleSlug` | BlogRoutes → CustomDomainArticle | Não |
| `/p/:pageSlug` | BlogRoutes → CustomDomainLandingPage | Não |
| `/client/dashboard` | ClientRoutes → SubAccountGuard → Dashboard | Sim |
| `/client/articles` | ClientRoutes → SubAccountGuard → Articles | Sim |
| `/login` | Redirect → app.omniseen.app/login | - |
| `/signup` | Redirect → app.omniseen.app/signup | - |
| `/admin/*` | Redirect → app.omniseen.app/admin/* | - |

---

## Fluxo Correto Após Correção

```
Usuário acessa trulynolen.app.omniseen.app/
  ↓
isSubaccountHost() → true
  ↓
SubaccountRouteDecider
  ↓ pathname = "/"
  ↓ Não começa com /client, /login, /admin, etc.
BlogRoutes ✅
  ↓
usePublicDomainResolution() → content-api
  ↓
CustomDomainBlog renderiza artigos ✅
```

```
Usuário acessa trulynolen.app.omniseen.app/client/dashboard
  ↓
isSubaccountHost() → true
  ↓
SubaccountRouteDecider
  ↓ pathname.startsWith('/client') = true
ClientRoutes → SubAccountGuard
  ↓ Se não logado:
Navigate to /login
  ↓ SubaccountRouteDecider pega /login
Redirect → app.omniseen.app/login ✅
```

---

## Observação Importante

O `SubAccountGuard` redireciona para `/login` (path relativo). Com a nova lógica do `SubaccountRouteDecider`, quando o usuário não está autenticado:

1. `SubAccountGuard` → `Navigate to="/login"`
2. Browser vai para `trulynolen.app.omniseen.app/login`
3. `SubaccountRouteDecider` captura `/login`
4. Executa `window.location.href = 'https://app.omniseen.app/login'`
5. Usuário é redirecionado para a plataforma principal para fazer login

Este fluxo garante que:
- Subdomínios não precisam de telas de login próprias
- Autenticação é centralizada em `app.omniseen.app`
- Após login, o usuário pode voltar ao subdomínio

---

## Testes de Validação

| Cenário | URL | Resultado Esperado |
|---------|-----|-------------------|
| Blog público | `trulynolen.app.omniseen.app/` | Lista de artigos (sem login) |
| Artigo público | `trulynolen.app.omniseen.app/dedetizacao` | Artigo (sem login) |
| Super página | `trulynolen.app.omniseen.app/p/servicos` | Landing page (sem login) |
| Dashboard | `trulynolen.app.omniseen.app/client/dashboard` | Redireciona para app.omniseen.app/login se não logado |
| Login direto | `trulynolen.app.omniseen.app/login` | Redireciona para app.omniseen.app/login |
