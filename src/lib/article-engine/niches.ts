/**
 * Article Engine - Niche Rulesets
 * 
 * Referência: docs/ARTICLE_ENGINE_MASTER.md
 * 
 * Este arquivo define as regras por nicho do Motor de Artigos.
 * Vocabulário, compliance, blocos obrigatórios e CTAs típicos.
 */

import type { NicheRuleset, NicheType } from './types';

// =============================================================================
// NICHE RULESETS
// =============================================================================

export const NICHE_RULESETS: Record<NicheType, NicheRuleset> = {
  
  // ─────────────────────────────────────────────────────────────────────────
  // CONTROLE DE PRAGAS
  // ─────────────────────────────────────────────────────────────────────────
  pest_control: {
    id: 'pest_control',
    name: 'pest_control',
    displayName: 'Controle de Pragas',
    
    lsiKeywords: [
      'dedetização', 'descupinização', 'desratização', 'desinsetização',
      'baratas', 'cupins', 'ratos', 'escorpiões', 'formigas', 'mosquitos',
      'pragas urbanas', 'controle de pragas', 'exterminador', 'fumigação'
    ],
    
    seedKeywords: [
      'dedetizadora', 'empresa de dedetização', 'controle de pragas',
      'dedetização residencial', 'dedetização comercial'
    ],
    
    mandatoryBlocks: [
      'tipos_de_pragas',
      'prevencao',
      'riscos_saude',
      'metodos_controle',
      'frequencia_tratamento'
    ],
    
    complianceAlerts: [
      'Mencionar uso de produtos registrados na ANVISA',
      'Alertar sobre necessidade de licença ambiental',
      'Destacar importância de profissional capacitado',
      'Informar sobre garantia do serviço'
    ],
    
    typicalCtas: [
      'Orçamento gratuito',
      'Atendimento 24h',
      'Garantia do serviço',
      'Visita técnica sem compromisso'
    ],
    
    imageKeywords: [
      'dedetização', 'controle de pragas', 'praga urbana',
      'tratamento', 'aplicação', 'equipamento profissional'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DESENTUPIDORA
  // ─────────────────────────────────────────────────────────────────────────
  plumbing: {
    id: 'plumbing',
    name: 'plumbing',
    displayName: 'Desentupidora',
    
    lsiKeywords: [
      'desentupimento', 'hidrojateamento', 'entupimento', 'esgoto',
      'pia', 'vaso sanitário', 'ralo', 'caixa de gordura', 'fossa',
      'limpa fossa', 'sifão', 'tubulação', 'cano entupido'
    ],
    
    seedKeywords: [
      'desentupidora', 'empresa de desentupimento', 'desentupir',
      'desentupimento urgente', 'desentupidora 24h'
    ],
    
    mandatoryBlocks: [
      'tipos_entupimento',
      'causas_comuns',
      'metodos',
      'prevencao',
      'quando_chamar_profissional'
    ],
    
    complianceAlerts: [
      'Mencionar descarte adequado de resíduos',
      'Alertar sobre riscos de soluções caseiras',
      'Destacar uso de equipamentos profissionais',
      'Informar sobre garantia do serviço'
    ],
    
    typicalCtas: [
      'Atendimento emergencial 24h',
      'Orçamento sem compromisso',
      'Garantia do serviço',
      'Resposta em minutos'
    ],
    
    imageKeywords: [
      'desentupimento', 'hidrojateamento', 'limpeza de esgoto',
      'equipamento profissional', 'caminhão limpa fossa'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TELHADOS
  // ─────────────────────────────────────────────────────────────────────────
  roofing: {
    id: 'roofing',
    name: 'roofing',
    displayName: 'Telhados',
    
    lsiKeywords: [
      'telhas', 'cobertura', 'impermeabilização', 'calhas', 'rufos',
      'manutenção', 'goteiras', 'infiltração', 'telhado colonial',
      'telhado de zinco', 'telha de barro', 'telha de concreto'
    ],
    
    seedKeywords: [
      'telhado', 'telhadista', 'reforma de telhado', 'instalação de telhas',
      'conserto de telhado', 'manutenção de telhado'
    ],
    
    mandatoryBlocks: [
      'tipos_telhas',
      'clima_local',
      'instalacao',
      'manutencao',
      'garantias',
      'orcamento'
    ],
    
    complianceAlerts: [
      'Mencionar certificações de materiais',
      'Destacar importância de profissional qualificado',
      'Alertar sobre segurança em altura',
      'Informar sobre normas técnicas'
    ],
    
    typicalCtas: [
      'Inspeção gratuita',
      'Orçamento detalhado',
      'Garantia de X anos',
      'Visita técnica'
    ],
    
    imageKeywords: [
      'instalação de telhas', 'telhado', 'cobertura',
      'impermeabilização', 'manutenção de telhado'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONSULTORIA DE IMAGEM
  // ─────────────────────────────────────────────────────────────────────────
  image_consulting: {
    id: 'image_consulting',
    name: 'image_consulting',
    displayName: 'Consultoria de Imagem',
    
    lsiKeywords: [
      'personal stylist', 'coloração pessoal', 'análise de estilo',
      'guarda-roupa cápsula', 'visagismo', 'dress code', 'moda',
      'consultora de imagem', 'estilo pessoal', 'closet organizado'
    ],
    
    seedKeywords: [
      'consultoria de imagem', 'personal stylist', 'consultor de estilo',
      'análise de coloração', 'visagismo'
    ],
    
    mandatoryBlocks: [
      'analise_coloracao',
      'tipos_corpo',
      'estilo_pessoal',
      'closet_inteligente',
      'ocasioes'
    ],
    
    complianceAlerts: [
      'Respeitar diversidade de corpos',
      'Não usar termos depreciativos',
      'Incluir faixas de preço variadas',
      'Ser inclusivo em recomendações'
    ],
    
    typicalCtas: [
      'Agende sua análise',
      'Consulta online disponível',
      'Transformação completa',
      'Primeira consulta grátis'
    ],
    
    imageKeywords: [
      'consultoria de imagem', 'personal stylist', 'análise de cores',
      'guarda-roupa', 'moda feminina', 'moda masculina'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ODONTOLOGIA
  // ─────────────────────────────────────────────────────────────────────────
  dental: {
    id: 'dental',
    name: 'dental',
    displayName: 'Odontologia',
    
    lsiKeywords: [
      'implante dentário', 'clareamento', 'ortodontia', 'aparelho',
      'prótese', 'canal', 'extração', 'gengivite', 'periodontia',
      'faceta', 'lente de contato dental', 'harmonização facial'
    ],
    
    seedKeywords: [
      'dentista', 'clínica odontológica', 'odontologia',
      'consultório dentário', 'tratamento dentário'
    ],
    
    mandatoryBlocks: [
      'procedimentos',
      'antes_depois',
      'cuidados',
      'valores',
      'qualificacao_profissional'
    ],
    
    complianceAlerts: [
      'Mencionar registro no CRO',
      'Não prometer resultados absolutos',
      'Informar sobre anestesia e dor',
      'Incluir orientações pós-procedimento'
    ],
    
    typicalCtas: [
      'Avaliação gratuita',
      'Agende sua consulta',
      'Financiamento disponível',
      'Atendimento de urgência'
    ],
    
    imageKeywords: [
      'dentista', 'clínica odontológica', 'sorriso',
      'implante dentário', 'clareamento dental'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ADVOCACIA
  // ─────────────────────────────────────────────────────────────────────────
  legal: {
    id: 'legal',
    name: 'legal',
    displayName: 'Advocacia',
    
    lsiKeywords: [
      'advogado', 'processo', 'ação judicial', 'direito trabalhista',
      'direito de família', 'divórcio', 'pensão', 'herança',
      'contrato', 'indenização', 'recurso', 'audiência'
    ],
    
    seedKeywords: [
      'advogado', 'escritório de advocacia', 'advocacia',
      'assessoria jurídica', 'consultoria jurídica'
    ],
    
    mandatoryBlocks: [
      'areas_atuacao',
      'como_funciona',
      'prazos',
      'documentos_necessarios',
      'honorarios'
    ],
    
    complianceAlerts: [
      'Respeitar código de ética da OAB',
      'Não garantir resultado de processos',
      'Mencionar registro na OAB',
      'Manter sigilo profissional'
    ],
    
    typicalCtas: [
      'Consulta inicial',
      'Análise do seu caso',
      'Primeira consulta gratuita',
      'Fale com um especialista'
    ],
    
    imageKeywords: [
      'advogado', 'escritório advocacia', 'direito',
      'justiça', 'tribunal', 'consultoria jurídica'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONTABILIDADE
  // ─────────────────────────────────────────────────────────────────────────
  accounting: {
    id: 'accounting',
    name: 'accounting',
    displayName: 'Contabilidade',
    
    lsiKeywords: [
      'contador', 'imposto de renda', 'IRPF', 'MEI', 'CNPJ',
      'folha de pagamento', 'fiscal', 'tributário', 'balanço',
      'declaração', 'nota fiscal', 'simples nacional'
    ],
    
    seedKeywords: [
      'contador', 'escritório contábil', 'contabilidade',
      'assessoria contábil', 'serviços contábeis'
    ],
    
    mandatoryBlocks: [
      'servicos',
      'tipos_empresa',
      'obrigacoes_fiscais',
      'prazos',
      'beneficios'
    ],
    
    complianceAlerts: [
      'Mencionar registro no CRC',
      'Informar sobre prazos legais',
      'Alertar sobre multas por atraso',
      'Manter atualização sobre legislação'
    ],
    
    typicalCtas: [
      'Diagnóstico gratuito',
      'Consultoria inicial',
      'Migre seu contador',
      'Abra sua empresa'
    ],
    
    imageKeywords: [
      'contador', 'escritório contábil', 'contabilidade',
      'documentos fiscais', 'calculadora', 'planilhas'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IMOBILIÁRIA
  // ─────────────────────────────────────────────────────────────────────────
  real_estate: {
    id: 'real_estate',
    name: 'real_estate',
    displayName: 'Imobiliária',
    
    lsiKeywords: [
      'imóvel', 'apartamento', 'casa', 'aluguel', 'venda', 'compra',
      'financiamento', 'FGTS', 'escritura', 'registro', 'condomínio',
      'corretor', 'CRECI', 'avaliação'
    ],
    
    seedKeywords: [
      'imobiliária', 'corretor de imóveis', 'imóveis',
      'casa para vender', 'apartamento para alugar'
    ],
    
    mandatoryBlocks: [
      'tipos_imoveis',
      'localizacao',
      'documentacao',
      'financiamento',
      'dicas_negociacao'
    ],
    
    complianceAlerts: [
      'Mencionar registro no CRECI',
      'Informar sobre documentação necessária',
      'Alertar sobre taxas e impostos',
      'Ser transparente sobre valores'
    ],
    
    typicalCtas: [
      'Avaliação gratuita',
      'Agende uma visita',
      'Fale com um corretor',
      'Simule seu financiamento'
    ],
    
    imageKeywords: [
      'imóvel', 'casa', 'apartamento', 'imobiliária',
      'corretor', 'chaves', 'contrato'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AUTOMOTIVO
  // ─────────────────────────────────────────────────────────────────────────
  automotive: {
    id: 'automotive',
    name: 'automotive',
    displayName: 'Automotivo',
    
    lsiKeywords: [
      'mecânica', 'oficina', 'troca de óleo', 'freios', 'suspensão',
      'motor', 'câmbio', 'elétrica automotiva', 'ar condicionado',
      'funilaria', 'pintura', 'revisão', 'manutenção preventiva'
    ],
    
    seedKeywords: [
      'mecânico', 'oficina mecânica', 'auto elétrica',
      'funilaria e pintura', 'revisão automotiva'
    ],
    
    mandatoryBlocks: [
      'servicos',
      'marcas_atendidas',
      'sintomas_problemas',
      'manutencao_preventiva',
      'garantia'
    ],
    
    complianceAlerts: [
      'Informar sobre garantia de serviços',
      'Usar peças originais ou de qualidade',
      'Alertar sobre riscos de adiar manutenção',
      'Ser transparente sobre diagnóstico'
    ],
    
    typicalCtas: [
      'Orçamento gratuito',
      'Agende sua revisão',
      'Diagnóstico computadorizado',
      'Leva e traz grátis'
    ],
    
    imageKeywords: [
      'oficina mecânica', 'mecânico', 'carro',
      'manutenção automotiva', 'motor', 'ferramentas'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTRUÇÃO
  // ─────────────────────────────────────────────────────────────────────────
  construction: {
    id: 'construction',
    name: 'construction',
    displayName: 'Construção',
    
    lsiKeywords: [
      'reforma', 'obra', 'construção', 'pedreiro', 'empreiteira',
      'projeto', 'acabamento', 'alvenaria', 'fundação', 'estrutura',
      'arquiteto', 'engenheiro', 'ART', 'RRT'
    ],
    
    seedKeywords: [
      'construtora', 'reforma', 'construção civil',
      'empreiteira', 'obra residencial'
    ],
    
    mandatoryBlocks: [
      'tipos_servico',
      'etapas_obra',
      'materiais',
      'prazos',
      'orcamento'
    ],
    
    complianceAlerts: [
      'Informar sobre ART/RRT',
      'Alertar sobre licenças necessárias',
      'Mencionar normas técnicas',
      'Ser transparente sobre prazos'
    ],
    
    typicalCtas: [
      'Orçamento detalhado',
      'Visita técnica gratuita',
      'Projeto 3D grátis',
      'Financiamos sua obra'
    ],
    
    imageKeywords: [
      'construção', 'obra', 'reforma', 'pedreiro',
      'construtora', 'projeto arquitetônico'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ESTÉTICA
  // ─────────────────────────────────────────────────────────────────────────
  beauty: {
    id: 'beauty',
    name: 'beauty',
    displayName: 'Estética',
    
    lsiKeywords: [
      'harmonização facial', 'botox', 'preenchimento', 'peeling',
      'limpeza de pele', 'depilação a laser', 'massagem',
      'drenagem linfática', 'tratamento corporal', 'emagrecimento'
    ],
    
    seedKeywords: [
      'clínica de estética', 'esteticista', 'estética facial',
      'estética corporal', 'tratamentos estéticos'
    ],
    
    mandatoryBlocks: [
      'procedimentos',
      'resultados',
      'cuidados',
      'contraindicacoes',
      'valores'
    ],
    
    complianceAlerts: [
      'Não prometer resultados milagrosos',
      'Informar sobre contraindicações',
      'Mencionar qualificação profissional',
      'Alertar sobre cuidados pós-procedimento'
    ],
    
    typicalCtas: [
      'Avaliação gratuita',
      'Agende sua sessão',
      'Pacotes promocionais',
      'Primeira sessão com desconto'
    ],
    
    imageKeywords: [
      'estética', 'tratamento facial', 'harmonização',
      'clínica estética', 'procedimento estético'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EDUCAÇÃO
  // ─────────────────────────────────────────────────────────────────────────
  education: {
    id: 'education',
    name: 'education',
    displayName: 'Educação',
    
    lsiKeywords: [
      'curso', 'treinamento', 'formação', 'certificado', 'diploma',
      'aula particular', 'professor', 'metodologia', 'EAD',
      'presencial', 'workshop', 'capacitação'
    ],
    
    seedKeywords: [
      'curso', 'escola', 'formação profissional',
      'treinamento', 'capacitação'
    ],
    
    mandatoryBlocks: [
      'conteudo_programatico',
      'metodologia',
      'certificacao',
      'investimento',
      'depoimentos'
    ],
    
    complianceAlerts: [
      'Informar sobre carga horária',
      'Mencionar certificação válida',
      'Ser claro sobre pré-requisitos',
      'Informar sobre política de cancelamento'
    ],
    
    typicalCtas: [
      'Matricule-se agora',
      'Aula experimental grátis',
      'Fale com um consultor',
      'Garanta sua vaga'
    ],
    
    imageKeywords: [
      'curso', 'sala de aula', 'treinamento',
      'formação', 'certificado', 'professor'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TECNOLOGIA
  // ─────────────────────────────────────────────────────────────────────────
  technology: {
    id: 'technology',
    name: 'technology',
    displayName: 'Tecnologia',
    
    lsiKeywords: [
      'software', 'sistema', 'aplicativo', 'site', 'desenvolvimento',
      'programação', 'TI', 'infraestrutura', 'cloud', 'segurança',
      'suporte técnico', 'manutenção', 'consultoria'
    ],
    
    seedKeywords: [
      'empresa de TI', 'desenvolvimento de software', 'suporte técnico',
      'criação de sites', 'consultoria em tecnologia'
    ],
    
    mandatoryBlocks: [
      'servicos',
      'tecnologias',
      'metodologia',
      'cases',
      'suporte'
    ],
    
    complianceAlerts: [
      'Mencionar segurança de dados',
      'Informar sobre LGPD',
      'Ser claro sobre SLAs',
      'Alertar sobre backup e recuperação'
    ],
    
    typicalCtas: [
      'Solicite um orçamento',
      'Agende uma demonstração',
      'Fale com um especialista',
      'Diagnóstico gratuito'
    ],
    
    imageKeywords: [
      'tecnologia', 'programação', 'computador',
      'software', 'TI', 'servidor'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DEFAULT (Fallback)
  // ─────────────────────────────────────────────────────────────────────────
  default: {
    id: 'default',
    name: 'default',
    displayName: 'Serviços Gerais',
    
    lsiKeywords: [
      'serviço', 'profissional', 'qualidade', 'atendimento',
      'orçamento', 'garantia', 'experiência'
    ],
    
    seedKeywords: [
      'empresa', 'serviços', 'profissional',
      'atendimento', 'solução'
    ],
    
    mandatoryBlocks: [
      'servicos',
      'diferenciais',
      'como_funciona',
      'contato'
    ],
    
    complianceAlerts: [
      'Ser transparente sobre serviços',
      'Informar sobre garantias',
      'Manter profissionalismo'
    ],
    
    typicalCtas: [
      'Entre em contato',
      'Solicite um orçamento',
      'Fale conosco',
      'Saiba mais'
    ],
    
    imageKeywords: [
      'profissional', 'atendimento', 'serviço',
      'equipe', 'escritório'
    ]
  }
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Obtém ruleset por ID
 */
export function getNiche(id: NicheType): NicheRuleset {
  return NICHE_RULESETS[id] || NICHE_RULESETS.default;
}

/**
 * Lista todos os nichos disponíveis
 */
export function listNiches(): NicheRuleset[] {
  return Object.values(NICHE_RULESETS);
}

/**
 * Verifica se nicho existe
 */
export function isValidNiche(id: string): id is NicheType {
  return id in NICHE_RULESETS;
}

/**
 * Obtém LSI keywords de um nicho
 */
export function getLsiKeywords(id: NicheType): string[] {
  const niche = getNiche(id);
  return niche.lsiKeywords;
}

/**
 * Obtém CTAs típicos de um nicho
 */
export function getTypicalCtas(id: NicheType): string[] {
  const niche = getNiche(id);
  return niche.typicalCtas;
}

/**
 * Obtém alertas de compliance de um nicho
 */
export function getComplianceAlerts(id: NicheType): string[] {
  const niche = getNiche(id);
  return niche.complianceAlerts;
}
