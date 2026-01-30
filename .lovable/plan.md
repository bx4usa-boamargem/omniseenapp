

# Plano de Correção Estrutural: Pipeline de Artigos OmniSeen

## Diagnóstico Confirmado

Após análise detalhada do código em `generate-article-structured/index.ts`:

### Problema Central Identificado
1. **Schema do Writer (linhas 1760-1798)** não possui campo `introduction` explícito
2. **Merge de conteúdo (linha 2009)** usa `seoOut.content || writerOut.content` - SEO tem prioridade
3. **Extração de introdução (linhas 2107-2148)** ocorre APÓS o merge, quando já é tarde demais
4. **SEO prompt (linhas 1867-1889)** já foi corrigido para preservar introdução, MAS não há garantia estrutural

---

## Correção 1: Campo `introduction` Explícito no Schema do Writer

**Arquivo:** `supabase/functions/generate-article-structured/index.ts`  
**Linhas:** 1760-1798

Adicionar campo `introduction` como propriedade obrigatória:

```typescript
const createArticleSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'SEO title (max 60 chars)' },
    meta_description: { type: 'string', description: 'Meta description (max 160 chars)' },
    excerpt: { type: 'string', description: 'Short excerpt (max 200 chars)' },
    // ✅ NOVO: Campo explícito de introdução
    introduction: { 
      type: 'string', 
      description: 'Introduction paragraph (3-4 sentences, MINIMUM 120 characters). Plain text WITHOUT headings (#, ##, ###). Must NOT start with markdown heading.',
      minLength: 120
    },
    content: { 
      type: 'string', 
      description: 'Full markdown content starting with first H2 section (##). Do NOT include introduction here - it goes in separate "introduction" field.' 
    },
    faq: { ... },
    // ... resto igual
  },
  required: ['title', 'meta_description', 'excerpt', 'introduction', 'content', 'faq', 'reading_time', 'image_prompts', 'images']
};
```

---

## Correção 2: Prompt do Writer Exigindo Introdução Separada

**Arquivo:** `supabase/functions/generate-article-structured/index.ts`  
**Linhas:** 1801-1809

```typescript
const writerUserPrompt = `Escreva o artigo completo sobre: "${theme}"

${outlineInstruction}

