
# Plano de Implementação Completo: Sistema CMS Profissional

## Objetivo

Implementar as 4 entregas obrigatórias para um sistema de publicação CMS robusto e profissional:

1. ✅ OAuth WordPress.com com credenciais reais
2. ✅ Zero consumo de recursos sem integração válida
3. ✅ Opção de publicação por domínio próprio (modelo Automaticles)
4. ✅ Ciclo completo: Conectar / Desconectar / Reconectar / Alternar

---

## Entrega 1: Correção do OAuth WordPress.com

### Problema Atual
O secret `WORDPRESS_COM_CLIENT_ID` contém um placeholder em português ("O Client ID que o WordPress.com vai te dar"), não um Client ID real do WordPress.com.

### Solução

**Passo 1: Configuração de Credenciais Reais**

O usuário precisa registrar um aplicativo OAuth no WordPress.com Developer Portal:
- URL: https://developer.wordpress.com/apps/
- Configurar Redirect URI: `https://omniseenapp.lovable.app/cms/wordpress-callback`
- Obter Client ID e Client Secret reais

**Passo 2: Atualizar os Secrets**

Substituir os 3 secrets no sistema:
```
WORDPRESS_COM_CLIENT_ID = <Client ID real do WordPress.com>
WORDPRESS_COM_CLIENT_SECRET = <Client Secret real do WordPress.com>
WORDPRESS_COM_REDIRECT_URI = https://omniseenapp.lovable.app/cms/wordpress-callback
```

**Passo 3: Validação em Runtime**

Adicionar validação no código para detectar placeholders e bloquear OAuth antes de redirecionar:

```typescript
// Em wordpress-com-oauth/index.ts
function getAuthorizationUrl(blogId: string): string {
  const clientId = Deno.env.get("WORDPRESS_COM_CLIENT_ID");
  
  // Bloquear se for placeholder
  if (!clientId || clientId.includes("vai te dar") || clientId.length < 10) {
    throw new Error("WORDPRESS_COM_CLIENT_ID não está configurado. Configure um Client ID real do WordPress.com.");
  }
  // ...resto do código
}
```

---

## Entrega 2: Zero Consumo Sem Integração Válida

### Arquitetura de Proteção

O sistema já possui validação no backend (`is_active = true`), mas precisamos garantir que:
1. Nenhuma chamada de API consuma recursos sem criar integração
2. Erros claros sejam retornados antes de qualquer operação custosa

### Mudanças Necessárias

**Backend: publish-to-cms/index.ts**

A proteção já existe (linhas 676-700), mas adicionamos log de auditoria:

```typescript
// Linha ~690 - Após verificar is_active
if (integrationError || !integration) {
  console.error(`[AUDIT] Tentativa de publicação bloqueada: integrationId=${integrationId}, motivo=INACTIVE_OR_NOT_FOUND`);
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

**Frontend: CMSIntegrationCenterSheet.tsx**

Já implementado:
- Linha 141-146: Reset de form ao abrir
- Linha 268, 272, 275, 290, 315, 329: Refetch após operações
- Validação de integração ativa antes de habilitar botão "Publicar"

---

## Entrega 3: Publicação por Domínio Próprio (Modelo Automaticles)

### Arquitetura Existente

O sistema já possui a fundação completa:

| Componente | Status | Localização |
|------------|--------|-------------|
| Tabela `tenant_domains` | ✅ Existe | Database |
| RPC `resolve_domain` | ✅ Existe | Migration 20260120023317 |
| Edge Function `verify-domain` | ✅ Existe | supabase/functions/verify-domain |
| Roteamento por hostname | ✅ Existe | src/App.tsx:305-320 |
| Renderização pública | ✅ Existe | src/pages/CustomDomainArticle.tsx |
| Hook de resolução | ✅ Existe | src/hooks/useDomainResolution.ts |

### O Que Falta Implementar

**1. Nova Opção na Central de Publicação**

Adicionar "Domínio Próprio" como opção ao lado de WordPress/Wix:

```typescript
// Em CMSIntegrationCenterSheet.tsx - Adicionar à array PLATFORMS
{
  id: "domain",
  name: "Domínio Próprio",
  description: "Publique diretamente no seu subdomínio OmniSeen ou domínio customizado",
  icon: "🌐",
  authType: "domain",
  fields: [],
  domainSelector: true, // Flag especial para mostrar seletor de domínios
}
```

**2. Componente de Seleção de Domínio**

Novo componente para listar domínios verificados do blog:

```typescript
// Novo: DomainPublishingSelector.tsx
interface DomainPublishingSelectorProps {
  blogId: string;
  onSelect: (domain: string) => void;
}

export function DomainPublishingSelector({ blogId, onSelect }: DomainPublishingSelectorProps) {
  // Query tenant_domains WHERE blog_id = blogId AND status = 'active'
  // Mostrar lista de domínios ativos
  // Permitir selecionar um como destino de publicação
}
```

**3. Ação de "Publicar no Domínio"**

Quando o usuário seleciona publicar no domínio próprio:

```typescript
// Em handlePublish - Nova branch
if (publishableIntegration.platform === "domain") {
  // Simplesmente marcar artigo como published
  const { error } = await supabase
    .from("articles")
    .update({ 
      status: "published", 
      published_at: new Date().toISOString(),
      publication_target: "domain",
      publication_url: canonicalUrl
    })
    .eq("id", articleId);
  
  if (!error) {
    toast.success("Publicado!", {
      description: "Artigo disponível no seu domínio",
      action: { label: "Abrir", onClick: () => window.open(canonicalUrl, "_blank") }
    });
  }
}
```

**4. Migração de Banco de Dados**

Adicionar coluna para rastrear destino de publicação:

```sql
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS publication_target TEXT DEFAULT 'cms',
ADD COLUMN IF NOT EXISTS publication_url TEXT;

