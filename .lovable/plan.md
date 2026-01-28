
# Plano: Refatoração Definitiva do Sidebar – Arquitetura de Produto OmniSeen

## Diagnóstico do Estado Atual

### Estrutura Atual (Problemas Identificados)
1. **5 itens no corpo do sidebar** (Dashboard, Conteúdo, Analytics, Conversões, Conta & Sistema)
2. **Analytics como item separado** - NÃO deveria existir
3. **"Conta & Sistema" no corpo do sidebar** - deveria estar no rodapé
4. **SidebarFooter abre UserMenu separado** - duplicação de lógica
5. **Dois componentes de menu de conta** (UserMenu + AccountHubPanel) - redundante

### Estrutura Desejada
```
┌──────────────────────────────┐
│ 🟣 OmniSeen                  │  ← Logo no topo
├──────────────────────────────┤
│                              │
│ ▸ Dashboard                  │  → Navegação direta
│                              │
│ ▸ Conteúdo ✎                 │  ← HUB (hover/click abre painel)
│                              │
│ ▸ Conversões                 │  → Navegação direta
│                              │
│ ───────────────────────────  │
│                              │
│ [🟣 TN] Truly Nolen     ▼    │  ← HUB da conta (rodapé)
│        Plano Growth          │
└──────────────────────────────┘
```

**REMOVIDO do corpo:**
- ❌ Analytics
- ❌ Conta & Sistema

---

## Arquivos a Modificar/Criar/Remover

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `PremiumSidebar.tsx` | **MODIFICAR** | Remover Analytics + Remover HubMenuItem "Conta & Sistema" + Usar Pencil icon |
| `SidebarFooter.tsx` | **REESCREVER** | Transformar em AccountFooter que abre menu flutuante para CIMA |
| `AccountHubPanel.tsx` | **MODIFICAR** | Reorganizar: adicionar "Configurações", expandir "Integrações" com sub-itens |
| `ContentHubPanel.tsx` | **MANTER** | Já está correto |
| `HubMenuItem.tsx` | **MODIFICAR** | Suporte a ícone decorativo (Pencil) |
| `MobileDrawer.tsx` | **MODIFICAR** | Remover Analytics, adaptar estrutura simplificada |
| `UserMenu.tsx` | **REMOVER** | Substituído pelo novo AccountFooter |
| `index.ts` | **MODIFICAR** | Remover export do UserMenu |

---

## Detalhamento Técnico

### 1. PremiumSidebar.tsx – Estrutura Simplificada

**Mudanças:**
- Remover import de `BarChart3` (Analytics icon)
- Remover NavItem de Analytics (linhas 132-139)
- Remover HubMenuItem "Conta & Sistema" (linhas 153-165)
- Substituir `FileText` por `Pencil` para o hub Conteúdo
- Remover estado `menuOpen` e o componente `UserMenu`
- Modificar getActiveHub para remover 'analytics'

```tsx
// ANTES: 5 itens + HubMenuItem "Conta & Sistema"
// DEPOIS: 3 itens (Dashboard, Conteúdo HUB, Conversões)

import { Home, Pencil, MessageSquare } from 'lucide-react';

// Remover Analytics do getActiveHub
const getActiveHub = useCallback(() => {
  const path = location.pathname;
  if (path.includes('/dashboard')) return 'dashboard';
  if (path.includes('/articles') || path.includes('/radar') || 
      path.includes('/portal') || path.includes('/landing-pages')) return 'content';
  if (path.includes('/leads')) return 'conversions';
  // Rotas de conta agora são tratadas no footer
  return 'dashboard';
}, [location.pathname]);

// Na nav:
<nav className="flex-1 py-4 overflow-y-auto">
  <NavItem id="dashboard" icon={Home} label="Dashboard" ... />
  
  <HubMenuItem id="content" icon={Pencil} label="Conteúdo" ... >
    <ContentHubPanel ... />
  </HubMenuItem>
  
  <NavItem id="conversions" icon={MessageSquare} label="Conversões" ... />
  
  {/* REMOVIDO: Analytics */}
  {/* REMOVIDO: Separador + Conta & Sistema */}
</nav>

{/* Separador antes do footer */}
<div className="mx-4 h-px bg-[#E5E7EB] dark:bg-gray-700" />

{/* Footer - Agora é um HUB completo */}
<AccountFooter 
  onNavigate={handleNavigate}
  onLogout={handleLogout}
  currentPath={location.pathname}
/>

{/* REMOVIDO: UserMenu e menuOpen state */}
```

### 2. SidebarFooter.tsx → AccountFooter (Reescrita Completa)

Transformar o footer em um HUB que abre menu flutuante **para CIMA**:

```tsx
import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';
import { cn } from '@/lib/utils';
import { AccountHubPanel } from './AccountHubPanel';

interface AccountFooterProps {
  onNavigate: (path: string) => void;
  onLogout: () => void;
  currentPath?: string;
}

export function AccountFooter({ onNavigate, onLogout, currentPath }: AccountFooterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { blog } = useBlog();

  const displayName = blog?.name || user?.email?.split('@')[0] || 'Workspace';
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleNavigateAndClose = (path: string) => {
    onNavigate(path);
    setIsOpen(false);
  };

  const handleLogoutAndClose = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <div className="relative border-t border-[#E5E7EB] dark:border-gray-700 p-4">
      {/* Botão do Workspace */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
          'hover:bg-[#F9FAFB] dark:hover:bg-gray-800',
          isOpen && 'bg-[#F9FAFB] dark:bg-gray-800'
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {/* Avatar gradient */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#7C3AED] flex items-center justify-center shrink-0">
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-[#111827] dark:text-white truncate">
            {displayName}
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-xs text-[#6B7280]">Plano Growth</span>
          </div>
        </div>

        {/* Chevron - rota para cima quando aberto */}
        <ChevronUp className={cn(
          'h-4 w-4 text-[#9CA3AF] transition-transform duration-200',
          !isOpen && 'rotate-180'
        )} />
      </button>

      {/* Menu Flutuante - Abre para CIMA */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Card flutuante - posicionado ACIMA do botão */}
          <div 
            className={cn(
              'absolute bottom-full left-0 right-0 mb-2 z-50',
              'bg-white dark:bg-gray-900 rounded-xl',
              'shadow-[0_-10px_40px_rgba(0,0,0,0.15)]',
              'border border-[#E5E7EB] dark:border-gray-700',
              'animate-in slide-in-from-bottom-2 duration-200',
              'max-h-[70vh] overflow-y-auto'
            )}
            role="menu"
            aria-label="Menu da conta"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 px-4 py-3 border-b border-[#E5E7EB] dark:border-gray-700">
              <h3 className="text-sm font-semibold text-[#111827] dark:text-white">
                Minha Conta
              </h3>
            </div>
            
            <AccountHubPanel 
              onNavigate={handleNavigateAndClose}
              onLogout={handleLogoutAndClose}
              currentPath={currentPath}
            />
          </div>
        </>
      )}
    </div>
  );
}
```

### 3. AccountHubPanel.tsx – Reorganização com "Configurações" e Integrações Expandidas

```tsx
const accountItems = [
  {
    id: 'profile',
    icon: User,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    title: 'Perfil',
    subtitle: 'Dados pessoais',
    path: '/client/account',
  },
  {
    id: 'company',
    icon: Building2,
    iconBg: 'bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400',
    title: 'Empresa',
    subtitle: 'Informações do negócio',
    path: '/client/company',
  },
  {
    id: 'strategy',
    icon: Target,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    title: 'Estratégia SEO',
    subtitle: 'Palavras-chave e posicionamento',
    path: '/client/radar',
  },
];

const settingsItems = [
  {
    id: 'settings',
    icon: Settings, // NOVO
    iconBg: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    title: 'Configurações',
    subtitle: 'Preferências do sistema',
    path: '/client/settings',
  },
  {
    id: 'billing',
    icon: CreditCard,
    iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    title: 'Plano & Cobrança',
    subtitle: 'Assinatura e pagamentos',
    path: '/client/settings?tab=billing',
  },
  {
    id: 'notifications',
    icon: Bell,
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    title: 'Notificações',
    subtitle: 'E-mails e alertas',
    path: '/client/settings?tab=notifications',
  },
  {
    id: 'help',
    icon: HelpCircle,
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    title: 'Ajuda & Suporte',
    subtitle: 'Central de ajuda',
    path: '/client/help',
  },
];

// Integrações com sub-itens
const integrationItems = [
  { id: 'wordpress', title: 'WordPress', path: '/client/integrations/wordpress', available: true },
  { id: 'wix', title: 'Wix', path: '/client/integrations/wix', available: true },
  { id: 'gmail', title: 'Gmail', path: '/client/integrations/gmail', available: false, badge: 'Em breve' },
  { id: 'calendar', title: 'Google Calendar', path: '/client/integrations/calendar', available: false, badge: 'Em breve' },
];
```

### 4. HubMenuItem.tsx – Adicionar Suporte a Ícone Decorativo

```tsx
interface HubMenuItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  children: ReactNode;
  decoratorIcon?: LucideIcon; // NOVO: ícone decorativo (ex: Pencil)
}

// No render, após o label:
<span className="flex-1 text-left text-sm font-medium">
  {label}
</span>

{/* Ícone decorativo opcional (ex: lápis) */}
{decoratorIcon && (
  <decoratorIcon className="h-3.5 w-3.5 text-[#9CA3AF] mr-1" />
)}

<ChevronRight className={cn(...)} />
```

Ou simplesmente usar o ícone `Pencil` como ícone principal do HubMenuItem "Conteúdo".

### 5. MobileDrawer.tsx – Estrutura Simplificada

**Mudanças:**
- Remover import de `BarChart3`
- Remover NavButton de Analytics (linhas 162-168)
- Renomear "Conta & Sistema" para "Minha Conta"
- Usar `Pencil` para Conteúdo

