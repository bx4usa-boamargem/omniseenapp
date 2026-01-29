
# Desabilitar Web Research Completamente (Temporário)

## Problema

A geração de artigos está travando em "Pesquisando na web..." por mais de 2 minutos porque a etapa de research (Perplexity + analyze-serp) está fazendo timeout antes do fallback entrar em ação.

## Solução

Pular completamente a chamada `runResearchStage` e criar o pacote de pesquisa vazio imediatamente, sem tentar Perplexity.

---

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/generate-article-structured/index.ts` | Comentar chamada ao `runResearchStage` e usar fallback direto |

---

## Implementação

Modificar o bloco de research (linhas 1388-1420) para pular completamente a chamada ao Perplexity:

```typescript
// ============================================================================
// STAGE 1 (RESEARCH - TEMPORARIAMENTE DESABILITADO)
// ============================================================================
let researchPackage: ResearchPackage;

// ⚠️ TEMPORÁRIO: Web research desabilitado para evitar timeouts
// TODO: Reativar quando Perplexity estiver estável
console.log('[TEMPORARY] Web research DISABLED - using empty package immediately');

researchPackage = {
  geo: { 
    facts: [], 
    trends: [],
    sources: [], 
    rawQuery: primaryKeyword,
    fetchedAt: new Date().toISOString()
  },
  serp: { commonTerms: [], topTitles: [], contentGaps: [], averages: {} },
  sources: [],
  generatedAt: new Date().toISOString(),
};

await logStage(supabase, blog_id, 'research', 'skipped', 'empty-package', true, 0, { 
  reason: 'TEMPORARY_DISABLED' 
});

console.log('[TEMPORARY] Proceeding with empty research package');

// CÓDIGO ORIGINAL COMENTADO:
// try {
//   researchPackage = await runResearchStage({
//     supabase,
//     blogId: blog_id!,
//     theme,
//     primaryKeyword,
//     territoryName: territoryData?.official_name || null,
//     territoryData: (territoryData as unknown as GeoTerritoryData) || null,
//   });
// } catch (e) {
//   ... fallback code ...
// }
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Trava 2+ min tentando Perplexity | Pula imediatamente para geração |
| Timeout infinito | Geração em ~30-60 segundos |
| Erro 424 se Perplexity falhar | Sempre gera (sem fontes externas) |

---

## Impacto Temporário

- Artigos gerados **sem** pesquisa web (fatos, trends, fontes)
- E-E-A-T e ALT contextual continuam funcionando normalmente
- Template selection e estrutura funcionam normalmente
- Nicho e modo (Entry/Authority) funcionam normalmente

---

## Próximos Passos (Após Estabilizar)

1. Investigar timeout do Perplexity
2. Adicionar timeout explícito de 30s na chamada
3. Reativar research com timeout seguro
4. Ou: adicionar toggle no frontend para "usar pesquisa web" (já existe mas não está funcionando)

---

## Checklist

- [ ] Comentar chamada ao `runResearchStage`
- [ ] Criar pacote de pesquisa vazio imediatamente
- [ ] Log indicando que research está temporariamente desabilitado
- [ ] Deploy da edge function
- [ ] Testar geração (deve completar em ~1 minuto)
