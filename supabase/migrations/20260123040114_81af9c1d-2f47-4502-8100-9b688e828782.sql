-- ═══════════════════════════════════════════════════════════════════
-- NICHE PROFILES: Motor de Pontuação por Perfil de Nicho
-- ═══════════════════════════════════════════════════════════════════

-- 1. Criar tabela de perfis de nicho
CREATE TABLE IF NOT EXISTS public.niche_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Tipo de Intenção
  intent TEXT NOT NULL DEFAULT 'local_service'
    CHECK (intent IN ('local_service', 'informational', 'ecommerce', 'b2b')),
  
  -- Limites Estruturais
  min_words INTEGER NOT NULL DEFAULT 1000,
  max_words INTEGER NOT NULL DEFAULT 3000,
  min_h2 INTEGER NOT NULL DEFAULT 4,
  max_h2 INTEGER NOT NULL DEFAULT 12,
  min_paragraphs INTEGER NOT NULL DEFAULT 10,
  min_images INTEGER NOT NULL DEFAULT 2,
  
  -- Score
  min_score INTEGER NOT NULL DEFAULT 50,
  target_score INTEGER NOT NULL DEFAULT 75,
  
  -- Entidades Semânticas (arrays de texto)
  allowed_entities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  forbidden_entities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  seed_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_niche_profiles_name ON public.niche_profiles(name);

-- 2. Adicionar coluna niche_profile_id em blogs
ALTER TABLE public.blogs 
ADD COLUMN IF NOT EXISTS niche_profile_id UUID REFERENCES public.niche_profiles(id);

-- 3. Adicionar coluna niche_profile_id em business_profile
ALTER TABLE public.business_profile
ADD COLUMN IF NOT EXISTS niche_profile_id UUID REFERENCES public.niche_profiles(id);

-- 4. Adicionar coluna niche_profile_id em serp_analysis_cache
ALTER TABLE public.serp_analysis_cache
ADD COLUMN IF NOT EXISTS niche_profile_id UUID REFERENCES public.niche_profiles(id);

-- 5. Habilitar RLS
ALTER TABLE public.niche_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS - Leitura pública, escrita apenas admin
CREATE POLICY "Niche profiles are viewable by everyone"
ON public.niche_profiles FOR SELECT
USING (true);

CREATE POLICY "Only authenticated users can insert niche profiles"
ON public.niche_profiles FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only authenticated users can update niche profiles"
ON public.niche_profiles FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- 7. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_niche_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_niche_profiles_updated_at ON public.niche_profiles;
CREATE TRIGGER trigger_niche_profiles_updated_at
BEFORE UPDATE ON public.niche_profiles
FOR EACH ROW
EXECUTE FUNCTION update_niche_profiles_updated_at();

