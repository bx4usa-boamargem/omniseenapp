
# Fase 2: Execução - Remover GSC das Edge Functions

## Arquivo 1: `supabase/functions/send-weekly-report/index.ts`

### Linhas a Remover (total: ~90 linhas de código GSC)

| Bloco | Linhas | Descrição |
|-------|--------|-----------|
| Variável gscInsights | 94-100 | Declaração da variável e tipagem |
| Query gsc_connections | 102-107 | Busca de conexão GSC ativa |
| Bloco condicional GSC | 109-177 | Toda lógica de fetch e cálculo GSC |
| Seção HTML GSC | 206-234 | Bloco "Insights do Google Search Console" no email |

### Código Mantido

- Métricas de performance (linhas 179-196, 236-272)
- Oportunidades sugeridas (linhas 274-285)
- Recomendações automáticas (linhas 287-312)
- Envio de email (linhas 327-353)
- Toda infraestrutura base

---

## Arquivo 2: `supabase/functions/support-chat/index.ts`

### Linhas a Remover (2 linhas)

| Linhas | Conteúdo Exato |
|--------|----------------|
| 88-89 | `🔗 INTEGRAÇÕES (/client/integrations/gsc)` e `- Google Search Console: conectar, sincronizar dados` |

### Código Mantido

- Todo o resto do systemPrompt (140+ linhas)
- Lógica de contexto por página (linhas 160-183)
- Handler de chat com IA (linhas 189-226)

---

## Sequência de Execução

```text
┌─────────────────────────────────────────────────────┐
│ 1. Editar send-weekly-report/index.ts               │
│    └─> Remover 4 blocos GSC (~90 linhas)            │
├─────────────────────────────────────────────────────┤
│ 2. Executar Build                                   │
│    └─> Confirmar: "Build passou sem erros"          │
├─────────────────────────────────────────────────────┤
│ 3. Editar support-chat/index.ts                     │
│    └─> Remover 2 linhas do prompt (88-89)           │
├─────────────────────────────────────────────────────┤
│ 4. Executar Build                                   │
│    └─> Confirmar: "Build passou sem erros"          │
├─────────────────────────────────────────────────────┤
│ 5. Validação Final                                  │
│    └─> grep "gsc" = 0 ocorrências                   │
└─────────────────────────────────────────────────────┘
```

---

## Validação Pós-Execução

Após cada arquivo:
- Nenhuma referência a "gsc", "GSC", "Search Console"
- Nenhum import quebrado
- Build compila sem erros
- Edge functions deployam corretamente

## Resultado Esperado

| Arquivo | Antes | Depois | Redução |
|---------|-------|--------|---------|
| send-weekly-report/index.ts | 379 linhas | ~289 linhas | ~90 linhas |
| support-chat/index.ts | 235 linhas | 233 linhas | 2 linhas |

## Próximo Passo

Aguardar confirmação explícita de build limpo após cada arquivo antes de prosseguir.
