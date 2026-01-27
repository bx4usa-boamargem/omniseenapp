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

export interface LandingPageData {
  hero: HeroSection;
  services: ServiceCard[];
  service_details: ServiceDetail[];
  emergency_banner?: EmergencyBanner;
  materials?: MaterialsSection;
  process_steps?: ProcessStep[];
  why_choose_us?: WhyChooseUsItem[];
  testimonials: Testimonial[];
  areas_served: AreasServed;
  faq: FAQItem[];
  contact: ContactInfo;
  cta_banner?: CTABanner;
  
  // New fields for service_authority_v1 template
  template?: string;
  authority_content?: string;
  
  // Meta
  meta?: {
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
  };
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
  | 'institutional_v1' 
  | 'specialist_authority_v1';

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
