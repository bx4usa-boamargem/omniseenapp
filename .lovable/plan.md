

# Correção Crítica: Destravar Geração Imediata + SEO Assíncrono

## Diagnóstico Técnico

### Problema Identificado
O sistema está **travando na etapa "Pesquisando na web..."** porque o fluxo atual executa **`analyze-serp` (Perplexity + Firecrawl)** de forma **SÍNCRONA** dentro do `runResearchStage`:

```text
Fluxo Atual (PROBLEMÁTICO):
┌─────────────────────────────────────────────────────────────────┐
│ generate-article-structured                                      │
│  ├── runResearchStage() ← BLOQUEIA UI por ~45-60s              │
│  │     ├── analyze-serp (Perplexity ~4s + Firecrawl ~50s)      │
│  │     └── fetchGeoResearchData (Perplexity ~4s)                │
│  ├── callWriter() (~12s)                                        │
│  ├── callSEO() (~8s)                                            │
│  ├── callQA() (~5s)                                             │
│  └── persistArticle()                                           │
└─────────────────────────────────────────────────────────────────┘
Tempo Total: 80-100 segundos (inaceitável)
```

O `analyze-serp` com `useFirecrawl: true` está no **caminho crítico** (linhas 265-277 de `generate-article-structured`), fazendo scraping de 8 URLs (~7s cada = ~56s total).

---

## Solução Proposta

### Arquitetura Nova: Pesquisa Leve (Síncrona) + SEO Profundo (Assíncrono)

```text
Fluxo Novo (RÁPIDO):
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: GERAÇÃO IMEDIATA (< 30s)                                │
│ generate-article-structured                                      │
│  ├── runLightResearchStage() ← SÓ Perplexity (~5s)             │
│  ├── callWriter() (~12s)                                        │
│  ├── persistArticle() ← SALVA IMEDIATAMENTE                    │
│  └── dispatchSEOEnhancerJob() ← BACKGROUND (não bloqueia)      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: ENRIQUECIMENTO ASSÍNCRONO (background)                  │
│ seo-enhancer-job                                                │
│  ├── analyze-serp com Firecrawl (~50s)                         │
│  ├── callSEO() - otimização profunda                           │
│  ├── FAQ adicional                                              │
│  ├── Interlinks                                                 │
│  └── UPDATE articles SET content=... WHERE id=article_id       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Alterações Necessárias

### 1. Backend: `generate-article-structured/index.ts`

#### A) Criar `runLightResearchStage` (Perplexity Only - SEM Firecrawl)

**Nova função** que substitui `runResearchStage` no fluxo crítico:

```typescript
async function runLightResearchStage(params: {
  supabase: any;
  blogId: string;
  theme: string;
  primaryKeyword: string;
  territoryName: string | null;
  territoryData: GeoTerritoryData | null;
}): Promise<ResearchPackage> {
  const { supabase, blogId, theme, primaryKeyword, territoryName, territoryData } = params;
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const start = Date.now();

  // ✅ APENAS Perplexity (rápido, ~5s) - SEM analyze-serp/Firecrawl
  const geo = await fetchGeoResearchData(
    theme,
    territoryData,
    PERPLEXITY_API_KEY,
    undefined,
    supabase,
    blogId,
    undefined
  );

  if (!geo) {
    throw new Error('Perplexity research returned null');
  }

  const pkg: ResearchPackage = {
    geo,
    serp: {}, // SERP vazia - será preenchida pelo job assíncrono
    sources: geo.sources || [],
    generatedAt: new Date().toISOString(),
    provider: 'perplexity',
  };

  const duration = Date.now() - start;
  console.log(`[LightResearch] Completed in ${duration}ms (Perplexity only)`);

  await logStage(supabase, blogId, 'research', 'perplexity', 'light-research', true, duration, {
    sources_count: pkg.sources.length,
    firecrawl_skipped: true,
  });

  return pkg;
}
```

#### B) Substituir chamada de research no fluxo principal

**Linhas ~1581-1624:** Substituir `runResearchStage` por `runLightResearchStage`:

```typescript
// ANTES (bloqueante):
// researchPackage = await runResearchStage({...});

