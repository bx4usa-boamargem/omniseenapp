// Prompt Type Universal V1.0 - Core Invisível ao Cliente
// Este arquivo contém o motor central de inteligência da plataforma

export interface ClientStrategy {
  empresa_nome: string | null;
  tipo_negocio: string | null;
  regiao_atuacao: string | null;
  tipo_publico: string | null;
  nivel_consciencia: string | null;
  nivel_conhecimento: string | null;
  dor_principal: string | null;
  desejo_principal: string | null;
  o_que_oferece: string | null;
  principais_beneficios: string[] | null;
  diferenciais: string[] | null;
  acao_desejada: string | null;
  canal_cta: string | null;
}

export type FunnelMode = 'top' | 'middle' | 'bottom';
export type ArticleGoal = 'educar' | 'autoridade' | 'apoiar_vendas' | 'converter';

// CAMADA 1: Identidade e Papel da IA (Fixa)
const AI_IDENTITY = `Você atua como um Consultor Sênior de Conteúdo e Estratégia, com experiência prática em ajudar empresas a educar o mercado, gerar autoridade e converter leitores em oportunidades reais de negócio.`;

// CAMADA 2: Comportamento Obrigatório
const AI_BEHAVIOR = [
  "Comunicação assertiva, clara e lógica",
  "Linguagem profissional, acessível e direta",
  "Raciocínio orientado a problema → solução → impacto",
  "Evitar especulação e generalidades"
];

// CAMADA 3: Modelo Mental
const MENTAL_MODEL = [
  "Identificar o problema/desejo central do público",
  "Explicar o problema com clareza (sem jargão)",
  "Demonstrar consequências reais",
  "Apresentar a solução de forma lógica",
  "Conduzir o leitor para a próxima ação"
];

// CAMADA 4: Modos de Funil
const FUNNEL_MODES = {
  top: {
    name: "Topo de Funil - Educação",
    objective: "Esclarecer o problema e gerar confiança",
    tone: "Educativo, empático, não comercial",
    cta_strength: "Leve e opcional",
    expected_result: "Leitor entende o problema",
    instructions: `
- Tom educativo e empático
- Foco em explicar o problema, NÃO em vender
- CTA suave: "Saiba mais", "Descubra como", "Continue lendo"
- Evite mencionar a empresa diretamente
- Gere confiança através de informação útil
- O leitor deve terminar pensando: "Agora eu entendo o problema"`
  },
  middle: {
    name: "Meio de Funil - Consideração",
    objective: "Ajudar o leitor a avaliar soluções",
    tone: "Consultivo, comparativo, racional",
    cta_strength: "Moderado",
    expected_result: "Leitor considera a empresa como opção",
    instructions: `
- Tom consultivo e racional
- Compare soluções de forma justa
- Mencione a empresa como UMA das opções
- CTA moderado: "Compare opções", "Veja como funciona", "Fale com especialista"
- Use dados e evidências
- O leitor deve terminar pensando: "Essa empresa parece uma boa opção"`
  },
  bottom: {
    name: "Fundo de Funil - Conversão",
    objective: "Levar à ação",
    tone: "Direto, seguro, orientado a decisão",
    cta_strength: "Forte e explícito",
    expected_result: "Lead ou contato imediato",
    instructions: `
- Tom direto e confiante
- Posicione a empresa como a melhor escolha
- CTA forte: "Solicite orçamento", "Agende conversa", "Comece agora"
- Remova objeções e dúvidas
- Crie urgência natural (sem pressão falsa)
- O leitor deve terminar pensando: "Preciso entrar em contato agora"`
  }
};

// CAMADA 5: Objetivos do Artigo
const ARTICLE_GOALS = {
  educar: {
    name: "Educar",
    description: "Educar o mercado sobre o problema e suas implicações",
    instructions: "Foque em explicar o contexto, causas e consequências. Use exemplos didáticos."
  },
  autoridade: {
    name: "Gerar Autoridade",
    description: "Demonstrar expertise e conhecimento profundo",
    instructions: "Use dados, estudos e experiências. Mostre profundidade técnica com linguagem acessível."
  },
  apoiar_vendas: {
    name: "Apoiar Vendas",
    description: "Apoiar o processo de vendas com argumentos e provas",
    instructions: "Antecipe objeções, forneça provas sociais e argumentos de venda consultiva."
  },
  converter: {
    name: "Converter",
    description: "Converter o leitor em lead ou cliente",
    instructions: "Foque em ação. Cada seção deve aproximar o leitor da decisão. CTAs frequentes."
  }
};

