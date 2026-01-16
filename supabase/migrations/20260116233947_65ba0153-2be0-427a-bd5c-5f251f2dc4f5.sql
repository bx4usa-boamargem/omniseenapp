-- ============================================================
-- MODELOS EDITORIAIS ESTRUTURAIS - Sistema Anti-Clone
-- ============================================================

-- 1. Adicionar campo article_structure_type à tabela articles
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS article_structure_type TEXT
CHECK (article_structure_type IN ('educational', 'problem_solution', 'guide', 'comparison'));

-- 2. Criar tabela de templates estruturais por atividade
CREATE TABLE IF NOT EXISTS activity_structure_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_slug TEXT NOT NULL,
  structure_type TEXT NOT NULL CHECK (structure_type IN ('educational', 'problem_solution', 'guide', 'comparison')),
  display_name TEXT NOT NULL,
  required_sections JSONB NOT NULL DEFAULT '[]',
  validation_rules JSONB NOT NULL DEFAULT '{}',
  generation_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_slug, structure_type)
);

-- 3. Habilitar RLS
ALTER TABLE activity_structure_templates ENABLE ROW LEVEL SECURITY;

-- 4. Policy de leitura pública (templates são públicos para geração)
CREATE POLICY "Templates are readable by authenticated users"
ON activity_structure_templates
FOR SELECT
TO authenticated
USING (true);

-- 5. Policy de escrita apenas para admins
CREATE POLICY "Only admins can modify templates"
ON activity_structure_templates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'platform_admin')
  )
);

-- 6. Popular templates iniciais (10 atividades × 4 modelos = 40 registros)
-- ============================================================
-- ATIVIDADE: servicos_gerais
-- ============================================================
INSERT INTO activity_structure_templates (activity_slug, structure_type, display_name, required_sections, validation_rules, generation_prompt)
VALUES 
('servicos_gerais', 'educational', 'Artigo Educativo', 
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO com estrutura de pergunta-resposta. O título DEVE terminar com interrogação (?). Logo após o título, forneça uma resposta direta e objetiva em 2-3 linhas. Organize o conteúdo em blocos didáticos com exemplos práticos da região do cliente. Finalize com a seção "## Próximo passo" personalizada.'
),
('servicos_gerais', 'problem_solution', 'Problema e Solução',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO. Comece descrevendo uma dor real e comum do público-alvo. Mostre as consequências de ignorar o problema. Contextualize para a região/cidade do cliente. Apresente o caminho para a solução de forma consultiva. Finalize com CTA direto e urgente na seção "## Próximo passo".'
),
('servicos_gerais', 'guide', 'Guia Completo',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA COMPLETO passo-a-passo. O título deve conter "Guia", "Como" ou "Passo a passo". Estruture com passos numerados claros. Inclua alertas de erros comuns com ⚠️. Adicione uma seção "Quando chamar um profissional". Finalize com "## Próximo passo" incentivando contato.'
),
('servicos_gerais', 'comparison', 'Comparativo',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO. O título deve conter "vs", "ou" ou "qual escolher". Compare as duas opções de forma equilibrada. Liste prós e contras de cada uma. Dê uma recomendação final baseada no perfil do cliente. Finalize com "## Próximo passo" oferecendo consultoria.'
),

-- ============================================================
-- ATIVIDADE: saude
-- ============================================================
('saude', 'educational', 'Artigo Educativo Saúde',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO sobre saúde com estrutura de pergunta-resposta. O título DEVE terminar com interrogação (?). Forneça uma resposta direta baseada em evidências. Organize o conteúdo em blocos didáticos acessíveis. IMPORTANTE: Inclua disclaimer de que não substitui consulta médica. Finalize com "## Próximo passo" incentivando agendamento.'
),
('saude', 'problem_solution', 'Problema e Solução Saúde',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO sobre saúde. Descreva sintomas ou condições comuns. Mostre riscos de não tratar. Contextualize para a região. IMPORTANTE: Não faça promessas de cura, use linguagem responsável. Finalize com "## Próximo passo" incentivando avaliação profissional.'
),
('saude', 'guide', 'Guia Completo Saúde',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA sobre cuidados de saúde. Estruture com orientações claras e numeradas. Inclua alertas sobre sinais de alerta. OBRIGATÓRIO: Seção "Quando procurar um médico". Inclua disclaimer sobre consulta profissional. Finalize com "## Próximo passo" para agendamento.'
),
('saude', 'comparison', 'Comparativo Saúde',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO sobre opções de tratamento ou procedimentos. Compare de forma equilibrada e baseada em evidências. IMPORTANTE: Não faça recomendações médicas diretas, oriente buscar avaliação individual. Finalize com "## Próximo passo" para consulta.'
),

