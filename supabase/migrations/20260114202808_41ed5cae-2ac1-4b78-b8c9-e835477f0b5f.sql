-- Update help articles with rich content (400-600 words each)

UPDATE help_articles SET content = '## O que é o Radar de Oportunidades?

O Radar é o sensor de mercado da Omniseen. Ele monitora constantemente o que as pessoas estão buscando na sua região e nicho, identificando demandas reais que você pode atender com conteúdo estratégico.

Diferente de ferramentas genéricas de palavras-chave, o Radar cruza:
- Buscas locais no Google
- Tendências sazonais
- Gaps de conteúdo dos seus concorrentes
- Intenção de compra por estágio do funil

O resultado? Uma lista priorizada de oportunidades com score de relevância que indica o potencial de cada tema.

## Como interpretar o Score de Relevância

O score vai de 0 a 100 e considera demanda, concorrência e potencial de conversão:

| Score | Significado | Ação Recomendada |
|-------|-------------|------------------|
| 90-100 | 🔥 Oportunidade quente | Criar imediatamente |
| 70-89 | ✅ Boa oportunidade | Priorizar esta semana |
| 50-69 | ⏳ Potencial moderado | Avaliar contexto |
| <50 | ❄️ Baixa prioridade | Ignorar por ora |

💡 **Dica**: Comece sempre pelas oportunidades 90+. São temas com demanda comprovada e baixa concorrência local.

## Criando um artigo a partir do Radar

1. **Acesse o Radar** → Menu lateral > Radar de Oportunidades
2. **Analise as oportunidades** → Veja o score, tendência e justificativa da IA
3. **Clique em "Criar Artigo"** → O sistema inicia a geração automaticamente
4. **Acompanhe o progresso** → Barra de progresso mostra: Analisando → Gerando → Imagens → Finalizando
5. **Revise o rascunho** → Você é redirecionado ao editor para ajustes finais

⚠️ **Erro comum**: Ignorar oportunidades por não entender o tema. Confie na IA - ela analisa demanda real, não achismo.

## Estratégia de priorização semanal

Uma rotina eficaz para maximizar resultados:

1. **Segunda-feira**: Consulte o Radar e liste as top 5 oportunidades
2. **Terça a Quarta**: Crie 2-3 artigos das oportunidades com score 90+
3. **Quinta**: Revise e publique os rascunhos gerados
4. **Sexta**: Analise performance da semana e ajuste estratégia

💡 **Dica avançada**: Ative o Autopilot de Funil para converter oportunidades automaticamente em rascunhos enquanto você foca em outras tarefas do negócio.

## Por que artigos do Radar performam melhor?

Quando você cria conteúdo baseado em demanda real (ao invés de intuição), você:

- **Aparece nas buscas certas** → Pessoas já estão procurando isso ativamente
- **Converte mais** → O tema ressoa com dores reais do seu mercado local
- **Economiza tempo** → Não desperdiça energia em temas sem demanda comprovada
- **Ganha autoridade** → Conteúdo relevante atrai links e compartilhamentos

📌 **Próximo passo**: Após dominar o Radar, configure a Automação para manter seu blog sempre atualizado com conteúdo de alta demanda.' 
WHERE slug = 'usando-radar-oportunidades' OR title ILIKE '%radar%';

UPDATE help_articles SET content = '## O que é a Automação Omniseen?

A automação é o coração operacional da plataforma. Ela permite que você configure uma esteira de produção de conteúdo que funciona 24 horas por dia, 7 dias por semana, sem intervenção manual.

Com a automação ativada, o sistema:
- Identifica oportunidades no Radar automaticamente
- Gera artigos otimizados para SEO
- Cria imagens exclusivas para cada conteúdo
- Agenda publicações nos melhores horários
- Mantém seu blog sempre atualizado

## Como ativar a Automação

1. **Acesse Automação** → Menu lateral > Operação > Automação
2. **Configure a frequência** → Escolha quantos artigos por semana
3. **Defina os dias preferidos** → Selecione os melhores dias para publicar
4. **Escolha o horário** → Defina quando os artigos serão publicados
5. **Ative o sistema** → Clique no botão "Ativar Automação"

💡 **Dica**: Comece com 2-3 artigos por semana e aumente gradualmente conforme vê resultados.

## Entendendo os modos de automação

### Modo Manual
Você decide manualmente quando criar cada artigo. Ideal para quem quer controle total sobre o conteúdo.

### Modo Automático
O sistema cria artigos automaticamente baseado nas oportunidades do Radar. Você só precisa revisar e aprovar.

### Autopilot de Funil
O modo mais avançado. O sistema distribui artigos automaticamente entre topo, meio e fundo de funil, criando uma jornada completa para seus clientes.

