

# Plano: Remoção Completa de GSC e Landing Pages (Fases 1-7)

## Objetivo
Remover **completamente** todas as funcionalidades de Google Search Console e Landing Pages, mantendo a estabilidade da plataforma e sem executar DROP TABLE.

---

## Resumo de Alterações

### Arquivos a DELETAR (39+ arquivos)

| Categoria | Arquivos |
|-----------|----------|
| **Páginas GSC/LP** | 7 páginas |
| **Componentes GSC** | 14 componentes |
| **Componentes Landing** | 14+ arquivos (diretório) |
| **Hooks** | 2 hooks |
| **Edge Functions** | 12 funções |

### Arquivos a EDITAR (9 arquivos)

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Remover imports e rotas |
| `src/components/layout/SubAccountLayout.tsx` | Remover itens de menu |
| `src/hooks/useValueProofMetrics.ts` | Remover queries GSC |
| `src/components/dashboard/ValueProofDashboard.tsx` | Remover cards GSC |
| `src/components/blog-editor/ScriptsIntegrationsTab.tsx` | Remover seção GSC |
| `src/components/strategy/KeywordsTab.tsx` | Remover lógica GSC |
| `supabase/functions/send-weekly-report/index.ts` | Remover bloco GSC |
| `supabase/functions/support-chat/index.ts` | Remover referência GSC |
| `src/i18n/locales/pt-BR.json` | Remover entrada "gsc" |
| `supabase/config.toml` | Remover `generate-landing-page` |

---

## Fase 1: Editar App.tsx

### Remover Imports (linhas 67-68, 80-81, 97-99)
- `GoogleIntegration`
- `GoogleOAuthCallback`
- `ClientGSCIntegration`
- `ClientPerformance`
- `ClientLandingPages`
- `ClientLandingPageNew`
- `ClientLandingPageEdit`

### Remover Rotas
- Linha 185-187: Landing pages
- Linha 197: GSC integration
- Linha 234: OAuth Google callback

---

## Fase 2: Editar Menu (SubAccountLayout.tsx)

### Remover da seção CONTEÚDO (linha 70)
```typescript
// REMOVER
{ icon: Layout, label: 'Landing Pages', path: '/client/landing-pages' },
```

### Remover seção INTEGRAÇÕES completa (linhas 87-89 e 217-225)
```typescript
// REMOVER TODO O BLOCO
const integrationItems: NavItem[] = [
  { icon: Search, label: 'Google Search Console', path: '/client/integrations/gsc' },
];
```

### Remover import do ícone Layout (linha 21)

---

## Fase 3: Refatorar Dependências

### 3.1 useValueProofMetrics.ts
Remover todas as queries a tabelas GSC:
- Linhas 97-102: Query a `gsc_connections`
- Linhas 104-117: Queries a `gsc_queries_history`
- Linhas 119-132: Queries a `gsc_analytics_history`

Definir valores padrão:
- `gscConnected: false`
- `rankedKeywords: 0`
- `keywordsDelta: null`
- `avgPosition: null`
- `positionDelta: null`

### 3.2 ValueProofDashboard.tsx
Remover os cards que dependem de GSC:
- Linhas 188-209: Card "Palavras Ranqueadas"
- Linhas 224-246: Card "Posição Média"

Ajustar grid de 5 para 3 colunas.

### 3.3 ScriptsIntegrationsTab.tsx
- Remover import `useGSCConnection` (linha 19)
- Remover estado de conexão (linha 52-53)
- Remover Card "Google Search Console" (linhas 118-157)

### 3.4 KeywordsTab.tsx
Remover toda lógica GSC:
- Linhas 54-70: Interfaces GSC
- Linhas 93-103: Estados GSC
- Linhas 114-153: Fetch GSC config/connection
- Linhas 155-283: Handlers GSC (connect, disconnect, fetch, import)
- Linhas 458-530: Card "Google Search Console"

### 3.5 send-weekly-report/index.ts
Remover bloco de insights GSC (linhas 94-177):
- Verificação de `gsc_connections`
- Queries a `gsc_queries_history`
- Queries a `gsc_analytics_history`
- Bloco HTML de insights GSC

### 3.6 support-chat/index.ts
Remover referência a GSC (linha 88):
```typescript
// REMOVER
🔗 INTEGRAÇÕES (/client/integrations/gsc)
- Google Search Console: conectar, sincronizar dados
```

---

## Fase 4: Deletar Páginas

### Páginas a deletar:
1. `src/pages/GoogleIntegration.tsx`
2. `src/pages/GoogleOAuthCallback.tsx`
3. `src/pages/client/ClientGSCIntegration.tsx`
4. `src/pages/client/ClientPerformance.tsx`
5. `src/pages/client/ClientLandingPages.tsx`
6. `src/pages/client/ClientLandingPageNew.tsx`
7. `src/pages/client/ClientLandingPageEdit.tsx`

---

## Fase 5: Deletar Componentes

### Componentes GSC (diretório completo):
```
src/components/gsc/ (3 arquivos)
├── GSCConfigChecker.tsx
├── GSCSetupGuide.tsx
└── GSCTestConnection.tsx
```

