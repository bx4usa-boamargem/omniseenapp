# Motor de Artigos OmniSeen - Authority Article Engine

> **Documento-Mestre de Produto v1.0**
> 
> Última atualização: 2026-01-29
> 
> Este documento é a **fonte única de verdade** para o Motor de Artigos de Autoridade Local.

---

## PRINCÍPIO FUNDAMENTAL

A OmniSeen é o **motor invisível** de autoridade local.

Cada artigo é assinado e pertence à **SUBCONTA** (empresa cliente), NUNCA à OmniSeen.

O artigo deve parecer escrito por:
- Uma empresa local real
- Com anos de experiência na área
- Com conhecimento profundo do mercado local
- Com autoridade técnica no nicho

### Termos Proibidos (NUNCA mencionar):

| ❌ Proibido | Razão |
|-------------|-------|
| OmniSeen | Marca da plataforma |
| Plataforma | Revela automação |
| Sistema | Revela automação |
| Automação | Quebra naturalidade |
| IA | Quebra autoridade |
| Gerador | Quebra autoridade |

**O narrador é SEMPRE a empresa da subconta.**

---

## ARQUITETURA MULTI-DIMENSIONAL

Cada artigo é definido por **5 dimensões**:

```
┌─────────────────────────────────────────────────────────────┐
│                    ARTIGO DE AUTORIDADE                      │
├─────────────┬─────────────┬─────────────┬─────────────┬─────┤
│   NICHO     │  SUBCONTA   │  INTENÇÃO   │  TEMPLATE   │MODO │
│   (Setor)   │  (Empresa)  │  (Search)   │ (Estrutura) │(Prof│
├─────────────┼─────────────┼─────────────┼─────────────┼─────┤
│pest_control │ business_   │transactional│complete_    │entry│
│plumbing     │ name        │commercial   │guide        │     │
│roofing      │ city        │informational│qa_format    │auth-│
│...          │ tone        │             │comparative  │ority│
│             │ offers      │             │problem_sol  │     │
│             │             │             │educational  │     │
└─────────────┴─────────────┴─────────────┴─────────────┴─────┘
```

---

## DIMENSÃO 1: NICHO (Setor de Atuação)

Define regras, vocabulário técnico, compliance e blocos obrigatórios.

### Nichos Implementados

| ID | Nome | Serviços Típicos |
|----|------|------------------|
| `pest_control` | Controle de Pragas | Dedetização, desratização, descupinização |
| `plumbing` | Desentupidora | Hidrojateamento, limpeza de fossa |
| `roofing` | Telhados | Instalação, manutenção, impermeabilização |
| `image_consulting` | Consultoria de Imagem | Personal stylist, coloração pessoal |
| `dental` | Odontologia | Implantes, clareamento, ortodontia |
| `legal` | Advocacia | Trabalhista, família, empresarial |
| `accounting` | Contabilidade | Fiscal, departamento pessoal |
| `real_estate` | Imobiliária | Venda, locação, avaliação |
| `automotive` | Automotivo | Mecânica, elétrica, funilaria |
| `construction` | Construção | Reforma, obra, projeto |
| `beauty` | Estética | Harmonização, depilação, massagem |
| `education` | Educação | Cursos, treinamentos, formação |
| `technology` | Tecnologia | Software, TI, sistemas |

### Estrutura de um Niche Ruleset

```typescript
interface NicheRuleset {
  id: string;
  name: string;
  displayName: string;
  
  // Vocabulário
  lsiKeywords: string[];
  seedKeywords: string[];
  
  // Estrutura obrigatória
  mandatoryBlocks: string[];
  
  // Compliance
  complianceAlerts: string[];
  
  // Conversão
  typicalCtas: string[];
  
  // Visual
  imageKeywords: string[];
}
```

---

## DIMENSÃO 2: SUBCONTA (Empresa Cliente)

Define personalidade, tom, ofertas, diferencial e CTA.

### Campos Obrigatórios

