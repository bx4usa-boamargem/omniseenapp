
# Correção: Domínio Próprio não pode "travar" a UI

## Problema Identificado
Na aba "Domínio Próprio", ao selecionar um domínio a UI entra em um estado confuso onde:
- O seletor permanece visível (isso está funcionando)
- MAS quando o artigo **já está publicado** em um domínio, o card `DomainPublishedCard` substitui completamente o seletor
- E ao clicar em "Trocar Domínio", o estado `isEditingDomain` é alterado, mas não há forma de "voltar" de forma intuitiva

O comportamento atual está na lógica condicional (linhas 829-898):
```text
SE já publicado E NÃO está editando:
   → Mostra apenas DomainPublishedCard (seletor oculto)
SENÃO:
   → Mostra seletor
```

## Solução Proposta

### 1. Remover a substituição do seletor pelo card
O `DomainPublishedCard` deve coexistir com o seletor, não substituí-lo.

### 2. Novo layout proposto:
```text
┌─────────────────────────────────────────┐
│ [Se já publicado: Card de status]       │
│ ✓ Publicado em: https://xxx.app/slug    │
│ [Abrir ↗]  [Desconectar]                │
└─────────────────────────────────────────┘

Trocar domínio:
┌─────────────────────────────────────────┐
│ ○ dominio1.app.omniseen.app [Primário]  │
│ ● dominio2.com            ← selecionado │
└─────────────────────────────────────────┘

[Atualizar Domínio] ← só aparece se seleção ≠ atual
```

### 3. Mudanças no código

**Arquivo: `src/components/cms/CMSIntegrationCenterSheet.tsx`**

| Linha | Alteração |
|-------|-----------|
| 829-898 | Remover o condicional `if (isPublishedToDomain && !isEditingDomain)` que esconde o seletor |
| - | Renderizar sempre: 1) Card de status (se publicado), 2) Seletor de domínios |
| - | Adicionar lógica para pré-selecionar o domínio atual quando artigo já está publicado |
| - | Botão de ação muda de "Publicar" para "Atualizar" quando domínio selecionado ≠ domínio atual |

**Arquivo: `src/components/cms/DomainPublishedCard.tsx`**

| Alteração |
|-----------|
| Remover o botão "Trocar Domínio" (será substituído pelo seletor sempre visível) |
| Manter apenas: URL, link externo, e botão "Desconectar" |
| Simplificar o componente para ser apenas um "card de status" |

### 4. Lógica de estado simplificada

```text
NOVO FLUXO:
1. Seletor de domínios SEMPRE visível
2. Se artigo já publicado:
   - Mostrar card de status acima do seletor
   - Pré-selecionar o domínio atual no seletor
   - Botão = "Atualizar Domínio" (só aparece se seleção ≠ atual)
3. Se artigo não publicado:
   - Mostrar apenas seletor
   - Botão = "Publicar no Domínio" (aparece quando há seleção)
```

### 5. Benefícios da correção
- **Nunca trava**: O seletor está sempre acessível
- **Fluxo reversível**: O usuário pode mudar a seleção livremente
- **Clareza de estado**: Card de status + seletor coexistem
- **Sem modo "edição"**: A variável `isEditingDomain` pode ser removida

## Detalhes Técnicos

### Remoção do estado `isEditingDomain`
Este estado se torna desnecessário pois não haverá mais "modo de edição" vs "modo de visualização".

### Pré-seleção do domínio atual
Quando o artigo já está publicado, extrair o domínio de `publication_url` e usá-lo como valor inicial de `selectedDomain`:
```typescript
// No useEffect quando artigo é carregado:
if (articlePublicationInfo?.publication_url) {
  const currentDomain = new URL(articlePublicationInfo.publication_url).hostname;
  setSelectedDomain(currentDomain);
}
```

### Lógica do botão de ação
```typescript
const isCurrentDomain = selectedDomain && 
  articlePublicationInfo?.publication_url?.includes(selectedDomain);

// Se não está publicado: "Publicar no Domínio"
// Se está publicado e seleção ≠ atual: "Atualizar Domínio"  
// Se está publicado e seleção = atual: botão desabilitado ou oculto
```
