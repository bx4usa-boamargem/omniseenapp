
# Plano de Implementação: Sprint 2 + Sprint 3

## Resumo Executivo

Este plano implementa o **Backend Core** e módulos de **Qualidade** do Authority Article Engine, criando 3 arquivos novos e adicionando funções ao `geoWriterCore.ts` existente.

---

## SPRINT 2: Backend Core

### Arquivo 1: `supabase/functions/_shared/templateSelector.ts`

**Objetivo:** Seleção inteligente de template com lógica anti-padrão

**Funcionalidades a implementar:**

| Função | Descrição |
|--------|-----------|
| `classifyIntent(keyword)` | Classificação de intenção via regex (4 categorias) |
| `getRecentTemplates(supabase, blogId, limit)` | Busca histórico de templates usados |
| `applyAntiPattern(recommended, history, intent)` | Rotação anti-padrão (evita 2x em 3) |
| `selectVariant(template, history)` | Escolhe variante diferente da última |
| `selectTemplate(supabase, keyword, blogId)` | Função principal orquestradora |

**Tipos definidos no arquivo:**
- `TemplateType`: 5 templates (complete_guide, qa_format, comparative, problem_solution, educational_steps)
- `TemplateVariant`: 15 variantes (3 por template)
- `Intent`: { type, urgency, recommendedTemplate }
- `TemplateSelectionResult`: { template, variant, intent, reason, antiPatternApplied }

**Constantes:**
```typescript
const TEMPLATE_VARIANTS: Record<TemplateType, TemplateVariant[]>
const ALTERNATIVE_TEMPLATES: Record<IntentType, TemplateType[]>
const TRANSACTIONAL_PATTERNS: RegExp[]
const COMMERCIAL_PATTERNS: RegExp[]
const HOW_TO_PATTERNS: RegExp[]
const INFORMATIONAL_PATTERNS: RegExp[]
```

**Mapeamento de compatibilidade com structureRotation.ts:**
| Novo (templateSelector) | Existente (structureRotation) |
|-------------------------|-------------------------------|
| complete_guide | guide |
| qa_format | educational |
| comparative | comparison |
| problem_solution | problem_solution |
| educational_steps | educational |

---

### Arquivo 2: `supabase/functions/_shared/pipelineStages.ts`

**Objetivo:** Helpers para as 12 etapas do pipeline de geração

**Funcionalidades a implementar:**

| Função | Etapa | Descrição |
|--------|-------|-----------|
| `validateBrief(brief)` | 1 | Valida campos obrigatórios do ArticleBrief |
| `classifyKeywordIntent(keyword)` | 2 | Wrapper para classificação de intenção |
| `selectTemplateForBrief(supabase, brief)` | 3 | Integra seleção com anti-padrão |
| `buildOutlineStructure(template, variant, mode, keyword, city, businessName)` | 5 | Gera estrutura completa do artigo |
| `calculateTargetWordCount(template, mode)` | Helper | Calcula word count esperado |
| `calculateH2Range(template)` | Helper | Retorna range de H2s por template |

**Tipos definidos:**
```typescript
interface ArticleBrief {
  keyword: string;
  city: string;
  state?: string;
  blogId: string;
  niche: string;
  mode: 'entry' | 'authority';
  webResearch: boolean;
  templateOverride?: TemplateType;
  businessName?: string;
  businessPhone?: string;
  businessWhatsapp?: string;
}

interface BriefValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface OutlineSection {
  type: string;
  h2: string | null;
  h3s?: string[];
  targetWords: number;
  includeTable?: boolean;
  forceList?: boolean;
  injectEat?: boolean;
  geoSpecific?: boolean;
}

interface OutlineStructure {
  h1: string;
  urlSlug: string;
  metaTitle: string;
  metaDescription: string;
  sections: OutlineSection[];
  totalTargetWords: number;
  h2Count: number;
}
```

