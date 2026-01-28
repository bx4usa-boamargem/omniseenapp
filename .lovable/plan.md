

# Plano: Refatoração Premium do Sidebar com Hubs Flutuantes

## Objetivo

Transformar o sidebar atual (muitos itens individuais) em um design **limpo e estratégico** com poucos botões principais que funcionam como **HUBS**, cada um abrindo um menu flutuante estilo card. Restaurar a logomarca oficial da OmniSeen.

---

## Comparativo: Antes vs Depois

| Aspecto | ANTES (Atual) | DEPOIS (Premium) |
|---------|--------------|------------------|
| Itens visíveis | 11 itens em 2 seções | **5 itens principais** |
| Navegação | Cada item é um link direto | Hubs abrem menus flutuantes |
| Logomarca | Letra "O" em círculo | **Logo OmniSeen oficial** |
| Organização | PRINCIPAL + CONFIGURAÇÕES | Dashboard, Conteúdo (HUB), Analytics, Conversões, Conta (HUB) |
| Experiência | Painel administrativo | **Plataforma de crescimento** |

---

## Estrutura Final do Sidebar

```text
┌─────────────────────────────────────────┐
│  [LOGO OMNISEEN]    OmniSeen            │  ← Clique → Dashboard
├─────────────────────────────────────────┤
│                                         │
│  🏠 Dashboard                           │  ← Navegação direta
│  📄 Conteúdo                      ▸     │  ← HUB (abre menu flutuante)
│  📊 Analytics                           │  ← Navegação direta
│  💬 Conversões                          │  ← Navegação direta
│                                         │
│  ─────────────────────────────────────  │  ← Separador
│                                         │
│  ⚙️ Conta & Sistema                ▸    │  ← HUB (abre menu flutuante)
│                                         │
├─────────────────────────────────────────┤
│  [Avatar] Truly Nolen               ▼   │  ← Seletor de workspace
└─────────────────────────────────────────┘
```

---

## Menu Flutuante: CONTEÚDO

Abre ao **hover ou click** em "Conteúdo":

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  📡 Radar de Oportunidades                               │
│     Descubra o que sua cidade procura                    │
│     → /client/radar                                      │
│                                                          │
│  ✨ Gerar Artigo                                         │
│     Crie conteúdo otimizado com IA                       │
│     → /client/articles/new                               │
│                                                          │
│  📄 Meus Artigos                                         │
│     Gerencie seus posts e rascunhos                      │
│     → /client/articles                                   │
│                                                          │
│  🌐 Blogs / Portais                                      │
│     Seus sites e mini-sites                              │
│     → /client/portal                                     │
│                                                          │
│  🧱 Páginas SEO                                          │
│     Crie páginas locais de conversão                     │
│     → /client/landing-pages                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Menu Flutuante: CONTA & SISTEMA

Abre ao **hover ou click** em "Conta & Sistema":

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  👤 Perfil                                               │
│     Dados pessoais e preferências                        │
│     → /client/account                                    │
│                                                          │
│  🏢 Empresa                                              │
│     Informações do negócio                               │
│     → /client/company                                    │
│                                                          │
│  🎯 Estratégia SEO                                       │
│     Palavras-chave e metas                               │
│     → /client/radar                                      │
│                                                          │
│  💳 Plano & Cobrança                                     │
│     Gerencie sua assinatura                              │
│     → /client/settings?tab=billing                       │
│                                                          │
│  🔌 Integrações                                          │
│     Conecte suas ferramentas                             │
│     → /client/settings?tab=integrations                  │
│                                                          │
│  🔔 Notificações                                         │
│     E-mails e alertas                                    │
│     → /client/settings?tab=notifications                 │
│                                                          │
│  ❓ Ajuda & Suporte                                      │
│     Central de ajuda                                     │
│     → /client/help                                       │
│                                                          │
│  🌗 Tema                         [Toggle claro/escuro]   │
│                                                          │
│  ─────────────────────────────────────                   │
│                                                          │
│  🚪 Sair                                   (vermelho)    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `SidebarHeader.tsx` | **MODIFICAR** | Usar `OmniseenLogo` oficial |
| `PremiumSidebar.tsx` | **MODIFICAR** | Reduzir para 5 itens principais com hubs |
| `HubMenuItem.tsx` | **CRIAR** | Novo componente para botão que abre menu flutuante |
| `ContentHubPanel.tsx` | **CRIAR** | Menu flutuante do hub "Conteúdo" |
| `AccountHubPanel.tsx` | **CRIAR** | Menu flutuante do hub "Conta & Sistema" |
| `NavItem.tsx` | **MODIFICAR** | Adicionar suporte a indicador "▸" para hubs |
| `MobileDrawer.tsx` | **MODIFICAR** | Adaptar estrutura para mobile |