-- ============================================================
-- ATIVIDADE: advocacia
-- ============================================================
('advocacia', 'educational', 'Artigo Educativo Jurídico',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO jurídico com estrutura de pergunta-resposta. O título DEVE terminar com interrogação (?). Explique o tema em linguagem acessível (evite juridiquês). Cite legislação quando relevante. IMPORTANTE: Inclua disclaimer de que não substitui consulta com advogado. Finalize com "## Próximo passo".'
),
('advocacia', 'problem_solution', 'Problema e Solução Jurídico',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO jurídico. Descreva situações legais comuns. Mostre riscos e consequências. Apresente caminhos legais disponíveis. IMPORTANTE: Não prometa resultados, cada caso é único. Finalize com "## Próximo passo" para análise do caso.'
),
('advocacia', 'guide', 'Guia Completo Jurídico',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA jurídico passo-a-passo. Explique procedimentos legais de forma clara. Inclua prazos e documentos necessários. Alerte sobre erros comuns. OBRIGATÓRIO: Seção "Quando procurar um advogado". Finalize com "## Próximo passo".'
),
('advocacia', 'comparison', 'Comparativo Jurídico',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO jurídico. Compare opções legais (ex: judicial vs extrajudicial). Explique prós e contras de cada via. IMPORTANTE: A melhor opção depende do caso específico. Finalize com "## Próximo passo" para análise personalizada.'
),

-- ============================================================
-- ATIVIDADE: construcao
-- ============================================================
('construcao', 'educational', 'Artigo Educativo Construção',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO sobre construção/reforma. O título DEVE terminar com interrogação (?). Responda de forma técnica mas acessível. Inclua considerações sobre materiais e custos da região. Finalize com "## Próximo passo" para orçamento.'
),
('construcao', 'problem_solution', 'Problema e Solução Construção',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO sobre construção. Descreva problemas estruturais ou de reforma comuns. Mostre riscos de não resolver. Apresente soluções técnicas. Contextualize para o clima/região do cliente. Finalize com "## Próximo passo" para vistoria.'
),
('construcao', 'guide', 'Guia Completo Construção',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA sobre projeto ou reforma. Estruture em etapas claras. Inclua estimativas de tempo e custo. Alerte sobre erros que encarecem a obra. Mencione quando contratar profissional qualificado. Finalize com "## Próximo passo".'
),
('construcao', 'comparison', 'Comparativo Construção',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO sobre materiais, técnicas ou fornecedores. Compare custo-benefício de forma técnica. Liste prós e contras considerando durabilidade e manutenção. Finalize com "## Próximo passo" para consultoria.'
),

-- ============================================================
-- ATIVIDADE: home_services (Desentupidora, Elétrica, etc)
-- ============================================================
('home_services', 'educational', 'Artigo Educativo Serviços Domésticos',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO sobre serviços domésticos/residenciais. O título DEVE terminar com interrogação (?). Explique conceitos técnicos de forma simples. Dê dicas práticas para o dia-a-dia. Mencione particularidades da região. Finalize com "## Próximo passo" para atendimento.'
),
('home_services', 'problem_solution', 'Problema e Solução Serviços Domésticos',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO sobre emergências ou manutenção residencial. Descreva o problema de forma vívida (vazamento, entupimento, curto-circuito). Mostre riscos de não agir. Apresente a solução profissional. Use tom de URGÊNCIA quando apropriado. Finalize com "## Próximo passo" para chamado imediato.'
),
('home_services', 'guide', 'Guia Completo Serviços Domésticos',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA sobre manutenção preventiva ou identificação de problemas. Passos claros que o morador pode fazer. ⚠️ Alertas de segurança obrigatórios (eletricidade, gás). OBRIGATÓRIO: "Quando chamar um profissional". Finalize com "## Próximo passo".'
),
('home_services', 'comparison', 'Comparativo Serviços Domésticos',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO sobre métodos, equipamentos ou tipos de serviço. Compare eficácia e custo-benefício. Liste prós e contras de forma prática. Recomende baseado no tipo de situação. Finalize com "## Próximo passo" para avaliação.'
),

