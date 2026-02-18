
-- ============================================================
-- ELITE ENGINE V2: content_blocks table with placement rules
-- ============================================================
CREATE TABLE public.content_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche TEXT NOT NULL DEFAULT 'default',
  block_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  prompt_snippet TEXT NOT NULL,
  constraints_json JSONB DEFAULT '{}',
  compatible_structures TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(niche, block_key)
);

ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

-- Service role access only (edge functions)
CREATE POLICY "Service role full access on content_blocks"
  ON public.content_blocks FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- Seed 12 initial blocks with placement rules
-- ============================================================
INSERT INTO public.content_blocks (niche, block_key, display_name, prompt_snippet, constraints_json, compatible_structures) VALUES
('default', 'direct_answer', 'Resposta Direta', 
 'Comece a seção respondendo diretamente à pergunta do usuário em 2-3 frases claras e objetivas, ANTES de qualquer explicação detalhada. Use linguagem simples e assertiva.',
 '{"placement": "first_h2", "required_when": ["informational", "qa_format"], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['qa_format', 'complete_guide', 'educational_steps']),

('default', 'checklist', 'Checklist Prático',
 'Inclua um checklist prático com 5-8 itens que o leitor pode usar para verificar/avaliar a situação. Use formato de lista com ✅ ou ☐. Cada item deve ser acionável e específico ao contexto local.',
 '{"placement": "middle", "required_when": [], "forbidden_when": ["comparative"], "max_per_article": 1}'::jsonb,
 ARRAY['complete_guide', 'educational_steps', 'problem_solution']),

('default', 'comparison_table', 'Tabela Comparativa',
 'Crie uma tabela comparativa em Markdown com pelo menos 3 opções/alternativas. Inclua colunas para: opção, preço médio, vantagem principal, indicação ideal. Use dados realistas para a região.',
 '{"placement": "middle", "required_when": ["commercial"], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['comparative', 'complete_guide']),

('default', 'step_by_step', 'Passo a Passo Numerado',
 'Apresente um passo a passo numerado com 4-7 etapas claras. Cada etapa deve ter: número, título em negrito, descrição de 2-3 linhas com ação concreta. Inclua dicas de tempo estimado quando relevante.',
 '{"placement": "any", "required_when": ["how_to"], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['educational_steps', 'complete_guide', 'problem_solution']),

('default', 'myths', 'Mitos e Verdades',
 'Crie uma seção "Mitos e Verdades" com 3-5 afirmações comuns sobre o tema. Para cada uma: declare o mito, explique a verdade com base técnica e, quando possível, cite dados ou experiência local.',
 '{"placement": "middle_to_end", "required_when": [], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['qa_format', 'complete_guide', 'educational_steps']),

('default', 'pricing_section', 'Seção de Preços/Custos',
 'Inclua informações de preço/custo médio para a região. Use faixas de valores (ex: R$ X a R$ Y), explique fatores que influenciam o preço e dê dicas para economizar sem perder qualidade.',
 '{"placement": "middle_to_end", "required_when": ["commercial", "transactional"], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['comparative', 'complete_guide', 'problem_solution']),

('default', 'mini_case', 'Mini Caso Real',
 'Apresente um mini caso real ou cenário realista de um cliente/situação na região. Descreva: o problema encontrado, a solução aplicada, o resultado obtido. Use tom narrativo sem revelar dados pessoais.',
 '{"placement": "middle_to_end", "required_when": [], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['problem_solution', 'complete_guide', 'educational_steps']),

('default', 'faq_block', 'FAQ Expandido',
 'Adicione 3-5 perguntas frequentes ESPECÍFICAS ao contexto local e ao serviço. Evite perguntas genéricas. Cada resposta deve ter 3-5 linhas com informação prática e acionável.',
 '{"placement": "before_conclusion", "required_when": [], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['qa_format', 'complete_guide', 'comparative', 'problem_solution', 'educational_steps']),

('default', 'seasonal_alert', 'Alerta Sazonal',
 'Inclua um alerta ou dica relacionada à sazonalidade (estação do ano, período de chuvas, datas comemorativas, etc.) que seja relevante para o serviço na região. Conecte com urgência quando apropriado.',
 '{"placement": "first_or_second_h2", "required_when": [], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['problem_solution', 'complete_guide']),

('default', 'risk_section', 'Riscos e Consequências',
 'Descreva 3-5 riscos ou consequências de NÃO resolver o problema ou de fazer escolhas erradas. Use tom educativo sem ser alarmista. Inclua dados quando disponíveis e conecte com a solução profissional.',
 '{"placement": "first_half", "required_when": ["transactional"], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['problem_solution', 'complete_guide', 'educational_steps']),

('default', 'technical_explanation', 'Explicação Técnica Acessível',
 'Explique um conceito técnico de forma acessível ao público leigo. Use analogias do cotidiano, evite jargão e, quando necessário, defina termos técnicos entre parênteses. Objetivo: educar sem intimidar.',
 '{"placement": "any", "required_when": [], "forbidden_when": [], "max_per_article": 2}'::jsonb,
 ARRAY['educational_steps', 'complete_guide', 'qa_format']),

('default', 'quick_summary', 'Resumo Rápido (TL;DR)',
 'Inclua um box de resumo rápido com 3-5 bullet points que sintetizam os pontos principais do artigo. Ideal para leitores que querem a informação essencial rapidamente.',
 '{"placement": "first_h2_or_last", "required_when": [], "forbidden_when": [], "max_per_article": 1}'::jsonb,
 ARRAY['complete_guide', 'comparative', 'educational_steps']);
