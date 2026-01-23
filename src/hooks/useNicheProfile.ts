import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Niche Profile structure from database
 */
export interface NicheProfile {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  intent: 'local_service' | 'informational' | 'ecommerce' | 'b2b';
  minWords: number;
  maxWords: number;
  minH2: number;
  maxH2: number;
  minParagraphs: number;
  minImages: number;
  minScore: number;
  targetScore: number;
  allowedEntities: string[];
  forbiddenEntities: string[];
  seedKeywords: string[];
}

interface UseNicheProfileReturn {
  profile: NicheProfile | null;
  allProfiles: NicheProfile[];
  loading: boolean;
  floorApplied: boolean;
  updateBlogProfile: (profileId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

// Keyword mapping for auto-detection
const NICHE_KEYWORDS: Record<string, string[]> = {
  'controle_pragas': ['dedetização', 'dedetizadora', 'pragas', 'cupim', 'desratização', 'desinsetização', 'pest control'],
  'advocacia': ['advogado', 'advocacia', 'escritório de advocacia', 'jurídico', 'direito'],
  'saude': ['médico', 'clínica médica', 'consultório', 'hospital', 'saúde'],
  'odontologia': ['dentista', 'odontologia', 'clínica odontológica', 'dental'],
  'estetica': ['estética', 'beleza', 'spa', 'salão', 'harmonização', 'botox'],
  'construcao': ['construção', 'construtora', 'reforma', 'empreiteira', 'obra'],
  'automotivo': ['oficina', 'mecânico', 'autopeças', 'veículos', 'carros'],
  'contabilidade': ['contador', 'contabilidade', 'escritório contábil', 'fiscal'],
  'imobiliario': ['imobiliária', 'imóveis', 'corretor', 'aluguel', 'venda de imóveis'],
  'educacao': ['escola', 'curso', 'educação', 'treinamento', 'formação'],
  'tecnologia': ['software', 'ti', 'tecnologia', 'desenvolvimento', 'sistemas'],
  'marketing': ['marketing', 'agência', 'publicidade', 'comunicação', 'ads'],
  'alimentacao': ['restaurante', 'delivery', 'comida', 'gastronomia', 'bar']
};

function dbRowToNicheProfile(row: Record<string, unknown>): NicheProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    displayName: row.display_name as string,
    description: row.description as string | null,
    intent: row.intent as NicheProfile['intent'],
    minWords: row.min_words as number,
    maxWords: row.max_words as number,
    minH2: row.min_h2 as number,
    maxH2: row.max_h2 as number,
    minParagraphs: row.min_paragraphs as number,
    minImages: row.min_images as number,
    minScore: row.min_score as number,
    targetScore: row.target_score as number,
    allowedEntities: (row.allowed_entities as string[]) || [],
    forbiddenEntities: (row.forbidden_entities as string[]) || [],
    seedKeywords: (row.seed_keywords as string[]) || []
  };
}

export function useNicheProfile(blogId: string | undefined): UseNicheProfileReturn {
  const [profile, setProfile] = useState<NicheProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<NicheProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [floorApplied, setFloorApplied] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!blogId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Try to get from blog's niche_profile_id
      const { data: blogData } = await supabase
        .from('blogs')
        .select('niche_profile_id, niche_profiles(*)')
        .eq('id', blogId)
        .single();

      if (blogData?.niche_profiles && typeof blogData.niche_profiles === 'object' && !Array.isArray(blogData.niche_profiles)) {
        setProfile(dbRowToNicheProfile(blogData.niche_profiles as unknown as Record<string, unknown>));
        setLoading(false);
        return;
      }

      // 2. Try to get from business_profile's niche_profile_id
      const { data: profileData } = await supabase
        .from('business_profile')
        .select('niche_profile_id, niche_profiles(*), niche, services')
        .eq('blog_id', blogId)
        .single();

      if (profileData?.niche_profiles && typeof profileData.niche_profiles === 'object' && !Array.isArray(profileData.niche_profiles)) {
        setProfile(dbRowToNicheProfile(profileData.niche_profiles as unknown as Record<string, unknown>));
        setLoading(false);
        return;
      }

      // 3. Auto-detect from niche/services
      if (profileData?.niche || profileData?.services) {
        const nicheValue = profileData.niche as string | null;
        const servicesValue = profileData.services;
        const servicesArray = Array.isArray(servicesValue) ? servicesValue as string[] : [];
        const searchText = [nicheValue || '', ...servicesArray].join(' ').toLowerCase();

        for (const [nicheName, keywords] of Object.entries(NICHE_KEYWORDS)) {
          for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
              const { data: matchedProfile } = await supabase
                .from('niche_profiles')
                .select('*')
                .eq('name', nicheName)
                .single();

              if (matchedProfile) {
                setProfile(dbRowToNicheProfile(matchedProfile));
                setLoading(false);
                return;
              }
            }
          }
        }
      }

      // 4. Use default
      const { data: defaultProfile } = await supabase
        .from('niche_profiles')
        .select('*')
        .eq('name', 'default')
        .single();

      if (defaultProfile) {
        setProfile(dbRowToNicheProfile(defaultProfile));
      }
    } catch (error) {
      console.error('[useNicheProfile] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [blogId]);

  const fetchAllProfiles = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('niche_profiles')
        .select('*')
        .order('display_name');

      if (data) {
        setAllProfiles(data.map(dbRowToNicheProfile));
      }
    } catch (error) {
      console.error('[useNicheProfile] Error fetching all profiles:', error);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchAllProfiles();
  }, [fetchProfile, fetchAllProfiles]);

  const updateBlogProfile = useCallback(async (profileId: string): Promise<boolean> => {
    if (!blogId) return false;

    try {
      const { error } = await supabase
        .from('blogs')
        .update({ niche_profile_id: profileId })
        .eq('id', blogId);

      if (error) throw error;

      // Also update business_profile if it exists
      await supabase
        .from('business_profile')
        .update({ niche_profile_id: profileId })
        .eq('blog_id', blogId);

      await fetchProfile();
      return true;
    } catch (error) {
      console.error('[useNicheProfile] Error updating:', error);
      return false;
    }
  }, [blogId, fetchProfile]);

  const refresh = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    allProfiles,
    loading,
    floorApplied,
    updateBlogProfile,
    refresh
  };
}
