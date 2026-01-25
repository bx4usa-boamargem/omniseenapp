
# Implementação Final: Sistema de Integrações CMS Confiável

## Resumo da Análise

Após revisar todos os arquivos, identifiquei as lacunas específicas que precisam ser corrigidas para garantir que o ciclo de vida (Conectar → Publicar → Desconectar → Reconectar) funcione sem estados fantasmas.

---

## Correções a Implementar

### 1. Backend: Filtrar por `is_active = true` (CRÍTICO)

**Arquivo:** `supabase/functions/publish-to-cms/index.ts`

**Problema:** A query atual (linhas 676-680) busca a integração apenas por ID, sem verificar `is_active`:

```typescript
const { data: integration, error: integrationError } = await supabaseClient
  .from("cms_integrations_decrypted")
  .select("*")
  .eq("id", integrationId)
  .single();
```

**Correção:** Adicionar `.eq("is_active", true)` e retornar erro claro se a integração estiver inativa:

```typescript
const { data: integration, error: integrationError } = await supabaseClient
  .from("cms_integrations_decrypted")
  .select("*")
  .eq("id", integrationId)
  .eq("is_active", true)  // NOVO: só processa se ativo
  .single();

if (integrationError || !integration) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      code: "INTEGRATION_INACTIVE",
      message: "Integração não encontrada ou desativada. Abra a Central de Integrações." 
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
  );
}
```

---

### 2. WordPress.com OAuth: Tratar Erros Específicos

**Arquivo:** `supabase/functions/wordpress-com-oauth/index.ts`

**Problema:** O tratamento de erro atual (linhas 74-78) é genérico:

```typescript
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Failed to exchange code for tokens: ${response.status}`);
}
```

**Correção:** Parsear a resposta de erro e retornar mensagens acionáveis:

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error("Token exchange error:", errorText);
  
  // Parse error for specific message
  try {
    const errorData = JSON.parse(errorText);
    if (errorData.error === "invalid_client") {
      throw new Error("OAuth inválido: Client ID não reconhecido pelo WordPress.com. Verifique as credenciais do app.");
    }
    if (errorData.error === "invalid_grant") {
      throw new Error("Código de autorização expirado ou já utilizado. Tente conectar novamente.");
    }
    throw new Error(errorData.error_description || `Erro OAuth: HTTP ${response.status}`);
  } catch (parseError) {
    if (parseError instanceof Error && parseError.message.includes("OAuth")) {
      throw parseError;
    }
    throw new Error(`Falha na autenticação OAuth. HTTP ${response.status}`);
  }
}
```

---

### 3. Frontend: Forçar Refetch Após Operações

**Arquivo:** `src/components/cms/CMSIntegrationCenterSheet.tsx`

**Problema:** O componente não está chamando `refetch()` após operações de desconectar/editar, o que pode deixar o estado desatualizado.

**Correção:** Importar e usar `refetch` explicitamente:

```typescript
// Na desestruturação do hook (linha 109-119):
const {
  integrations,
  loading,
  testing,
  addIntegration,
  updateIntegration,
  deleteIntegration,
  testConnection,
  publishArticle,
  initiateWordPressComOAuth,
  refetch, // ADICIONAR
} = useCMSIntegrations(blogId);
```

**No handleDisconnect (linhas 297-304):**
```typescript
const handleDisconnect = async (integrationId: string) => {
  setDisconnecting(integrationId);
  const success = await updateIntegration(integrationId, { is_active: false });
  if (success) {
    await refetch(); // ADICIONAR: Forçar atualização imediata
    toast.success("Integração desconectada", {
      description: "Não será mais usada para publicação. Reconecte quando desejar."
    });
  }
  setDisconnecting(null);
};
```

**No handleEditIntegration (linhas 247-273):**
```typescript
if (success) {
  await refetch(); // ADICIONAR: Forçar atualização após edição
  toast.success("Credenciais atualizadas! Testando conexão...");
  // ...resto do código
}
```

**No handleDelete (linhas 307-312):**
```typescript
const handleDelete = async (integrationId: string) => {
  if (!confirm("Tem certeza que deseja excluir esta integração permanentemente?")) return;
  setDeleting(integrationId);
  const deleted = await deleteIntegration(integrationId);
  if (deleted) {
    await refetch(); // ADICIONAR: Forçar atualização após exclusão
  }
  setDeleting(null);
};
```

---

### 4. ClientArticleEditor: Resincronizar Após Fechar Central

**Arquivo:** `src/pages/client/ClientArticleEditor.tsx`