## Configurando o Autopilot de Funil

O Autopilot distribui conteúdo estrategicamente:

| Estágio | Objetivo | % Recomendado |
|---------|----------|---------------|
| Topo | Atrair visitantes | 50% |
| Meio | Educar e engajar | 30% |
| Fundo | Converter em leads | 20% |

⚠️ **Erro comum**: Criar apenas conteúdo de fundo de funil. Isso limita seu alcance e não constrói autoridade.

## Monitorando a Fila de Produção

A aba "Fila" mostra todos os artigos em processamento:

- **Pendentes**: Aguardando geração
- **Em andamento**: Sendo gerados agora
- **Concluídos**: Prontos para revisão
- **Falhas**: Artigos que precisam de atenção

💡 **Dica**: Artigos que falharam geralmente são temas muito específicos. Tente reformular ou ignore.

## Melhores práticas de automação

1. **Revise semanalmente** → Mesmo com automação, dê uma olhada nos rascunhos
2. **Ajuste o tom** → Configure o tom de voz em Minha Empresa
3. **Monitore resultados** → Veja quais temas performam melhor
4. **Escale gradualmente** → Aumente a frequência conforme os resultados

📌 **Próximo passo**: Após ativar a automação, configure seus Territórios para receber oportunidades mais relevantes para sua região de atuação.' 
WHERE slug = 'configurando-automacao' OR title ILIKE '%automa%';

UPDATE help_articles SET content = '## O que são Resultados & ROI?

A página de Resultados é o painel de controle financeiro do seu blog. Aqui você vê o impacto real do seu conteúdo em métricas que importam: visibilidade, engajamento e oportunidades de negócio.

Diferente de analytics genéricos, o Omniseen traduz visualizações em valor monetário baseado na economia do seu negócio.

## Entendendo as métricas principais

### Aproveitamento do Radar
Mede quantas oportunidades do Radar você transformou em artigos. Indica sua disciplina de execução do plano estratégico.

**Cálculo**: (Artigos criados do Radar ÷ Oportunidades de alto score) × 100

| Taxa | Avaliação | Ação |
|------|-----------|------|
| 80%+ | 🏆 Excelente | Mantenha o ritmo |
| 50-79% | ✅ Bom | Pode melhorar |
| <50% | ⚠️ Baixo | Priorize o Radar |

### Exposição Comercial
Conta leituras qualificadas (mais de 60% do artigo lido). Indica pessoas que realmente consumiram seu conteúdo.

### Intenção Comercial
Conta cliques no CTA (Call-to-Action). Indica pessoas interessadas em seu serviço.

## Configurando a Economia do Negócio

Para calcular o ROI real, configure em Minha Empresa:

1. **Ticket Médio** → Quanto você cobra em média por cliente
2. **Taxa de Fechamento** → % de leads que viram clientes
3. **Margem** → Sua margem de lucro

💡 **Dica**: Seja realista nesses números. Dados inflados geram expectativas irreais.

## Interpretando o ROI Real

O ROI é calculado assim:

1. **Valor por Exposição** = 10% do (Ticket × Taxa de Fechamento × Margem)
2. **Valor por Intenção** = 150% do (Ticket × Taxa de Fechamento × Margem)
3. **ROI Total** = Soma dos valores × Quantidade de eventos

### Exemplo prático
- Ticket médio: R$ 5.000
- Taxa fechamento: 20%
- Margem: 30%
- Valor por intenção: 150% × (5.000 × 0.20 × 0.30) = R$ 450

Se você teve 10 cliques no CTA, o valor estimado é R$ 4.500.

## Performance de Busca (Google)

Esta aba mostra dados do Google Search Console:

- **Impressões**: Quantas vezes seu site apareceu no Google
- **Cliques**: Quantas pessoas clicaram
- **CTR**: Taxa de clique (Cliques ÷ Impressões)
- **Posição média**: Sua posição média nos resultados

⚠️ **Erro comum**: Focar apenas em posição. CTR baixo com boa posição indica problema no título.

## Melhorando seus resultados

1. **Crie mais conteúdo de alto score** → Use o Radar
2. **Otimize títulos** → Aumente o CTR
3. **Melhore CTAs** → Aumente conversões
4. **Revise economia** → Atualize valores conforme seu negócio cresce

📌 **Próximo passo**: Configure a economia do seu negócio em Minha Empresa para ter projeções de ROI mais precisas.' 
WHERE slug = 'entendendo-resultados-roi' OR title ILIKE '%resultado%' OR title ILIKE '%roi%';

UPDATE help_articles SET content = '## O que é o SEO no Omniseen?

SEO (Search Engine Optimization) é o conjunto de técnicas que fazem seu conteúdo aparecer no Google. A Análise de SEO do Omniseen é um consultor técnico automatizado que avalia cada artigo e sugere melhorias.