---

## Detalhamento Técnico

### 1. SidebarHeader.tsx - Logo Oficial

```tsx
import { useNavigate } from 'react-router-dom';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';

export function SidebarHeader() {
  const navigate = useNavigate();

  return (
    <div className="h-20 flex items-center px-4 gap-3 border-b border-[#E5E7EB] dark:border-gray-700">
      <button
        onClick={() => navigate('/client/dashboard')}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        aria-label="Ir para Dashboard"
      >
        <OmniseenLogo size="sidebar" />
        <span className="text-lg font-semibold text-[#111827] dark:text-white">
          OmniSeen
        </span>
      </button>
    </div>
  );
}
```

### 2. HubMenuItem.tsx - Botão com Menu Flutuante

```tsx
interface HubMenuItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  children: React.ReactNode; // Menu flutuante
}

export function HubMenuItem({ id, icon: Icon, label, isActive, children }: HubMenuItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Botão Principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-lg mx-2',
          'transition-all duration-200',
          isActive && 'bg-[#EDE9FE] text-[#7C3AED] font-semibold',
          !isActive && 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'
        )}
      >
        {/* Faixa lateral ativa (roxo → laranja) */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-[#7C3AED] to-[#F97316] rounded-r-full" />
        )}
        
        <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-[#7C3AED]')} />
        <span className="flex-1 text-left text-sm font-medium">{label}</span>
        <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
      </button>

      {/* Menu Flutuante */}
      {isOpen && (
        <>
          {/* Overlay invisível para detectar saída */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Card flutuante */}
          <div className={cn(
            'absolute left-full top-0 ml-2 z-50',
            'w-80 bg-white dark:bg-gray-900 rounded-xl',
            'shadow-[0_10px_40px_rgba(0,0,0,0.15)]',
            'border border-[#E5E7EB] dark:border-gray-700',
            'animate-in slide-in-from-left-2 duration-200'
          )}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
```

### 3. ContentHubPanel.tsx - Menu Flutuante de Conteúdo

```tsx
const contentItems = [
  {
    id: 'radar',
    icon: Radar,
    iconBg: 'bg-blue-100 text-blue-600',
    title: 'Radar de Oportunidades',
    subtitle: 'Descubra o que sua cidade procura',
    path: '/client/radar',
  },
  {
    id: 'generate',
    icon: Sparkles,
    iconBg: 'bg-purple-100 text-purple-600',
    title: 'Gerar Artigo',
    subtitle: 'Crie conteúdo otimizado com IA',
    path: '/client/articles/new',
    highlight: true, // Destaque especial
  },
  {
    id: 'articles',
    icon: FileText,
    iconBg: 'bg-emerald-100 text-emerald-600',
    title: 'Meus Artigos',
    subtitle: 'Gerencie seus posts e rascunhos',
    path: '/client/articles',
  },
  {
    id: 'portal',
    icon: Globe,
    iconBg: 'bg-amber-100 text-amber-600',
    title: 'Blogs / Portais',
    subtitle: 'Seus sites e mini-sites',
    path: '/client/portal',
  },
  {
    id: 'landing-pages',
    icon: LayoutTemplate,
    iconBg: 'bg-rose-100 text-rose-600',
    title: 'Páginas SEO',
    subtitle: 'Crie páginas locais de conversão',
    path: '/client/landing-pages',
  },
];

export function ContentHubPanel({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="p-3 space-y-1">
      {contentItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.path)}
          className={cn(
            'w-full flex items-start gap-3 px-3 py-3 rounded-lg',
            'hover:bg-[#F9FAFB] dark:hover:bg-gray-800 transition-colors',
            item.highlight && 'ring-2 ring-purple-200 dark:ring-purple-800'
          )}
        >
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', item.iconBg)}>
            <item.icon className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-sm font-medium text-[#111827] dark:text-white">
              {item.title}
            </span>
            <p className="text-xs text-[#6B7280] mt-0.5">{item.subtitle}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
```

### 4. AccountHubPanel.tsx - Menu Flutuante de Conta

Similar ao `ContentHubPanel`, mas incluindo:
- Perfil, Empresa, Estratégia SEO
- Plano & Cobrança, Integrações, Notificações
- Ajuda & Suporte
- Toggle de Tema (dentro do painel)
- Separador + Botão Sair (vermelho)

### 5. PremiumSidebar.tsx - Estrutura Simplificada

