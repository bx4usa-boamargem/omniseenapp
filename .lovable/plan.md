
# Fase 1: Refatorar KeywordsTab.tsx - Remover GSC

## Ação Imediata

Substituir o arquivo `src/components/strategy/KeywordsTab.tsx` removendo **completamente**:

### Remover (200+ linhas de código morto)

1. **Interfaces GSC** (linhas 54-70):
   - `GSCKeyword`
   - `GSCConnection`

2. **Estados GSC** (linhas 93-103):
   - `googleClientId`
   - `gscConnection`
   - `isLoadingGSC`
   - `isFetchingKeywords`
   - `showGSCImportModal`
   - `showGSCSiteSelector`
   - `gscSites`

3. **Funções GSC** (linhas 114-283):
   - `fetchGSCConfig()`
   - `fetchGSCConnection()`
   - `handleConnectGSC()`
   - `handleOAuthCallback()`
   - `handleDisconnectGSC()`
   - `handleFetchGSCKeywords()`
   - `handleImportKeywords()`

4. **UI GSC** (linhas 458-530):
   - Card "Google Search Console"
   - Dialogs de seleção de site
   - Modal de importação

### Manter

- Lógica de keywords internas
- Análise por IA (`AISuggestKeywordsModal`)
- Adição manual de keywords
- Layout base da aba

## Validação

Após salvar:
- ✅ Nenhuma referência a "gsc" no arquivo
- ✅ Nenhum import quebrado
- ✅ Build passa sem erros

## Próximo Passo

Aguardar OK do usuário antes da Fase 2.
