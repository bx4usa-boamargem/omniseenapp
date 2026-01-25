
# Central de Integrações CMS - Fluxo Completo de Publicação

## Contexto do Problema

O fluxo atual de publicação está fragmentado:
- O botão "Publicar no WordPress" tenta publicar diretamente sem validações
- Não há visibilidade sobre quais integrações estão configuradas
- O usuário não consegue gerenciar (testar, desconectar, editar) as integrações de forma centralizada
- Não existe validação de que a integração foi testada com sucesso antes de publicar

---

## Solução Proposta

Criar uma **Central de Integrações CMS** que:
1. Seja aberta automaticamente ao clicar em "Publicar no WordPress/CMS"
2. Mostre todas as integrações com status claro
3. Permita gerenciar completamente cada integração
4. Só permita publicar quando houver uma integração ativa E testada

---

## Fluxo de Usuário Final

```text
Usuário clica "Publicar"
        |
        v
+---------------------------+
| Existe integração ativa   |
| E testada com sucesso?    |
+---------------------------+
        |
    +---+---+
    |       |
   SIM     NÃO
    |       |
    v       v
Publica   Abre Central
direto    de Integrações CMS
```

---

## Componentes a Implementar

### 1. Novo Componente: CMSIntegrationCenterSheet

Um Sheet (painel lateral) completo que substitui o atual mini-form de configuração.

**Estrutura visual:**

```text
+---------------------------------------+
|        Central de Publicação          |
+---------------------------------------+
|                                       |
|  WordPress.com          [CONECTADO]   |
|  meusite.wordpress.com                |
|  [Testar] [Desconectar] [Editar]      |
|                                       |
+---------------------------------------+
|                                       |
|  WordPress.org          [ERRO]        |
|  meusiteorg.com.br                    |
|  [Testar] [Desconectar] [Editar]      |
|                                       |
+---------------------------------------+
|                                       |
|  Wix                    [INATIVO]     |
|  meusite.wixsite.com                  |
|  [Reconectar]                         |
|                                       |
+---------------------------------------+
|                                       |
|  + Adicionar Nova Integração          |
|                                       |
+---------------------------------------+
```

### 2. Modificação: ClientArticleEditor.tsx

Alterar o comportamento do botão de publicação:

**Antes:**
- Se existe `activeIntegration` → publica direto
- Se não existe → abre Sheet de configuração

**Depois:**
- Se existe integração ativa E `last_sync_status === "connected"` → publica direto
- Caso contrário → abre Central de Integrações CMS

### 3. Novo Campo: `last_test_at` na tabela `cms_integrations`

Para saber quando a integração foi testada pela última vez (opcional, pode usar `last_sync_at` existente).

---

## Detalhes Técnicos

### Arquivo: `src/components/cms/CMSIntegrationCenterSheet.tsx` (NOVO)

Este componente será uma versão melhorada do `CMSIntegrationsTab.tsx` otimizada para o contexto de publicação:

```typescript
interface CMSIntegrationCenterSheetProps {
  blogId: string;
  articleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublishSuccess?: (url: string) => void;
}
```

**Funcionalidades:**
- Lista todas as integrações (ativas e inativas)
- Para cada integração mostra:
  - Plataforma (WordPress.org, WordPress.com, Wix)
  - URL conectada
  - Status com badge colorido (Conectado/Erro/Desconectado/Não testado)
  - Última verificação
- Botões de ação:
  - **Testar**: Executa teste de conexão
  - **Desconectar**: Define `is_active = false`
  - **Reconectar/Editar**: Abre formulário para atualizar credenciais
  - **Excluir**: Remove permanentemente (com confirmação)
- Botão "Adicionar Integração" que abre o formulário existente
- Se houver exatamente UMA integração ativa e testada, mostra botão "Publicar Agora"

### Arquivo: `src/pages/client/ClientArticleEditor.tsx` (MODIFICAR)

Linhas ~1315-1395:

```typescript
// Nova lógica de validação
const canPublishDirectly = activeIntegration && 
  activeIntegration.is_active && 
  activeIntegration.last_sync_status === "connected";

// Botão de publicação
{existingArticleId && (
  canPublishDirectly ? (
    // Botão verde "Publicar no WordPress"
    <Button onClick={handlePublishCMS}>
      Publicar no {platformName}
    </Button>
  ) : (
    // Abre Central de Integrações
    <CMSIntegrationCenterSheet
      blogId={blog?.id}
      articleId={existingArticleId}
      open={showCMSCenter}
      onOpenChange={setShowCMSCenter}
      onPublishSuccess={(url) => window.open(url, '_blank')}
    />
  )
)}
```

### Arquivo: `src/hooks/useCMSIntegrations.ts` (MODIFICAR)

Adicionar função `reconnectIntegration`:

```typescript
const reconnectIntegration = async (
  integrationId: string,
  updates: { site_url?: string; username?: string; api_key?: string }
): Promise<boolean> => {
  // Atualiza credenciais E reativa a integração
  const success = await updateIntegration(integrationId, {
    ...updates,
    is_active: true,
  });
  
  if (success) {
    // Auto-testa a nova configuração
    const testResult = await testConnection(integrationId);
    return testResult.success;
  }
  return false;
};
```

---

## Estados de Status com Cores

| Status | Badge | Cor | Significado |
|--------|-------|-----|-------------|
| `connected` | Conectado | Verde | Testado e funcionando |
| `error` | Erro | Vermelho | Último teste falhou |
| `null` | Não testado | Cinza | Nunca foi testado |
| `is_active = false` | Desconectado | Laranja | Desativado pelo usuário |

---

## Validação de Publicação

O botão "Publicar" só aparece quando:
1. Existe exatamente 1 integração ativa
2. Essa integração tem `last_sync_status === "connected"`
3. O artigo já foi salvo (`existingArticleId` existe)

Caso contrário, mostra mensagem explicativa:
- "Nenhuma integração configurada" → botão "Conectar CMS"
- "Integração não testada" → botão "Testar Conexão"
- "Múltiplas integrações ativas" → lista para escolher

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/cms/CMSIntegrationCenterSheet.tsx` | Criar | Nova Central de Integrações |
| `src/pages/client/ClientArticleEditor.tsx` | Modificar | Integrar nova Central |
| `src/hooks/useCMSIntegrations.ts` | Modificar | Adicionar `reconnectIntegration` |
| `src/components/blog-editor/CMSIntegrationsTab.tsx` | Reutilizar | Extrair lógica compartilhada |

---

## Garantias Finais

Após esta implementação:

| Funcionalidade | Garantia |
|----------------|----------|
| Visão das integrações | Lista completa com status |
| Controle sobre CMS ativo | Switch ativo/inativo |
| Desconectar | `is_active = false` + toast |
| Reconectar outro WordPress | Formulário de edição + auto-teste |
| Teste manual | Botão "Testar Conexão" |
| Edição de credenciais | Dialog de edição para cada integração |
| Publicação segura | Só publica se testado com sucesso |