```typescript
interface SubaccountProfile {
  // Identificação
  businessName: string;           // "Desentup Rápido"
  businessCity: string;           // "São Paulo"
  businessState: string;          // "SP"
  businessPhone: string;          // "(11) 3456-7890"
  businessWhatsapp?: string;      // "(11) 99999-9999"
  businessWebsite?: string;       // "desentuprapido.com.br"
  
  // Posicionamento
  primaryService: string;         // "Desentupimento"
  secondaryServices: string[];    // ["Hidrojateamento", "Limpeza de caixa de gordura"]
  niche: NicheType;               // "plumbing"
  
  // Diferencial
  yearsInBusiness?: number;       // 15
  uniqueSellingPoint: string;     // "Atendimento 24h com garantia"
  certifications?: string[];      // ["CREA", "Alvará sanitário"]
  
  // Tom de voz
  tone: 'formal' | 'casual' | 'premium' | 'popular';
  
  // Ofertas
  offers: string[];               // ["Orçamento gratuito", "Garantia de 90 dias"]
  
  // CTA preferencial
  preferredCta: 'phone' | 'whatsapp' | 'form' | 'schedule';
}
```

---

## DIMENSÃO 3: INTENÇÃO (Search Intent)

Define qual template estrutural usar.

### Classificação Automática

| Intenção | Keywords Indicativas | Template Recomendado | Urgência |
|----------|---------------------|---------------------|----------|
| **Transactional** | urgente, emergência, 24h, agora, hoje | `problem_solution` | Alta |
| **Commercial** | preço, custo, valor, quanto, melhor, vs | `comparative` | Média |
| **Informational** | como, por que, o que é, quando, funciona | `qa_format` ou `educational_steps` | Baixa |
| **Default** | (outros casos) | `complete_guide` | Baixa |

### Algoritmo de Classificação

```typescript
function classifyIntent(keyword: string): Intent {
  const lower = keyword.toLowerCase();
  
  // Transacional (urgência, contratar agora)
  if (/urgente|emergência|24h|agora|hoje|imediato/.test(lower)) {
    return { type: 'transactional', urgency: 'high', recommendedTemplate: 'problem_solution' };
  }
  
  // Comercial (comparar, preço, melhor)
  if (/preço|custo|valor|quanto|barato|melhor|perto de mim|comparar|vs/.test(lower)) {
    return { type: 'commercial', urgency: 'medium', recommendedTemplate: 'comparative' };
  }
  
  // Perguntas (FAQ, dúvidas)
  if (/como|por que|o que é|quando|onde|vale a pena|funciona/.test(lower)) {
    return {
      type: 'informational',
      urgency: 'low',
      recommendedTemplate: /como/.test(lower) ? 'educational_steps' : 'qa_format'
    };
  }
  
  // Default: guia completo
  return { type: 'informational', urgency: 'low', recommendedTemplate: 'complete_guide' };
}
```

---

## DIMENSÃO 4: TEMPLATE (Estrutura Narrativa)

### 5 Templates Base

| Template | Nome | H2 Range | Word Count (Authority) | Uso Principal |
|----------|------|----------|----------------------|---------------|
| `complete_guide` | Guia Completo | 8-12 | 1.800-3.000 | Conteúdo evergreen |
| `qa_format` | Perguntas & Respostas | 7-10 | 1.500-2.500 | FAQ expandido |
| `comparative` | Comparativo Técnico | 7-10 | 1.500-2.800 | Decisão de compra |
| `problem_solution` | Problema → Solução | 8-12 | 1.600-2.800 | Urgência |
| `educational_steps` | Educacional em Etapas | 9-13 | 1.700-3.000 | How-to |

### Variantes por Template

Cada template possui variantes internas para evitar padrão:

```typescript
const TEMPLATE_VARIANTS = {
  complete_guide: ['chronological', 'importance_based', 'problem_first'],
  qa_format: ['simple_to_complex', 'most_common_first', 'cost_first'],
  comparative: ['pros_cons', 'cost_benefit', 'feature_matrix'],
  problem_solution: ['urgent_first', 'severity_based', 'cost_based'],
  educational_steps: ['beginner_to_advanced', 'linear_process', 'modular_learning']
};
```

### Sistema Anti-Padrão

```
┌─────────────────────────────────────────────────────────────┐
│                   SELEÇÃO DE TEMPLATE                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Classificar intenção da keyword                          │
│ 2. Obter template recomendado                               │
│ 3. Verificar últimos 10 artigos da subconta                 │
│ 4. Se template foi usado 2x nas últimas 3, trocar           │
│ 5. Escolher variante diferente da última usada              │
│ 6. Aplicar rotação de seções (ordem diferente)              │
└─────────────────────────────────────────────────────────────┘
```

---

## DIMENSÃO 5: MODO (Profundidade Editorial)

| Modo | Palavras | H2s | FAQ | Tabelas | Imagens |
|------|----------|-----|-----|---------|---------|
| **Entry** | 800-1.200 | 4-6 | 3-5 | Opcional | 3-5 |
| **Authority** (padrão) | 1.200-3.000 | 8-12 | 8-12 | Obrigatório | 6-10 |

### Quando usar cada modo

- **Authority**: Padrão. Artigos de posicionamento, SEO, autoridade.
- **Entry**: Exceção. Artigos rápidos, trending topics, complementares.

---

## PIPELINE DE GERAÇÃO (12 Etapas)

```
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│  1  │→│  2  │→│  3  │→│  4  │→│  5  │→│  6  │
│Brief│  │Class│  │Templ│  │Rsch │  │Outln│  │Sects│
└─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘
                                                 ↓
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│ 12  │←│ 11  │←│ 10  │←│  9  │←│  8  │←│  7  │
│Valid│  │Links│  │Imgs │  │Tabls│  │ FAQ │  │TL;DR│
└─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘
```

### Etapa 1: Brief do Artigo

```typescript
interface ArticleBrief {
  keyword: string;                    // "desentupidora pinheiros"
  city: string;                       // "São Paulo"
  state: string;                      // "SP"
  subaccount: SubaccountProfile;      // Dados da empresa
  niche: NicheType;                   // "plumbing"
  mode: 'entry' | 'authority';        // "authority"
  webResearch: boolean;               // true
  templateOverride?: TemplateType;    // null (auto-select)
}
```

### Etapa 2: Classificação de Intenção + LSI

Analisa keyword e retorna intenção, urgência, LSI keywords e perguntas relacionadas.

### Etapa 3: Seleção de Template (Anti-Padrão)

Aplica algoritmo de rotação para evitar repetição estrutural.

### Etapa 4: Web Research (Opcional)

Pesquisa via Perplexity para dados atuais, estatísticas, regulações.

### Etapa 5: Outline Estruturado

Gera estrutura completa: H1, meta, seções com H2/H3, target de palavras.

### Etapa 6: Geração de Conteúdo por Seção

Gera cada seção individualmente mantendo coesão.

### Etapa 7: TL;DR (Resumo Executivo)

3 bullets resumindo valor, serviços e CTA.

### Etapa 8: FAQ

8-12 perguntas para Authority, 3-5 para Entry. Schema FAQPage.

### Etapa 9: Inserção de Tabelas e Listas

Tabelas de preço, comparativos. Listas em steps e checklists.

### Etapa 10: Imagens com ALT Local

3-10 imagens com ALT contextualizado: "{{service}} por {{business}} em {{city}}".

### Etapa 11: Links Internos

2-3 links para artigos relacionados da subconta.

### Etapa 12: Validação Final

Checklist de 25 pontos. Bloqueia se não passar.

---

## REGRAS DE OURO (Invioláveis)

### 1. INVISIBILIDADE DA PLATAFORMA

