
# Plano: Correção Definitiva do Sistema WordPress

## Problema Identificado

O WordPress está retornando `HTTP 200` com body `[]` (array vazio) e o sistema atual faz `JSON.parse("[]")` sem erro, resultando em `post = []` que passa pela validação `response.ok` mas falha em `post.id` e `post.link`.

A mensagem atual "Erro HTTP 200: []" não é clara o suficiente.

---

## Mudanças Propostas

### 1. Edge Function: Validar Body Vazio/Inválido ANTES do parse

**Arquivo:** `supabase/functions/publish-to-cms/index.ts`

Modificar `createWordPressPost()` e `createWordPressComPost()` para detectar respostas inválidas antes do `JSON.parse`:

```typescript
// Após: const responseText = await response.text();
// Adicionar ANTES do try/catch JSON.parse:

// Validate non-empty response
if (!responseText || responseText.trim() === "" || responseText.trim() === "[]") {
  console.error(`[WordPress.org] Empty or invalid response body`);
  return { 
    success: false, 
    message: `WordPress respondeu vazio — post não criado. HTTP ${response.status}. Verifique endpoint, autenticação ou bloqueio do host.`
  };
}

// Detect HTML error pages
if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
  console.error(`[WordPress.org] Received HTML instead of JSON`);
  return { 
    success: false, 
    message: `WordPress retornou HTML em vez de JSON. HTTP ${response.status}. Endpoint incorreto ou REST API desabilitada.`
  };
}
```

A mesma lógica será aplicada para `createWordPressComPost()`.

---

### 2. Edge Function: Melhorar Mensagem de Erro

Quando `response.ok` mas sem `id`/`link`, tornar mensagem mais clara:

```typescript
// Linha 247-251 atual:
console.error("[WordPress.org] Failed - missing id or link:", {...});
return { 
  success: false, 
  message: `Publicação falhou. HTTP ${response.status}. Body: ${responseText.slice(0, 300)}. Verifique se o usuário tem permissão para criar posts.`
};
```

---

### 3. UI: Adicionar Botão "Desconectar" Explícito

**Arquivo:** `src/components/blog-editor/CMSIntegrationsTab.tsx`

Adicionar um botão "Desconectar" visível ao lado do switch, que:
1. Define `is_active = false`
2. Limpa estado local (remove do array `integrations`)
3. Mostra toast: "Integração desconectada. Você pode reconectar a qualquer momento."

O ícone de lixeira existente permanece para exclusão definitiva.

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={async () => {
    await updateIntegration(integration.id, { is_active: false });
    toast.success("Integração desconectada");
  }}
  className="gap-1 text-orange-600"
>
  <Unplug className="h-4 w-4" />
  Desconectar
</Button>
```

---

### 4. UI: Permitir Reconectar (Editar Credenciais)

Quando existir uma integração `is_active = false`, mostrar botão "Reconectar" que abre dialog para atualizar URL/credenciais do registro existente, em vez de criar um novo.

---

### 5. Deploy e Teste

1. Atualizar `publish-to-cms/index.ts`
2. Deploy Edge Function
3. Verificar logs com `HTTP status` + `body` completo
4. Testar cenário: publicar em WordPress.org real

---

## Fluxo Final Garantido

```
Usuário clica "Publicar no WordPress"
       ↓
Edge Function POST /wp-json/wp/v2/posts
       ↓
Recebe resposta HTTP
       ↓
┌─────────────────────────────────┐
│ Body vazio ("" ou "[]")?        │
│ → Erro: "WordPress respondeu    │
│   vazio — post não criado"      │
├─────────────────────────────────┤
│ Body é HTML?                    │
│ → Erro: "REST API desabilitada" │
├─────────────────────────────────┤
│ JSON válido mas sem id/link?    │
│ → Erro: "Publicação falhou.     │
│   Body: {trecho}. Verifique     │
│   permissões do usuário."       │
├─────────────────────────────────┤
│ JSON com id + link?             │
│ → Sucesso: retorna URL do post  │
└─────────────────────────────────┘
       ↓
Frontend exibe toast + abre URL
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/publish-to-cms/index.ts` | Validar body vazio/HTML antes de JSON.parse |
| `src/components/blog-editor/CMSIntegrationsTab.tsx` | Adicionar botão "Desconectar" explícito |

---

## Garantias Finais

Após esta implementação:

| Cenário | Resultado Garantido |
|---------|---------------------|
| WordPress.org com credenciais válidas | Post criado + URL retornada |
| WordPress.com com OAuth válido | Post criado + URL retornada |
| Body vazio `[]` ou `""` | Erro claro: "respondeu vazio" |
| Body HTML | Erro claro: "REST API desabilitada" |
| HTTP 200 sem id/link | Erro claro com body parcial |
| Usuário desconecta | `is_active = false`, pode reconectar |
| Usuário reconecta | Atualiza credenciais do registro existente |
