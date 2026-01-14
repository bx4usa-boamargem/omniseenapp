-- Insert help articles for all categories
INSERT INTO help_articles (slug, title, category, content, icon, order_index, language, is_published) VALUES

-- Primeiros Passos
('como-comecar', 'Como começar na Omniseen', 'primeiros-passos', '## Bem-vindo à Omniseen!

A Omniseen é seu sistema de inteligência comercial que transforma sinais de mercado em artigos que atraem clientes.

### Primeiros passos

1. **Configure sua empresa** → Vá em "Minha Empresa" e preencha seu nicho, serviços e localização
2. **Defina suas cores** → Personalize a identidade visual do seu blog
3. **Crie seu primeiro artigo** → Use o Radar de Oportunidades para encontrar temas quentes

💡 **Dica**: O Radar analisa a demanda real do seu mercado. Comece por ele!', 'Rocket', 1, 'pt-BR', true),

('configurando-empresa', 'Configurando sua empresa', 'primeiros-passos', '## Configure o perfil do seu negócio

Para que a IA gere conteúdo relevante, você precisa definir seu perfil de negócio.

### Campos importantes

- **Nicho**: Área de atuação (ex: "Controle de Pragas")
- **Serviços**: O que você oferece
- **Cidade/Região**: Onde você atua
- **Descrição**: Sobre sua empresa

### Como acessar

Vá em **Minha Empresa** no menu lateral e preencha todas as informações.

💡 **Dica**: Quanto mais completo o perfil, melhores serão as sugestões da IA!', 'Building2', 2, 'pt-BR', true),

-- Resultados
('entendendo-dashboard-roi', 'Entendendo o Dashboard de ROI', 'resultados', '## Métricas que importam

O dashboard de Resultados & ROI mostra o impacto real do seu conteúdo.

### 3 Abas principais

1. **Métricas** - Execução operacional (artigos criados, aproveitamento do Radar)
2. **Performance** - Dados do Google (cliques, impressões, CTR, posição)
3. **ROI Real** - Exposição e intenção comercial convertida

### Aproveitamento do Radar

Mede quantas oportunidades você converteu em artigos. Quanto maior, melhor sua disciplina editorial.

💡 **Dica**: Foque primeiro nas oportunidades de score alto (90+)!', 'TrendingUp', 1, 'pt-BR', true),

-- Inteligência
('usando-radar-oportunidades', 'Usando o Radar de Oportunidades', 'inteligencia', '## Seu sensor de mercado

O Radar analisa semanalmente seu mercado e identifica oportunidades de conteúdo.

### Como funciona

1. A IA pesquisa tendências no seu nicho e região
2. Gera sugestões com score de relevância (0-100)
3. Você converte em artigo com 1 clique

### Score de relevância

- **90-100**: Altíssima demanda - priorize!
- **70-89**: Boa oportunidade
- **Abaixo de 70**: Complementar

### Criando artigo do Radar

Clique em **Criar Artigo** na oportunidade desejada. A IA gera automaticamente!

💡 **Dica**: O Radar atualiza semanalmente. Confira toda segunda-feira!', 'Compass', 1, 'pt-BR', true),

('analise-seo-explicada', 'Análise de SEO explicada', 'inteligencia', '## Saúde do seu blog

A Análise de SEO avalia a qualidade técnica dos seus artigos.

### O que é analisado

- **Título**: Tamanho ideal (50-60 caracteres)
- **Meta Description**: 140-160 caracteres
- **Keywords**: 3-7 palavras-chave
- **Conteúdo**: Mínimo 300 palavras, ideal 800+
- **Estrutura**: Headers H2/H3 organizados

### Score de saúde

Varia de 0 a 100. Acima de 80 é considerado saudável.

### Otimizando

Clique em **Otimizar** para a IA corrigir automaticamente os problemas.', 'Activity', 2, 'pt-BR', true),

-- Conteúdo
('criando-artigos-ia', 'Criando artigos com IA', 'conteudo', '## Duas formas de criar

### 1. Via Radar (recomendado)

Vá em **Radar de Oportunidades** e clique em **Criar Artigo** em qualquer oportunidade. A IA gera automaticamente baseada na demanda real do mercado.

### 2. Manual

Vá em **Artigos** > **Criar Artigo** e preencha o tema desejado.

### O que a IA gera

- Título otimizado para SEO
- Meta description
- Conteúdo completo com H2/H3
- Imagem de capa
- Imagens internas (problema/solução)
- FAQ (se aplicável)
- CTA personalizado

💡 **Dica**: Artigos do Radar têm melhor performance porque atendem demanda real!', 'FileText', 1, 'pt-BR', true),

('publicando-agendando', 'Publicando e agendando artigos', 'conteudo', '## Publicação de conteúdo

### Publicar imediatamente

1. Abra o artigo no editor
2. Revise o conteúdo
3. Clique em **Publicar**

### Agendar para depois

1. Abra o artigo
2. Selecione **Agendar** ao invés de Publicar
3. Escolha data e horário
4. Confirme

### Status dos artigos

- **Rascunho**: Ainda não publicado
- **Agendado**: Aguardando data de publicação
- **Publicado**: Visível no seu blog

💡 **Dica**: Publique em horários que seu público está online!', 'FileText', 2, 'pt-BR', true),

-- Operação
('configurando-automacao', 'Configurando a automação', 'operacao', '## Piloto automático

A automação cria e publica artigos baseados no Radar sem você precisar fazer nada.

### Como ativar

1. Vá em **Automação**
2. Ative o toggle **Automação ativa**
3. Defina a frequência (diária, 2x semana, semanal)
4. Configure o Autopilot de Funil se desejar

### Autopilot de Funil

Distribui artigos automaticamente entre Topo, Meio e Fundo do funil.

### Fila de produção

Artigos pendentes aparecem na aba **Fila**. Você pode priorizar ou remover.

⚠️ **Importante**: A automação usa oportunidades do Radar. Mantenha-o atualizado!', 'Zap', 1, 'pt-BR', true),

('gerenciando-territorios', 'Gerenciando territórios', 'operacao', '## Atuação por região

Territórios permitem que a IA gere conteúdo específico para cada região onde você atua.

### Adicionando território

1. Vá em **Territórios**
2. Clique em **Adicionar Território**
3. Selecione País > Estado > Cidade

### Limites por plano

- **Lite**: 1 território
- **Pro**: 2 territórios
- **Business**: 10 territórios

### Métricas por região

Veja performance de oportunidades e artigos por território.

💡 **Dica**: Comece pela sua cidade principal e expanda gradualmente!', 'MapPin', 2, 'pt-BR', true),

-- Integrações
('conectando-gsc', 'Conectando Google Search Console', 'integracoes', '## Dados reais do Google

O Google Search Console (GSC) mostra como seu site aparece nas buscas.

### Como conectar

1. Vá em **Integrações** > **Google Search Console**
2. Clique em **Conectar**
3. Autorize o acesso com sua conta Google
4. Selecione o domínio do seu blog

### Dados disponíveis

- **Cliques**: Quantas vezes clicaram nos seus resultados
- **Impressões**: Quantas vezes você apareceu
- **CTR**: Taxa de cliques
- **Posição média**: Ranking médio

### Sincronização

Os dados são sincronizados automaticamente a cada 24 horas.

💡 **Dica**: Leva alguns dias para o Google indexar novos artigos!', 'Plug', 1, 'pt-BR', true)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  icon = EXCLUDED.icon,
  order_index = EXCLUDED.order_index,
  is_published = EXCLUDED.is_published;