-- 8. Popular perfis de nicho iniciais
INSERT INTO public.niche_profiles (name, display_name, description, intent, min_words, max_words, min_h2, max_h2, min_score, target_score, allowed_entities, forbidden_entities, seed_keywords)
VALUES 
  ('controle_pragas', 'Controle de Pragas', 'Dedetizadoras, controle de pragas urbanas', 'local_service', 1000, 2500, 5, 10, 55, 75,
   ARRAY['dedetização', 'pragas', 'cupim', 'cupins', 'barata', 'baratas', 'rato', 'ratos', 'desinfecção', 'sanitização', 'dengue', 'escorpião', 'formiga', 'percevejo', 'mosca', 'mosquito', 'pulga', 'carrapato', 'aranha', 'marimbondo', 'vespa', 'traça', 'broca', 'controle integrado', 'manejo de pragas', 'fumigação', 'desinsetização', 'descupinização', 'desratização']::TEXT[],
   ARRAY['seo', 'google', 'marketing digital', 'agência', 'tráfego', 'leads', 'conversão', 'funil', 'campanha', 'anúncio', 'ads', 'otimização', 'backlink', 'palavra-chave', 'ranqueamento', 'serp']::TEXT[],
   ARRAY['dedetização', 'controle de pragas', 'empresa dedetizadora']::TEXT[]),
   
  ('advocacia', 'Advocacia', 'Escritórios de advocacia e advogados', 'local_service', 1200, 3000, 6, 12, 60, 80,
   ARRAY['advogado', 'advogada', 'processo', 'tribunal', 'direito', 'petição', 'justiça', 'ação judicial', 'recurso', 'sentença', 'cliente', 'caso', 'defesa', 'contestação', 'audiência', 'mandado', 'liminar', 'jurisprudência', 'código civil', 'código penal', 'constituição', 'lei', 'legislação', 'honorários', 'procuração', 'escritório']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência de marketing', 'tráfego pago', 'google ads', 'facebook ads', 'leads', 'funil de vendas', 'conversão', 'campanha publicitária']::TEXT[],
   ARRAY['advogado', 'escritório de advocacia', 'assessoria jurídica']::TEXT[]),
   
  ('saude', 'Saúde', 'Clínicas médicas, consultórios, hospitais', 'local_service', 1000, 2500, 5, 10, 55, 75,
   ARRAY['médico', 'médica', 'clínica', 'consulta', 'tratamento', 'paciente', 'saúde', 'exame', 'diagnóstico', 'sintoma', 'doença', 'terapia', 'cirurgia', 'especialista', 'atendimento', 'agendamento', 'convênio', 'plano de saúde', 'consultório', 'hospital', 'laboratório', 'medicamento', 'prescrição', 'receita médica']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência', 'leads', 'funil', 'tráfego', 'conversão', 'campanha', 'anúncio']::TEXT[],
   ARRAY['clínica médica', 'consultório', 'tratamento de saúde']::TEXT[]),
   
  ('odontologia', 'Odontologia', 'Clínicas e consultórios odontológicos', 'local_service', 1000, 2500, 5, 10, 55, 75,
   ARRAY['dentista', 'odontologia', 'dente', 'dentes', 'gengiva', 'cárie', 'canal', 'extração', 'implante', 'prótese', 'aparelho ortodôntico', 'clareamento', 'limpeza dental', 'periodontia', 'endodontia', 'ortodontia', 'cirurgia bucomaxilofacial', 'radiografia dental', 'consultório odontológico', 'tratamento dental']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência', 'leads', 'funil', 'tráfego', 'conversão']::TEXT[],
   ARRAY['dentista', 'clínica odontológica', 'tratamento dental']::TEXT[]),
   
  ('estetica', 'Estética e Beleza', 'Clínicas de estética, salões, spas', 'local_service', 800, 2000, 4, 8, 50, 70,
   ARRAY['estética', 'beleza', 'pele', 'facial', 'corporal', 'massagem', 'depilação', 'limpeza de pele', 'peeling', 'botox', 'preenchimento', 'harmonização facial', 'tratamento capilar', 'manicure', 'pedicure', 'maquiagem', 'design de sobrancelhas', 'spa', 'relaxamento', 'rejuvenescimento']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência', 'leads', 'funil', 'tráfego', 'conversão']::TEXT[],
   ARRAY['clínica de estética', 'tratamentos estéticos', 'beleza e estética']::TEXT[]),
   
  ('construcao', 'Construção Civil', 'Construtoras, empreiteiras, reformas', 'local_service', 1200, 3000, 6, 12, 55, 75,
   ARRAY['construção', 'reforma', 'obra', 'pedreiro', 'engenheiro', 'arquiteto', 'projeto', 'planta', 'fundação', 'alvenaria', 'concreto', 'estrutura', 'acabamento', 'elétrica', 'hidráulica', 'pintura', 'revestimento', 'piso', 'telhado', 'impermeabilização', 'orçamento', 'mão de obra', 'material de construção']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência', 'leads', 'funil', 'tráfego', 'conversão', 'google ads']::TEXT[],
   ARRAY['construtora', 'reforma residencial', 'construção civil']::TEXT[]),
   
  ('automotivo', 'Automotivo', 'Oficinas mecânicas, autopeças, concessionárias', 'local_service', 1000, 2500, 5, 10, 55, 75,
   ARRAY['carro', 'veículo', 'automóvel', 'moto', 'motocicleta', 'mecânico', 'oficina', 'revisão', 'manutenção', 'reparo', 'conserto', 'peça', 'motor', 'freio', 'suspensão', 'câmbio', 'embreagem', 'óleo', 'filtro', 'pneu', 'bateria', 'ar condicionado automotivo', 'alinhamento', 'balanceamento', 'diagnóstico', 'injeção eletrônica']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência', 'leads', 'funil', 'tráfego', 'conversão']::TEXT[],
   ARRAY['oficina mecânica', 'manutenção automotiva', 'conserto de veículos']::TEXT[]),
   
  ('contabilidade', 'Contabilidade', 'Escritórios contábeis, contadores', 'b2b', 1200, 3000, 6, 12, 60, 80,
   ARRAY['contador', 'contabilidade', 'imposto', 'tributo', 'declaração', 'balanço', 'demonstração financeira', 'folha de pagamento', 'nota fiscal', 'faturamento', 'lucro', 'prejuízo', 'ativo', 'passivo', 'patrimônio', 'simples nacional', 'mei', 'ltda', 'cnpj', 'cpf', 'receita federal', 'fiscal', 'tributário', 'dre', 'livro caixa']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência de marketing', 'tráfego pago', 'leads', 'funil']::TEXT[],
   ARRAY['contador', 'escritório contábil', 'serviços contábeis']::TEXT[]),
   
  ('imobiliario', 'Imobiliário', 'Imobiliárias, corretores de imóveis', 'local_service', 1000, 2500, 5, 10, 55, 75,
   ARRAY['imóvel', 'apartamento', 'casa', 'terreno', 'lote', 'sala comercial', 'galpão', 'aluguel', 'locação', 'venda', 'compra', 'financiamento', 'corretor', 'corretagem', 'escritura', 'registro', 'condomínio', 'iptu', 'matrícula', 'avaliação', 'visita', 'contrato', 'imobiliária']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência', 'leads', 'funil', 'tráfego', 'conversão']::TEXT[],
   ARRAY['imobiliária', 'imóveis para venda', 'aluguel de imóveis']::TEXT[]),
   
  ('educacao', 'Educação', 'Escolas, cursos, treinamentos', 'informational', 1200, 3500, 6, 14, 55, 75,
   ARRAY['escola', 'curso', 'aula', 'professor', 'aluno', 'estudante', 'aprendizado', 'ensino', 'educação', 'matrícula', 'formação', 'capacitação', 'treinamento', 'certificado', 'diploma', 'vestibular', 'enem', 'concurso', 'metodologia', 'didática', 'material didático', 'apostila', 'exercício', 'prova']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência', 'tráfego pago', 'google ads']::TEXT[],
   ARRAY['escola', 'curso profissionalizante', 'educação']::TEXT[]),
   
  ('tecnologia', 'Tecnologia', 'Empresas de TI, software, desenvolvimento', 'b2b', 1500, 4000, 8, 16, 60, 80,
   ARRAY['software', 'sistema', 'aplicativo', 'app', 'site', 'website', 'desenvolvimento', 'programação', 'código', 'tecnologia', 'ti', 'infraestrutura', 'cloud', 'nuvem', 'servidor', 'banco de dados', 'api', 'integração', 'automação', 'segurança da informação', 'backup', 'suporte técnico', 'consultoria de ti', 'inteligência artificial', 'machine learning', 'seo', 'ux', 'ui', 'frontend', 'backend']::TEXT[],
   ARRAY[]::TEXT[],
   ARRAY['empresa de tecnologia', 'desenvolvimento de software', 'soluções de TI']::TEXT[]),
   
  ('marketing', 'Marketing e Agências', 'Agências de marketing, publicidade, comunicação', 'b2b', 1500, 4000, 8, 16, 65, 85,
   ARRAY['seo', 'marketing digital', 'tráfego', 'leads', 'conversão', 'funil', 'campanha', 'anúncio', 'ads', 'google ads', 'facebook ads', 'instagram', 'rede social', 'conteúdo', 'copywriting', 'landing page', 'email marketing', 'automação de marketing', 'crm', 'roi', 'kpi', 'métricas', 'analytics', 'branding', 'identidade visual', 'design gráfico', 'vídeo', 'publicidade']::TEXT[],
   ARRAY[]::TEXT[],
   ARRAY['agência de marketing', 'marketing digital', 'publicidade']::TEXT[]),
   
  ('alimentacao', 'Alimentação', 'Restaurantes, bares, delivery, food service', 'local_service', 800, 2000, 4, 8, 50, 70,
   ARRAY['restaurante', 'comida', 'refeição', 'almoço', 'jantar', 'cardápio', 'menu', 'chef', 'cozinha', 'delivery', 'entrega', 'pedido', 'reserva', 'buffet', 'self-service', 'prato', 'sobremesa', 'bebida', 'bar', 'happy hour', 'café', 'lanche', 'fast food', 'gastronomia']::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência', 'leads', 'funil', 'conversão']::TEXT[],
   ARRAY['restaurante', 'delivery de comida', 'gastronomia']::TEXT[]),
   
  ('default', 'Geral', 'Perfil padrão para nichos não categorizados', 'informational', 1200, 3000, 6, 10, 50, 70,
   ARRAY[]::TEXT[],
   ARRAY['seo', 'marketing digital', 'agência de marketing', 'tráfego pago', 'google ads', 'leads', 'funil de vendas']::TEXT[],
   ARRAY[]::TEXT[])
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  intent = EXCLUDED.intent,
  min_words = EXCLUDED.min_words,
  max_words = EXCLUDED.max_words,
  min_h2 = EXCLUDED.min_h2,
  max_h2 = EXCLUDED.max_h2,
  min_score = EXCLUDED.min_score,
  target_score = EXCLUDED.target_score,
  allowed_entities = EXCLUDED.allowed_entities,
  forbidden_entities = EXCLUDED.forbidden_entities,
  seed_keywords = EXCLUDED.seed_keywords,
  updated_at = now();