
# Plano: Adicionar Botões de Editar/Desconectar na Tela de Domínio Próprio

## Contexto
Atualmente, a aba "Domínio Próprio" no diálogo de integração CMS permite apenas selecionar um domínio e publicar. Falta a capacidade de:
- Ver se o artigo **já está publicado** em um domínio
- **Trocar** para outro domínio
- **Desconectar** (despublicar do domínio)

## Solução Proposta

### 1. Buscar Estado de Publicação do Artigo
Adicionar uma consulta para verificar se o artigo atual já está publicado via domínio próprio (campos `publication_target` e `publication_url`).

### 2. Exibir Card de "Publicado em Domínio" 
Quando o artigo já estiver publicado em domínio próprio (`publication_target = 'domain'`), mostrar um card destacado com:
- URL onde está publicado
- Badge "Publicado"
- Link externo para visualizar
- **Botão "Editar/Trocar"** - abre seletor para escolher outro domínio
- **Botão "Desconectar"** - remove a vinculação e volta para rascunho

### 3. Fluxo de Trocar Domínio
- Ao clicar em "Editar", mostrar o seletor de domínios (que já existe)
- Ao selecionar novo domínio e confirmar, atualizar `publication_url` para a nova URL

### 4. Fluxo de Desconectar
- Ao clicar em "Desconectar", mostrar confirmação
- Limpar `publication_target` e `publication_url`
- Opcionalmente, reverter status para "draft" ou manter como está

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cms/CMSIntegrationCenterSheet.tsx` | Adicionar estado de publicação do artigo, lógica de trocar/desconectar, e UI condicional |
| `src/components/cms/DomainPublishingSelector.tsx` | Adicionar prop opcional para modo "edição" e botões de ação |

## Detalhes Técnicos

### Novo Estado no CMSIntegrationCenterSheet
```text
// Buscar informações de publicação do artigo atual
const [articlePublicationInfo, setArticlePublicationInfo] = useState<{
  publication_target: string | null;
  publication_url: string | null;
} | null>(null);
```

### Consulta ao Artigo
```text
// No useEffect inicial, buscar:
SELECT publication_target, publication_url, status FROM articles WHERE id = articleId
```

### Ações Novas
1. **handleChangePublicationDomain** - Atualiza `publication_url` para novo domínio
2. **handleDisconnectFromDomain** - Limpa `publication_target` e `publication_url`

### Layout Atualizado da Aba "Domínio Próprio"
```text
SE artigo já publicado em domínio:
   ┌─────────────────────────────────────────┐
   │ ✓ Publicado em: https://xxx.app/slug    │
   │ ─────────────────────────────────────── │
   │ [Abrir ↗]   [Trocar Domínio]  [Desconec]│
   └─────────────────────────────────────────┘

SENAO:
   [Seletor de domínios existente]
   [Botão Publicar no Domínio]
```

## Benefícios
- Governança completa sobre publicação em domínios próprios
- Consistência com a gestão de integrações CMS (que já tem Editar/Desconectar)
- Permite migrar artigos entre domínios sem precisar despublicar manualmente
