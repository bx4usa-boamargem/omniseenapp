// Performance Optimizer Engine V1.0
// Motor de Otimização de Performance orientado por KPIs

export interface DiagnosticIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'intro' | 'title' | 'structure' | 'rhythm' | 'cta' | 'scannability';
  message: string;
  location?: string; // e.g., "Parágrafo 3", "Seção H2 #2"
  suggestion?: string;
}

export interface PerformanceDiagnosis {
  overall_health: 'poor' | 'moderate' | 'good' | 'excellent';
  score: number; // 0-100
  estimated_read_time_seconds: number;
  predicted_scroll_depth: number; // 0-100%
  predicted_bounce_rate: number; // 0-100%
  issues: DiagnosticIssue[];
}

export interface TitleSuggestion {
  title: string;
  improvement: string; // e.g., "Mais específico", "Gera curiosidade"
  predicted_ctr_boost: number; // e.g., +15%
}

export interface SectionSuggestion {
  section_name: string;
  original_excerpt: string;
  suggested_rewrite: string;
  improvement_reason: string;
}

export interface OptimizationSuggestions {
  title_alternatives: TitleSuggestion[];
  intro_rewrite?: string;
  sections_to_fix: SectionSuggestion[];
  cta_optimized?: string;
  highlight_blocks_to_add: string[];
}

export interface KPIImprovements {
  estimated_read_time_delta: number; // segundos
  predicted_scroll_depth_delta: number; // %
  predicted_bounce_rate_delta: number; // % (negativo é bom)
}

// IDENTIDADE DO MOTOR DE PERFORMANCE
const PERFORMANCE_ENGINE_IDENTITY = `Você é o MOTOR DE OTIMIZAÇÃO DE PERFORMANCE deste blog.

Você não "edita texto". Você:
- Aumenta tempo de leitura
- Reduz rejeição (bounce rate)
- Eleva cliques em CTAs
- Melhora posição em SEO
- Conduz o leitor até o final

Cada ajuste deve responder à pergunta:
"Isso faz o leitor ficar mais tempo, entender melhor e agir com mais facilidade?"

Você é o editor invisível que transforma conteúdo comum em conteúdo que performa.`;

// CAMADA DE DIAGNÓSTICO INTELIGENTE
const DIAGNOSTIC_RULES = {
  intro_weak: {
    symptoms: [
      "Primeiros parágrafos genéricos ou abstratos",
      "Falta de identificação imediata com o leitor",
      "Ausência de tensão ou curiosidade",
      "Início com 'No mundo de hoje...', 'Atualmente...', etc."
    ],
    diagnosis: "A introdução não cria tensão suficiente"
  },
  title_not_magnetic: {
    symptoms: [
      "Título genérico sem especificidade",
      "Falta de curiosidade prática",
      "Ausência de benefício claro",
      "Título muito longo (>70 caracteres)"
    ],
    diagnosis: "O título não ativa curiosidade"
  },
  paragraphs_too_long: {
    symptoms: [
      "Parágrafos com mais de 3 linhas",
      "Blocos de texto densos sem quebras",
      "Ausência de listas ou bullets"
    ],
    diagnosis: "O segundo bloco tem leitura cansativa"
  },
  cta_position_late: {
    symptoms: [
      "CTA apenas no final do artigo",
      "Nenhuma chamada para ação no meio",
      "Leitor pode abandonar antes de ver o CTA"
    ],
    diagnosis: "O CTA está tarde demais no texto"
  },
  no_visual_rhythm: {
    symptoms: [
      "Ausência de alternância entre texto/listas/subtítulos",
      "Sem blocos de destaque (blockquotes)",
      "Distribuição irregular de H2s"
    ],
    diagnosis: "O artigo ensina, mas não conduz"
  },
  low_scannability: {
    symptoms: [
      "Subtítulos genéricos que não informam",
      "Ausência de negrito em pontos-chave",
      "Leitor não consegue escanear em 10 segundos"
    ],
    diagnosis: "Baixa escaneabilidade nos primeiros 20 segundos"
  }
};