// DEPOIS (rápido):
researchPackage = await runLightResearchStage({
  supabase,
  blogId: blog_id!,
  theme,
  primaryKeyword,
  territoryName: territoryData?.official_name || null,
  territoryData: (territoryData as unknown as GeoTerritoryData) || null,
});
```

#### C) Disparar job assíncrono APÓS persistência

**Após** `persistArticleToDb` (linhas ~2350+), adicionar:

```typescript
// Disparar SEO Enhancer em background (não awaited)
EdgeRuntime.waitUntil(
  fetch(`${SUPABASE_URL}/functions/v1/seo-enhancer-job`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      article_id: persistedArticle.id,
      blog_id,
      request_id: requestId,
      keyword: primaryKeyword,
      territory: territoryData?.official_name || null,
    }),
  }).catch(e => console.error('[SEO-Job] Failed to dispatch:', e))
);
```

---

### 2. Nova Edge Function: `seo-enhancer-job`

#### Criar `supabase/functions/seo-enhancer-job/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SEOJobRequest {
  article_id: string;
  blog_id: string;
  request_id: string;
  keyword: string;
  territory?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { article_id, blog_id, request_id, keyword, territory }: SEOJobRequest = await req.json();
    
    console.log(`[${request_id}][SEO-Job] Starting async enhancement for article ${article_id}`);

    // 1. Buscar artigo atual
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('content, title, faq, keywords')
      .eq('id', article_id)
      .single();

    if (fetchError || !article) {
      console.error(`[${request_id}][SEO-Job] Article not found`);
      return new Response(JSON.stringify({ error: 'Article not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 2. Executar analyze-serp COM Firecrawl (agora em background, sem pressa)
    console.log(`[${request_id}][SEO-Job] Running deep SERP analysis...`);
    const serpResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-serp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyword,
        territory,
        blogId: blog_id,
        forceRefresh: true,
        useFirecrawl: true,
      }),
    });

    let serpMatrix = {};
    if (serpResponse.ok) {
      const serpData = await serpResponse.json();
      serpMatrix = serpData.matrix || {};
      console.log(`[${request_id}][SEO-Job] SERP analysis complete: ${serpMatrix.competitors?.length || 0} competitors`);
    }

    // 3. Otimização SEO com dados completos
    // (Implementar lógica de SEO optimization aqui se necessário)

    // 4. Gerar FAQs adicionais baseadas em SERP gaps
    const contentGaps = serpMatrix.contentGaps || [];
    const additionalFaqs = contentGaps.slice(0, 2).map(gap => ({
      question: gap,
      answer: `Resposta baseada na análise de mercado para "${keyword}".`
    }));

    // 5. UPDATE no artigo (incrementalmente)
    const existingFaq = article.faq || [];
    const mergedFaq = [...existingFaq, ...additionalFaqs].slice(0, 8);

    const { error: updateError } = await supabase
      .from('articles')
      .update({
        faq: mergedFaq,
        serp_enhanced: true,
        serp_enhanced_at: new Date().toISOString(),
        // Futuramente: content otimizado, interlinks, etc.
      })
      .eq('id', article_id);

    if (updateError) {
      console.error(`[${request_id}][SEO-Job] Update failed:`, updateError);
    } else {
      console.log(`[${request_id}][SEO-Job] Article ${article_id} enhanced successfully`);
    }

    // 6. Registrar consumo
    await supabase.from('consumption_logs').insert({
      user_id: null, // Background job
      blog_id,
      action_type: 'seo_enhancement',
      action_description: `SEO async enhancement for article ${article_id}`,
      metadata: {
        request_id,
        keyword,
        competitors_analyzed: serpMatrix.competitors?.length || 0,
      },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      article_id,
      enhancements: {
        faqs_added: additionalFaqs.length,
        serp_competitors: serpMatrix.competitors?.length || 0,
      }
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('[SEO-Job] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
```

#### Adicionar ao `supabase/config.toml`

```toml
[functions.seo-enhancer-job]
verify_jwt = false
```

---

### 3. Frontend: UI Stages Corrigidos

#### `src/components/client/ArticleGenerationProgress.tsx`

**Atualizar stages** para refletir o novo fluxo rápido:

```typescript
const GENERATION_STAGES: GenerationStage[] = [
  { key: 'classifying', label: 'Classificando intenção...', icon: Brain, progress: 15 },
  { key: 'selecting', label: 'Selecionando template...', icon: LayoutTemplate, progress: 25 },
  { key: 'researching', label: 'Pesquisando referências...', icon: Search, progress: 40 },
  { key: 'writing', label: 'Escrevendo conteúdo...', icon: FileText, progress: 70 },
  { key: 'images', label: 'Gerando imagens...', icon: Image, progress: 85 },
  { key: 'finalizing', label: 'Finalizando artigo...', icon: Target, progress: 95 },
];
```

**Notas:**
- Removido stage separado de "outlining" (agora é parte de "selecting")
- "Pesquisando referências" = Apenas Perplexity (rápido)
- Removido "optimizing SEO" do fluxo síncrono (agora é background)

#### `src/pages/client/ClientArticleEditor.tsx`

**Atualizar mapeamento** (linhas ~133-143):

```typescript
const mapStageToArticleEngine = (stage: GenerationStage): string | null => {
  if (!stage) return null;
  const mapping: Record<string, string> = {
    'analyzing': 'classifying',
    'structuring': 'selecting',
    'generating': 'writing',
    'images': 'images',
    'finalizing': 'finalizing'
  };
  return mapping[stage] || stage;
};
```

**Atualizar tempo estimado** (componente `ArticleGenerationProgress`):

```tsx
<span>Tempo estimado: 20-30 segundos</span>
```

---

### 4. Database: Nova Coluna para Tracking

**Migração SQL** para tracking de enriquecimento:

```sql
-- Adicionar colunas para SEO async tracking
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS serp_enhanced BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS serp_enhanced_at TIMESTAMPTZ;

-- Índice para queries de jobs pendentes
CREATE INDEX IF NOT EXISTS idx_articles_serp_pending 
  ON articles(blog_id, serp_enhanced) 
  WHERE serp_enhanced = FALSE;
```

---

## Resumo de Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/generate-article-structured/index.ts` | Criar `runLightResearchStage`, substituir chamada, disparar job |
| `supabase/functions/seo-enhancer-job/index.ts` | **NOVO** - Job assíncrono de SEO |
| `supabase/config.toml` | Adicionar `seo-enhancer-job` |
| `src/components/client/ArticleGenerationProgress.tsx` | Atualizar stages e tempo estimado |
| `src/pages/client/ClientArticleEditor.tsx` | Atualizar mapeamento de stages |
| **Migração SQL** | Adicionar `serp_enhanced`, `serp_enhanced_at` |

---

## Fluxo Final Esperado

```text
┌───────────────────────────────────────────────────────────────┐
│ USUÁRIO CLICA "GERAR"                                         │
└──────────────────────────┬────────────────────────────────────┘
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ FASE SÍNCRONA (UI bloqueante) - ~25 segundos                  │
│  1. Classificar intenção (LLM) ─────────────────── 2s         │
│  2. Selecionar template ────────────────────────── 1s         │
│  3. Pesquisa leve (Perplexity only) ────────────── 5s         │
│  4. Gerar conteúdo (Writer LLM) ────────────────── 12s        │
│  5. Gerar imagens ──────────────────────────────── 4s         │
│  6. SALVAR ARTIGO ──────────────────────────────── 1s         │
│  7. Retornar success + navegar para /edit                     │
└──────────────────────────┬────────────────────────────────────┘
                           ▼
                     ┌─────────────┐
                     │ BACKGROUND  │
                     └─────┬───────┘
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ FASE ASSÍNCRONA (seo-enhancer-job) - ~60 segundos             │
│  1. analyze-serp com Firecrawl (scraping profundo)            │
│  2. Otimização SEO baseada em SERP                            │
│  3. FAQ adicional baseado em gaps                             │
│  4. Interlinks (futuro)                                       │
│  5. UPDATE articles SET ... WHERE id = article_id             │
└───────────────────────────────────────────────────────────────┘
```

---

## Resultados Esperados

| Métrica | Antes | Depois |
|---------|-------|--------|
| Tempo de geração (UI) | 80-100s | **20-30s** |
| Etapa travada | "Pesquisando na web..." | Nenhuma |
| Firecrawl no caminho crítico | ✅ Sim | ❌ Não |
| Artigo disponível para edição | Após 100s | **Após 25s** |
| SEO profundo | Síncrono | Background |
| Geração duplicada | Possível | Bloqueada |

