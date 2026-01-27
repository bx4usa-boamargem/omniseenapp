// Super Página PRO - Service Authority Pro Template Types
// Template: service_authority_pro_v1
// 12 seções reais, 15+ imagens

export interface ServiceAuthorityProPageData {
  template: 'service_authority_pro_v1';
  
  // Brand Info
  brand: {
    company_name: string;
    phone: string;
    city: string;
    niche: string;
    tagline?: string;
  };

  // SEÇÃO 1: Hero (1 imagem)
  hero: {
    headline: string;           // 8-12 palavras
    subheadline: string;        // 20-30 palavras
    image_prompt: string;
    image_url?: string | null;  // ✓ Imagem 1
  };

  // SEÇÃO 2: Service Cards (4 imagens)
  service_cards: Array<{
    id: string;
    title: string;
    description: string;        // 40-60 palavras
    cta_text: string;
    image_prompt: string;
    image_url?: string | null;  // ✓ Imagens 2-5
  }>;

  // SEÇÃO 3: Emergency (sem imagem)
  emergency: {
    headline: string;
    subtext: string;
  };

  // SEÇÕES 4-5: Deep Dives (4 imagens - 2 por seção)
  deep_dives: Array<{
    id: string;
    title: string;
    intro: string;              // 50-80 palavras
    hero_image_prompt: string;
    hero_image_url?: string | null;    // ✓ Imagens 6, 8
    side_image_prompt: string;
    side_image_url?: string | null;    // ✓ Imagens 7, 9
    bullets: string[];          // 5-7 bullets
    cta_text: string;
  }>;

  // SEÇÃO 6: Local Context (4 imagens)
  local_context: {
    title: string;
    intro: string;
    hero_image_prompt: string;
    hero_image_url?: string | null;    // ✓ Imagem 10
    challenges: Array<{         // 3 challenges
      id: string;
      title: string;
      description: string;      // 30-50 palavras
      image_prompt: string;
      image_url?: string | null;       // ✓ Imagens 11-13
    }>;
  };

  // SEÇÃO 7: Inspection Process (1 imagem)
  inspection_process: {
    title: string;
    intro: string;
    steps: string[];
    image_prompt: string;
    image_url?: string | null;         // ✓ Imagem 14
    special_offer?: string;
  };

  // SEÇÃO 8: Materials Quality (1 imagem)
  materials_quality: {
    title: string;
    description: string;
    image_prompt: string;
    image_url?: string | null;         // ✓ Imagem 15
  };

  // SEÇÃO 9: Areas Served (sem imagem)
  areas_served: {
    title: string;
    intro: string;
    neighborhoods: string[];
  };

  // SEÇÃO 10: FAQ (sem imagem)
  faq: Array<{
    id: string;
    question: string;
    answer: string;             // 50-100 palavras
  }>;

  // SEÇÃO 11: Testimonials (sem imagem)
  testimonials: Array<{
    id: string;
    quote: string;
    name: string;
    location: string;
  }>;

  // SEÇÃO 12: Footer CTA (sem imagem)
  footer_cta: {
    headline: string;
    phone: string;
    badges: string[];
  };
}

// Block visibility for PRO template
export interface ProBlockVisibility {
  hero: boolean;
  service_cards: boolean;
  emergency: boolean;
  deep_dives: boolean;
  local_context: boolean;
  inspection_process: boolean;
  materials_quality: boolean;
  areas_served: boolean;
  faq: boolean;
  testimonials: boolean;
  footer_cta: boolean;
}

export const DEFAULT_PRO_VISIBILITY: ProBlockVisibility = {
  hero: true,
  service_cards: true,
  emergency: true,
  deep_dives: true,
  local_context: true,
  inspection_process: true,
  materials_quality: true,
  areas_served: true,
  faq: true,
  testimonials: true,
  footer_cta: true,
};

// Image resolution tracking
export interface ProImageResolutionResult {
  key: string;
  path: string[];
  prompt: string;
  url?: string;
  status: 'pending' | 'resolved' | 'failed';
  attempts: number;
}