**Constante TEMPLATE_SPECS:**
```typescript
const TEMPLATE_SPECS: Record<TemplateType, {
  h2Range: [number, number];
  wordCountAuthority: [number, number];
  wordCountEntry: [number, number];
}> = {
  complete_guide: { h2Range: [8, 12], wordCountAuthority: [1800, 3000], wordCountEntry: [800, 1200] },
  qa_format: { h2Range: [7, 10], wordCountAuthority: [1500, 2500], wordCountEntry: [800, 1200] },
  comparative: { h2Range: [7, 10], wordCountAuthority: [1500, 2800], wordCountEntry: [900, 1300] },
  problem_solution: { h2Range: [8, 12], wordCountAuthority: [1600, 2800], wordCountEntry: [900, 1400] },
  educational_steps: { h2Range: [9, 13], wordCountAuthority: [1700, 3000], wordCountEntry: [1000, 1500] }
};
```

**Estruturas de seções por template:**
Cada template terá sua estrutura base de seções com:
- H2 title pattern
- targetWords por seção
- Flags: includeTable, forceList, injectEat, geoSpecific

---

## SPRINT 3: Qualidade

### Arquivo 3: Modificação `supabase/functions/_shared/geoWriterCore.ts`

**Objetivo:** Adicionar E-E-A-T avançado por nicho (APENAS ADIÇÕES - não modificar código existente)

**O que será ADICIONADO (após linha 742):**

```typescript
// =============================================================================
// NICHE E-E-A-T PHRASES (ADIÇÃO V2.1)
// =============================================================================

export const NICHE_EAT_PHRASES: Record<string, string[]> = {
  pest_control: [
    "Na {{business_name}}, vemos diariamente como o clima de {{city}} afeta infestações de pragas.",
    "Com {{years}} anos atendendo {{city}}, nossa equipe aprendeu que tratamentos preventivos são essenciais.",
    // ... mais frases
  ],
  plumbing: [
    "A {{business_name}} atende {{city}} há {{years}} anos e conhece cada peculiaridade da rede de esgoto.",
    "Em {{city}}, problemas de entupimento variam por bairro devido à idade das tubulações.",
    // ... mais frases
  ],
  // ... 11 nichos adicionais
  default: [
    "A {{business_name}} é referência em {{city}} com mais de {{years}} anos de atuação.",
    "Atendemos clientes de toda {{city}}, de {{neighborhood}} a {{other_neighborhood}}.",
  ]
};

export function injectLocalExperience(
  niche: string,
  city: string,
  businessName: string,
  yearsInBusiness?: number,
  neighborhoods?: string[]
): string {
  // Escolhe 1-2 frases aleatórias do nicho
  // Substitui placeholders
  // Retorna texto para inserir no artigo
}
```

**Nichos a implementar E-E-A-T (13 total):**
1. pest_control
2. plumbing
3. roofing
4. image_consulting
5. dental
6. legal
7. accounting
8. real_estate
9. automotive
10. construction
11. beauty
12. education
13. technology
14. default (fallback)

---

### Arquivo 4: `supabase/functions/_shared/imageAltGenerator.ts`

**Objetivo:** Gerar ALT texts contextualizados com cidade + serviço + empresa

**Funcionalidades:**

| Função | Descrição |
|--------|-----------|
| `generateImageAlt(context)` | Gera ALT para uma imagem |
| `generateMultipleAlts(context, count)` | Gera ALTs em batch |
| `generateCaption(context)` | Gera caption descritiva |

**Tipos:**
```typescript
interface ImageAltContext {
  service: string;
  businessName: string;
  city: string;
  niche: string;
  imageType: 'hero' | 'service' | 'team' | 'equipment' | 'before_after' | 'location';
}

interface GeneratedAlt {
  alt: string;
  title?: string;
  caption?: string;
}
```

**Constante ALT_PATTERNS:**
```typescript
const ALT_PATTERNS: Record<ImageAltContext['imageType'], string[]> = {
  hero: [
    "{{service}} profissional em {{city}} pela {{business}}",
    "Equipe de {{service}} da {{business}} atendendo em {{city}}",
  ],
  service: [
    "{{service}} realizado pela {{business}} em {{city}}",
    "Serviço de {{service}} da {{business}} em {{city}}",
  ],
  team: [
    "Equipe profissional da {{business}} em {{city}}",
    "Time especializado em {{service}} da {{business}}",
  ],
  equipment: [
    "Equipamento profissional para {{service}} usado pela {{business}}",
    "Tecnologia moderna para {{service}} em {{city}}",
  ],
  before_after: [
    "Antes e depois de {{service}} pela {{business}} em {{city}}",
    "Resultado de {{service}} realizado pela {{business}}",
  ],
  location: [
    "{{business}} atendendo em {{city}}",
    "Área de cobertura da {{business}} em {{city}}",
  ]
};
```