```tsx
import { X, Menu, Home, Pencil, MessageSquare, User } from 'lucide-react';

// Na navegação:
<NavButton icon={Home} label="Dashboard" ... />

<NavButton icon={Pencil} label="Conteúdo" isHub ... />
{contentExpanded && <ContentHubPanel ... />}

<NavButton icon={MessageSquare} label="Conversões" ... />

{/* REMOVIDO: Analytics */}

<div className="separator" />

{/* Conta - Accordion (não mais "Conta & Sistema") */}
<NavButton icon={User} label="Minha Conta" isHub ... />
{accountExpanded && <AccountHubPanel ... />}
```

### 6. index.ts – Remover UserMenu

```tsx
// REMOVER esta linha:
export { UserMenu } from './UserMenu';

// Adicionar (se renomear):
export { AccountFooter } from './AccountFooter';
```

### 7. UserMenu.tsx – DELETAR

Este arquivo será removido pois sua funcionalidade foi absorvida pelo novo `AccountFooter`.

---

## Comportamento Final

| Elemento | Hover | Click |
|----------|-------|-------|
| **Dashboard** | Highlight suave | Navega para `/client/dashboard` |
| **Conteúdo ✎** | Abre menu flutuante | Abre menu flutuante |
| **Conversões** | Highlight suave | Navega para `/client/leads` |
| **Truly Nolen ▼** | Highlight suave | Abre menu flutuante para CIMA |
| **Itens dentro dos menus** | Highlight | Navega e fecha menu |

### Regras de Interação (Obrigatório)

```tsx
// CORRETO - Hover apenas para UI
<div
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>

// CORRETO - Click navega
<button onClick={() => navigate('/rota')}>

// PROIBIDO
onClick={(e) => { e.preventDefault(); ... }}  // ❌
onClick={(e) => { e.stopPropagation(); ... }} // ❌
```

---

## Critérios de Aceite

### Visual
- [ ] Apenas 3 itens no corpo do sidebar (Dashboard, Conteúdo, Conversões)
- [ ] ❌ Analytics NÃO aparece mais
- [ ] ❌ "Conta & Sistema" NÃO aparece no corpo do menu
- [ ] Botão do workspace no rodapé com avatar + nome + chevron
- [ ] Menu da conta abre para CIMA (não para o lado)
- [ ] Ícone ✎ (lápis) ao lado de "Conteúdo"

### Menu Conteúdo
- [ ] Radar de Oportunidades
- [ ] Gerar Artigo (com badge IA)
- [ ] Meus Artigos
- [ ] Blog / Portal Público
- [ ] Páginas SEO

### Menu Conta (rodapé)
- [ ] Perfil, Empresa, Estratégia SEO
- [ ] Configurações
- [ ] Plano & Cobrança
- [ ] Integrações (com sub-itens: WordPress, Wix, Gmail, Calendar)
- [ ] Notificações
- [ ] Ajuda & Suporte
- [ ] Toggle de Tema
- [ ] Sair (vermelho)

### Comportamento
- [ ] Hover em hub abre menu flutuante
- [ ] Click em item do menu navega E fecha menu
- [ ] Menu fecha ao clicar fora
- [ ] Toggle de tema funciona
- [ ] Logout funciona

### Mobile
- [ ] Estrutura simplificada no drawer
- [ ] Analytics removido
- [ ] Conta expande como accordion

---

## Ordem de Implementação

1. **PASSO 1:** Reescrever `SidebarFooter.tsx` → `AccountFooter.tsx`
2. **PASSO 2:** Modificar `AccountHubPanel.tsx` (adicionar Configurações, expandir Integrações)
3. **PASSO 3:** Modificar `PremiumSidebar.tsx` (remover Analytics, remover HubMenuItem Conta, usar Pencil)
4. **PASSO 4:** Modificar `MobileDrawer.tsx` (remover Analytics, adaptar)
5. **PASSO 5:** Modificar `index.ts` (remover UserMenu, adicionar AccountFooter)
6. **PASSO 6:** Deletar `UserMenu.tsx`
7. **PASSO 7:** Testar todos os fluxos

---

## Resultado Visual Final

```
┌──────────────────────────────┐
│ 🟣 OmniSeen                  │
├──────────────────────────────┤
│                              │
│ ▸ Dashboard                  │  
│                              │
│ ▸ Conteúdo ✎                 │  ← hover abre painel flutuante
│                              │
│ ▸ Conversões                 │
│                              │
│ ───────────────────────────  │
│                              │
│ [🟣 TN] Truly Nolen     ▼    │  ← click abre painel para CIMA
│        Plano Growth          │
└──────────────────────────────┘
```

**3 itens no corpo + 1 botão de conta no rodapé = LIMPO**

---

## Impacto

| Antes | Depois |
|-------|--------|
| 5 itens + HubMenuItem "Conta" | **3 itens + AccountFooter** |
| Analytics separado | **Removido** |
| Menus duplicados (UserMenu + AccountHubPanel) | **Um só lugar para conta** |
| Painel administrativo | **Plataforma de crescimento** |
