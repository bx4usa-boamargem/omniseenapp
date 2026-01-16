/**
 * COMPLIANCE VALIDATOR
 * Validates content for sensitive niches (health, legal, finance)
 * Ensures regulatory compliance and prevents problematic content
 */

export type SensitiveNiche = 'health' | 'legal' | 'finance' | 'general';

interface ComplianceResult {
  passed: boolean;
  niche: SensitiveNiche;
  violations: string[];
  requiredDisclaimer: string | null;
  riskLevel: 'low' | 'medium' | 'high';
}

// Patterns that indicate sensitive niches
const NICHE_PATTERNS: Record<SensitiveNiche, RegExp[]> = {
  health: [
    /médic[oa]/i,
    /saúde/i,
    /clínica/i,
    /hospital/i,
    /tratamento/i,
    /fisioterapi/i,
    /odonto/i,
    /dentist/i,
    /psicólog/i,
    /psiquiatr/i,
    /nutricion/i,
    /estétic/i,
    /dermatolog/i,
    /pediatr/i,
    /cardiolog/i,
    /ortoped/i,
  ],
  legal: [
    /advogad/i,
    /advocacia/i,
    /jurídic/i,
    /escritório de direito/i,
    /assessoria legal/i,
    /consultoria jurídica/i,
    /direito trabalhista/i,
    /direito civil/i,
    /direito penal/i,
    /direito empresarial/i,
  ],
  finance: [
    /investiment/i,
    /financ/i,
    /banco/i,
    /consórcio/i,
    /crédito/i,
    /empréstimo/i,
    /seguros/i,
    /previdência/i,
    /criptomoeda/i,
    /ações/i,
    /renda fixa/i,
    /renda variável/i,
    /consultoria financeira/i,
  ],
  general: [],
};

// Prohibited phrases by niche
const PROHIBITED_PHRASES: Record<Exclude<SensitiveNiche, 'general'>, RegExp[]> = {
  health: [
    /cura garantida/i,
    /100% eficaz/i,
    /sem efeitos colaterais/i,
    /substitui (a )?consulta médica/i,
    /diagnóstico (definitivo|certo)/i,
    /pare de tomar medicamentos/i,
    /tratamento milagroso/i,
    /resultados garantidos/i,
    /cura definitiva/i,
    /médico não quer que você saiba/i,
    /solução definitiva para/i,
    /elimina (definitivamente|para sempre)/i,
  ],
  legal: [
    /garantia de (vitória|ganho|resultado)/i,
    /vamos ganhar (sua|a) causa/i,
    /resultado garantido/i,
    /100% de sucesso/i,
    /nunca perdemos/i,
    /aconselhamento legal definitivo/i,
    /constitui parecer jurídico/i,
    /substitui advogado/i,
  ],
  finance: [
    /retorno garantido/i,
    /lucro certo/i,
    /sem risco/i,
    /rentabilidade garantida/i,
    /dinheiro fácil/i,
    /enriqueça rápido/i,
    /investimento sem perdas/i,
    /ganhos extraordinários/i,
    /multiplique seu dinheiro/i,
    /recomendação de (compra|venda|investimento)/i,
  ],
};

// Required disclaimers by niche
const DISCLAIMERS: Record<Exclude<SensitiveNiche, 'general'>, string> = {
  health: '**Aviso:** Este conteúdo é informativo e não substitui consulta médica. Procure sempre um profissional de saúde qualificado.',
  legal: '**Aviso:** Este conteúdo é informativo e não constitui aconselhamento legal. Para orientação jurídica específica, consulte um advogado.',
  finance: '**Aviso:** Este conteúdo é educacional e não é recomendação de investimento. Consulte um profissional financeiro antes de tomar decisões.',
};

/**
 * Detects the sensitive niche based on business profile
 */
export function detectSensitiveNiche(
  niche?: string,
  services?: string,
  content?: string
): SensitiveNiche {
  const textToAnalyze = [niche, services, content].filter(Boolean).join(' ');

  for (const [nicheType, patterns] of Object.entries(NICHE_PATTERNS) as [SensitiveNiche, RegExp[]][]) {
    if (nicheType === 'general') continue;
    
    for (const pattern of patterns) {
      if (pattern.test(textToAnalyze)) {
        return nicheType;
      }
    }
  }

  return 'general';
}

/**
 * Validates content for compliance violations
 */
export function validateCompliance(
  content: string,
  niche: SensitiveNiche
): ComplianceResult {
  if (niche === 'general') {
    return {
      passed: true,
      niche: 'general',
      violations: [],
      requiredDisclaimer: null,
      riskLevel: 'low',
    };
  }

  const violations: string[] = [];
  const prohibitedPhrases = PROHIBITED_PHRASES[niche];

  for (const pattern of prohibitedPhrases) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push(`Frase proibida detectada: \"${matches[0]}\"`);
    }
  }

  const riskLevel = violations.length === 0 ? 'low' : violations.length <= 2 ? 'medium' : 'high';

  return {
    passed: violations.length === 0,
    niche,
    violations,
    requiredDisclaimer: DISCLAIMERS[niche],
    riskLevel,
  };
}

/**
 * Checks if content has the required disclaimer
 */
export function hasRequiredDisclaimer(content: string, niche: SensitiveNiche): boolean {
  if (niche === 'general') return true;
  
  const disclaimer = DISCLAIMERS[niche];
  // Check for the key phrase in the disclaimer
  const keyPhrases: Record<Exclude<SensitiveNiche, 'general'>, string[]> = {
    health: ['não substitui consulta médica', 'profissional de saúde'],
    legal: ['não constitui aconselhamento legal', 'consulte um advogado'],
    finance: ['não é recomendação de investimento', 'profissional financeiro'],
  };

  const phrases = keyPhrases[niche];
  return phrases.some(phrase => content.toLowerCase().includes(phrase.toLowerCase()));
}

/**
 * Injects the required disclaimer into content
 */
export function injectDisclaimer(content: string, niche: SensitiveNiche): string {
  if (niche === 'general') return content;
  if (hasRequiredDisclaimer(content, niche)) return content;

  const disclaimer = DISCLAIMERS[niche];
  
  // Find the \"Próximo passo\" section and inject before it
  const nextStepMatch = content.match(/##\s*Próximo passo/i);
  
  if (nextStepMatch && nextStepMatch.index !== undefined) {
    const beforeNextStep = content.slice(0, nextStepMatch.index);
    const afterNextStep = content.slice(nextStepMatch.index);
    return `${beforeNextStep}\n\n${disclaimer}\n\n${afterNextStep}`;
  }
  
  // Otherwise, add at the end before any final section
  return `${content}\n\n---\n\n${disclaimer}`;
}

/**
 * Full compliance check with auto-fix capability
 */
export function runComplianceCheck(
  content: string,
  niche?: string,
  services?: string
): ComplianceResult & { fixedContent?: string } {
  const detectedNiche = detectSensitiveNiche(niche, services, content);
  const result = validateCompliance(content, detectedNiche);

  if (!result.passed) {
    return result;
  }

  // Check for disclaimer
  if (!hasRequiredDisclaimer(content, detectedNiche)) {
    const fixedContent = injectDisclaimer(content, detectedNiche);
    return {
      ...result,
      fixedContent,
    };
  }

  return result;
}