O sistema analisa automaticamente:
- Estrutura de títulos (H1, H2, H3)
- Meta descriptions
- Uso de palavras-chave
- Tamanho do conteúdo
- Imagens e alt text
- Links internos

## Entendendo o Score de SEO

Cada artigo recebe uma nota de 0 a 100:

| Score | Classificação | Significado |
|-------|---------------|-------------|
| 90-100 | 🏆 Excelente | Otimizado para rankear |
| 70-89 | ✅ Bom | Pequenos ajustes necessários |
| 50-69 | ⚠️ Regular | Precisa de melhorias |
| <50 | ❌ Crítico | Revisão urgente |

💡 **Dica**: Foque primeiro nos artigos com score abaixo de 70 que já estão publicados.

## Critérios de avaliação

### Título (H1)
- Ideal: 50-60 caracteres
- Deve conter a palavra-chave principal
- Deve ser único e atrativo

### Meta Description
- Ideal: 140-160 caracteres
- Deve resumir o conteúdo
- Deve ter call-to-action sutil

### Conteúdo
- Mínimo: 300 palavras (artigos curtos penalizam)
- Ideal: 800-1500 palavras
- Deve ter estrutura clara com subtítulos

### Palavras-chave
- Mínimo: 3 palavras-chave
- Ideal: 5-7 palavras-chave relacionadas
- Devem aparecer naturalmente no texto

## Otimizando artigos existentes

1. **Acesse Análise de SEO** → Menu > Inteligência > Análise de SEO
2. **Identifique artigos críticos** → Filtre por score baixo
3. **Clique em "Otimizar"** → A IA sugere melhorias
4. **Revise as sugestões** → Aceite ou ajuste conforme necessário
5. **Salve e republique** → Alterações são aplicadas imediatamente

⚠️ **Erro comum**: Otimizar artigos já bons (90+). Foque nos que realmente precisam.

## Acompanhando a evolução

A aba de Tendências mostra:
- Score médio ao longo do tempo
- Quantidade de artigos por faixa de score
- Melhoria após otimizações

### Metas recomendadas
- **Semana 1**: Todos os artigos acima de 50
- **Semana 2**: 80% dos artigos acima de 70
- **Semana 4**: 50% dos artigos acima de 80

## Melhores práticas de SEO

1. **Escreva para humanos primeiro** → Google valoriza conteúdo útil
2. **Use subtítulos descritivos** → Facilitam a leitura
3. **Inclua imagens com alt text** → Acessibilidade melhora SEO
4. **Crie links internos** → Conecte artigos relacionados
5. **Atualize conteúdo antigo** → Artigos atualizados rankeiam melhor

📌 **Próximo passo**: Execute uma otimização em lote nos artigos com score abaixo de 70 para ver resultados rápidos.' 
WHERE slug = 'otimizando-seo-artigos' OR title ILIKE '%seo%';

UPDATE help_articles SET content = '## Por que personalizar seu portal?

O Portal Público é a vitrine do seu negócio. É onde seus potenciais clientes chegam, leem seu conteúdo e decidem se confiam em você. Uma boa personalização:

- Transmite profissionalismo
- Reforça sua marca
- Aumenta a confiança do visitante
- Melhora a conversão

## Configurações essenciais

### Logo
Sua marca é o primeiro elemento que o visitante vê. Recomendações:
- Formato: PNG com fundo transparente
- Tamanho: Mínimo 200px de largura
- Versões: Clara (para fundo escuro) e escura (para fundo claro)

### Cores da marca
O sistema aplica suas cores automaticamente em:
- Botões e links
- Destaques e badges
- Gradientes do hero
- Ícones e elementos interativos

💡 **Dica**: Use cores que contrastem bem. Evite cores muito claras que dificultam leitura.

### Banner Hero
A imagem de destaque no topo do blog:
- Resolução recomendada: 1920x600px
- Opacidade do overlay: 30-80% (ajuste para legibilidade)
- Inclua título e descrição impactantes

## Configurando o CTA (Call-to-Action)

O CTA aparece em cada artigo e é crucial para conversão:

### Opções de CTA
1. **WhatsApp**: Link direto para conversa
2. **E-mail**: Abre cliente de e-mail
3. **Link externo**: Direciona para landing page
4. **Formulário**: Captura leads no próprio blog

### Escrevendo um bom CTA
- Seja específico: "Agende sua consulta" > "Clique aqui"
- Crie urgência: "Vagas limitadas" ou "Só esta semana"
- Destaque benefício: "Diagnóstico grátis"

⚠️ **Erro comum**: CTAs genéricos como "Saiba mais". Seja direto sobre o que você oferece.

