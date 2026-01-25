
# Redesign Completo: Botão "Levar a 100" e Velocímetro de Score

## Diagnóstico Técnico (Auditoria)

### Problema Identificado

O botão "Levar este artigo a 100" atualmente chama a Edge Function `boost-content-score` que:

1. **Reescreve o artigo inteiro** (linhas 286-321) - O prompt instrui a IA a "otimizar este artigo" e retornar "APENAS o artigo otimizado", não micro-ajustes
2. **Pode reduzir o score** - Embora exista um `scoreGuard` (linhas 431-455), ele apenas bloqueia a atualização do score, mas AINDA aplica o conteúdo reescrito
3. **Executa reescrita destrutiva** - Cada chamada de `callBoost()` no loop substitui completamente o conteúdo

```text
┌─────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL (DESTRUTIVO)                                    │
├─────────────────────────────────────────────────────────────┤
│ runTo100() → callBoost('words') → REESCREVE TUDO            │
│           → callBoost('h2')    → REESCREVE TUDO NOVAMENTE   │
│           → callBoost('terms') → REESCREVE TUDO OUTRA VEZ   │
│           → callBoost('cta')   → REESCREVE TUDO DE NOVO     │
│                                                             │
│ RESULTADO: Artigo original DESTRUÍDO após 4-5 reescritas    │
└─────────────────────────────────────────────────────────────┘
```

---

## Solução Proposta: Otimização Incremental

### Novo Comportamento do Botão

```text
┌─────────────────────────────────────────────────────────────┐
│ FLUXO NOVO (INCREMENTAL)                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Ler score atual                                          │
│ 2. Identificar APENAS os gaps específicos                   │
│ 3. Aplicar MICRO-AJUSTES (não reescrita):                   │
│    - Inserir termos semânticos faltantes                    │
│    - Adicionar H2 se abaixo do mercado                      │
│    - Expandir parágrafos fracos (+50-100 palavras)          │
│    - Melhorar CTA existente                                 │
│ 4. Recalcular score                                         │
│ 5. GARANTIR: newScore >= currentScore                       │
│                                                             │
│ RESULTADO: 81 → 85 → 90 → 95 → 100 (progressão previsível)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

### 1. `supabase/functions/boost-content-score/index.ts`

**Mudança crítica**: Alterar o prompt de IA (linhas 286-321) de "reescreva o artigo" para "faça micro-ajustes preservando 95% do texto original".

Novo prompt incremental:
- "Mantenha EXATAMENTE o texto atual"
- "APENAS insira os termos X, Y, Z nas frases existentes"
- "NÃO reescreva parágrafos - apenas expanda com 1-2 sentenças"
- "RETORNE o diff das mudanças, não o artigo completo"

Adicionar proteção absoluta:
```typescript
// REGRA ABSOLUTA: Se newScore < currentScore, REJEITAR a mudança
if (newScore.total < currentScore.total) {
  return Response.json({
    success: false,
    rejected: true,
    reason: 'score_regression_blocked',
    message: `Otimização rejeitada: score cairia de ${currentScore.total} para ${newScore.total}`
  });
}
```

### 2. `src/hooks/useContentOptimizer.ts`

**Mudança crítica**: O loop `runTo100()` (linhas 262-425) deve:
- Armazenar o score ANTES de cada passo
- Validar que o score SUBIU após cada passo
- Se o score CAIU, reverter para o conteúdo anterior

```typescript
// PROTEÇÃO: Guardar estado anterior
const previousContent = currentContent;
const previousScore = currentScore;

const newContent = await stepFn();
const { newScore } = await calculateScore(newContent);

// VALIDAÇÃO: Score não pode cair
if (newScore < previousScore) {
  console.warn(`[OPTIMIZER] Score regression detected: ${previousScore} → ${newScore}, reverting`);
  currentContent = previousContent;
  // Marcar passo como "skipped" (sem melhoria possível)
} else {
  currentContent = newContent;
  currentScore = newScore;
}
```

### 3. `src/components/editor/ContentScoreGauge.tsx` (Redesign Visual)

**Mudança visual**: Transformar o gauge simples em um velocímetro profissional com:

1. Marcações numéricas: 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100
2. Tracinhos intermediários entre cada dezena
3. Ponteiro animado com transição suave
4. Faixas de cor FIXAS conforme especificado:
   - 🔴 0-49: Vermelho (Ruim)
   - 🟡 50-79: Amarelo (Bom)
   - 🟢 80-100: Verde (Excelente)

```text
         0    10   20   30   40   50   60   70   80   90  100
         |    |    |    |    |    |    |    |    |    |    |
         ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
         [   🔴 RUIM   ][   🟡 BOM   ][   🟢 EXCELENTE  ]
                              ▲
                           ponteiro (ex: 72)
