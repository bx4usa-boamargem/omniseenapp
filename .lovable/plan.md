
# Plano: Sidebar Minimalista Premium com Painéis Flutuantes Hover

## Visão Geral

Transformar o sidebar atual em uma barra de comando premium no estilo SEOwriting.ai, onde cada ícone abre um painel flutuante ao passar o mouse (hover), sem exigir cliques.

---

## Análise da Referência (SEOwriting.ai)

Com base nas imagens fornecidas:

| Característica | SEOwriting.ai | Omniseen Atual |
|----------------|---------------|----------------|
| Sidebar | Ícones minimalistas | Ícones minimalistas |
| Abertura de menu | Hover | Click (tooltip) |
| Painéis flutuantes | Fora do sidebar, à direita | Não existe |
| Ícone de criação | Caneta/Lápis | Martelo |
| Conteúdo dos painéis | Ícone colorido + título + subtítulo | Apenas tooltip |

---

## Arquitetura Proposta

### Novo Componente: `SidebarHoverPanel.tsx`

Componente reutilizável para painéis flutuantes com:
- Ícone colorido (customizável)
- Título
- Subtítulo
- Hover elegante

```text
┌─────────────────────────────────────────────────────────┐
│ [Sidebar]    │ [Painel Flutuante]                       │
│              │                                          │
│   🖊️ ────────>  ┌────────────────────────────────┐      │
│              │  │ 📄 Postagem de Blog            │      │
│              │  │    Gere artigos com um clique  │      │
│              │  │ 📚 Geração em Massa            │      │
│              │  │    Até 100 artigos             │      │
│              │  │ 🚀 Super Página                │      │
│              │  │    Landing pages SERP          │      │
│              │  │ ✨ Ferramenta de Reescrita     │      │
│              │  │    Transforme textos           │      │
│              │  └────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

## Modificações Necessárias

### 1. Criar `src/components/layout/SidebarHoverPanel.tsx`

Componente para cada item do painel flutuante:

```typescript
interface PanelItem {
  id: string;
  icon: React.ElementType;
  iconColor: string;        // Cor do fundo do ícone
  iconTextColor: string;    // Cor do ícone
  title: string;
  subtitle: string;
  path: string;
  badge?: string;           // Ex: "Novo!"
  comingSoon?: boolean;
}

interface SidebarHoverPanelProps {
  items: PanelItem[];
  onNavigate: (path: string) => void;
}
```

Estilo do painel:
- Fundo branco (`bg-white dark:bg-gray-900`)
- Bordas arredondadas (`rounded-xl`)
- Sombra suave (`shadow-xl`)
- Largura fixa (`w-72`)
- Padding interno (`p-3`)
- Animação de entrada (`animate-in fade-in-0 slide-in-from-left-2`)

### 2. Criar `src/components/layout/SidebarNavItem.tsx`

Componente para cada ícone do sidebar com hover panel:

```typescript
interface SidebarNavItemProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  disabled?: boolean;
  panel?: ReactNode;        // Painel flutuante a exibir
  onClick?: () => void;
}
```

Comportamento:
- `onMouseEnter` → Mostrar painel
- `onMouseLeave` → Ocultar painel (com delay de 100ms)
- Painel posicionado à direita do sidebar (`left-full ml-2`)

### 3. Atualizar `src/components/layout/MinimalSidebar.tsx`

**Mudanças principais:**

| Antes | Depois |
|-------|--------|
| Ícone `Hammer` | Ícone `PenTool` (ou `Edit3`) |
| Tooltip simples | `HoverCard` com painel de ferramentas |
| Click para navegar | Hover para expandir, click no item |

**Nova estrutura de navegação:**

```typescript
// Ícone de Criação (PenTool) - Hover Panel com:
const creationTools = [
  {
    id: 'one-click',
    icon: FileText,
    iconColor: 'bg-amber-100',
    iconTextColor: 'text-amber-600',
    title: 'Postagem de Blog com um clique',
    subtitle: 'Crie e publique um artigo usando apenas um título.',
    path: '/client/create',
  },
  {
    id: 'bulk',
    icon: Layers,
    iconColor: 'bg-orange-100',
    iconTextColor: 'text-orange-600',
    title: 'Geração de artigos em massa',
    subtitle: 'Gere e publique até 100 artigos automaticamente.',
    path: '/client/bulk-create',
    comingSoon: true,
  },
  {
    id: 'super-page',
    icon: LayoutTemplate,
    iconColor: 'bg-green-100',
    iconTextColor: 'text-green-600',
    title: 'Super Página',
    subtitle: 'Crie páginas CTA completas com base na SERP.',
    path: '/client/landing-pages/new',
  },
  {
    id: 'rewrite',
    icon: Sparkles,
    iconColor: 'bg-purple-100',
    iconTextColor: 'text-purple-600',
    title: 'Ferramenta de reescrita',
    subtitle: 'Reescreva com insights da SERP para ranquear.',
    path: '/client/rewrite',
    badge: 'Novo!',
    comingSoon: true,
  },
];

