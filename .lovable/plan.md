
## Diagnóstico técnico (causa raiz) — por que virou 100% “missing_introduction”

### Onde exatamente a *introduction* é extraída hoje
1) O Quality Gate valida a introdução em:
- **Arquivo:** `supabase/functions/_shared/qualityGate.ts`
- **Linha:** ~24-30  
- **Lógica:**  
  ```ts
  const introduction = article.introduction || article.intro || '';
  if (introduction.length < config.minIntroductionLength) ...
  ```
- **Regra ativa:** `minIntroductionLength = 100` (entry e authority) em `supabase/functions/_shared/qualityGateConfig.ts` (linhas ~18 e ~32).

2) O `article.introduction` é preenchido em:
- **Arquivo:** `supabase/functions/generate-article-structured/index.ts`
- **Linha:** ~2069-2078 (trecho do seu diff)
- **Lógica atual (V3.1):**  
  - pega **todo conteúdo antes do primeiro H2** (`/^##\s+/m`)
  - se não achar H2, usa os **2 primeiros parágrafos**
  - detalhe crítico: se o **primeiro H2 estiver no índice 0**, o código entra no fallback e acaba pegando um “parágrafo” que pode ser apenas o próprio H2 + uma linha curta, resultando em 48–55 chars.

### O que isso prova sobre o pipeline
A introdução curta **não é (necessariamente) o writer “escrevendo curto”** — é *muito provável* que o conteúdo final (`contentWithEat`) esteja vindo **já sem introdução real**.

E o `contentWithEat` é definido assim:
- **Arquivo:** `supabase/functions/generate-article-structured/index.ts`
- **Linha:** ~1972
  ```ts
  let contentWithEat = seoOut.content || writerOut.content || '';
  ```

Ou seja: **se o SEO stage devolver `seoOut.content` começando direto com `## ...`**, a “introdução” calculada ficará vazia/curta e o gate falha.

### O ponto exato da regressão
O Writer stage está fortemente instruído a ter introdução (e a NÃO ter H2 nas primeiras linhas) via `HIERARCHY_RULES`:
- **Arquivo:** `supabase/functions/generate-article-structured/index.ts`
- **Linha:** ~790-809
- Regra explícita:
  - “Introdução → 3-4 linhas, SEM headings”
  - “PROIBIDO: H2 na introdução”

Mas o **SEO stage (optimize_article)** hoje NÃO está obrigado a respeitar essas regras de hierarquia/introdução, porque o prompt do SEO stage é bem genérico:
- **Arquivo:** `supabase/functions/generate-article-structured/index.ts`
- **Linha:** ~1867 (seoSystem)
  ```ts
  const seoSystem = `Você é um Agente SEO... Reestruture ...`
  ```
Ele não inclui `HIERARCHY_RULES` e também não manda “preservar/garantir introdução sem headings antes do primeiro H2”.

Resultado: o SEO stage pode “reestruturar” para começar com `##` (ou colocar H2 cedo), **apagando/encurtando a introdução**. Como `contentWithEat` prioriza `seoOut.content`, isso vira falha 100%.

**Conclusão da causa raiz:**  
> A falha 422 “missing_introduction” é causada por uma regressão de *governança do SEO stage*: o `seoOut.content` frequentemente sai sem introdução (ou com H2 logo no começo), e como ele tem prioridade sobre `writerOut.content`, o Quality Gate valida uma introdução curta.

---

## Plano de correção (sem “workaround”, corrigindo a causa)

### 1) Instrumentação/telemetria para prova definitiva (1 deploy)
Adicionar logs determinísticos antes do Quality Gate para capturar:
- `writerOut.content` → primeiros 200 chars + introLen calculado
- `seoOut.content` → primeiros 200 chars + introLen calculado
- `contentWithEat` → primeiros 200 chars + `firstH2Index` + introLen final

**Objetivo:** mostrar em log se o writer estava ok e o SEO removeu a intro (ou vice-versa), com números.

### 2) Corrigir o SEO stage para nunca destruir a introdução (correção de causa)
Modificar `seoSystem`/`seoUser` para:
- Incluir explicitamente as **regras de hierarquia** relevantes (ideal: reaproveitar o texto do `HIERARCHY_RULES` ou um subset enxuto).
- Exigir:  
  1) **Introdução antes do primeiro H2**  
  2) **Sem headings na introdução**  
  3) **Mínimo de 120–160 caracteres** (buffer acima do gate 100)  
  4) Preservar H1 único, e só depois introdução, depois H2.

Isso força a etapa SEO a respeitar a arquitetura editorial existente (answer-first + introdução).

### 3) Ajuste mínimo na extração para o caso “H2 no índice 0” (bug real de parsing)
Mesmo com o SEO corrigido, a extração V3.1 tem um edge-case:
- se o conteúdo começa com `##` (primeiro H2 index = 0), o código cai no fallback e captura um bloco ruim.

Corrigir a condição:
- tratar `firstH2Index >= 0` separadamente:
  - `firstH2Index > 0` → ok, pega substring(0, firstH2Index)
  - `firstH2Index === 0` → **introdução é vazia** (correto), e isso deve acionar diagnóstico claro (log), não um “parágrafo” que inclui heading.
  - fallback só quando `firstH2Index === -1` (não existe H2).

Isso deixa a validação coerente e facilita detectar “SEO devolveu sem intro” de forma inequívoca.

### 4) (Opcional, mas recomendado) Erro mais explicativo quando a causa for “SEO output sem intro”
Antes de retornar 422, incluir no payload de erro (apenas debug, sem vazar dados sensíveis):
- `intro_len`
- `first_h2_index`
- `content_prefix` (ex: primeiros 120 chars)
- `source_of_content`: `"seoOut"` ou `"writerOut"`

Isso elimina a sensação de “workaround” e vira diagnóstico automático.

---

## Critérios de sucesso (como testar)
1) Repetir geração em um tema que hoje falha 100%.
2) Ver nos logs:
   - `seoOut_intro_len >= 120`
   - `contentWithEat_intro_len >= 120`
   - `firstH2Index > 0`
3) Confirmar que o Quality Gate para de falhar por `missing_introduction`.
4) Teste de regressão: garantir que H2 não aparece nas primeiras linhas (conforme HIERARCHY_RULES).

---

## Arquivos envolvidos (referências diretas)
- `supabase/functions/_shared/qualityGate.ts` (validação da introdução)
- `supabase/functions/_shared/qualityGateConfig.ts` (minIntroductionLength = 100)
- `supabase/functions/generate-article-structured/index.ts`
  - `HIERARCHY_RULES` (linha ~790)
  - `seoSystem/seoUser` (linha ~1867)
  - `contentWithEat = seoOut.content || writerOut.content` (linha ~1972)
  - extração da introduction (linha ~2069-2078)
  - retorno 422 do Quality Gate (linha ~2118-2131)

---

## Observação importante (coerência com sua exigência “sem workaround”)
A correção principal aqui não é “mascarar o gate” nem “colar texto artificial”: é **garantir que o SEO stage preserve a introdução** e corrigir um edge-case real da função de parsing (firstH2Index === 0).