// CAMADA DE CORREÇÃO POR KPI
const CORRECTION_RULES = {
  title: {
    goal: "Aumentar CTR",
    instructions: [
      "Ser mais específico (números, resultados concretos)",
      "Gerar curiosidade prática (não clickbait)",
      "Incluir benefício claro para o leitor",
      "Manter entre 50-70 caracteres"
    ],
    examples: [
      "De: 'Dicas de Atendimento' → Para: 'Como Atender 3x Mais Clientes Sem Contratar Ninguém'",
      "De: 'Erros Comuns' → Para: 'O Erro de R$5.000 que Todo Prestador Comete Sem Perceber'"
    ]
  },
  intro: {
    goal: "Prender nos primeiros 3 parágrafos",
    instructions: [
      "Gerar identificação imediata ('Você já passou por isso?')",
      "Criar tensão ou mostrar o problema real",
      "Prometer valor claro (o que o leitor vai ganhar)",
      "Máximo 3-4 linhas por parágrafo na intro"
    ]
  },
  structure: {
    goal: "Aumentar scroll depth",
    instructions: [
      "Parágrafos curtos (1-3 linhas)",
      "H2 e H3 claros e informativos (não genéricos)",
      "Listas escaneáveis quando houver enumerações",
      "Espaço em branco entre blocos"
    ]
  },
  highlight_blocks: {
    goal: "Aumentar retenção emocional",
    instructions: [
      "Inserir pelo menos 2-3 blockquotes com frases de impacto",
      "Usar formato: > *Frase curta, impactante*",
      "Posicionar em momentos de 'virada de consciência'",
      "Cada bloco deve ser algo que o leitor quer sublinhar"
    ],
    examples: [
      "> *Quem responde primeiro, vende primeiro.*",
      "> *O problema não é falta de cliente. É falta de organização para atender.*"
    ]
  },
  cta: {
    goal: "Aumentar conversão",
    instructions: [
      "Tornar mais humano e contextual",
      "Conectar a dor do artigo com a solução",
      "Posicionar no ponto emocional correto (após resolver uma objeção)",
      "Evitar linguagem de venda agressiva"
    ],
    examples: [
      "Se você sente que poderia atender melhor seus clientes sem se sobrecarregar, talvez seja hora de conhecer uma forma mais simples de automatizar seu dia."
    ]
  }
};

/**
 * Constrói o prompt de diagnóstico para o modo assistido
 */
export function buildDiagnosticPrompt(
  title: string,
  content: string,
  metaDescription?: string
): string {
  return `# MOTOR DE PERFORMANCE - MODO DIAGNÓSTICO

${PERFORMANCE_ENGINE_IDENTITY}

---

## TAREFA: ANÁLISE DE PERFORMANCE

Analise o artigo abaixo e identifique problemas que afetam:
- Tempo de leitura
- Taxa de rolagem (scroll depth)
- Taxa de rejeição (bounce rate)
- Cliques em CTA
- Posição em SEO

## CRITÉRIOS DE DIAGNÓSTICO

${Object.entries(DIAGNOSTIC_RULES).map(([key, rule]) => `
### ${rule.diagnosis}
Sintomas:
${rule.symptoms.map(s => `- ${s}`).join('\n')}
`).join('\n')}

---

## ARTIGO PARA ANÁLISE

**Título:** ${title}
${metaDescription ? `**Meta Description:** ${metaDescription}` : ''}

**Conteúdo:**
${content}

---

## FORMATO DE RESPOSTA (JSON)

Retorne um JSON com a seguinte estrutura:
{
  "overall_health": "poor" | "moderate" | "good" | "excellent",
  "score": 0-100,
  "estimated_read_time_seconds": number,
  "predicted_scroll_depth": 0-100,
  "predicted_bounce_rate": 0-100,
  "issues": [
    {
      "id": "intro_weak",
      "severity": "critical" | "warning" | "info",
      "category": "intro" | "title" | "structure" | "rhythm" | "cta" | "scannability",
      "message": "Diagnóstico em linguagem humana",
      "location": "Onde está o problema (opcional)",
      "suggestion": "Sugestão de correção (opcional)"
    }
  ]
}

⚠️ IMPORTANTE:
- Seja específico nos diagnósticos
- Use linguagem humana e direta
- Priorize issues por impacto em performance
- Máximo 5 issues principais`;
}

