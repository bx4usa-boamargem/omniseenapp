
## Objetivo (rollback total imediato)
Restaurar o projeto para a **última versão estável** (antes das mudanças recentes), de forma segura e rápida, usando os recursos de **Histórico/Restore** do Lovable (em vez de comandos Git).

---

## Por que não vou executar “git reset --hard” aqui
No ambiente do Lovable eu não tenho acesso para rodar comandos Git/CLI nem fazer force-push. O caminho correto e mais seguro é o **History (Histórico de edições)** do Lovable, que é justamente feito para rollback rápido.

---

## Passo a passo do rollback total (o que você faz agora)
### 1) Abrir o Histórico
1. No topo do chat, clique em **History** (Histórico).
2. Você verá uma lista de edições/alterações (como “Improve AI tool call resilience”, “Emergency rollback”, etc.).

### 2) Encontrar a versão estável
Procure a última edição onde o sistema “estava bom”, tipicamente:
- Antes de qualquer mudança relacionada a:
  - “Improve AI tool call resilience”
  - “Fallback JSON extraction”
  - “Emergency rollback”
  - Alterações de geração de imagens/score recentes

Dica prática:
- Abra 1–3 versões anteriores em “Preview” (quando disponível) para checar rapidamente se o comportamento voltou.

### 3) Restaurar a versão
- Clique em **Restore** na versão estável escolhida.
- Aguarde o rebuild/atualização do preview.

### 4) Hard refresh / cache
Após o restore:
- Faça **hard refresh** (Ctrl+Shift+R / Cmd+Shift+R).
- Se ainda estiver estranho, abra em **aba anônima** para evitar cache e localStorage interferindo.

---

## Validação pós-rollback (checklist objetivo)
### A) Confirmação visual de “1 editor”
- Navegue pelo fluxo de artigos e confirme se existe **um único caminho principal** para editar artigos (sem duplicidade/confusão).

### B) Teste de geração (quando houver crédito de IA)
- Gere 1 artigo teste (ex.: “Dedetização em [cidade]”).
- Verifique:
  - Estrutura (H2/H3 coerentes, metas SEO dentro dos limites)
  - Presença de imagens conforme esperado
  - E-E-A-T presente quando habilitado
  - Tempo total “normal” (aprox. esperado do seu baseline)

> Observação crítica: se o aviso “AI balance acabou” continuar, a geração não vai executar (não é bug do código). Ainda assim, o rollback garante que, ao retornar os créditos, o comportamento volte ao baseline estável.

### C) Conferência rápida do que deve ter voltado
Após o restore, o estado “estável” deve refletir principalmente nestes pontos:
- `supabase/functions/generate-article-structured/index.ts` sem as mudanças problemáticas (retry/fallback agressivo etc.)
- `src/pages/client/ArticleGenerator.tsx` e/ou fluxo de geração consistente (sem defaults quebrados)
- Fluxo do editor principal sem duplicidade

---

## Se o problema “2 editores” persistir mesmo após rollback
Isso normalmente indica que:
- O “editor duplicado” já existia antes (não era só mudança recente), ou
- Há rotas/menu apontando para duas telas diferentes, e o rollback escolhido ainda não era o ponto “antes” disso.

Ação nesse caso:
1. Volte ao History e teste **mais 1–3 versões ainda mais antigas**.
2. Anote quais rotas aparecem no menu para “Editar artigo” (ex.: /client/articles/... vs /client/editor/...) para eu mapear com precisão depois.

---

## Plano de contingência (se não achar a versão estável rapidamente)
1. Escolher uma versão de ~48h atrás (como você sugeriu).
2. Restaurar.
3. Confirmar rapidamente se o menu e as rotas do editor voltaram ao normal.
4. Só então testar geração (quando o crédito permitir).

---

## Entregáveis (resultado esperado após concluir)
- Projeto restaurado para uma edição estável
- Interface sem “confusão de 2 editores” (ou, no mínimo, reduzida ao comportamento antigo)
- Fluxo de geração e preview no baseline anterior assim que a IA estiver disponível

