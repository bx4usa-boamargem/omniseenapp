import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessEconomics {
  averageTicket: number | null;
  closingRate: number | null;
  customOpportunityValue: number | null;
  averageMargin: number | null;
  isConfigured: boolean;
  isLoading: boolean;
  
  // Valores calculados
  opportunityValue: number;      // Valor de uma oportunidade comercial
  valuePerExposure: number;      // 10% do valor (exposição comercial)
  valuePerIntent: number;        // 150% do valor (intenção comercial)
  
  // Método para refetch
  refetch: () => Promise<void>;
}

const DEFAULT_EXPOSURE_MULTIPLIER = 0.10;  // 10% do valor da oportunidade
const DEFAULT_INTENT_MULTIPLIER = 1.5;      // 150% do valor da oportunidade

export function useBusinessEconomics(blogId: string | null): BusinessEconomics {
  const [data, setData] = useState<{
    averageTicket: number | null;
    closingRate: number | null;
    customOpportunityValue: number | null;
    averageMargin: number | null;
    isConfigured: boolean;
  }>({
    averageTicket: null,
    closingRate: null,
    customOpportunityValue: null,
    averageMargin: null,
    isConfigured: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchEconomics = async () => {
    if (!blogId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('business_profile')
        .select('average_ticket, closing_rate, custom_opportunity_value, average_margin, business_economics_configured')
        .eq('blog_id', blogId)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        setData({
          averageTicket: profile.average_ticket,
          closingRate: profile.closing_rate,
          customOpportunityValue: profile.custom_opportunity_value,
          averageMargin: profile.average_margin,
          isConfigured: profile.business_economics_configured || false,
        });
      }
    } catch (error) {
      console.error('Error fetching business economics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEconomics();
  }, [blogId]);

  // Cálculos derivados
  const calculatedOpportunityValue = 
    data.averageTicket && data.closingRate 
      ? data.averageTicket * (data.closingRate / 100)
      : 0;

  const opportunityValue = data.customOpportunityValue || calculatedOpportunityValue;
  const valuePerExposure = opportunityValue * DEFAULT_EXPOSURE_MULTIPLIER;
  const valuePerIntent = opportunityValue * DEFAULT_INTENT_MULTIPLIER;

  return {
    ...data,
    isLoading,
    opportunityValue,
    valuePerExposure,
    valuePerIntent,
    refetch: fetchEconomics,
  };
}

// Função utilitária para calcular valores (para uso em componentes que já têm os dados)
export function calculateBusinessValues(
  averageTicket: number | null,
  closingRate: number | null,
  customOpportunityValue: number | null
): {
  opportunityValue: number;
  valuePerExposure: number;
  valuePerIntent: number;
} {
  const calculatedOpportunityValue = 
    averageTicket && closingRate 
      ? averageTicket * (closingRate / 100)
      : 0;

  const opportunityValue = customOpportunityValue || calculatedOpportunityValue;
  const valuePerExposure = opportunityValue * DEFAULT_EXPOSURE_MULTIPLIER;
  const valuePerIntent = opportunityValue * DEFAULT_INTENT_MULTIPLIER;

  return { opportunityValue, valuePerExposure, valuePerIntent };
}