```

### 4. Faixas de Score (Padronização Global)

Criar arquivo `src/lib/scoreThresholds.ts`:

```typescript
export const SCORE_THRESHOLDS = {
  POOR: { min: 0, max: 49, color: '#EF4444', label: 'Ruim', bgClass: 'bg-red-500' },
  GOOD: { min: 50, max: 79, color: '#EAB308', label: 'Bom', bgClass: 'bg-yellow-500' },
  EXCELLENT: { min: 80, max: 100, color: '#22C55E', label: 'Excelente', bgClass: 'bg-green-500' }
} as const;

export function getScoreThreshold(score: number) {
  if (score >= 80) return SCORE_THRESHOLDS.EXCELLENT;
  if (score >= 50) return SCORE_THRESHOLDS.GOOD;
  return SCORE_THRESHOLDS.POOR;
}
```

---

## Implementação em Fases

### Fase 1: Proteção contra regressão (Backend)

1. Atualizar `boost-content-score/index.ts`:
   - Adicionar validação absoluta: `if (newScore < currentScore) { reject }`
   - Retornar erro claro em vez de conteúdo destrutivo

2. Atualizar `useContentOptimizer.ts`:
   - Guardar estado anterior antes de cada passo
   - Reverter se score cair
   - Mostrar mensagem: "Este passo não melhorou o score, pulando..."

### Fase 2: Prompt incremental (Backend)

1. Criar novo prompt em `boost-content-score`:
   - Instruções de micro-ajustes em vez de reescrita
   - Retornar apenas as mudanças, não o artigo completo
   - Limitar scope: máximo 10% do texto pode mudar por iteração

### Fase 3: Novo velocímetro (Frontend)

1. Redesenhar `ContentScoreGauge.tsx`:
   - Adicionar marcações numéricas (0, 10, 20... 100)
   - Adicionar tracinhos intermediários
   - Implementar faixas de cor fixas
   - Animar ponteiro com transição suave

### Fase 4: Padronização global

1. Criar `src/lib/scoreThresholds.ts`
2. Atualizar todos os componentes que usam cores de score:
   - `ScoreStars.tsx`
   - `ValidationScoreCard.tsx`
   - `SEOScoreGauge.tsx`
   - `SEOHealthCard.tsx`
   - `OptimizeTo100Dialog.tsx`

---

## Detalhes Técnicos

### Novo Prompt Incremental (boost-content-score)

```typescript
const incrementalPrompt = `Você é um editor SEO de PRECISÃO CIRÚRGICA.

## REGRA ABSOLUTA
Você NÃO PODE reescrever o artigo. Você APENAS:
1. INSERE termos faltantes nas frases existentes
2. EXPANDE parágrafos com +1-2 sentenças SE necessário
3. AJUSTA H2 existentes ou adiciona 1 novo H2 SE faltando

## ARTIGO ATUAL (95% deve permanecer IDÊNTICO)
${content}

## MICRO-AJUSTES NECESSÁRIOS
${optimizations.map(o => `- ${o}`).join('\n')}

## TERMOS A INSERIR (nas frases já existentes)
${filteredMissingTerms.slice(0, 5).join(', ')}

## FORMATO DE RESPOSTA
Retorne o artigo com as MÍNIMAS mudanças possíveis.
Se não conseguir melhorar sem reescrever, retorne o artigo ORIGINAL.

REGRA: Máximo 10% do texto pode ser alterado.`;
```

### Validação de Não-Regressão

```typescript
// No useContentOptimizer.ts
const validateScoreImprovement = (
  previousScore: number, 
  newScore: number
): { valid: boolean; message: string } => {
  if (newScore < previousScore) {
    return { 
      valid: false, 
      message: `Score caiu de ${previousScore} para ${newScore}. Mudança revertida.` 
    };
  }
  if (newScore === previousScore) {
    return { 
      valid: true, 
      message: `Score mantido em ${newScore}. Nenhuma melhoria possível neste passo.` 
    };
  }
  return { 
    valid: true, 
    message: `Score melhorou: ${previousScore} → ${newScore} (+${newScore - previousScore})` 
  };
};
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Clique → Score cai de 81 para 63 | Clique → Score sobe de 81 para 85 |
| Artigo reescrito completamente | Artigo com micro-ajustes pontuais |
| Usuário perde confiança | Usuário vê progressão previsível |
| Barra de cor genérica | Velocímetro com escala 0-100 |
| Thresholds variáveis | Faixas fixas: 0-49 / 50-79 / 80-100 |

---

## Ordem de Execução

1. ✅ **Fase 1**: Proteção backend (bloquear regressão)
2. ✅ **Fase 2**: Prompt incremental (micro-ajustes)
3. ✅ **Fase 3**: Novo velocímetro visual
4. ✅ **Fase 4**: Padronização de thresholds

Aguardo aprovação para iniciar a implementação.
