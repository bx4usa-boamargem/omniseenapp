// Landing Page Data Types - Similar ao padrão SEOWriting.ai

export interface HeroSection {
  title: string;
  subtitle: string;
  cta_text: string;
  cta_phone: string;
  phone?: string;
  background_image_url?: string;
  background_image_prompt?: string;
}

export interface ServiceCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  cta_text: string;
}

export interface ServiceDetail {
  id: string;
  title: string;
  content: string;
  bullets: string[];
  image_url?: string;
  image_prompt?: string;
  side: 'left' | 'right';
}

export interface EmergencyBanner {
  title: string;
  subtitle: string;
  phone: string;
  is_24h?: boolean;
}

export interface MaterialCategory {
  name: string;
  items: string[];
}

export interface MaterialsSection {
  title: string;
  categories: MaterialCategory[];
}

export interface ProcessStep {
  step: number;
  title: string;
  description: string;
  icon?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  quote: string;
  rating?: number;
  avatar_url?: string;
}

export interface AreaRegion {
  name: string;
  neighborhoods: string[];
}

export interface AreasServed {
  title: string;
  regions: AreaRegion[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface ContactInfo {
  address: string;
  phone: string;
  whatsapp?: string;
  email: string;
  hours: string;
  map_embed_url?: string;
  latitude?: number;
  longitude?: number;
}

export interface WhyChooseUsItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface CTABanner {
  title: string;
  subtitle: string;
  cta_text: string;
  phone: string;
  background_color?: string;
}

// Landing page meta with block visibility
export interface LandingPageMeta {
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  block_visibility?: BlockVisibility;
}

export interface LandingPageData {
  // All blocks are now optional to allow minimal pages
  hero?: HeroSection;
  services?: ServiceCard[];
  service_details?: ServiceDetail[];
  emergency_banner?: EmergencyBanner;
  materials?: MaterialsSection;
  process_steps?: ProcessStep[];
  why_choose_us?: WhyChooseUsItem[];
  testimonials?: Testimonial[];
  areas_served?: AreasServed;
  faq?: FAQItem[];
  contact?: ContactInfo;
  cta_banner?: CTABanner;
  
  // New fields for service_authority_v1 template
  template?: string;
  authority_content?: string;
  
  // Meta with block visibility
  meta?: LandingPageMeta;
}

export interface LandingPage {
  id: string;
  blog_id: string;
  title: string;
  slug: string;
  page_data: LandingPageData;
  status: 'draft' | 'published' | 'archived';
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  featured_image_url?: string;
  template_type: string;
  generation_source: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  // SEO snapshot fields
  seo_score?: number | null;
  seo_metrics?: SEOMetrics | null;
  seo_recommendations?: SEORecommendation[] | null;
  seo_analyzed_at?: string | null;
}

// SEO Types
export interface SEOMetrics {
  breakdown?: {
    title_points: number;
    meta_points: number;
    keywords_points: number;
    content_points: number;
    density_points: number;
    image_points: number;
  };
  diagnostics?: {
    title_length: number;
    meta_length: number;
    word_count: number;
    density: Record<string, number>;
    missing: string[];
    h2_count?: number;
    image_count?: number;
  };
  serp_benchmark?: {
    avg_words_niche: number;
    competitors_analyzed: number;
    semantic_coverage: number;
  } | null;
}

export interface SEORecommendation {
  type: string;
  severity: "error" | "warning" | "info";
  message: string;
  auto_fixable: boolean;
}

// Block visibility configuration
export interface BlockVisibility {
  hero: boolean;
  services: boolean;
  service_details: boolean;
  emergency_banner: boolean;
  materials: boolean;
  process_steps: boolean;
  why_choose_us: boolean;
  testimonials: boolean;
  areas_served: boolean;
  faq: boolean;
  contact: boolean;
  cta_banner: boolean;
}

export const DEFAULT_BLOCK_VISIBILITY: BlockVisibility = {
  hero: true,
  services: true,
  service_details: true,
  emergency_banner: true,
  materials: false,
  process_steps: true,
  why_choose_us: true,
  testimonials: true,
  areas_served: true,
  faq: true,
  contact: true,
  cta_banner: true,
};

// Landing page template types
export type LandingPageTemplateType = 
  | 'service_authority_v1' 
  | 'service_authority_pro_v1'  // Super Página PRO
  | 'institutional_v1' 
  | 'specialist_authority_v1';

// Template-specific default visibility configurations
export const TEMPLATE_DEFAULT_VISIBILITY: Record<LandingPageTemplateType, BlockVisibility> = {
  service_authority_v1: {
    hero: true,
    services: true,
    service_details: true,
    emergency_banner: true,
    materials: false,
    process_steps: true,
    why_choose_us: true,
    testimonials: true,
    areas_served: true,
    faq: true,
    contact: true,
    cta_banner: true,
  },
  service_authority_pro_v1: {
    hero: true,
    services: true,         // service_cards
    service_details: true,  // deep_dives
    emergency_banner: true,
    materials: true,        // materials_quality
    process_steps: true,    // inspection_process
    why_choose_us: true,    // local_context
    testimonials: true,
    areas_served: true,
    faq: true,
    contact: true,          // footer_cta
    cta_banner: true,
  },
  institutional_v1: {
    hero: true,
    services: true,  // services_areas
    service_details: false,
    emergency_banner: false,
    materials: false,
    process_steps: false,
    why_choose_us: false,
    testimonials: true,  // cases
    areas_served: false,
    faq: false,
    contact: true,
    cta_banner: true,
  },
  specialist_authority_v1: {
    hero: true,
    services: false,
    service_details: false,
    emergency_banner: false,
    materials: false,
    process_steps: true,  // methodology
    why_choose_us: false,
    testimonials: true,
    areas_served: false,
    faq: false,
    contact: true,
    cta_banner: true,
  }
};

// Generation request types
export interface GenerateLandingPageRequest {
  blog_id: string;
  niche: string;
  city: string;
  company_name: string;
  services: string[];
  phone: string;
  whatsapp?: string;
  address?: string;
  email?: string;
  territories?: string[];
  differentiator?: string;
  target_audience?: string;
  template_type?: LandingPageTemplateType;
}

export interface GenerateLandingPageResponse {
  success: boolean;
  page_data?: LandingPageData;
  error?: string;
}
