/**
 * Definições centralizadas de métricas da plataforma
 * Fonte única de verdade para labels, descrições e fontes de dados
 */

export const METRIC_DEFINITIONS = {
  VISITS_TOTAL: {
    label: 'Visitas Totais',
    description: 'Pageviews de artigos + super páginas + portal público',
    source: ['articles.view_count', 'landing_pages.view_count', 'portal_views'],
    icon: '👁',
  },
  CTA_CLICKS: {
    label: 'Cliques nos CTAs',
    description: 'Cliques em botões de conversão (call, whatsapp, form)',
    source: ['real_leads.lead_type IN (whatsapp_click, phone_click)'],
    icon: '🎯',
  },
  REAL_LEADS: {
    label: 'Leads Reais',
    description: 'Criação efetiva de lead (form ou integração)',
    source: ['real_leads'],
    icon: '💬',
  },
  TOTAL_ARTICLES: {
    label: 'Total de Artigos',
    description: 'Quantidade total de artigos criados',
    source: ['articles'],
    icon: '📝',
  },
  PUBLISHED_ARTICLES: {
    label: 'Publicados',
    description: 'Artigos com status published',
    source: ['articles.status = published'],
    icon: '✅',
  },
  TOTAL_VIEWS: {
    label: 'Visualizações',
    description: 'Soma de view_count de todos os artigos',
    source: ['articles.view_count'],
    icon: '👀',
  },
  LEADS_GENERATED: {
    label: 'Leads Gerados',
    description: 'Total de leads capturados via brand_agent_leads ou real_leads',
    source: ['real_leads', 'brand_agent_leads'],
    icon: '🚀',
  },
} as const;

/**
 * Calcula o score/percentual baseado no status do documento
 * @param status - Status do documento (draft, ready, scheduled, published)
 * @returns Percentual de 0-100
 */
export function calculateDocumentScore(status: string): number {
  switch (status?.toLowerCase()) {
    case 'published':
      return 100;
    case 'ready':
    case 'scheduled':
      return 70;
    case 'draft':
    default:
      return 30;
  }
}

/**
 * Planos disponíveis na plataforma
 */
export const PLAN_TIERS = {
  trial: {
    name: 'Trial',
    price: null,
    duration: '7 dias grátis',
    features: ['Acesso completo por 7 dias'],
  },
  starter: {
    name: 'Starter',
    price: 14.97,
    duration: '/mês',
    features: ['10 artigos/mês', '2 Super Páginas'],
  },
  growth: {
    name: 'Growth',
    price: 39,
    duration: '/mês',
    features: ['50 artigos/mês', '10 Super Páginas', 'Automação'],
  },
  scale: {
    name: 'Scale',
    price: 79,
    duration: '/mês',
    features: ['Artigos ilimitados', 'Super Páginas ilimitadas', 'Prioridade'],
  },
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;