// Ícone de Documentos (FileText) - Hover Panel com:
const documentItems = [
  {
    id: 'articles',
    icon: FileText,
    iconColor: 'bg-blue-100',
    iconTextColor: 'text-blue-600',
    title: 'Meus Artigos',
    subtitle: 'Visualize e gerencie todos os seus artigos.',
    path: '/client/articles',
  },
  {
    id: 'landing-pages',
    icon: LayoutTemplate,
    iconColor: 'bg-emerald-100',
    iconTextColor: 'text-emerald-600',
    title: 'Minhas Páginas',
    subtitle: 'Gerencie suas Super Páginas.',
    path: '/client/landing-pages',
  },
];
```

**Estrutura do JSX:**

```tsx
<div className="relative group">
  {/* Ícone */}
  <button className="...">
    <PenTool className="h-5 w-5" />
  </button>
  
  {/* Painel Flutuante - aparece no hover */}
  <div className="absolute left-full top-0 ml-4 opacity-0 invisible 
                  group-hover:opacity-100 group-hover:visible 
                  transition-all duration-200">
    <SidebarHoverPanel items={creationTools} onNavigate={navigate} />
  </div>
</div>
```

### 4. Atualizar `src/components/ui/OmniseenLogo.tsx`

Adicionar tamanho `sidebar` para identidade de marca:

```typescript
const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
  sidebar: "h-12 max-w-[56px]",  // NOVO
};
```

---

## Especificações de Design

### Painel Flutuante

| Propriedade | Valor |
|-------------|-------|
| Largura | `w-72` (288px) |
| Fundo | `bg-white dark:bg-gray-900` |
| Borda | `border border-border/50` |
| Sombra | `shadow-xl` |
| Bordas arredondadas | `rounded-xl` |
| Padding | `p-3` |
| Posição | `left-full ml-4 top-0` |
| Z-index | `z-50` |

### Item do Painel

| Propriedade | Valor |
|-------------|-------|
| Padding | `px-3 py-3` |
| Hover | `hover:bg-muted/50 rounded-lg` |
| Ícone | `w-10 h-10 rounded-lg` com cor customizada |
| Título | `text-sm font-medium text-foreground` |
| Subtítulo | `text-xs text-muted-foreground` |
| Badge | `bg-purple-100 text-purple-700 text-[10px]` |

### Transições

| Elemento | Transição |
|----------|-----------|
| Painel | `transition-all duration-200` |
| Visibilidade | `opacity-0 invisible → opacity-100 visible` |
| Hover item | `transition-colors duration-150` |

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/layout/SidebarHoverPanel.tsx` | Painel flutuante reutilizável |
| `src/components/layout/SidebarNavItem.tsx` | Item de navegação com hover |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/layout/MinimalSidebar.tsx` | Refatorar para usar painéis hover |
| `src/components/ui/OmniseenLogo.tsx` | Adicionar tamanho `sidebar` |
| `src/components/mobile/MobileBottomNav.tsx` | Trocar `Hammer` por `PenTool` |

---

## Mapeamento de Ícones

| Antes | Depois |
|-------|--------|
| `Hammer` (Construtor) | `PenTool` ou `Edit3` (Criação) |
| `FileText` (Documentos) | `FileText` (mantido) |
| `Users` (Leads) | `Users` (mantido) |
| `Bell` (Notificações) | `Bell` (mantido) |
| `HelpCircle` (Ajuda) | `HelpCircle` (mantido) |

---

## Comportamento Detalhado

### Hover sobre "Criação" (PenTool)

1. Mouse entra no ícone
2. Painel flutuante aparece à direita (fora do sidebar)
3. Painel contém 4 itens:
   - Postagem de Blog com um clique
   - Geração de artigos em massa (coming soon)
   - Super Página
   - Ferramenta de reescrita (coming soon + badge "Novo!")
4. Mouse sai → painel fecha

### Hover sobre "Documentos" (FileText)

1. Mouse entra no ícone
2. Painel flutuante aparece com 2 itens:
   - Meus Artigos → `/client/articles`
   - Minhas Páginas → `/client/landing-pages`
3. Mouse sai → painel fecha

### Ícones sem Hover Panel

- **Leads** → Navegação direta
- **Notificações** → Disabled (Em breve)
- **Ajuda** → Abre FloatingSupportChat

---

## Resultado Visual Esperado

```text
┌──────┐  ┌────────────────────────────────────────┐
│      │  │                                        │
│  🖊️  │──│ 📄 Postagem de Blog com um clique     │
│      │  │    Crie e publique com um título       │
│  📄  │  │                                        │
│      │  │ 📚 Geração de artigos em massa        │
│  👥  │  │    Até 100 artigos automaticamente     │
│      │  │                                        │
│  🔔  │  │ 🚀 Super Página                        │
│      │  │    Páginas CTA baseadas na SERP        │
│  ❓  │  │                                        │
│      │  │ ✨ Ferramenta de reescrita     Novo!   │
│      │  │    Reescreva com insights da SERP      │
└──────┘  └────────────────────────────────────────┘
```

---

## Critérios de Aceite

| Critério | Validação |
|----------|-----------|
| Ícone de criação | PenTool (não mais Hammer) |
| Hover abre painel | Sem clique necessário |
| Painel fora do sidebar | Posicionado à direita |
| 4 ferramentas de criação | Postagem, Massa, Super Página, Reescrita |
| 2 itens em Documentos | Artigos e Páginas |
| Estilo premium | Fundo branco, sombra, bordas arredondadas |
| Hover elegante | Realce suave nos itens |
| Fechar ao sair | Painel fecha quando mouse sai |
| Coming soon | Badge para itens não disponíveis |

---

## Impacto na UX

- **Antes**: Sidebar genérico com tooltips simples
- **Depois**: Barra de comando premium com painéis informativos
- **Percepção**: Plataforma profissional comparável ao SEOwriting.ai
- **Fluidez**: Navegação por hover, sem fricção de cliques