**Problema:** Quando o usuário fecha a Central de Integrações, o estado local (`integrations`, `activeIntegration`) pode não refletir as mudanças feitas.

**Correção:** Adicionar `refetch` ao hook e chamar quando a Central fechar:

```typescript
// Linha 140: Adicionar refetch
const { integrations, publishArticle, getActiveIntegration, refetch: refetchIntegrations } = useCMSIntegrations(blog?.id || '');
```

**Na prop onOpenChange do CMSIntegrationCenterSheet:**
```typescript
<CMSIntegrationCenterSheet
  blogId={blog?.id || ''}
  articleId={existingArticleId}
  open={showCMSCenter}
  onOpenChange={async (open) => {
    setShowCMSCenter(open);
    // Quando fechar a Central, forçar refetch
    if (!open) {
      await refetchIntegrations();
    }
  }}
  onPublishSuccess={(url) => window.open(url, '_blank')}
/>
```

---

## Arquivos a Modificar

| Arquivo | Mudança Principal |
|---------|-------------------|
| `supabase/functions/publish-to-cms/index.ts` | Adicionar `.eq("is_active", true)` na query de integração |
| `supabase/functions/wordpress-com-oauth/index.ts` | Tratar `invalid_client` e `invalid_grant` com mensagens claras |
| `src/components/cms/CMSIntegrationCenterSheet.tsx` | Chamar `refetch()` após disconnect/edit/delete |
| `src/pages/client/ClientArticleEditor.tsx` | Chamar `refetchIntegrations()` ao fechar a Central |

---

## Fluxo Garantido Após Implementação

```text
                       CICLO DE VIDA COMPLETO
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  CONECTAR                                                        │
│    └→ Adicionar integração → Salvar → Auto-testar                │
│       → Status: "Conectado" (verde)                              │
│                                                                  │
│  PUBLICAR                                                        │
│    └→ Frontend verifica: is_active=true E status="connected"    │
│       └→ SIM: Publica direto                                     │
│       └→ NÃO: Abre Central de Integrações                        │
│    └→ Backend verifica: is_active=true (NOVA VALIDAÇÃO)          │
│       └→ Se inativo: retorna INTEGRATION_INACTIVE                │
│                                                                  │
│  DESCONECTAR                                                     │
│    └→ is_active = false                                          │
│    └→ refetch() atualiza lista imediatamente                     │
│    └→ UI muda para "Desconectado" (laranja)                      │
│    └→ Backend RECUSA qualquer tentativa de publicação            │
│                                                                  │
│  RECONECTAR                                                      │
│    └→ Edita credenciais → is_active = true → Auto-testa          │
│    └→ refetch() atualiza lista                                   │
│    └→ Status: "Conectado" ou "Erro"                              │
│                                                                  │
│  EXCLUIR                                                         │
│    └→ Remove registro permanentemente                            │
│    └→ refetch() remove da lista                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Mensagens de Erro Acionáveis

| Cenário | Mensagem Retornada |
|---------|-------------------|
| Integração desativada | "Integração não encontrada ou desativada. Abra a Central de Integrações." |
| OAuth Client ID inválido | "OAuth inválido: Client ID não reconhecido pelo WordPress.com." |
| Código OAuth expirado | "Código de autorização expirado. Tente conectar novamente." |
| Loop de redirect | "Loop de redirect detectado (http/https). Corrija: URL A ↔ URL B" |
| Body vazio | "WordPress respondeu vazio — post não criado." |

---

## Validação em Duas Camadas (Garantia de Segurança)

| Camada | Validação | Status |
|--------|-----------|--------|
| Frontend | `canPublishDirectly = is_active && status === "connected"` | ✅ Já existe |
| Frontend | Abre Central se não houver integração válida | ✅ Já existe |
| Frontend | Refetch após operações | ❌ **Será adicionado** |
| Backend | Query filtra por `is_active = true` | ❌ **Será adicionado** |
| Backend | OAuth: tratar erros específicos | ❌ **Será adicionado** |

---

## Critério de Aceitação Final

Após esta implementação, o seguinte ciclo funcionará perfeitamente:

1. ✅ Conectar WordPress.org/WordPress.com/Wix
2. ✅ Publicar artigo
3. ✅ Desconectar → UI atualiza imediatamente
4. ✅ Tentar publicar → Backend recusa (INTEGRATION_INACTIVE)
5. ✅ Reconectar → Editar credenciais + ativar + testar
6. ✅ Publicar novamente
7. ✅ Nenhuma "integração fantasma" em nenhum momento
8. ✅ Frontend e backend sempre concordam sobre o estado
