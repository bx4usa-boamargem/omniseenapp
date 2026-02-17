

# Sidebar Colapsavel com Expansao por Hover

## Problema Atual

O `PremiumSidebar` tem largura fixa de 280px no desktop e usa um botao hamburguer no canto direito para mobile. O usuario quer um sidebar que:
- Quando **recolhido**: mostra apenas os icones (largura ~64px)
- Quando o mouse **passa por cima**: expande suavemente para mostrar icones + labels (largura 280px)
- Sem botao hamburguer no lado direito

## Solucao

Transformar o `PremiumSidebar` em um sidebar colapsavel com hover, mantendo toda a estrutura existente (3 itens + AccountFooter + hubs flutuantes).

## Alteracoes

### 1. `src/components/layout/PremiumSidebar/PremiumSidebar.tsx`

- Adicionar estado `isExpanded` controlado por `onMouseEnter` / `onMouseLeave`
- Sidebar tera `w-16` quando recolhido e `w-[280px]` quando expandido
- Transicao suave com `transition-all duration-300`
- Passar `isExpanded` para os componentes filhos (NavItem, HubMenuItem, SidebarHeader, AccountFooter)
- Remover o `MobileMenuButton` do lado direito (manter apenas o `MobileDrawer` para mobile)

### 2. `src/components/layout/PremiumSidebar/SidebarHeader.tsx`

- Quando recolhido: mostrar apenas o logo (sem o texto "OmniSeen")
- Quando expandido: mostrar logo + texto
- Receber prop `isExpanded`

### 3. `src/components/layout/PremiumSidebar/NavItem.tsx`

- Receber prop `isExpanded`
- Quando recolhido: mostrar apenas o icone centralizado (esconder label, badges)
- Quando expandido: mostrar icone + label + badges (como esta hoje)
- Tooltip com o nome do item quando recolhido

### 4. `src/components/layout/PremiumSidebar/HubMenuItem.tsx`

- Receber prop `isExpanded`
- Quando recolhido: mostrar apenas o icone (esconder label e chevron)
- O painel flutuante continua funcionando normalmente no hover (ja abre ao lado)

### 5. `src/components/layout/PremiumSidebar/AccountFooter.tsx`

- Receber prop `isExpanded`
- Quando recolhido: mostrar apenas o avatar circular (esconder nome, plano, chevron)
- Quando expandido: mostrar tudo como hoje

### 6. `src/components/layout/SubAccountLayout.tsx`

- Mudar `lg:ml-[280px]` para `lg:ml-16` (margem fixa do sidebar recolhido)
- O conteudo principal nao se desloca quando o sidebar expande (o sidebar expande por cima com `position: fixed`)

## Comportamento Final

```text
RECOLHIDO (estado padrao):
  [Logo]          <- apenas icone, 64px de largura
  [Home icon]
  [Pencil icon]
  [Chat icon]
  ...
  [Avatar]

HOVER (mouse sobre o sidebar):
  [Logo] OmniSeen     <- expande para 280px
  [Home] Dashboard
  [Pencil] Conteudo  >
  [Chat] Conversoes
  ...
  [Avatar] Workspace Name
```

O sidebar expande suavemente sobre o conteudo (position fixed, z-index alto), sem empurrar o layout principal.

## Detalhes Tecnicos

- O sidebar usa `position: fixed` (ja usa), entao a expansao nao afeta o layout
- A margem do conteudo principal (`lg:ml-16`) permanece fixa
- A expansao e puramente visual com `width` transition
- Os textos usam `opacity-0` / `opacity-100` com `transition-opacity` para fade suave
- `overflow-hidden` no sidebar impede que textos vazem quando recolhido
- Os hubs flutuantes (ContentHubPanel, AccountHubPanel) continuam abrindo normalmente
- No mobile (< 1024px), o MobileDrawer continua funcionando como esta, mas sem o botao hamburguer no canto direito (o MobileBottomNav ja existe para navegacao mobile)

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `PremiumSidebar.tsx` | Estado hover, passar isExpanded, remover MobileMenuButton |
| `SidebarHeader.tsx` | Esconder texto quando recolhido |
| `NavItem.tsx` | Esconder label quando recolhido |
| `HubMenuItem.tsx` | Esconder label/chevron quando recolhido |
| `AccountFooter.tsx` | Esconder texto quando recolhido |
| `SubAccountLayout.tsx` | Margem fixa `lg:ml-16` |

