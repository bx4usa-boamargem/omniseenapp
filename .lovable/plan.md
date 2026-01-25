
# Correção Estrutural: Roteamento Público de Subdomínios

## CAUSA RAIZ CONFIRMADA

O `ErrorBoundary` global em `src/App.tsx` (linha 324) executa `window.location.href = '/login'` incondicionalmente quando qualquer erro ocorre, mesmo em subdomínios públicos (`*.app.omniseen.app`) que deveriam ser 100% públicos.

## EVIDÊNCIA OBJETIVA

```typescript
// src/App.tsx - Linha 324 (PROBLEMA)
onReset={() => window.location.href = '/login'}
```

Este código força redirecionamento para `/login` mesmo quando:
- Host é `trulynolen.app.omniseen.app` (blog público)
- Qualquer erro transitório ocorre (ex: falha de rede temporária)
- A RPC `resolve_domain` demora ou falha

## LOCAL EXATO

| Arquivo | Linha | Código |
|---------|-------|--------|
| `src/App.tsx` | 324 | `onReset={() => window.location.href = '/login'}` |

## PATCH A APLICAR

**Substituir linhas 320-348 de `src/App.tsx`:**

```typescript
/**
 * Handler de reset do ErrorBoundary
 * REGRA: Subdomínios públicos NUNCA redirecionam para /login
 * - *.app.omniseen.app (blogs públicos) → reload
 * - Domínios customizados → reload
 * - app.omniseen.app (plataforma) → /login
 */
const handleErrorReset = () => {
  // Hosts públicos: apenas recarregar, NUNCA redirecionar para login
  if (isSubaccountHost() || isCustomDomainHost()) {
    console.log('[ErrorBoundary] Public host detected, reloading instead of redirecting to login');
    window.location.reload();
    return;
  }
  // Plataforma principal: redirecionar para login
  window.location.href = '/login';
};

// Main App - with global ErrorBoundary for crash protection
const App = () => (
  <ErrorBoundary 
    FallbackComponent={GlobalErrorFallback}
    onReset={handleErrorReset}
    onError={(error) => console.error('[App] Global error caught:', error)}
  >
    <QueryClientProvider client={queryClient}>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <TenantProvider>
            <TooltipProvider>
              {/* UNIFICADO: Usando apenas Sonner para evitar conflitos de DOM */}
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </TenantProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
```

## FLUXO APÓS CORREÇÃO

```text
┌─────────────────────────────────────────────────────────────┐
│ ANTES (PROBLEMA)                                            │
├─────────────────────────────────────────────────────────────┤
│ trulynolen.app.omniseen.app/                                │
│ ↓                                                           │
│ BlogRoutes → useDomainResolution → (qualquer erro)          │
│ ↓                                                           │
│ ErrorBoundary.onReset → window.location.href = '/login'     │
│ ↓                                                           │
│ REDIRECT PARA /login ❌                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DEPOIS (CORREÇÃO)                                           │
├─────────────────────────────────────────────────────────────┤
│ trulynolen.app.omniseen.app/                                │
│ ↓                                                           │
│ BlogRoutes → useDomainResolution → (qualquer erro)          │
│ ↓                                                           │
│ ErrorBoundary.onReset → isSubaccountHost() = true           │
│ ↓                                                           │
│ window.location.reload() → RECARREGA PÁGINA ✅               │
│ ↓                                                           │
│ BlogRoutes exibe "Blog não encontrado" (se persistir)       │
└─────────────────────────────────────────────────────────────┘
```

## VALIDAÇÃO PÓS-CORREÇÃO

### Teste 1: Home do blog público
1. Abrir aba anônima (Ctrl+Shift+N)
2. Acessar: `https://trulynolen.app.omniseen.app`
3. **Resultado esperado:** Home do blog carrega SEM redirecionamento para login

### Teste 2: Artigo do blog público
1. Abrir aba anônima (Ctrl+Shift+N)
2. Acessar: `https://trulynolen.app.omniseen.app/qualquer-artigo`
3. **Resultado esperado:** Artigo carrega ou mostra "Blog não encontrado" (NUNCA /login)

### Teste 3: Plataforma principal (não afetada)
1. Acessar: `https://app.omniseen.app`
2. **Resultado esperado:** Redireciona para `/login` normalmente

## ESCOPO DA MUDANÇA

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar handler `handleErrorReset` com verificação de host público |

**Nenhuma migration SQL. Nenhuma alteração de banco. Apenas correção de lógica frontend.**