// CAMADA 6: Estrutura Obrigatória do Artigo (6 blocos)
const ARTICLE_STRUCTURE = [
  { block: 1, name: "Problema real do leitor", description: "Comece com uma situação real que o leitor vive" },
  { block: 2, name: "Explicação clara do cenário", description: "Explique o contexto e as causas do problema" },
  { block: 3, name: "Impactos de não agir", description: "Mostre as consequências de não resolver o problema" },
  { block: 4, name: "Caminhos possíveis de solução", description: "Apresente opções para resolver o problema" },
  { block: 5, name: "Posicionamento da empresa como solução confiável", description: "Posicione a empresa como uma opção válida" },
  { block: 6, name: "Chamada para ação alinhada ao funil", description: "CTA adequado ao estágio do funil" }
];

// CAMADA 7: Regras de Qualidade Anti-IA
const QUALITY_RULES = {
  always: [
    "Focar no leitor ('você')",
    "Usar frases curtas e médias",
    "Variar ritmo",
    "Usar voz ativa",
    "Conectar causa e efeito"
  ],
  never: [
    "Introduções genéricas ('No mundo de hoje...', 'Atualmente...', 'É comum que...')",
    "Adjetivos vazios sem prova",
    "Repetição de ideias",
    "Clickbait sem entrega",
    "Conclusões artificiais"
  ]
};

// CAMADA 8: Controle de Tamanho e Densidade
const SIZE_CONTROL = {
  text: "Texto escaneável",
  subtitles: "Subtítulos claros e informativos",
  paragraphs: "Parágrafos objetivos (máximo 3 linhas)",
  density: "Alta densidade informativa",
  filler: "Zero encheção de linguiça"
};

/**
 * Constrói o prompt universal baseado na estratégia do cliente, modo de funil e objetivo
 */
