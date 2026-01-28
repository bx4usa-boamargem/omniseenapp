
## Objetivo (o que você pediu)
1) O menu flutuante do **ícone “Conteúdo” (lápis)** precisa mostrar os 5 cards (Radar, Gerar Artigo, Meus Artigos, Blog/Portal, Páginas SEO).
2) Hoje, apesar de existir conteúdo no código, **na prática o usuário está vendo o menu vazio / sem nada aparecendo**.

## Diagnóstico (varredura no código – o porquê de você “não estar vendo nada”)
### 1) Os dados do menu “Conteúdo” já existem no projeto
No arquivo:
- `src/components/layout/PremiumSidebar/ContentHubPanel.tsx`

Existe exatamente a lista com:
- Radar de Oportunidades → `/client/radar`
- Gerar Artigo → `/client/articles/new` (com badge “IA”)
- Meus Artigos → `/client/articles`
- Blogs / Portais → `/client/portal`
- Páginas SEO → `/client/landing-pages`

Ou seja: **não falta “injetar dados”** nesse arquivo — eles já estão lá.

### 2) O “vazio” está acontecendo por problema de renderização/visibilidade (CSS/posicionamento)
O `ContentHubPanel` é renderizado como `children` dentro do `HubMenuItem`:
- `src/components/layout/PremiumSidebar/PremiumSidebar.tsx`

O menu flutuante é desenhado assim:
- `src/components/layout/PremiumSidebar/HubMenuItem.tsx`

Ponto crítico:
- O `<nav>` da sidebar usa `overflow-y-auto`.
- O painel flutuante do HubMenuItem é `position: absolute` (classe `absolute left-full top-0`).
- Em CSS, quando um ancestral tem `overflow` diferente de `visible`, **elementos posicionados/overflow podem ser “cortados” (clipped)**.
- Resultado: o painel pode até “abrir”, mas **fica recortado/fora da área visível**, dando a impressão de “conteúdo vazio”.

Isso também explica porque você “abre” Conteúdo e não vê os cards: eles estão sendo renderizados, mas **não aparecem na tela**.

## Solução (abordagem correta e definitiva)
### Estratégia recomendada: “Portal / painel em position: fixed”
Em vez do painel flutuante ficar `absolute` dentro do `<nav>` (que tem overflow e pode cortar), vamos:
1) Medir a posição do botão “Conteúdo” (`getBoundingClientRect()`).
2) Renderizar o painel como `position: fixed` na tela (fora do fluxo do `<nav>`).
3) Garantir z-index alto para ficar sempre acima do layout.
4) Manter o comportamento: abre no hover e no click, fecha ao sair e ao clicar fora.

Essa abordagem elimina 100% os casos de “menu invisível” por overflow.

## Mudanças planejadas (arquivos e o que será feito)

### 1) `src/components/layout/PremiumSidebar/HubMenuItem.tsx`
**Objetivo:** fazer o painel flutuante sempre aparecer e sempre por cima.

Mudanças:
- Trocar o container do painel de:
  - `absolute left-full top-0 ...`
  para:
  - `fixed` com coordenadas calculadas via `containerRef.current.getBoundingClientRect()`
- Guardar no state a posição do painel (top/left) ao abrir.
- Aumentar z-index do overlay e do painel (ex.: overlay `z-[100]`, painel `z-[110]`).
- Adicionar `max-h-[80vh] overflow-y-auto` no painel para não estourar altura.
- (Opcional) adicionar uma borda/sombra consistente para “parecer card premium”.

Resultado esperado:
- Ao hover/click em “Conteúdo”, o menu aparece SEMPRE, com os cards.

### 2) (Se necessário) `src/components/layout/PremiumSidebar/PremiumSidebar.tsx`
**Objetivo:** evitar qualquer conflito de empilhamento (stacking context).
- Ajustar `z-40` do `<aside>` se houver conflito com overlays globais.
- Na maioria dos casos, com painel `fixed` + z-index alto, isso nem será necessário.

### 3) (Validação visual) `src/components/layout/PremiumSidebar/ContentHubPanel.tsx`
**Objetivo:** garantir que o layout final bate exatamente com o que você descreveu.
- Confirmar títulos/subtítulos e rotas:
  - Radar → `/client/radar`
  - Gerar Artigo → `/client/articles/new`
  - Meus Artigos → `/client/articles`
  - Blog / Portal Público → `/client/portal`
  - Páginas SEO → `/client/landing-pages`
- Confirmar que “Gerar Artigo” está destacado com badge “IA”.

Obs.: este arquivo já está correto; aqui é apenas validação e pequenos ajustes de texto se você quiser “Blog / Portal Público” exatamente.

## Critérios de aceite (o que você vai testar na tela)
1) No Desktop:
   - Passar o mouse em “Conteúdo” → aparece o painel flutuante com os 5 cards.
   - Clicar em “Conteúdo” → painel também abre (sem ficar “vazio”).
   - Clicar fora → fecha.
   - Clicar em cada card → navega para a rota certa e fecha o painel.

2) Em telas com scroll/overflow:
   - Mesmo com o `<nav>` scrollável, o painel não some e não fica cortado.

## Plano de execução (ordem)
1) Ajustar `HubMenuItem.tsx` para renderizar painel em `fixed` com posição calculada.
2) Ajustar z-index/overlay e adicionar `max-h`/scroll interno.
3) Validar textos/rotas no `ContentHubPanel.tsx` (se quiser ajustes de nomenclatura).
4) Teste completo no /client/dashboard (desktop) e no mobile drawer (mobile já usa accordion e não depende do flutuante).

## Observação importante
O mobile **não está vazio** pelo mesmo motivo, porque no mobile o “Conteúdo” é um accordion renderizado dentro do drawer (não é um painel flutuante absoluto). O problema está concentrado no **desktop** por causa de overflow/posicionamento do painel flutuante.