COMMENT ON COLUMN articles.publication_target IS 'Target: cms, domain, minisite';
```

---

## Entrega 4: Ciclo Completo de Gerenciamento

### Fluxos Garantidos

**Conectar**
```
Clica "Adicionar Integração"
  → Form resetado (useEffect já implementado)
  → Seleciona plataforma
  → WordPress.org: preenche campos → Salva → Auto-testa
  → WordPress.com: vê explicação → Clica consciente → OAuth → Salva
  → Domínio Próprio: seleciona domínio → Ativa
  → Refetch → Lista atualizada
```

**Desconectar**
```
Clica "Desconectar" 
  → is_active = false
  → Refetch imediato
  → UI mostra "Desconectado" (laranja)
  → Backend recusa publicação (INTEGRATION_INACTIVE)
```

**Reconectar**
```
Clica "Reconectar" em integração desconectada
  → Abre dialog de edição
  → Atualiza credenciais (opcional)
  → is_active = true
  → Auto-testa
  → Refetch
  → Status atualizado
```

**Alternar**
```
Múltiplas integrações configuradas (WordPress + Wix + Domínio)
  → Todas listadas na Central
  → Só UMA pode estar ativa para publicação
  → Desativa uma → Ativa outra
  → Backend sempre usa a integração ativa
```

### Código Existente Validado

| Funcionalidade | Status | Arquivo |
|----------------|--------|---------|
| Reset de form | ✅ | CMSIntegrationCenterSheet.tsx:141-146 |
| Campos WordPress.org primeiro | ✅ | CMSIntegrationCenterSheet.tsx:641-689 |
| Explicação OAuth | ✅ | CMSIntegrationCenterSheet.tsx:601-638 |
| State único OAuth | ✅ | wordpress-com-oauth/index.ts:40-42 |
| Refetch após ops | ✅ | CMSIntegrationCenterSheet.tsx (múltiplos) |
| Backend valida is_active | ✅ | publish-to-cms/index.ts (já implementado) |
| Editor sync ao fechar | ✅ | ClientArticleEditor.tsx:143-148 |

---

## Arquivos a Modificar/Criar

### Modificações

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/wordpress-com-oauth/index.ts` | Validar CLIENT_ID não é placeholder |
| `src/components/cms/CMSIntegrationCenterSheet.tsx` | Adicionar opção "Domínio Próprio" |
| `src/hooks/useTenantDomains.ts` | Hook para buscar domínios ativos do blog |

### Novos Arquivos

| Arquivo | Propósito |
|---------|-----------|
| `src/components/cms/DomainPublishingSelector.tsx` | Componente de seleção de domínio |

### Migração SQL

```sql
-- Adicionar campos de publicação na tabela articles
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS publication_target TEXT DEFAULT 'cms',
ADD COLUMN IF NOT EXISTS publication_url TEXT;
```

---

## Fluxo Visual Final

```text
                    CENTRAL DE PUBLICAÇÃO
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔵 WordPress.org        ✅ Conectado                │   │
│  │    https://meusite.com.br                           │   │
│  │    [Testar] [Editar] [Desconectar] [Excluir]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🌐 WordPress.com        🟠 Desconectado             │   │
│  │    https://meublog.wordpress.com                    │   │
│  │    [Reconectar] [Excluir]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🌍 Domínio Próprio      ✅ Ativo                    │   │
│  │    anabione.app.omniseen.app                        │   │
│  │    [Desativar] [Alterar Domínio]                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [+ Adicionar Integração]                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │       [Publicar no WordPress.org]                   │   │
│  │              OU                                      │
│  │       [Publicar no Domínio Próprio]                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Requisito Crítico: Credenciais OAuth

**ATENÇÃO**: Para que o OAuth do WordPress.com funcione, é necessário:

1. Acessar https://developer.wordpress.com/apps/
2. Criar um aplicativo OAuth
3. Obter Client ID e Client Secret reais
4. Atualizar os secrets no sistema via ferramenta de secrets

Sem credenciais reais, o erro `invalid_client` continuará ocorrendo.

---

## Estimativa de Implementação

| Entrega | Complexidade | Tempo |
|---------|--------------|-------|
| 1. OAuth com credenciais reais | Baixa (config) | 15 min |
| 2. Proteção de recursos | ✅ Já existe | - |
| 3. Publicação por domínio | Média | 2-3 horas |
| 4. Ciclo completo | ✅ Já existe | - |

**Total**: ~3 horas de desenvolvimento + configuração OAuth

---

## Critérios de Aceite (Binários)

| # | Critério | Implementação |
|---|----------|---------------|
| 1 | OAuth WordPress.com com credenciais reais | Validação + atualização de secrets |
| 2 | Zero consumo sem integração válida | Backend valida is_active (já existe) |
| 3 | Publicação por domínio próprio | Nova opção na Central + seletor de domínios |
| 4 | Conectar funciona | ✅ Já implementado |
| 5 | Desconectar funciona | ✅ Já implementado |
| 6 | Reconectar funciona | ✅ Já implementado |
| 7 | Alternar entre plataformas | Central com múltiplas integrações |

Ao aprovar, implementarei todas as mudanças e entregarei diffs reais + evidências funcionais.