-- ============================================================
-- ATIVIDADE: tecnologia
-- ============================================================
('tecnologia', 'educational', 'Artigo Educativo Tech',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO sobre tecnologia. O título DEVE terminar com interrogação (?). Explique conceitos técnicos de forma acessível para não-técnicos. Use analogias quando útil. Mostre aplicação prática no negócio. Finalize com "## Próximo passo" para consultoria.'
),
('tecnologia', 'problem_solution', 'Problema e Solução Tech',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO sobre dores tecnológicas de negócios. Descreva problemas comuns (sistemas lentos, falta de integração, segurança). Mostre impacto financeiro de não resolver. Apresente soluções modernas. Finalize com "## Próximo passo" para diagnóstico.'
),
('tecnologia', 'guide', 'Guia Completo Tech',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA sobre implementação ou migração tecnológica. Estruture em fases claras. Inclua checklist e pré-requisitos. Alerte sobre erros comuns e custos ocultos. Mencione quando contratar especialista. Finalize com "## Próximo passo".'
),
('tecnologia', 'comparison', 'Comparativo Tech',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO sobre ferramentas, plataformas ou abordagens tecnológicas. Compare funcionalidades, preço e curva de aprendizado. Liste prós e contras para diferentes perfis de empresa. Finalize com "## Próximo passo" para POC ou demo.'
),

-- ============================================================
-- ATIVIDADE: educacao
-- ============================================================
('educacao', 'educational', 'Artigo Educativo Educação',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO sobre educação/ensino. O título DEVE terminar com interrogação (?). Explique conceitos pedagógicos de forma clara para pais e alunos. Inclua exemplos práticos. Mencione realidade educacional da região. Finalize com "## Próximo passo" para matrícula ou contato.'
),
('educacao', 'problem_solution', 'Problema e Solução Educação',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO sobre desafios educacionais. Descreva dificuldades comuns (aprendizado, vestibular, carreira). Mostre consequências de não agir. Apresente metodologias e soluções. Finalize com "## Próximo passo" para aula experimental.'
),
('educacao', 'guide', 'Guia Completo Educação',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA sobre preparação para provas, escolha de curso ou carreira. Estruture em etapas claras. Inclua cronogramas e dicas de estudo. Alerte sobre erros comuns. Finalize com "## Próximo passo" para orientação.'
),
('educacao', 'comparison', 'Comparativo Educação',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO sobre metodologias, cursos ou instituições. Compare de forma equilibrada. Liste prós e contras para diferentes perfis de aluno. Finalize com "## Próximo passo" para visita ou teste.'
),

-- ============================================================
-- ATIVIDADE: financas
-- ============================================================
('financas', 'educational', 'Artigo Educativo Finanças',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO sobre finanças/contabilidade. O título DEVE terminar com interrogação (?). Explique conceitos financeiros de forma acessível. IMPORTANTE: Não prometa rentabilidade, cada situação é única. Inclua disclaimer sobre consultoria profissional. Finalize com "## Próximo passo".'
),
('financas', 'problem_solution', 'Problema e Solução Finanças',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO sobre dores financeiras. Descreva problemas comuns (fluxo de caixa, impostos, planejamento). Mostre impacto de não resolver. IMPORTANTE: Não faça recomendações de investimento específicas. Finalize com "## Próximo passo" para diagnóstico.'
),
('financas', 'guide', 'Guia Completo Finanças',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA sobre organização financeira ou processos contábeis. Estruture em passos claros. Inclua prazos fiscais quando relevante. Alerte sobre multas e erros comuns. OBRIGATÓRIO: "Quando procurar um contador/assessor". Finalize com "## Próximo passo".'
),
('financas', 'comparison', 'Comparativo Finanças',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO sobre opções financeiras, regimes tributários ou ferramentas. Compare de forma técnica mas acessível. IMPORTANTE: A melhor opção depende da situação específica. Finalize com "## Próximo passo" para análise personalizada.'
),