### Componentes SEO relacionados a GSC (11 arquivos):
```
src/components/seo/
├── GSCAlertManager.tsx
├── GSCConnectionCard.tsx
├── GSCDateRangeSelector.tsx
├── GSCGoogleSearchTab.tsx
├── GSCOmniseenTab.tsx
├── GSCOverviewCards.tsx
├── GSCPeriodComparison.tsx
├── GSCRankingEvolution.tsx
├── GSCTopPages.tsx
├── GSCTopQueries.tsx
└── GSCTrendChart.tsx
```

### Componentes Landing Pages (diretório completo):
```
src/components/client/landingpage/ (14+ arquivos)
├── LandingPageEditor.tsx
├── LandingPagePreview.tsx
├── blocks/
│   ├── index.ts
│   ├── AreasServedBlock.tsx
│   ├── CTABannerBlock.tsx
│   ├── ContactFormBlock.tsx
│   ├── EmergencyBannerBlock.tsx
│   ├── FAQBlock.tsx
│   ├── HeroBlock.tsx
│   ├── ProcessStepsBlock.tsx
│   ├── ServiceCardsBlock.tsx
│   ├── ServiceDetailBlock.tsx
│   ├── TestimonialsBlock.tsx
│   └── WhyChooseUsBlock.tsx
├── hooks/
│   └── useLandingPages.ts
└── types/
    └── landingPageTypes.ts
```

### Componentes Consultant (dependentes de GSC):
```
src/components/consultant/
├── SearchConsoleMetricsBar.tsx
├── SearchConsoleTable.tsx
└── tabs/SearchPerformanceTab.tsx
```

### Componentes Client:
```
src/components/client/
└── KeywordsTable.tsx
```

---

## Fase 6: Deletar Hooks

```
src/hooks/
├── useGSCConnection.ts
└── useGSCAnalytics.ts
```

---

## Fase 7: Deletar Edge Functions e Atualizar Config

### Edge Functions GSC a deletar (10):
```
supabase/functions/
├── check-gsc-alerts/
├── disconnect-gsc/
├── fetch-gsc-analytics/
├── fetch-gsc-keywords/
├── get-gsc-config/
├── gsc-callback/
├── gsc-fetch-performance/
├── gsc-list-properties/
├── gsc-select-site/
└── import-gsc-keywords/
```

### Edge Functions Landing Pages a deletar (2):
```
supabase/functions/
├── generate-landing-page/
└── landing-chat/
```

### Atualizar supabase/config.toml
Remover:
```toml
[functions.generate-landing-page]
verify_jwt = false
```

### Atualizar traduções pt-BR.json
Remover linhas 58-61 (bloco "gsc")

---

## Fase 8: Migration SQL (Arquivamento - SEM DROP)

Será criada uma migration que **renomeia** as tabelas para `__archive`:

```sql
-- Arquivar tabelas GSC e Landing Pages (reversível)
-- NÃO usa CASCADE, apenas renomeia

-- GSC Tables
ALTER TABLE IF EXISTS public.gsc_connections 
  RENAME TO gsc_connections__archive;

ALTER TABLE IF EXISTS public.gsc_queries_history 
  RENAME TO gsc_queries_history__archive;

ALTER TABLE IF EXISTS public.gsc_pages_history 
  RENAME TO gsc_pages_history__archive;

ALTER TABLE IF EXISTS public.gsc_analytics_history 
  RENAME TO gsc_analytics_history__archive;

-- Landing Pages
ALTER TABLE IF EXISTS public.landing_pages 
  RENAME TO landing_pages__archive;

-- Comentário para restauração futura:
-- Para reverter: ALTER TABLE public.xxx__archive RENAME TO xxx;
```

---

## Ordem de Execução

1. **Editar dependências** (useValueProofMetrics, ValueProofDashboard, ScriptsIntegrationsTab, KeywordsTab, send-weekly-report, support-chat)
2. **Editar rotas** (App.tsx)
3. **Editar menu** (SubAccountLayout.tsx)
4. **Deletar páginas** (7 arquivos)
5. **Deletar componentes** (30+ arquivos/diretórios)
6. **Deletar hooks** (2 arquivos)
7. **Deletar edge functions** (12 diretórios)
8. **Atualizar traduções** (pt-BR.json)
9. **Atualizar config.toml**
10. **Propor migration SQL** (arquivamento)

---

## Menu Final Resultante

```
RESULTADOS
├── Resultados & ROI
└── Leads Capturados

INTELIGÊNCIA
├── Radar de Oportunidades
└── Análise de SEO

CONTEÚDO
├── Artigos
└── Portal Público

OPERAÇÃO
├── Automação
├── Territórios
├── Minha Empresa
├── Minha Conta
├── Domínios
└── Ajuda

ADMINISTRAÇÃO (admin only)
└── Painel Admin
```

---

## Validação Final

Após implementação completa:
- [ ] Build sem erros
- [ ] Nenhuma rota quebrada (404)
- [ ] Nenhum import morto
- [ ] Menu sem referências a GSC ou Landing Pages
- [ ] Dashboard funcional sem cards GSC
- [ ] KeywordsTab funcional sem seção GSC
- [ ] Varredura por "gsc_" e "landing" limpa

