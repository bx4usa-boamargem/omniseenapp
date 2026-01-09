-- FASE 1: Modelo de Dados Universal
-- Criar tabela client_strategy (estratégia universal do cliente)
CREATE TABLE client_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES blogs(id) ON DELETE CASCADE UNIQUE,
  
  -- Identidade do Negócio
  empresa_nome TEXT,
  tipo_negocio TEXT,
  regiao_atuacao TEXT,
  
  -- Público-Alvo  
  tipo_publico TEXT,
  nivel_consciencia TEXT,
  nivel_conhecimento TEXT,
  dor_principal TEXT,
  desejo_principal TEXT,
  
  -- Oferta/Solução
  o_que_oferece TEXT,
  principais_beneficios TEXT[],
  diferenciais TEXT[],
  
  -- Conversão
  acao_desejada TEXT,
  canal_cta TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_client_strategy_updated_at
  BEFORE UPDATE ON client_strategy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS com suporte a ownership E team_members
ALTER TABLE client_strategy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage strategy"
  ON client_strategy FOR ALL
  USING (
    blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid())
    OR
    blog_id IN (SELECT blog_id FROM team_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

-- Criar tabela prompt_type_config (controle de versão do Prompt Type)
CREATE TABLE prompt_type_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL DEFAULT 'V1.0',
  is_active BOOLEAN DEFAULT true,
  prompt_content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prompt_type_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active prompt types"
  ON prompt_type_config FOR SELECT
  USING (is_active = true);

-- ADD COLUMN em articles (sem DROP, sem ALTER destrutivo)
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS funnel_mode TEXT 
  CHECK (funnel_mode IN ('top', 'middle', 'bottom'));

ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS article_goal TEXT 
  CHECK (article_goal IN ('educar', 'autoridade', 'apoiar_vendas', 'converter'));

-- Seed do Prompt Type V1.0
INSERT INTO prompt_type_config (version, is_active, prompt_content)
VALUES ('V1.0', true, '{
  "identity": "Você atua como um Consultor Sênior de Conteúdo e Estratégia, com experiência prática em ajudar empresas a educar o mercado, gerar autoridade e converter leitores em oportunidades reais de negócio.",
  "behavior": [
    "Comunicação assertiva, clara e lógica",
    "Linguagem profissional, acessível e direta",
    "Raciocínio orientado a problema → solução → impacto",
    "Evitar especulação e generalidades"
  ],
  "mental_model": [
    "Identificar o problema/desejo central do público",
    "Explicar o problema com clareza (sem jargão)",
    "Demonstrar consequências reais",
    "Apresentar a solução de forma lógica",
    "Conduzir o leitor para a próxima ação"
  ],
  "funnel_modes": {
    "top": {
      "name": "Topo de Funil - Educação",
      "objective": "Esclarecer o problema e gerar confiança",
      "tone": "Educativo, empático, não comercial",
      "cta_strength": "Leve e opcional",
      "expected_result": "Leitor entende o problema"
    },
    "middle": {
      "name": "Meio de Funil - Consideração",
      "objective": "Ajudar o leitor a avaliar soluções",
      "tone": "Consultivo, comparativo, racional",
      "cta_strength": "Moderado",
      "expected_result": "Leitor considera a empresa como opção"
    },
    "bottom": {
      "name": "Fundo de Funil - Conversão",
      "objective": "Levar à ação",
      "tone": "Direto, seguro, orientado a decisão",
      "cta_strength": "Forte e explícito",
      "expected_result": "Lead ou contato imediato"
    }
  },
  "article_goals": {
    "educar": "Educar o mercado sobre o problema e suas implicações",
    "autoridade": "Gerar autoridade demonstrando expertise e conhecimento profundo",
    "apoiar_vendas": "Apoiar o processo de vendas com argumentos e provas",
    "converter": "Converter o leitor em lead ou cliente"
  },
  "article_structure": [
    "Problema real do leitor",
    "Explicação clara do cenário",
    "Impactos de não agir",
    "Caminhos possíveis de solução",
    "Posicionamento da empresa como solução confiável",
    "Chamada para ação alinhada ao funil"
  ],
  "quality_rules": {
    "always": [
      "Focar no leitor (você)",
      "Usar frases curtas e médias",
      "Variar ritmo",
      "Usar voz ativa",
      "Conectar causa e efeito"
    ],
    "never": [
      "Introduções genéricas",
      "Adjetivos vazios sem prova",
      "Repetição de ideias",
      "Clickbait sem entrega",
      "Conclusões artificiais"
    ]
  },
  "size_control": {
    "text": "Texto escaneável",
    "subtitles": "Subtítulos claros",
    "paragraphs": "Parágrafos objetivos",
    "density": "Alta densidade informativa",
    "filler": "Sem encheção de linguiça"
  }
}'::jsonb);