## ⛔ CAMPO "introduction" OBRIGATÓRIO:
- DEVE ter no MÍNIMO 120 caracteres de texto corrido
- DEVE ser texto puro, SEM headings (#, ##, ###)
- DEVE contextualizar o problema/tema para o leitor em 3-4 frases
- Se gerar menos de 120 caracteres, REESCREVA até atingir o mínimo
- NÃO repita esta introdução no campo "content"

## CAMPO "content":
- DEVE começar DIRETAMENTE com o primeiro H2 (##)
- NÃO inclua a introdução aqui - ela vai no campo separado "introduction"
- Estruture com H2/H3 conforme outline

REGRAS CRÍTICAS:
- Use APENAS as fontes e dados do pacote de pesquisa
- Inclua links externos (https://...) apontando para FONTES PERMITIDAS
- Estruture com H2–H3, inclua FAQ + meta tags
- Não invente estatísticas/tendências. Se faltar dado: "não encontrado nas fontes".`;
```

---

## Correção 3: SEO Atua APENAS no Corpo (Nunca na Introdução)

**Arquivo:** `supabase/functions/generate-article-structured/index.ts`  
**Linhas:** 1891-1906

Atualizar `seoUser` para NÃO receber/modificar a introdução:

```typescript
const seoUser = `PACOTE DE PESQUISA (resumo):
- Termos: ${(researchPackage.serp.commonTerms || []).slice(0, 12).join(', ')}
- Títulos top: ${(researchPackage.serp.topTitles || []).slice(0, 3).join(' | ')}
- Gaps: ${(researchPackage.serp.contentGaps || []).slice(0, 5).join(' | ')}
- Fontes permitidas: ${(researchPackage.sources || []).slice(0, 8).join(' | ')}

RASCUNHO (writer):
Title: ${writerOut.title}
Meta: ${writerOut.meta_description}

⚠️ A INTRODUÇÃO FOI SEPARADA E NÃO DEVE SER MODIFICADA.
OTIMIZE APENAS O CORPO ABAIXO (H2s e seus conteúdos):

CONTENT (corpo apenas):
${(writerOut.content || '').substring(0, 6000)}

⚠️ REGRA CRÍTICA: O campo "content" da resposta DEVE começar com ## (H2). NÃO adicione introdução - ela é gerenciada separadamente.

Reestruture e retorne via tool optimize_article.`;
```

---

## Correção 4: Merge Final Explícito - Writer é Fonte da Verdade

**Arquivo:** `supabase/functions/generate-article-structured/index.ts`  
**Linhas:** 2005-2043

Substituir o merge atual por:

```typescript
// ============================================================================
// V3.3: ARTICLE ENGINE - Writer é FONTE DA VERDADE para INTRODUÇÃO
// SEO atua APENAS no corpo (content), NUNCA na introdução
// ============================================================================

// A introdução vem EXPLICITAMENTE do Writer (campo separado)
const writerIntroduction = (writerOut.introduction || '').toString().trim();

// Telemetria obrigatória
console.log(`[Merge V3.3] Writer introduction: ${writerIntroduction.length} chars`);
console.log(`[Merge V3.3] Writer introduction preview: "${writerIntroduction.substring(0, 100)}..."`);

// Validar que não começa com heading (double check)
const introStartsWithHeading = /^#/.test(writerIntroduction.trim());
if (introStartsWithHeading) {
  console.error(`[Merge V3.3] ⚠️ WARNING: Writer introduction starts with heading! Cleaning...`);
}
const cleanIntroduction = introStartsWithHeading 
  ? writerIntroduction.replace(/^#+\s*[^\n]*\n*/gm, '').trim()
  : writerIntroduction;

// SEO content (corpo apenas)
let seoBodyContent = seoOut.content || writerOut.content || '';

// Garantir que SEO content começa com H2 (remover qualquer intro duplicada)
const firstH2InSeo = seoBodyContent.search(/^##\s+/m);
if (firstH2InSeo > 0) {
  console.log(`[Merge V3.3] Removing ${firstH2InSeo} chars before first H2 in SEO output (prevents duplication)`);
  seoBodyContent = seoBodyContent.substring(firstH2InSeo).trim();
} else if (firstH2InSeo === -1) {
  console.warn(`[Merge V3.3] ⚠️ SEO output has no H2, using as-is`);
}

// E-E-A-T injection mantém a lógica existente, mas sobre seoBodyContent
let contentWithEat = seoBodyContent;

console.log(`[Article Engine] E-E-A-T check: useEat=${useEat}, niche="${niche}", hasContent=${contentWithEat.length > 0}`);

if (useEat && niche && niche !== 'default') {
  // ... código E-E-A-T existente (mantido igual)
}

// MERGE FINAL: Introdução do Writer + Corpo do SEO (com E-E-A-T)
const finalContent = cleanIntroduction + '\n\n' + contentWithEat;
console.log(`[Merge V3.3] Final content length: ${finalContent.length}, intro: ${cleanIntroduction.length}, body: ${contentWithEat.length}`);
```

---

## Correção 5: Extração de Introdução Usando Campo Explícito

**Arquivo:** `supabase/functions/generate-article-structured/index.ts`  
**Linhas:** 2107-2148

Substituir a função de extração por:

```typescript
// V3.3: Introduction vem DIRETAMENTE do campo Writer, não de parsing
introduction: (() => {
  // Prioridade 1: Campo explícito do Writer (FONTE DA VERDADE)
  const explicitIntro = (writerOut.introduction || '').toString().trim();
  
  // Limpar qualquer heading que tenha vazado
  const cleanedIntro = explicitIntro.replace(/^#+\s*[^\n]*\n*/gm, '').trim();
  
  if (cleanedIntro.length >= 100) {
    console.log(`[Intro V3.3] ✅ Using explicit Writer introduction: ${cleanedIntro.length} chars`);
    return cleanedIntro;
  }
  
  // Prioridade 2: Fallback - extrair do finalContent (backward compatibility)
  console.warn(`[Intro V3.3] ⚠️ Writer introduction too short (${cleanedIntro.length}), falling back to extraction`);
  
  const firstH2Index = finalContent.search(/^##\s+/m);
  
  // Edge-case: H2 at index 0 = no introduction
  if (firstH2Index === 0) {
    console.error(`[Intro V3.3] ❌ Content starts with ## - no introduction found`);
    return '';
  }
  
  // Normal case: extract before first H2
  if (firstH2Index > 0) {
    const extracted = finalContent.substring(0, firstH2Index).trim();
    console.log(`[Intro V3.3] Extracted from finalContent: ${extracted.length} chars`);
    return extracted;
  }
  
  // Fallback extremo: primeiros 2 parágrafos (sem headings)
  const paragraphs = finalContent.split('\n\n')
    .filter((p: string) => !p.trim().startsWith('#'))
    .slice(0, 2);
  console.warn(`[Intro V3.3] Using paragraph fallback: ${paragraphs.join('\n\n').length} chars`);
  return paragraphs.join('\n\n');
})(),
```

---

## Correção 6: Flag para Teste de Sanidade (Writer-Only Mode)

**Arquivo:** `supabase/functions/generate-article-structured/index.ts`  
**Adicionar após linha 1830**

```typescript
// V3.3: Teste de sanidade - Flag para desabilitar SEO temporariamente
const DISABLE_SEO_FOR_TEST = Deno.env.get('DISABLE_SEO_STAGE') === 'true';

if (DISABLE_SEO_FOR_TEST) {
  console.log('[DEBUG] ⚠️ SEO STAGE DISABLED - Using Writer output directly for testing');
}
```

E na seção do SEO (após linha 1908):

```typescript
let seoOut: any;

