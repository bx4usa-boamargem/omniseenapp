
# Implementação: Botão CMS Sempre Visível no Editor de Artigo

## Objetivo
Garantir que o usuário **sempre veja** uma opção de publicação CMS na toolbar do Editor de Artigo, mesmo quando não houver integração configurada.

## Problema Atual (Linhas 1312-1354)

```typescript
// PROBLEMA: Só aparece quando activeIntegration existe
{existingArticleId && activeIntegration && (
  <Button>Publicar no WordPress</Button>
)}
```

O usuário nunca vê que essa funcionalidade existe se não configurou previamente.

---

## Solução: Lógica Condicional com Fallback

### Novo comportamento:

| Estado | O que aparece |
|--------|---------------|
| Artigo não salvo | Nada (botão escondido) |
| Artigo salvo + SEM integração | Botão **"Conectar CMS"** (laranja) |
| Artigo salvo + COM integração | Botão **"Publicar no WordPress/Wix"** (verde) |

---

## Alterações no Arquivo

**Arquivo:** `src/pages/client/ClientArticleEditor.tsx`

### 1. Novo import (linha ~15-19)

Adicionar `Unplug` e importar o componente de configuração:

```typescript
import { Unplug } from 'lucide-react';
import { CMSIntegrationsTab } from '@/components/blog-editor/CMSIntegrationsTab';
```

### 2. Novo estado (após linha 136)

```typescript
// CMS Setup Sheet state
const [showCMSSetupSheet, setShowCMSSetupSheet] = useState(false);
```

### 3. Substituir bloco CMS (linhas 1312-1354)

**Código atual:**
```typescript
{existingArticleId && activeIntegration && (
  <Button onClick={...}>Publicar no WordPress</Button>
)}
```

**Novo código:**
```typescript
{/* CMS Integration - Publish or Connect */}
{existingArticleId && (
  activeIntegration ? (
    // Botão PUBLICAR (verde) - integração ativa
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        setIsPublishingCMS(true);
        const result = await publishArticle(activeIntegration.id, existingArticleId);
        if (result.success) {
          toast.success(`Publicado com sucesso!`, {
            description: result.externalUrl 
              ? `Artigo disponível em ${activeIntegration.platform === 'wordpress' ? 'WordPress' : 'Wix'}` 
              : undefined,
            action: result.externalUrl ? {
              label: 'Abrir',
              onClick: () => window.open(result.externalUrl, '_blank')
            } : undefined
          });
          if (result.externalUrl) {
            window.open(result.externalUrl, '_blank');
          }
        } else {
          toast.error(result.message || 'Erro ao publicar no CMS');
        }
        setIsPublishingCMS(false);
      }}
      disabled={isPublishingCMS}
      className="gap-2 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
    >
      {isPublishingCMS ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Publicando...</>
      ) : (
        <><Upload className="h-4 w-4" />Publicar no {activeIntegration.platform === 'wordpress' ? 'WordPress' : 'Wix'}</>
      )}
    </Button>
  ) : (
    // Botão CONECTAR CMS (laranja) - sem integração
    <Sheet open={showCMSSetupSheet} onOpenChange={setShowCMSSetupSheet}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10"
        >
          <Unplug className="h-4 w-4" />
          Conectar CMS
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:w-[540px] overflow-y-auto">
        <div className="py-4">
          <h2 className="text-lg font-semibold mb-2">Conectar seu site</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Conecte seu WordPress ou Wix para publicar artigos diretamente no seu site.
          </p>
          <CMSIntegrationsTab blogId={blog?.id || ''} />
        </div>
      </SheetContent>
    </Sheet>
  )
)}
```

---

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────────┐
│ EDITOR DE ARTIGO - Toolbar                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [← Voltar]  [Preview]  [Ver no site]  [e-Book PDF]  [Melhorar IA] │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  SEM integração:    [ 🔌 Conectar CMS ]      ← Laranja        │ │
│  │                                                               │ │
│  │  COM integração:    [ ⬆️ Publicar no WordPress ] ← Verde      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [Ocultar Score]  [Salvar Rascunho]  [Publicar]                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Clique em **"Conectar CMS"**:

```text
┌────────────────────────────────────────┐
│              SHEET (Lateral)           │
├────────────────────────────────────────┤
│                                        │
│  Conectar seu site                     │
│  ──────────────────                    │
│  Conecte seu WordPress ou Wix para     │
│  publicar artigos diretamente.         │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  [WordPress]  [Wix]              │  │
│  │                                  │  │
│  │  URL do Site:  [_______________] │  │
│  │  Usuário:      [_______________] │  │
│  │  Senha App:    [_______________] │  │
│  │                                  │  │
│  │  [Testar Conexão] [Salvar]       │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

---

## Comportamento Automático

Após salvar uma integração no Sheet:
1. O hook `useCMSIntegrations` faz refetch automático
2. `activeIntegration` passa a ter valor
3. O botão muda automaticamente de "Conectar CMS" → "Publicar no WordPress"

---

## Resumo de Alterações

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `ClientArticleEditor.tsx` | ~15-19 | Import `Unplug`, `CMSIntegrationsTab` |
| `ClientArticleEditor.tsx` | ~137 | Novo estado `showCMSSetupSheet` |
| `ClientArticleEditor.tsx` | 1312-1354 | Substituir condicional por lógica ternária com Sheet |

---

## Critério de Aceitação

| Cenário | Resultado Esperado |
|---------|-------------------|
| Abrir editor com artigo salvo, sem integração | Botão **"Conectar CMS"** (laranja) visível |
| Clicar em "Conectar CMS" | Sheet lateral abre com formulário |
| Salvar integração WordPress | Botão muda para **"Publicar no WordPress"** (verde) |
| Clicar em "Publicar no WordPress" | Artigo publicado, toast com "Abrir" |
| Artigo não salvo ainda | Nenhum botão CMS aparece |

---

## Detalhes Técnicos

- **Componente reutilizado**: `CMSIntegrationsTab` (já existe, funcional)
- **Imports já existentes**: `Sheet`, `SheetContent`, `SheetTrigger` (linha 19)
- **Hook já configurado**: `useCMSIntegrations` (linha 23, usado linha 135)
- **Estado já existe**: `isPublishingCMS` (linha 134)

Nenhum arquivo novo será criado. Apenas modificações em `ClientArticleEditor.tsx`.
