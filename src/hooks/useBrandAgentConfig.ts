import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BrandAgentConfig {
  id: string;
  is_enabled: boolean;
  agent_name: string;
  agent_avatar_url: string | null;
  welcome_message: string;
  proactive_delay_seconds: number;
}

interface BusinessProfile {
  company_name: string | null;
  logo_url: string | null;
}

interface UseBrandAgentConfigResult {
  agentConfig: BrandAgentConfig | null;
  businessProfile: BusinessProfile | null;
  loading: boolean;
  error: string | null;
}

export function useBrandAgentConfig(blogId: string | null): UseBrandAgentConfigResult {
  const [agentConfig, setAgentConfig] = useState<BrandAgentConfig | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!blogId) {
      setLoading(false);
      return;
    }

    const fetchConfig = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch agent config and business profile in parallel
        const [configResult, profileResult] = await Promise.all([
          supabase
            .from('brand_agent_config')
            .select('id, is_enabled, agent_name, agent_avatar_url, welcome_message, proactive_delay_seconds')
            .eq('blog_id', blogId)
            .maybeSingle(),
          supabase
            .from('business_profile')
            .select('company_name')
            .eq('blog_id', blogId)
            .maybeSingle(),
        ]);

        if (configResult.error && configResult.error.code !== 'PGRST116') {
          console.error('Error fetching agent config:', configResult.error);
          setError('Failed to load agent config');
        } else {
          setAgentConfig(configResult.data);
        }

        if (profileResult.error && profileResult.error.code !== 'PGRST116') {
          console.error('Error fetching business profile:', profileResult.error);
        } else {
          setBusinessProfile(profileResult.data ? {
            company_name: profileResult.data.company_name,
            logo_url: null,
          } : null);
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Unexpected error loading agent config');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [blogId]);

  return { agentConfig, businessProfile, loading, error };
}