/**
 * Constrói o prompt de sugestões para o modo assistido
 */
export function buildSuggestionsPrompt(
  title: string,
  content: string,
  diagnosis: PerformanceDiagnosis,
  companyName?: string
): string {
  const issuesList = diagnosis.issues.map(i => `- ${i.message} (${i.severity})`).join('\n');

  return `# MOTOR DE PERFORMANCE - MODO SUGESTÕES

${PERFORMANCE_ENGINE_IDENTITY}

---

## DIAGNÓSTICO RECEBIDO

Score: ${diagnosis.score}/100 (${diagnosis.overall_health})
Issues identificadas:
${issuesList}

---

## REGRAS DE CORREÇÃO

${Object.entries(CORRECTION_RULES).map(([key, rule]) => `
### ${key.toUpperCase()} - Meta: ${rule.goal}
${rule.instructions.map((i: string) => `- ${i}`).join('\n')}
${'examples' in rule && rule.examples ? `Exemplos:\n${rule.examples.map((e: string) => `  ${e}`).join('\n')}` : ''}
`).join('\n')}

---

## ARTIGO ATUAL

**Título:** ${title}
${companyName ? `**Empresa:** ${companyName}` : ''}

**Conteúdo:**
${content}

---

## TAREFA: GERAR SUGESTÕES

Com base no diagnóstico, gere sugestões específicas para melhorar a performance.

## FORMATO DE RESPOSTA (JSON)

{
  "title_alternatives": [
    {
      "title": "Novo título sugerido",
      "improvement": "Por que é melhor",
      "predicted_ctr_boost": 15
    }
  ],
  "intro_rewrite": "Nova introdução reescrita (se necessário)",
  "sections_to_fix": [
    {
      "section_name": "Nome da seção H2",
      "original_excerpt": "Trecho original problemático",
      "suggested_rewrite": "Versão otimizada",
      "improvement_reason": "Por que essa versão é melhor"
    }
  ],
  "cta_optimized": "CTA otimizado (se necessário)",
  "highlight_blocks_to_add": [
    "> *Frase de impacto para adicionar*"
  ]
}`;
}

/**
 * Constrói o prompt de reescrita autônoma
 */
export function buildAutonomousRewritePrompt(
  title: string,
  content: string,
  diagnosis: PerformanceDiagnosis,
  companyName?: string
): string {
  return `# MOTOR DE PERFORMANCE - MODO AUTÔNOMO

${PERFORMANCE_ENGINE_IDENTITY}

---

## DIAGNÓSTICO ATUAL

Score: ${diagnosis.score}/100 (${diagnosis.overall_health})
- Scroll Depth Previsto: ${diagnosis.predicted_scroll_depth}%
- Bounce Rate Previsto: ${diagnosis.predicted_bounce_rate}%
- Tempo de Leitura: ${Math.round(diagnosis.estimated_read_time_seconds / 60)} min

Issues:
${diagnosis.issues.map(i => `- ${i.message}`).join('\n')}

---

## REGRAS DE CORREÇÃO (APLICAR TODAS)

${Object.entries(CORRECTION_RULES).map(([key, rule]) => `
### ${key.toUpperCase()}
Meta: ${rule.goal}
${rule.instructions.map(i => `- ${i}`).join('\n')}
`).join('\n')}

---

## ARTIGO PARA REESCREVER

**Título Atual:** ${title}
${companyName ? `**Empresa:** ${companyName}` : ''}

**Conteúdo:**
${content}

---

## TAREFA: REESCRITA COMPLETA

Reescreva o artigo INTEIRO aplicando todas as correções necessárias para:
1. Aumentar tempo de leitura
2. Reduzir bounce rate
3. Aumentar scroll depth
4. Melhorar conversão do CTA

## REGRAS ABSOLUTAS:
- Manter a ideia central do artigo
- Manter a estrutura de H2s (ajustar textos internos)
- Parágrafos de no máximo 3 linhas
- Incluir pelo menos 2-3 blocos de destaque (> *frase*)
- Introdução que prende nos primeiros 10 segundos
- CTA contextual e humano
- Título magnético (se necessário, sugira novo título)

## FORMATO DE RESPOSTA (JSON)

{
  "optimized_title": "Título otimizado",
  "optimized_content": "Conteúdo completo em Markdown",
  "changes_summary": [
    "Resumo de cada mudança feita"
  ],
  "kpi_improvements": {
    "estimated_read_time_delta": 30,
    "predicted_scroll_depth_delta": 15,
    "predicted_bounce_rate_delta": -10
  }
}`;
}