if (DISABLE_SEO_FOR_TEST) {
  console.log('[DEBUG] Skipping SEO stage - using Writer output directly');
  seoOut = {
    title: writerOut.title,
    meta_description: writerOut.meta_description,
    excerpt: writerOut.excerpt,
    content: writerOut.content,
    faq: writerOut.faq
  };
} else {
  // Código SEO existente...
  const seoCall = await callWriterWithTool({...});
  seoOut = seoCall.arguments as any;
}
```

---

## Correção 7: Logs Obrigatórios Antes do Quality Gate

**Arquivo:** `supabase/functions/generate-article-structured/index.ts`  
**Adicionar antes da linha 2186 (runQualityGate)**

```typescript
// V3.3: LOGS OBRIGATÓRIOS antes do Quality Gate
console.log(`[QualityGate V3.3] ========== PRE-VALIDATION DIAGNOSTICS ==========`);
console.log(`[QualityGate V3.3] introduction.length: ${articleWithImages.introduction?.length || 0}`);
console.log(`[QualityGate V3.3] introduction.source: writer_explicit`);
console.log(`[QualityGate V3.3] introduction.preview: "${(articleWithImages.introduction || '').substring(0, 120)}..."`);
console.log(`[QualityGate V3.3] firstH2Index in finalContent: ${finalContent.search(/^##\s+/m)}`);
console.log(`[QualityGate V3.3] sections.count: ${articleWithImages.sections?.length || 0}`);
console.log(`[QualityGate V3.3] faq.count: ${articleWithImages.faq?.length || 0}`);
console.log(`[QualityGate V3.3] image_prompts.count: ${articleWithImages.image_prompts?.length || 0}`);
console.log(`[QualityGate V3.3] writer_intro_raw: ${writerIntroduction.length} chars`);
console.log(`[QualityGate V3.3] seo_body_trimmed: ${seoBodyContent.length} chars`);
console.log(`[QualityGate V3.3] ================================================`);
```

---

## Resumo das Alterações

| Item | Arquivo | Linhas | Alteração |
|------|---------|--------|-----------|
| 1 | `index.ts` | 1760-1798 | Adicionar `introduction` ao schema |
| 2 | `index.ts` | 1801-1809 | Prompt exigindo introdução separada |
| 3 | `index.ts` | 1891-1906 | SEO não recebe/modifica introdução |
| 4 | `index.ts` | 2005-2043 | Merge: Writer intro + SEO body |
| 5 | `index.ts` | 2107-2148 | Extração usando campo explícito |
| 6 | `index.ts` | 1830 / 1908 | Flag DISABLE_SEO_FOR_TEST |
| 7 | `index.ts` | ~2180 | Logs diagnósticos obrigatórios |

---

## Fluxo Após Correção

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           WRITER STAGE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌───────────────────────────────────────┐   │
│  │    introduction     │    │              content                  │   │
│  │  (campo explícito)  │    │  (começa com ## H2, SEM introdução)   │   │
│  │  min 120 chars      │    │                                       │   │
│  │  texto puro         │    │                                       │   │
│  └──────────┬──────────┘    └───────────────────┬───────────────────┘   │
└─────────────┼───────────────────────────────────┼───────────────────────┘
              │                                   │
              │ (preservada)                      ▼
              │                    ┌──────────────────────────┐
              │                    │       SEO STAGE          │
              │                    │  (atua APENAS no corpo)  │
              │                    │  NÃO recebe introdução   │
              │                    └─────────────┬────────────┘
              │                                  │
              ▼                                  ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         MERGE FINAL V3.3                                   │
│    finalContent = writerOut.introduction + '\n\n' + seoBodyContent        │
│    article.introduction = writerOut.introduction (campo explícito)        │
└───────────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         QUALITY GATE                                       │
│    ✅ introduction.length >= 100 (usando campo explícito)                 │
│    ✅ firstH2Index > 0 (introdução antes do primeiro H2)                  │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado nos Logs

```
[Merge V3.3] Writer introduction: 156 chars
[Merge V3.3] Writer introduction preview: "Encontrar uma empresa de dedetização confiável em Recife pode ser..."
[Merge V3.3] Removing 0 chars before first H2 in SEO output
[Merge V3.3] Final content length: 4520, intro: 156, body: 4362

[QualityGate V3.3] ========== PRE-VALIDATION DIAGNOSTICS ==========
[QualityGate V3.3] introduction.length: 156
[QualityGate V3.3] introduction.source: writer_explicit
[QualityGate V3.3] introduction.preview: "Encontrar uma empresa de dedetização confiável em Recife pode ser..."
[QualityGate V3.3] firstH2Index in finalContent: 158
[QualityGate V3.3] sections.count: 8
[QualityGate V3.3] faq.count: 8
[QualityGate V3.3] image_prompts.count: 6
[QualityGate V3.3] ================================================

[QualityGate] ✅ ALL GATES PASSED
[QualityGate] Metrics: { wordCount: 1850, h2Count: 8, faqCount: 8, imageCount: 6 }
```

---

## Critérios de Sucesso

1. **introduction >= 120 chars** (campo explícito do Writer)
2. **firstH2Index > 0** (introdução existe antes do primeiro H2)
3. **Quality Gate PASS**
4. **Artigo salvo com sucesso**
5. **Logs mostram `introduction.source: writer_explicit`**

