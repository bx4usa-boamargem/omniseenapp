
# Correcao: SEO Elimina Formatacao e Imagens

## Problema Identificado

Ao clicar em "Aumentar Score", "Otimizar para SERP", "Corrigir automaticamente" ou "Levar a 100", o conteudo retornado pela IA perde:
- Todas as tags `<figure>` e `<img>` (imagens internas)
- Formatacao HTML (headings viram texto corrido)
- O conteudo volta como texto plano ou markdown simples

## Causa Raiz

Duas falhas complementares:

### 1. Prompt nao protege imagens
O prompt do `boost-content-score` (linha 293-334) envia o HTML completo para a IA mas NAO instrui explicitamente a preservar blocos `<figure>`, `<img>`, `<figcaption>`. A IA interpreta "micro-ajustes" como licenca para simplificar a estrutura, removendo imagens.

O mesmo ocorre no `fix-seo-with-ai` (linha 183-199).

### 2. Nao ha re-injecao de imagens apos otimizacao
O frontend aplica o conteudo otimizado diretamente (`onContentUpdate(optimizedContent)`) sem verificar se as imagens originais foram preservadas. Nao ha nenhum mecanismo de "restauracao" das imagens apos a IA retornar o conteudo.

## Solucao

### Estrategia: Protecao de Imagens em 3 Camadas

**Camada 1 — Prompt Guard**: Adicionar instrucoes explicitas nos prompts da IA para NUNCA remover blocos de imagem.

**Camada 2 — Extracao + Re-injecao**: Antes de enviar para a IA, extrair todos os blocos `<figure>` e substituir por placeholders. Apos receber a resposta, re-injetar os blocos originais.

**Camada 3 — Validacao pos-otimizacao**: Comparar contagem de imagens antes/depois e alertar ou restaurar se houve perda.

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/_shared/imageProtection.ts` | NOVO: Funcoes para extrair, substituir e re-injetar imagens |
| `supabase/functions/boost-content-score/index.ts` | Integrar protecao de imagens no fluxo de otimizacao |
| `supabase/functions/fix-seo-with-ai/index.ts` | Integrar protecao de imagens na expansao de conteudo |

## Detalhes Tecnicos

### 1. Novo modulo: `_shared/imageProtection.ts`

Funcoes:
- `extractImageBlocks(html)`: Localiza todos os `<figure>...</figure>` e `<img .../>` no HTML. Substitui cada um por um placeholder unico `<!--IMG_PLACEHOLDER_0-->`, `<!--IMG_PLACEHOLDER_1-->`, etc. Retorna o HTML limpo + array de blocos extraidos.
- `reinjectImageBlocks(html, blocks)`: Substitui cada placeholder pelo bloco original correspondente.
- `validateImagePreservation(before, after)`: Conta imagens antes/depois e retorna se houve perda.

### 2. `boost-content-score/index.ts`

Antes de montar o prompt (linha ~306):

```text
1. Extrair imagens: { cleanContent, imageBlocks } = extractImageBlocks(content)
2. Enviar cleanContent no prompt (sem imagens)
3. Adicionar ao prompt: "Os marcadores <!--IMG_PLACEHOLDER_N--> indicam posicoes de imagens. NAO os remova."
4. Apos receber resposta: optimizedContent = reinjectImageBlocks(aiResponse, imageBlocks)
5. Validar: se imagens foram perdidas, tentar re-inserir nas posicoes originais
```

Instrucao adicional no prompt:

```text
## IMAGENS - REGRA ABSOLUTA
- Os marcadores <!--IMG_PLACEHOLDER_N--> representam imagens do artigo
- NUNCA remova esses marcadores
- Mantenha-os nas mesmas posicoes ou mova para apos o H2 mais proximo
```

### 3. `fix-seo-with-ai/index.ts`

Mesma logica aplicada ao prompt de expansao de conteudo (linha 183):
- Extrair imagens antes de enviar
- Re-injetar apos receber resposta expandida
- Se a expansao adicionou novas secoes H2, as imagens permanecem nas secoes originais

### 4. Preservacao de formatacao HTML

Adicionar ao system prompt de ambas as funcoes:

```text
REGRA CRITICA DE FORMATACAO:
- Mantenha TODA a estrutura HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
- NAO converta HTML para Markdown
- NAO converta Markdown para texto plano
- Se o input e HTML, o output DEVE ser HTML
- Se o input e Markdown, o output DEVE ser Markdown
```

### Fluxo Revisado

```text
Conteudo Original (com imagens)
  |
  v
extractImageBlocks() → conteudo limpo + array de imagens
  |
  v
Enviar para IA (sem imagens, com placeholders)
  |
  v
IA retorna conteudo otimizado (com placeholders preservados)
  |
  v
reinjectImageBlocks() → conteudo otimizado COM imagens
  |
  v
validateImagePreservation() → confirmar que nenhuma imagem foi perdida
  |
  v
Se imagens perdidas: forcar re-insercao nas posicoes originais
  |
  v
Retornar conteudo final
```

## Resultado Esperado

- Imagens NUNCA sao removidas por otimizacao SEO
- Formatacao HTML preservada (headings, listas, paragrafos)
- Conteudo nao vira "texto corrido" apos otimizar
- Sistema funciona para todos os botoes: Aumentar Score, Otimizar SERP, Corrigir, Levar a 100
