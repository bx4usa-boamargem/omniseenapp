
# Plano: Ajustes no Dashboard - Mover "Seu Plano" e Corrigir Navegação dos Documentos

## Problemas Identificados

### 1. Card "Seu Plano" no Dashboard
O card `PlanStatusCard` aparece no dashboard, mas essa informação pertence às **Configurações de Conta**, não ao dashboard principal.

**Status atual:**
- Dashboard mostra: Boas-vindas, Status, Prova de Valor, Ferramentas, Documentos Recentes, **Seu Plano** ← ERRADO

**Status esperado:**
- Dashboard mostra: Boas-vindas, Status, Prova de Valor, Ferramentas, Documentos Recentes
- "Seu Plano" fica apenas em `/client/settings?tab=billing`

### 2. Navegação dos "Últimos Documentos"
Atualmente, clicar em um documento leva para o **editor individual**:
- Artigo → `/client/articles/{id}` (editor)
- Super Página → `/client/landing-pages/{id}` (editor)

O usuário quer que navegue para a **lista em cards**:
- Artigo → `/client/articles` (lista de artigos)
- Super Página → `/client/landing-pages` (lista de super páginas)

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `ClientDashboardMvp.tsx` | **MODIFICAR** | Remover o componente `PlanStatusCard` |
| `RecentDocuments.tsx` | **MODIFICAR** | Mudar navegação para listas ao invés de editores |
| `useRecentDocuments.ts` | **MODIFICAR** | Ajustar o campo `path` para apontar para as listas |

---

## Detalhamento Técnico

### 1. ClientDashboardMvp.tsx - Remover "Seu Plano"

**Mudanças:**
- Remover import do `PlanStatusCard`
- Remover a renderização do componente (linha 57)

```tsx
// ANTES (linha 10):
import { PlanStatusCard } from "@/components/dashboard/PlanStatusCard";

// DEPOIS:
// Remover esta linha

// ANTES (linha 57):
<PlanStatusCard />

// DEPOIS:
// Remover esta linha
```

**Resultado:** Dashboard termina em "Últimos Documentos", sem o card de plano.

### 2. useRecentDocuments.ts - Corrigir Paths

O hook já define o `path` para cada documento. Precisamos mudar para apontar para as listas:

```tsx
// ANTES (linha 70-71):
path: `/client/articles/${article.id}`,

// DEPOIS:
path: `/client/articles`,

// ANTES (linha 92):
path: `/client/landing-pages/${lp.id}`,

// DEPOIS:
path: `/client/landing-pages`,
```

### 3. RecentDocuments.tsx - Garantir Navegação Correta

O componente já usa `navigate(doc.path)`, então a mudança no hook automaticamente corrige a navegação.

**Opcional:** Adicionar feedback visual de que é clicável (cursor pointer, hover state):

```tsx
// Já existente na linha 82:
className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors text-left"

// Pode adicionar "cursor-pointer" para reforçar:
className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors text-left cursor-pointer"
```

---

## Comportamento Após Correção

### Dashboard Simplificado
```
┌─────────────────────────────────────────┐
│  Bem-vindo, João! 👋                    │
│  truenolen.omniseen.com                 │
├─────────────────────────────────────────┤
│  [Cards de Status]                      │
├─────────────────────────────────────────┤
│  [Prova de Valor - 7 dias]             │
├─────────────────────────────────────────┤
│  [Grid de Ferramentas]                  │
├─────────────────────────────────────────┤
│  Últimos Documentos                     │
│  • Super Página → click → /client/landing-pages
│  • Artigo → click → /client/articles    │
└─────────────────────────────────────────┘

❌ NÃO TEM MAIS: Card "Seu Plano"
```

### Navegação dos Documentos
| Tipo | Click | Destino |
|------|-------|---------|
| Super Página | Click | `/client/landing-pages` (lista em cards) |
| Artigo | Click | `/client/articles` (lista em cards) |

---

## Onde "Seu Plano" Continua Existindo

O card de plano permanece acessível em:

1. **Configurações > Cobrança** (`/client/settings?tab=billing`)
   - Componente: `BillingTab.tsx`
   - Mostra: plano atual, status, opções de upgrade, cancelamento

2. **Minha Conta** (`/client/account`)
   - Componente: `ClientAccount.tsx`
   - Mostra: card simples com nome do plano e status

3. **Menu da Conta (AccountHubPanel)**
   - Link: "Plano & Cobrança" → `/client/settings?tab=billing`

---

## Ordem de Implementação

1. **PASSO 1:** Modificar `ClientDashboardMvp.tsx` - remover `PlanStatusCard`
2. **PASSO 2:** Modificar `useRecentDocuments.ts` - mudar paths para listas
3. **PASSO 3:** Modificar `RecentDocuments.tsx` - adicionar `cursor-pointer` (opcional)
4. **PASSO 4:** Testar navegação no dashboard

---

## Critérios de Aceite

### Dashboard
- [ ] Card "Seu Plano" NÃO aparece mais no dashboard
- [ ] Dashboard termina em "Últimos Documentos"

### Navegação de Documentos
- [ ] Click em "Artigo" → navega para `/client/articles` (lista)
- [ ] Click em "Super Página" → navega para `/client/landing-pages` (lista)
- [ ] Hover mostra que é clicável

### Plano Acessível
- [ ] Plano acessível via menu "Conta" → "Plano & Cobrança"
- [ ] Plano acessível em `/client/settings?tab=billing`