✅ SEMPRE escrever como se fosse a empresa local
❌ NUNCA mencionar OmniSeen, plataforma, sistema, IA

### 2. VARIAÇÃO ESTRUTURAL

✅ Usar 5+ templates diferentes
✅ Variar ordem de seções dentro do template
✅ Não repetir mesmo template 3x seguidas para mesma subconta
❌ Gerar todos os artigos com mesma estrutura

### 3. E-E-A-T LOCAL

✅ Simular experiência local em 2-3 frases por artigo
✅ Mencionar clima, regulação, arquitetura da cidade
✅ Usar "nosso time em {{city}}" ou "atendemos {{city}} há {{years}} anos"
❌ Conteúdo genérico sem contexto geográfico

### 4. QUALIDADE EDITORIAL

✅ Authority = padrão (1.200-3.000 palavras)
✅ Entry = exceção controlada (800-1.200 palavras)
✅ Tabelas em comparações e custos
✅ Listas em steps e checklists
❌ Texto corrido sem estrutura visual

### 5. SEO CLÁSSICO + GEO

✅ Densidade keyword 1-2%
✅ LSI keywords naturalmente inseridos
✅ Títulos informativos (citáveis por IAs)
✅ Blocos de resposta direta (para snippet)
✅ Schema markup (FAQPage, LocalBusiness)
❌ Keyword stuffing ou otimização exagerada

### 6. IMAGENS CONTEXTUALIZADAS

✅ 3-10 imagens por artigo (conforme modo)
✅ ALT: "{{service}} por {{business}} em {{city}}"
✅ Imagens do nicho correto (pragas ≠ telhados)
✅ Distribuídas ao longo do conteúdo
❌ Todas as imagens no topo

---

## CHECKLIST DE VALIDAÇÃO (25 Pontos)

### Estrutura (8 pontos)
- [ ] H1 ≤ 60 caracteres
- [ ] Meta description ≤ 155 caracteres
- [ ] URL slug otimizado
- [ ] TL;DR com 3 bullets
- [ ] Word count dentro do range (modo)
- [ ] 8-12 H2s (authority) ou 4-6 (entry)
- [ ] Keyword density 1-2%
- [ ] 2-3 LSI keywords por seção

### Conteúdo (7 pontos)
- [ ] 1-2 tabelas (authority) ou 0-1 (entry)
- [ ] 3+ listas numeradas/bullets
- [ ] 8-12 FAQ (authority) ou 3-5 (entry)
- [ ] 2-3 frases E-E-A-T local
- [ ] 2-3 menções à cidade
- [ ] CTA local no final
- [ ] ZERO menções a OmniSeen/plataforma

### Visual (4 pontos)
- [ ] 6-10 imagens (authority) ou 3-5 (entry)
- [ ] Todas imagens com ALT local
- [ ] 2-3 links internos
- [ ] Schema FAQPage válido

### Qualidade (6 pontos)
- [ ] Tom consistente com subconta
- [ ] Ofertas da empresa incluídas
- [ ] Compliance do nicho respeitado
- [ ] Template NÃO repetido 3x
- [ ] Variação estrutural presente
- [ ] Conteúdo citável por IAs

---

## ARQUIVOS DO MOTOR

### Frontend (src/lib/article-engine/)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `types.ts` | Interfaces TypeScript |
| `templates.ts` | 5 templates estruturais |
| `niches.ts` | NICHE_RULESETS |
| `intent.ts` | classifyIntent() |
| `index.ts` | Barrel export |

### Backend (supabase/functions/_shared/)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `templateSelector.ts` | Seleção anti-padrão |
| `pipelineStages.ts` | 12 etapas do pipeline |
| `imageAltGenerator.ts` | ALT texts locais |

---

## VERSIONAMENTO

Este documento segue versionamento semântico:

- **v1.0** (2026-01-29): Versão inicial com especificação completa

Alterações devem ser registradas em `docs/ARTICLE_ENGINE_CHANGELOG.md`.
