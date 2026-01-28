
# Plano: Ajustar Menu 100% por Hover (Sem Fixação por Clique)

## Diagnóstico

### Componentes Analisados

| Componente | Estado Atual | Ação Necessária |
|------------|--------------|-----------------|
| `SidebarNavItem.tsx` | ✅ Já usa hover puro | Nenhuma |
| `SidebarHoverPanel.tsx` | ✅ Controlado por parent | Nenhuma |
| `MinimalSidebar.tsx` | ✅ Logo navega sem menu | Nenhuma |
| `AccountBlock.tsx` | ❌ Usa Popover com clique | **Converter para hover** |

### Problema Identificado

O `AccountBlock.tsx` (linhas 96-207) usa o componente Radix `Popover`, que por design abre e fecha com **clique**, mantendo um estado `isOpen` persistente:

```typescript
// Estado que persiste por clique
const [isOpen, setIsOpen] = useState(false);

// Popover que só fecha ao clicar fora
<Popover open={isOpen} onOpenChange={setIsOpen}>
  <PopoverTrigger asChild>
    <button>...</button>  // Clique abre/fecha
  </PopoverTrigger>
  <PopoverContent>...</PopoverContent>
</Popover>
```

---

## Solução Proposta

Converter `AccountBlock.tsx` de **Popover (clique)** para **HoverCard (hover puro)**:

### Mudanças Técnicas

1. **Substituir Popover por HoverCard**
   - De: `@radix-ui/react-popover`
   - Para: `@radix-ui/react-hover-card` (já instalado no projeto)

2. **Remover estado `isOpen` controlado**
   - O HoverCard gerencia automaticamente por eventos de mouse

3. **Adicionar delays para evitar flicker**
   - `openDelay={100}` - espera 100ms antes de abrir
   - `closeDelay={150}` - espera 150ms antes de fechar

4. **Manter clique no trigger para navegação direta**
   - Clique no avatar → navega para `/client/settings`
   - Hover no avatar → abre painel de opções

---

## Arquivo a Modificar

### `src/components/layout/AccountBlock.tsx`

**Antes (Popover com clique):**
```typescript
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const [isOpen, setIsOpen] = useState(false);

<Popover open={isOpen} onOpenChange={setIsOpen}>
  <PopoverTrigger asChild>
    <button>...</button>
  </PopoverTrigger>
  <PopoverContent>...</PopoverContent>
</Popover>
```

**Depois (HoverCard com hover puro):**
```typescript
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

// Sem estado isOpen!

<HoverCard openDelay={100} closeDelay={150}>
  <HoverCardTrigger asChild>
    <button onClick={() => navigate('/client/settings')}>
      {/* Avatar e info - clique navega para settings */}
    </button>
  </HoverCardTrigger>
  <HoverCardContent side="top" align="start" sideOffset={8}>
    {/* Menu items */}
  </HoverCardContent>
</HoverCard>
```

---

## Detalhes da Implementação

### Comportamento Final

| Interação | Resultado |
|-----------|-----------|
| Hover no avatar | Menu aparece após 100ms |
| Mouse sai do avatar/menu | Menu fecha após 150ms |
| Clique no avatar | Navega para `/client/settings` (sem fixar menu) |
| Clique em item do menu | Navega para a rota específica |

### Ajustes de Estilo

O `HoverCardContent` precisa herdar os estilos do `PopoverContent`:
- Mesma largura (`w-64`)
- Mesmo padding (`p-2`)
- Mesmo offset (`sideOffset={8}`)
- Mesma posição (`side="top"`, `align="start"`)

---

## Código da Solução

```typescript
// AccountBlock.tsx - Nova versão

import { useNavigate } from 'react-router-dom';
import { 
  User, Link2, CreditCard, BarChart3, Bell, LogOut, Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';

// Remover: const [isOpen, setIsOpen] = useState(false);

// Remover: setIsOpen(false) das funções de navegação

<HoverCard openDelay={100} closeDelay={150}>
  <HoverCardTrigger asChild>
    <button
      onClick={() => navigate('/client/settings')}
      className={cn(
        'account-block w-full p-3 rounded-xl cursor-pointer',
        'transition-all duration-200 hover:bg-primary/5',
        'flex items-center gap-3 text-left',
        'focus:outline-none focus:ring-2 focus:ring-primary/50'
      )}
    >
      {/* Avatar content - igual ao atual */}
    </button>
  </HoverCardTrigger>

  <HoverCardContent 
    side="top" 
    align="start" 
    className="w-64 p-2"
    sideOffset={8}
  >
    {/* Menu items - igual ao atual */}
  </HoverCardContent>
</HoverCard>
```

---

## Critérios de Aceite

| Critério | Validação |
|----------|-----------|
| Hover no avatar abre menu | Testar interação |
| Mouse sai → menu fecha automaticamente | Testar interação |
| Clique no avatar navega para /client/settings | Testar clique |
| Menu não fica "travado" após clique | Testar comportamento |
| Delay de 100-150ms evita flicker | Movimentar mouse rapidamente |
| Transição suave (200ms) | Visual |
| Funciona igual em collapsed mode | Testar sidebar compacto |

---

## Impacto

- **Zero breaking changes** - apenas muda o método de controle do menu
- **UX Premium** - comportamento fluido estilo Linear/Notion
- **Consistência** - todos os menus agora funcionam 100% por hover
- **Zero fricção** - usuário nunca precisa "destravar" menus

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/layout/AccountBlock.tsx` | Substituir Popover por HoverCard, remover estado `isOpen` |
