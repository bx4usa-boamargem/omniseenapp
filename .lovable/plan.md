
# Diagnóstico: Botão "Publicar no WordPress/Wix"

## Status Atual: ✅ Implementado Corretamente

O botão **já está no lugar certo** no código. Está localizado na toolbar do editor de artigos, exatamente onde estão os botões "Melhorar com IA", "Ver no site" e "e-Book PDF".

## Por Que Não Está Aparecendo

O botão tem uma condição de visibilidade:

```typescript
{existingArticleId && activeIntegration && (
  <Button>Publicar no WordPress</Button>
)}
```

Para o botão aparecer, são necessárias **duas condições**:

1. **Artigo já salvo** (`existingArticleId`): O artigo precisa ter sido salvo pelo menos uma vez
2. **Integração CMS ativa** (`activeIntegration`): O blog precisa ter uma integração WordPress ou Wix configurada

## Verificação no Banco de Dados

A tabela `cms_integrations` está **vazia**. Não existe nenhuma integração configurada para nenhum blog.

## Fluxo Correto para Ver o Botão

```text
┌─────────────────────────────────────────┐
│ 1. Configurar Integração                │
│    Settings → Integrações CMS           │
│    → Adicionar WordPress                │
│    → Preencher URL, usuário, senha      │
│    → Testar conexão                     │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 2. Criar/Editar Artigo                  │
│    Artigos → Novo Artigo                │
│    → Gerar conteúdo                     │
│    → Salvar rascunho                    │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 3. Botão Aparece na Toolbar             │
│    [ Publicar no WordPress ]            │
└─────────────────────────────────────────┘
```

## Localização Exata no Código

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `src/pages/client/ClientArticleEditor.tsx` | 133-136 | Hook e activeIntegration |
| `src/pages/client/ClientArticleEditor.tsx` | 1312-1354 | Botão na toolbar |

## Próximo Passo

Para testar o botão, você precisa:

1. **Acessar Settings do Blog** → Aba "Integrações CMS"
2. **Adicionar integração WordPress**:
   - URL do site (ex: `https://seusite.com.br`)
   - Usuário WordPress
   - Application Password (gerado no WP Admin → Users → Application Passwords)
3. **Salvar e testar conexão**
4. **Voltar ao editor de artigos** - o botão aparecerá automaticamente

## Resumo

O código está **100% implementado e no lugar correto**. O botão não aparece porque ainda não foi configurada nenhuma integração CMS. Isso é comportamento intencional - faz sentido não mostrar um botão de publicação se não há destino configurado.

---

**Recomendação**: Configurar uma integração WordPress de teste para validar o fluxo completo.