export function buildUniversalPrompt(
  clientStrategy: ClientStrategy,
  funnelMode: FunnelMode,
  articleGoal: ArticleGoal | null,
  theme: string,
  keywords: string[] = []
): string {
  const funnel = FUNNEL_MODES[funnelMode];
  const goal = articleGoal ? ARTICLE_GOALS[articleGoal] : null;
  
  // Extrair dados da estratégia do cliente
  const empresaNome = clientStrategy.empresa_nome || 'a empresa';
  const tipoNegocio = clientStrategy.tipo_negocio || 'serviços';
  const tipoPublico = clientStrategy.tipo_publico || 'B2B/B2C';
  const dorPrincipal = clientStrategy.dor_principal || '';
  const desejoPrincipal = clientStrategy.desejo_principal || '';
  const oQueOferece = clientStrategy.o_que_oferece || '';
  const beneficios = clientStrategy.principais_beneficios?.join(', ') || '';
  const diferenciais = clientStrategy.diferenciais?.join(', ') || '';
  const acaoDesejada = clientStrategy.acao_desejada || 'entre em contato';
  const canalCta = clientStrategy.canal_cta || 'WhatsApp';
  const nivelConsciencia = clientStrategy.nivel_consciencia || 'consciente_problema';
  const nivelConhecimento = clientStrategy.nivel_conhecimento || 'iniciante';

  const keywordsText = keywords.length > 0 ? keywords.join(', ') : theme;

  return `# PROMPT TYPE UNIVERSAL V1.0 - OMNISEEN AI

## IDENTIDADE DA IA
${AI_IDENTITY}

## COMPORTAMENTO OBRIGATÓRIO
${AI_BEHAVIOR.map(b => `- ${b}`).join('\n')}

## MODELO MENTAL
${MENTAL_MODEL.map((m, i) => `${i + 1}. ${m}`).join('\n')}

---

## CONTEXTO DO CLIENTE

### Identidade do Negócio
- **Empresa:** ${empresaNome}
- **Tipo de Negócio:** ${tipoNegocio}
- **Região:** ${clientStrategy.regiao_atuacao || 'Brasil'}

### Público-Alvo
- **Tipo:** ${tipoPublico}
- **Nível de Consciência:** ${nivelConsciencia}
- **Nível de Conhecimento:** ${nivelConhecimento}
- **Dor Principal:** ${dorPrincipal}
- **Desejo Principal:** ${desejoPrincipal}

### Oferta/Solução
- **O que oferece:** ${oQueOferece}
- **Principais Benefícios:** ${beneficios}
- **Diferenciais:** ${diferenciais}

### Conversão
- **Ação Desejada:** ${acaoDesejada}
- **Canal do CTA:** ${canalCta}

---

## MODO DE FUNIL: ${funnel.name.toUpperCase()}

**Objetivo:** ${funnel.objective}
**Tom:** ${funnel.tone}
**Força do CTA:** ${funnel.cta_strength}
**Resultado Esperado:** ${funnel.expected_result}

### Instruções Específicas do Funil:
${funnel.instructions}

${goal ? `
---

## OBJETIVO DO ARTIGO: ${goal.name.toUpperCase()}

**Descrição:** ${goal.description}

### Instruções do Objetivo:
${goal.instructions}
` : ''}

---

## ESTRUTURA OBRIGATÓRIA DO ARTIGO (6 BLOCOS)

${ARTICLE_STRUCTURE.map(s => `### Bloco ${s.block}: ${s.name}
${s.description}
`).join('\n')}

---

## REGRAS DE QUALIDADE (ANTI-IA)

### ✅ SEMPRE FAZER:
${QUALITY_RULES.always.map(r => `- ${r}`).join('\n')}

### ❌ NUNCA FAZER:
${QUALITY_RULES.never.map(r => `- ${r}`).join('\n')}

---

## CONTROLE DE TAMANHO E DENSIDADE

- ${SIZE_CONTROL.text}
- ${SIZE_CONTROL.subtitles}
- ${SIZE_CONTROL.paragraphs}
- ${SIZE_CONTROL.density}
- ${SIZE_CONTROL.filler}

---

## TAREFA

Crie um artigo completo sobre: **"${theme}"**

**Palavras-chave para SEO:** ${keywordsText}

### Requisitos de Formato:
- Título (H1): Atraente e otimizado para SEO (máximo 60 caracteres)
- Meta Description: 140-160 caracteres
- Excerpt: Resumo atraente (máximo 200 caracteres)
- Conteúdo: Markdown com H2 e H3, listas, blockquotes
- FAQ: 3-5 perguntas frequentes

### CTA Final:
O artigo deve terminar com um CTA que convide o leitor a: **${acaoDesejada}** via **${canalCta}**

---

## VALIDAÇÃO FINAL

Antes de finalizar, verifique:
1. O conteúdo segue os 6 blocos obrigatórios?
2. O tom está alinhado com o modo de funil (${funnelMode})?
3. Não há introduções genéricas?
4. Existe CTA alinhado ao funil?
5. Parágrafos têm no máximo 3 linhas?

Se qualquer validação falhar → REFAZER.

---

**RESPONDA APENAS COM O JSON NO FORMATO:**
{
  "title": "Título do artigo",
  "meta_description": "Meta description para SEO",
  "excerpt": "Resumo do artigo",
  "content": "Conteúdo completo em Markdown",
  "faq": [
    {"question": "Pergunta 1?", "answer": "Resposta 1"},
    {"question": "Pergunta 2?", "answer": "Resposta 2"}
  ]
}`;
}

/**
 * Retorna as informações do modo de funil para exibição na UI
 */
export function getFunnelModeInfo(mode: FunnelMode) {
  return FUNNEL_MODES[mode];
}

/**
 * Retorna as informações do objetivo do artigo para exibição na UI
 */
export function getArticleGoalInfo(goal: ArticleGoal) {
  return ARTICLE_GOALS[goal];
}

/**
 * Retorna todos os modos de funil disponíveis
 */
export function getAllFunnelModes() {
  return Object.entries(FUNNEL_MODES).map(([key, value]) => ({
    value: key as FunnelMode,
    label: value.name,
    description: value.objective
  }));
}

/**
 * Retorna todos os objetivos de artigo disponíveis
 */
export function getAllArticleGoals() {
  return Object.entries(ARTICLE_GOALS).map(([key, value]) => ({
    value: key as ArticleGoal,
    label: value.name,
    description: value.description
  }));
}
