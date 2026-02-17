

# Sidebar — Centralização, Timing e Organização

## Problemas Identificados

1. **Icones descentrados**: Os botoes usam `mx-2` que desloca os icones para a direita dentro dos 64px
2. **Hover conflitante**: O HubMenuItem abre o painel flutuante ao mesmo tempo que o sidebar expande — duplo efeito simultaneo
3. **Largura excessiva**: 280px e demais para 3 itens de navegacao — reduzir para 240px
4. **Logo grande demais**: `h-14` nao cabe bem no estado recolhido de 64px
5. **AccountFooter desalinhado**: Padding e margens nao centralizam o avatar quando recolhido

## Correcoes

### 1. `NavItem.tsx` — Centralizar icones

- Remover `mx-2` do botao
- Quando recolhido: usar `w-full flex justify-center py-3` (sem padding lateral, sem margin)
- Quando expandido: usar `px-4 py-3`
- Faixa lateral ativa: ajustar `left` para compensar a remocao do `mx-2`

### 2. `HubMenuItem.tsx` — Corrigir hover e centralizar

- Remover `px-2` do container
- Centralizar icone quando recolhido (mesmo padrao do NavItem)
- **Separar hover do sidebar vs hover do item**: O painel flutuante so deve abrir com CLICK quando sidebar esta recolhido, e com hover quando esta expandido
- Recalcular `panelPosition.left` baseado no estado expandido/recolhido (64px vs 240px)

### 3. `PremiumSidebar.tsx` — Reduzir largura

- Mudar `w-[280px]` para `w-60` (240px)
- Adicionar `shadow-lg` quando expandido para separar visualmente do conteudo

### 4. `SidebarHeader.tsx` — Organizar logo

- Quando recolhido: logo menor (`h-8`), centralizado sem texto
- Quando expandido: logo `h-10` + texto "OmniSeen"
- Centralizar o botao inteiro dentro dos 64px quando recolhido

### 5. `AccountFooter.tsx` — Centralizar avatar

- Quando recolhido: centralizar avatar (remover padding lateral, `justify-center`)
- Quando expandido: layout normal com nome + plano + chevron

### 6. `OmniseenLogo.tsx` — Novo tamanho

- Adicionar variante `sidebar-collapsed` com `h-8` para o estado recolhido

## Detalhes Tecnicos

### Logica de hover do HubMenuItem

```text
Sidebar RECOLHIDO + hover no item:
  -> Sidebar expande (controlado pelo PremiumSidebar)
  -> Painel flutuante NAO abre automaticamente
  -> Painel so abre com CLICK ou hover APOS sidebar expandir

Sidebar EXPANDIDO + hover no item:
  -> Painel flutuante abre normalmente ao lado
```

Implementacao: no `handleMouseEnter` do HubMenuItem, verificar `isExpanded` — se `false`, nao abrir o painel (deixar apenas o sidebar expandir via o handler do `aside`).

### Largura e posicionamento

```text
Recolhido: w-16 (64px) — icones centralizados
Expandido: w-60 (240px) — icones + labels
Margem do conteudo: lg:ml-16 (sem mudanca)
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `PremiumSidebar.tsx` | Largura `w-60`, shadow quando expandido |
| `SidebarHeader.tsx` | Logo menor e centralizado quando recolhido |
| `NavItem.tsx` | Remover `mx-2`, centralizar icone quando recolhido |
| `HubMenuItem.tsx` | Centralizar icone, corrigir timing do hover |
| `AccountFooter.tsx` | Centralizar avatar quando recolhido |
| `OmniseenLogo.tsx` | Adicionar tamanho `sidebar-collapsed` |

## Resultado Esperado

- Icones perfeitamente centralizados na coluna de 64px
- Hover no sidebar expande suavemente sem abrir paineis flutuantes prematuramente
- Largura expandida de 240px (mais compacta, sem invadir o conteudo)
- Logo OmniSeen visivel e organizado em ambos os estados
- Avatar da conta centralizado quando recolhido