/**
 * Calcula métricas preditivas básicas baseadas na estrutura do artigo
 */
export function calculatePredictiveMetrics(content: string, title: string): {
  estimated_read_time_seconds: number;
  predicted_scroll_depth: number;
  predicted_bounce_rate: number;
} {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const paragraphs = content.split(/\n\n+/);
  const h2Count = (content.match(/^## /gm) || []).length;
  const blockquotes = (content.match(/^>\s*\*/gm) || []).length;
  const lists = (content.match(/^[-*]\s/gm) || []).length;
  
  // Tempo de leitura: ~200 palavras por minuto
  const estimated_read_time_seconds = Math.round((wordCount / 200) * 60);
  
  // Scroll depth baseado em estrutura
  let scrollScore = 50; // base
  
  // Bons indicadores
  if (h2Count >= 3 && h2Count <= 7) scrollScore += 10;
  if (blockquotes >= 2) scrollScore += 10;
  if (lists >= 3) scrollScore += 5;
  
  // Maus indicadores
  const longParagraphs = paragraphs.filter(p => p.split('\n').length > 4).length;
  if (longParagraphs > 2) scrollScore -= 15;
  
  // Título magnético
  const titleScore = calculateTitleMagnetism(title);
  if (titleScore > 70) scrollScore += 10;
  
  const predicted_scroll_depth = Math.min(95, Math.max(20, scrollScore));
  
  // Bounce rate inversamente proporcional
  const introQuality = analyzeIntroQuality(content);
  let bounceScore = 50;
  if (introQuality.has_hook) bounceScore -= 10;
  if (introQuality.has_identification) bounceScore -= 10;
  if (titleScore > 70) bounceScore -= 10;
  if (longParagraphs > 2) bounceScore += 15;
  
  const predicted_bounce_rate = Math.min(80, Math.max(15, bounceScore));
  
  return {
    estimated_read_time_seconds,
    predicted_scroll_depth,
    predicted_bounce_rate
  };
}

function calculateTitleMagnetism(title: string): number {
  let score = 50;
  
  // Números específicos aumentam CTR
  if (/\d+/.test(title)) score += 15;
  
  // Palavras de curiosidade
  if (/como|por que|segredo|erro|verdade|rápido|simples/i.test(title)) score += 10;
  
  // Benefício claro
  if (/mais|melhor|menos|sem|evite|garanta|conquiste/i.test(title)) score += 10;
  
  // Muito curto ou muito longo
  if (title.length < 30) score -= 10;
  if (title.length > 70) score -= 10;
  
  // Título genérico
  if (/dicas de|guia de|tudo sobre|o que é/i.test(title)) score -= 15;
  
  return Math.min(100, Math.max(0, score));
}

function analyzeIntroQuality(content: string): {
  has_hook: boolean;
  has_identification: boolean;
} {
  const intro = content.split(/^## /m)[0] || content.substring(0, 500);
  
  // Busca por hooks (perguntas, cenários)
  const has_hook = /\?|imagine|você já|quantas vezes/i.test(intro);
  
  // Busca por identificação com o leitor
  const has_identification = /você|seu negócio|seu cliente|sua empresa/i.test(intro);
  
  return { has_hook, has_identification };
}