## Configurando informações do autor

A seção de autor aparece em cada artigo e aumenta credibilidade:

1. **Nome**: Seu nome ou da empresa
2. **Bio**: 2-3 frases sobre sua expertise (máx 160 caracteres)
3. **Foto**: Imagem profissional (recomendado)
4. **LinkedIn**: Link para perfil profissional

💡 **Dica**: Bio com dados concretos converte mais: "15 anos de experiência" > "Especialista na área".

## Recursos avançados

### Scripts personalizados
Para tracking adicional (Google Analytics, Facebook Pixel, etc):
- **Head**: Scripts que carregam antes do conteúdo
- **Body**: Scripts que carregam com o conteúdo
- **Footer**: Scripts que carregam por último

⚠️ **Atenção**: Scripts incorretos podem quebrar o site. Teste sempre.

### Domínio próprio
Para usar seu domínio (ex: blog.suaempresa.com.br):
1. Acesse Minha Conta
2. Vá em Domínio Personalizado
3. Siga as instruções de DNS

## Checklist de lançamento

Antes de divulgar seu blog, verifique:
- [ ] Logo carregado corretamente
- [ ] Cores da marca aplicadas
- [ ] Banner hero configurado
- [ ] CTA funcionando
- [ ] Informações do autor preenchidas
- [ ] Pelo menos 3 artigos publicados

📌 **Próximo passo**: Após personalizar, copie o link público e divulgue nas suas redes sociais e WhatsApp Business.' 
WHERE slug = 'personalizando-portal-publico' OR title ILIKE '%portal%' OR title ILIKE '%personaliz%';

UPDATE help_articles SET content = '## Primeiros passos na Omniseen

Bem-vindo à Omniseen! Esta plataforma foi criada para transformar seu blog em uma máquina de atração de clientes. Em poucos minutos, você terá tudo configurado para começar a gerar conteúdo que converte.

## O que você precisa configurar

### 1. Perfil da empresa (Minha Empresa)
Configure informações básicas do seu negócio:
- Nome da empresa
- Nicho de atuação
- Serviços oferecidos
- Cidade/região de atuação
- Tom de voz desejado

💡 **Dica**: Quanto mais detalhado, melhor a IA escreve para você.

### 2. Economia do negócio
Para calcular seu ROI, informe:
- Ticket médio
- Taxa de fechamento
- Margem de lucro

### 3. Portal público (aparência)
Personalize a cara do seu blog:
- Upload do logo
- Cores da marca
- Banner hero
- CTA (Call-to-Action)

### 4. Primeiro artigo
Crie seu primeiro conteúdo:
- Use o Radar para encontrar um tema relevante
- Deixe a IA gerar o artigo
- Revise e publique

## Roteiro de configuração inicial

**Dia 1 - Setup básico** (30 minutos)
1. Complete Minha Empresa
2. Configure cores e logo
3. Crie 1 artigo de teste

**Dia 2 - Produção** (20 minutos)
1. Explore o Radar de Oportunidades
2. Crie 2-3 artigos
3. Publique o primeiro

**Dia 3 - Otimização** (15 minutos)
1. Revise os artigos gerados
2. Ajuste o tom se necessário
3. Ative a automação

## Checklist de lançamento

Antes de divulgar seu blog:
- [ ] Logo e cores configurados
- [ ] CTA funcionando corretamente
- [ ] Pelo menos 3 artigos publicados
- [ ] Economia do negócio preenchida
- [ ] Automação ativada

## Onde buscar ajuda

### Central de Ajuda
Você está aqui! Artigos detalhados sobre cada funcionalidade.

### Assistente de IA
O chat no canto da tela responde dúvidas instantaneamente.

### Suporte humano
Para questões complexas, envie e-mail para suporte@omniseen.app.

## Erros comuns de iniciantes

⚠️ **Publicar sem revisar**: Sempre dê uma olhada antes de publicar.

⚠️ **Ignorar o Radar**: Ele mostra demanda real. Use-o.

⚠️ **CTA genérico**: Seja específico sobre o que você oferece.

⚠️ **Poucas palavras-chave**: Configure ao menos 5 para bons resultados.

## Próximos passos

Após a configuração inicial:

1. **Semana 1**: Publique 3-5 artigos
2. **Semana 2**: Ative automação, monitore resultados
3. **Semana 3**: Ajuste estratégia baseado em dados
4. **Semana 4**: Escale produção conforme resultados

📌 **Lembre-se**: Consistência é mais importante que perfeição. Comece simples e evolua.' 
WHERE slug = 'primeiros-passos' OR slug = 'comecando-na-plataforma' OR title ILIKE '%primeiro%' OR title ILIKE '%começ%' OR title ILIKE '%início%';