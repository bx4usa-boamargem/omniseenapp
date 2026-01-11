import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DiagnosticIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'intro' | 'title' | 'structure' | 'rhythm' | 'cta' | 'scannability';
  message: string;
  location?: string;
  suggestion?: string;
}

export interface PerformanceDiagnosis {
  overall_health: 'poor' | 'moderate' | 'good' | 'excellent';
  score: number;
  estimated_read_time_seconds: number;
  predicted_scroll_depth: number;
  predicted_bounce_rate: number;
  issues: DiagnosticIssue[];
}

export interface TitleSuggestion {
  title: string;
  improvement: string;
  predicted_ctr_boost: number;
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
  estimated_read_time_delta: number;
  predicted_scroll_depth_delta: number;
  predicted_bounce_rate_delta: number;
}

export interface AssistedResult {
  mode: 'assisted';
  diagnosis: PerformanceDiagnosis;
  suggestions: OptimizationSuggestions;
}

export interface AutonomousResult {
  mode: 'autonomous';
  diagnosis: PerformanceDiagnosis;
  optimized_title: string;
  optimized_content: string;
  changes_summary: string[];
  kpi_improvements: KPIImprovements;
}

export type OptimizationResult = AssistedResult | AutonomousResult;

export function usePerformanceOptimizer() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optimize = async (
    title: string,
    content: string,
    mode: 'assisted' | 'autonomous',
    options?: {
      metaDescription?: string;
      companyName?: string;
    }
  ): Promise<OptimizationResult | null> => {
    setIsOptimizing(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('optimize-article-performance', {
        body: {
          title,
          content,
          mode,
          metaDescription: options?.metaDescription,
          companyName: options?.companyName
        }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      return data;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao otimizar artigo';
      setError(message);
      toast.error('Erro na otimização', { description: message });
      return null;
    } finally {
      setIsOptimizing(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    optimize,
    reset,
    isOptimizing,
    result,
    error
  };
}
