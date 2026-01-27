
# Plano: Correção do Bug Visual nos Filtros de Status

## Problema Identificado

Os botões de filtro usam `variant="ghost"` do shadcn Button, que aplica:
```css
hover:bg-accent hover:text-accent-foreground
```

Os estilos customizados tentam sobrescrever apenas o background:
```tsx
statusFilter === tab.value
  ? "bg-background shadow-sm font-medium"
  : "hover:bg-background/50"  // ← Falta hover:text-...
```

**Resultado**: No hover, o texto pode perder contraste dependendo do tema, pois o `text-accent-foreground` do variant ghost conflita com o background customizado.

## Solução

Adicionar estilos completos para todos os estados (normal, hover, active) garantindo contraste consistente.

### Alterações em Ambos os Componentes

**ArticleFilters.tsx** (linhas 59-64):
```tsx
// ANTES
className={cn(
  "rounded-md px-2 sm:px-3 py-1.5 h-auto text-xs sm:text-sm transition-colors gap-1 whitespace-nowrap",
  statusFilter === tab.value
    ? "bg-background shadow-sm font-medium"
    : "hover:bg-background/50"
)}

// DEPOIS
className={cn(
  "rounded-md px-2 sm:px-3 py-1.5 h-auto text-xs sm:text-sm transition-colors gap-1 whitespace-nowrap",
  "text-muted-foreground hover:text-foreground hover:bg-muted/80",
  statusFilter === tab.value && "bg-background text-foreground shadow-sm font-medium hover:bg-background"
)}
```

**LandingPageFilters.tsx** (linhas 39-44):
```tsx
// ANTES
className={cn(
  "rounded-md px-3 py-1.5 h-auto text-sm transition-colors",
  statusFilter === tab.value
    ? "bg-background shadow-sm font-medium"
    : "hover:bg-background/50"
)}

// DEPOIS
className={cn(
  "rounded-md px-3 py-1.5 h-auto text-sm transition-colors",
  "text-muted-foreground hover:text-foreground hover:bg-muted/80",
  statusFilter === tab.value && "bg-background text-foreground shadow-sm font-medium hover:bg-background"
)}
```

## Lógica dos Estilos

| Estado | Background | Texto |
|--------|------------|-------|
| Normal (não selecionado) | transparente | `text-muted-foreground` |
| Hover (não selecionado) | `bg-muted/80` | `text-foreground` |
| Ativo (selecionado) | `bg-background` | `text-foreground` |
| Hover + Ativo | `bg-background` (mantém) | `text-foreground` |

## Arquivos a Modificar

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/components/client/articles/ArticleFilters.tsx` | 59-64 | Atualizar classes do Button |
| `src/components/client/landingpage/LandingPageFilters.tsx` | 39-44 | Atualizar classes do Button |

## Resultado Esperado

1. Todos os tabs têm texto visível no estado normal (`text-muted-foreground`)
2. Hover aplica background sutil (`bg-muted/80`) e texto destacado (`text-foreground`)
3. Tab ativo tem fundo sólido (`bg-background`) com sombra e texto destacado
4. Contraste mantido em todos os estados (normal, hover, active)
5. Comportamento consistente em ambas as telas (Artigos e Super Páginas)