```tsx
export function PremiumSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [contentHubOpen, setContentHubOpen] = useState(false);
  const [accountHubOpen, setAccountHubOpen] = useState(false);

  // Determinar item ativo (incluindo sub-rotas dos hubs)
  const getActiveHub = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/articles') || path.includes('/radar') || 
        path.includes('/portal') || path.includes('/landing-pages')) return 'content';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/leads')) return 'conversions';
    if (path.includes('/account') || path.includes('/company') || 
        path.includes('/settings') || path.includes('/help')) return 'account';
    return 'dashboard';
  };

  const activeHub = getActiveHub();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen z-40 w-[280px] flex-col bg-white dark:bg-gray-900 border-r border-[#E5E7EB]">
      
      {/* Header com Logo Oficial */}
      <SidebarHeader />

      {/* Navegação Principal */}
      <nav className="flex-1 py-4">
        {/* Dashboard - Link direto */}
        <NavItem 
          id="dashboard"
          icon={Home}
          label="Dashboard"
          isActive={activeHub === 'dashboard'}
          onClick={() => navigate('/client/dashboard')}
        />

        {/* Conteúdo - HUB */}
        <HubMenuItem
          id="content"
          icon={FileText}
          label="Conteúdo"
          isActive={activeHub === 'content'}
        >
          <ContentHubPanel onNavigate={navigate} />
        </HubMenuItem>

        {/* Analytics - Link direto */}
        <NavItem 
          id="analytics"
          icon={BarChart3}
          label="Analytics"
          isActive={activeHub === 'analytics'}
          onClick={() => navigate('/client/analytics')}
        />

        {/* Conversões - Link direto */}
        <NavItem 
          id="conversions"
          icon={MessageSquare}
          label="Conversões"
          isActive={activeHub === 'conversions'}
          onClick={() => navigate('/client/leads')}
        />

        {/* Separador */}
        <div className="mx-4 my-4 h-px bg-[#E5E7EB] dark:bg-gray-700" />

        {/* Conta & Sistema - HUB */}
        <HubMenuItem
          id="account"
          icon={Settings}
          label="Conta & Sistema"
          isActive={activeHub === 'account'}
        >
          <AccountHubPanel onNavigate={navigate} />
        </HubMenuItem>
      </nav>

      {/* Footer - Seletor de Workspace */}
      <SidebarFooter onMenuToggle={() => {}} />
    </aside>
  );
}
```

---

## Estilo Visual dos Menus Flutuantes

```css
/* Card flutuante premium */
.hub-panel {
  background: white;
  border-radius: 16px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.12),
    0 0 1px rgba(0, 0, 0, 0.1);
  border: 1px solid #E5E7EB;
}

/* Item do menu */
.hub-panel-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  transition: background 150ms;
}

.hub-panel-item:hover {
  background: #F9FAFB;
}

/* Ícone colorido */
.hub-panel-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Faixa lateral ativa (roxo → laranja) */
.active-indicator {
  position: absolute;
  left: 0;
  width: 4px;
  height: 32px;
  background: linear-gradient(to bottom, #7C3AED, #F97316);
  border-radius: 0 4px 4px 0;
}
```

---

## Comportamento

| Ação | Comportamento |
|------|---------------|
| **Hover em Dashboard/Analytics/Conversões** | Highlight suave (fundo cinza claro) |
| **Click em Dashboard/Analytics/Conversões** | Navega e marca como ativo |
| **Hover em Conteúdo/Conta** | Abre menu flutuante após 50ms |
| **Sair do Hover** | Fecha menu após 150ms (debounce) |
| **Click em item do menu flutuante** | Navega e fecha menu |
| **Click fora** | Fecha menu flutuante |
| **Item ativo** | Faixa lateral com gradiente roxo→laranja |

---

## Critérios de Aceite

### Visual
- [ ] Logo oficial OmniSeen no topo (não letra "O")
- [ ] Apenas 5 botões principais visíveis
- [ ] Indicador "▸" nos hubs que têm menu
- [ ] Faixa lateral roxo→laranja em item ativo
- [ ] Menus flutuantes com sombra e cantos arredondados

### Comportamento
- [ ] Hover em hub abre menu flutuante
- [ ] Click em hub também abre menu
- [ ] Menu fecha ao sair ou clicar fora
- [ ] Navegação funciona em todos os itens
- [ ] Toggle de tema funciona dentro do hub "Conta"

### Responsivo
- [ ] Mobile: drawer mantém mesma estrutura
- [ ] Mobile: hubs expandem inline (accordion)

---

## Impacto

| Aspecto | Impacto |
|---------|---------|
| **UX** | Sidebar 60% mais limpo, menos overwhelm visual |
| **Branding** | Logo oficial restaurada, identidade forte |
| **Navegação** | Power users encontram tudo nos hubs |
| **Percepção** | De "painel admin" para "plataforma de crescimento" |

