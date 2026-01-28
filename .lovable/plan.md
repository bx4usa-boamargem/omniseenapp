
# Plano: Corrigir Navegação do Sidebar (Separar Hover de Click)

## Problema Identificado

Os itens "Criar" e "Documentos" no `MinimalSidebar.tsx` **não passam prop `onClick`** para `SidebarNavItem`:

```tsx
// ANTES - SEM onClick (não navega no clique)
<SidebarNavItem
  icon={PenTool}
  label="Criar"
  isActive={isCreationActive()}
  panel={<SidebarHoverPanel items={creationTools} onNavigate={navigate} />}
/>
```

Quando o usuário clica no ícone:
- O `button` no `SidebarNavItem` executa `onClick={onClick}` (linha 47)
- Como `onClick` é `undefined`, nada acontece
- A navegação só funciona ao clicar nos itens DO PAINEL (que usam `onNavigate`)

---

## Solução

### 1. Adicionar `onClick` aos itens com painel

Cada item que tem um painel flutuante deve **também ter uma rota padrão** para navegação direta:

```tsx
// DEPOIS - COM onClick (navega para rota principal)
<SidebarNavItem
  icon={PenTool}
  label="Criar"
  isActive={isCreationActive()}
  onClick={() => navigate('/client/create')}  // ← Rota padrão
  panel={<SidebarHoverPanel items={creationTools} onNavigate={navigate} />}
/>

<SidebarNavItem
  icon={FileText}
  label="Documentos"
  isActive={isDocumentsActive()}
  onClick={() => navigate('/client/articles')}  // ← Rota padrão
  panel={<SidebarHoverPanel items={documentItems} onNavigate={navigate} />}
/>
```

### 2. Comportamento Final

| Interação | Resultado |
|-----------|-----------|
| **Hover** no ícone | Painel flutuante aparece (apenas visual) |
| **Click** no ícone | Navega para rota padrão do item |
| **Click** em item do painel | Navega para rota específica |
| **Mouse sai** | Painel fecha automaticamente |

---

## Arquivo a Modificar

### `src/components/layout/MinimalSidebar.tsx`

**Mudança 1 - Item "Criar":**
```tsx
<SidebarNavItem
  icon={PenTool}
  label="Criar"
  isActive={isCreationActive()}
  onClick={() => navigate('/client/create')}  // ADICIONAR
  panel={<SidebarHoverPanel items={creationTools} onNavigate={navigate} />}
/>
```

**Mudança 2 - Item "Documentos":**
```tsx
<SidebarNavItem
  icon={FileText}
  label="Documentos"
  isActive={isDocumentsActive()}
  onClick={() => navigate('/client/articles')}  // ADICIONAR
  panel={<SidebarHoverPanel items={documentItems} onNavigate={navigate} />}
/>
```

---

## Validação da Arquitetura

O `SidebarNavItem.tsx` já está **corretamente implementado**:
- Hover controlado por `onMouseEnter` / `onMouseLeave` (estado `isHovered`)
- Click delega para `onClick` prop
- Separação completa entre visual (hover) e ação (click)

O problema era apenas **não passar a prop `onClick`** no componente pai.

---

## Critérios de Aceite

| Critério | Validação |
|----------|-----------|
| Click em "Criar" navega para `/client/create` | Testar clique |
| Click em "Documentos" navega para `/client/articles` | Testar clique |
| Hover em "Criar" ainda abre painel flutuante | Testar hover |
| Hover em "Documentos" ainda abre painel flutuante | Testar hover |
| Leads, Radar, Ajuda continuam funcionando | Testar clique |
| Painel fecha ao tirar o mouse | Testar hover out |

---

## Impacto

- **Fix simples**: Apenas 2 linhas adicionadas
- **Zero breaking changes**: Comportamento de hover não é afetado
- **Navegação funcional**: Todos os itens agora respondem ao clique
