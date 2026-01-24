
# Fase 1: Refatorar KeywordsTab.tsx - Remover GSC ✅ CONCLUÍDA

## Ação Realizada

Substituído o arquivo `src/components/strategy/KeywordsTab.tsx` removendo **completamente**:

### Removido (~500 linhas de código morto)

1. **Interfaces GSC**:
   - `GSCKeyword`
   - `GSCConnection`

2. **Estados GSC**:
   - `googleClientId`
   - `gscConnection`
   - `isLoadingGSC`
   - `isConnecting`
   - `isFetchingKeywords`
   - `isImporting`
   - `showSiteSelector`
   - `availableSites`
   - `showImportDialog`
   - `gscKeywords`

3. **Funções GSC**:
   - `fetchGSCConfig()`
   - `fetchGSCConnection()`
   - `handleConnectGSC()`
   - `handleOAuthCallback()`
   - `handleSelectSite()`
   - `handleDisconnectGSC()`
   - `handleFetchGSCKeywords()`
   - `handleImportKeywords()`
   - `toggleKeywordSelection()`
   - `selectAllKeywords()`

4. **UI GSC**:
   - Card "Google Search Console"
   - Dialog de seleção de site
   - Dialog de importação de keywords
   - Badge "GSC" no histórico

5. **Imports não utilizados**:
   - `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
   - `Checkbox`
   - `Link`, `CheckCircle`, `ExternalLink`, `Download`, `Unlink`

### Mantido

- ✅ Lógica de keywords internas
- ✅ Análise por IA (`AISuggestKeywordsModal`)
- ✅ Adição manual de keywords
- ✅ Layout base da aba
- ✅ Tutorial de onboarding

## Validação

- ✅ Nenhuma referência a "gsc" no arquivo
- ✅ Nenhum import quebrado
- ✅ Arquivo reduzido de 946 para ~420 linhas

## Próximo Passo

Aguardando OK do usuário antes da Fase 2.