---

## Regras de Implementação

| Regra | Status |
|-------|--------|
| Criar APENAS 3 arquivos novos | ✅ |
| Modificar geoWriterCore.ts APENAS adicionando (não alterar existente) | ✅ |
| NÃO tocar em generate-article-structured/index.ts | ✅ |
| NÃO modificar structureRotation.ts | ✅ |
| NÃO modificar editorialRotation.ts | ✅ |
| Imports Deno com extensão .ts | ✅ |
| Comentários explicativos em português | ✅ |
| Logs de debug para troubleshooting | ✅ |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Linhas Est. |
|---------|------|-------------|
| `supabase/functions/_shared/templateSelector.ts` | CRIAR | ~350 |
| `supabase/functions/_shared/pipelineStages.ts` | CRIAR | ~450 |
| `supabase/functions/_shared/geoWriterCore.ts` | ADICIONAR ao final | ~200 |
| `supabase/functions/_shared/imageAltGenerator.ts` | CRIAR | ~200 |

---

## Validação Pós-Implementação

### Template Selector:
```typescript
// Teste 1: Classificação de intenção
classifyIntent("desentupidora urgente 24h")
// Esperado: { type: 'transactional', urgency: 'high', recommendedTemplate: 'problem_solution' }

// Teste 2: Seleção completa
await selectTemplate(supabase, "desentupidora urgente", blogId)
// Esperado: { template: 'problem_solution', variant: 'urgent_first', ... }
```

### Pipeline Stages:
```typescript
// Teste 3: Validação de Brief
validateBrief({ keyword: '', city: 'SP', blogId: '123', niche: 'plumbing', mode: 'authority' })
// Esperado: { valid: false, errors: ['Keyword é obrigatória...'], warnings: [] }

// Teste 4: Outline Structure
buildOutlineStructure('complete_guide', 'chronological', 'authority', 'desentupidora', 'São Paulo', 'Desentup Rápido')
// Esperado: { h1: 'Desentupidora em São Paulo: Guia Completo 2026', sections: [...], ... }
```

### E-E-A-T:
```typescript
// Teste 5: Injeção E-E-A-T
injectLocalExperience('plumbing', 'São Paulo', 'Desentup Rápido', 15, ['Pinheiros', 'Vila Madalena'])
// Esperado: "A Desentup Rápido atende São Paulo há 15 anos e conhece cada peculiaridade..."
```

### ALT de Imagens:
```typescript
// Teste 6: Geração de ALT
generateImageAlt({ service: 'dedetização', businessName: 'Truly Nolen', city: 'São Paulo', niche: 'pest_control', imageType: 'service' })
// Esperado: { alt: 'Dedetização realizada pela Truly Nolen em São Paulo', title: '...', caption: '...' }
```

---

## Checklist Final

- [x] `templateSelector.ts` criado com todas as funções
- [x] `pipelineStages.ts` criado com todas as funções
- [x] `geoWriterCore.ts` modificado (apenas adições no final)
- [x] `imageAltGenerator.ts` criado com todas as funções
- [x] TypeScript compila sem erro
- [x] Nenhum código existente foi alterado
- [x] Imports Deno com .ts funcionam
- [x] Logs de debug adicionados

---

## ✅ SPRINT 2 + SPRINT 3 CONCLUÍDO

Implementação realizada em 2026-01-29.

### Arquivos Criados:
1. `supabase/functions/_shared/templateSelector.ts` (~400 linhas)
2. `supabase/functions/_shared/pipelineStages.ts` (~500 linhas)
3. `supabase/functions/_shared/imageAltGenerator.ts` (~250 linhas)

### Arquivos Modificados:
4. `supabase/functions/_shared/geoWriterCore.ts` (+200 linhas E-E-A-T)

### Próximos Passos:
- Sprint 4: Interface de preview de template
- Sprint 5: Testes com 10 artigos reais