-- ============================================================
-- ATIVIDADE: ecommerce
-- ============================================================
('ecommerce', 'educational', 'Artigo Educativo E-commerce',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO sobre e-commerce/vendas online. O título DEVE terminar com interrogação (?). Explique conceitos de forma prática. Inclua dicas para aumentar conversão. Mencione logística regional quando relevante. Finalize com "## Próximo passo" para consultoria.'
),
('ecommerce', 'problem_solution', 'Problema e Solução E-commerce',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO sobre desafios de loja virtual. Descreva problemas comuns (carrinho abandonado, baixa conversão, logística). Mostre impacto no faturamento. Apresente soluções práticas. Finalize com "## Próximo passo" para auditoria.'
),
('ecommerce', 'guide', 'Guia Completo E-commerce',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA sobre criação ou otimização de loja virtual. Estruture em etapas claras. Inclua checklist de lançamento. Alerte sobre erros que custam vendas. Mencione quando contratar especialista. Finalize com "## Próximo passo".'
),
('ecommerce', 'comparison', 'Comparativo E-commerce',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO sobre plataformas, integrações ou estratégias de e-commerce. Compare funcionalidades e custos. Liste prós e contras para diferentes tamanhos de operação. Finalize com "## Próximo passo" para demo ou teste.'
),

-- ============================================================
-- ATIVIDADE: alimentacao
-- ============================================================
('alimentacao', 'educational', 'Artigo Educativo Alimentação',
  '["pergunta_titulo", "resposta_direta", "blocos_didaticos", "aplicacao_local", "proximo_passo"]',
  '{"title_pattern": "\\\\?$", "has_direct_answer": true, "min_didactic_blocks": 2, "has_local_mention": true, "ends_with_cta": true}',
  'Crie um artigo EDUCATIVO sobre alimentação/gastronomia. O título DEVE terminar com interrogação (?). Explique conceitos culinários ou nutricionais de forma acessível. Inclua dicas práticas. Mencione ingredientes e fornecedores da região. Finalize com "## Próximo passo" para visita ou pedido.'
),
('alimentacao', 'problem_solution', 'Problema e Solução Alimentação',
  '["dor_real", "consequencia", "contexto_local", "caminho_solucao", "cta_direto"]',
  '{"has_pain_description": true, "has_consequence": true, "has_local_context": true, "has_solution_path": true, "has_direct_cta": true}',
  'Crie um artigo de PROBLEMA-SOLUÇÃO sobre desafios alimentares ou de negócio food service. Descreva o problema de forma relacionável. Mostre consequências. Apresente a solução do seu estabelecimento/serviço. Finalize com "## Próximo passo" para reserva ou pedido.'
),
('alimentacao', 'guide', 'Guia Completo Alimentação',
  '["titulo_guia", "passos_numerados", "alertas_erro", "quando_chamar_profissional", "proximo_passo"]',
  '{"title_has_guide": true, "has_numbered_steps": true, "has_error_alerts": true, "has_pro_mention": true, "ends_with_cta": true}',
  'Crie um GUIA sobre culinária, eventos ou escolha de fornecedores. Estruture em passos claros. Inclua dicas de porcionamento e apresentação. Alerte sobre erros comuns. Finalize com "## Próximo passo" para encomenda ou consultoria.'
),
('alimentacao', 'comparison', 'Comparativo Alimentação',
  '["dilema_titulo", "comparacao_clara", "pros_contras", "recomendacao_final", "proximo_passo"]',
  '{"title_has_vs": true, "has_comparison": true, "has_pros_cons": true, "has_recommendation": true, "ends_with_cta": true}',
  'Crie um artigo COMPARATIVO sobre opções gastronômicas, tipos de serviço ou ingredientes. Compare de forma equilibrada. Liste prós e contras para diferentes ocasiões. Finalize com "## Próximo passo" para degustação ou pedido.'
)
ON CONFLICT (activity_slug, structure_type) DO NOTHING;

-- 7. Índice para busca rápida de templates
CREATE INDEX IF NOT EXISTS idx_activity_templates_slug_type 
ON activity_structure_templates(activity_slug, structure_type);

-- 8. Índice para artigos por structure_type
CREATE INDEX IF NOT EXISTS idx_articles_structure_type 
ON articles(article_structure_type) WHERE article_structure_type IS NOT NULL;