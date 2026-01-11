import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  buildDiagnosticPrompt, 
  buildSuggestionsPrompt, 
  buildAutonomousRewritePrompt,
  calculatePredictiveMetrics,
  type PerformanceDiagnosis,
  type OptimizationSuggestions,
  type KPIImprovements
} from '../_shared/performanceOptimizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizeRequest {
  title: string;
  content: string;
  metaDescription?: string;
  mode: 'assisted' | 'autonomous';
  companyName?: string;
}

interface AssistedResponse {
  mode: 'assisted';
  diagnosis: PerformanceDiagnosis;
  suggestions: OptimizationSuggestions;
}

interface AutonomousResponse {
  mode: 'autonomous';
  diagnosis: PerformanceDiagnosis;
  optimized_title: string;
  optimized_content: string;
  changes_summary: string[];
  kpi_improvements: KPIImprovements;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const request: OptimizeRequest = await req.json();
    const { title, content, metaDescription, mode, companyName } = request;

    if (!title || !content) {
      throw new Error('Title and content are required');
    }

    console.log(`[Performance Optimizer] Mode: ${mode}, Title: ${title.substring(0, 50)}...`);

    // STEP 1: Calculate predictive metrics
    const predictiveMetrics = calculatePredictiveMetrics(content, title);
    console.log('[Performance Optimizer] Predictive metrics:', predictiveMetrics);

    // STEP 2: Run AI diagnosis
    const diagnosticPrompt = buildDiagnosticPrompt(title, content, metaDescription);
    
    const diagnosisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de performance de conteúdo. Retorne APENAS JSON válido, sem markdown ou explicações.'
          },
          { role: 'user', content: diagnosticPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!diagnosisResponse.ok) {
      throw new Error(`Diagnosis API error: ${diagnosisResponse.status}`);
    }

    const diagnosisData = await diagnosisResponse.json();
    let diagnosisRaw = diagnosisData.choices?.[0]?.message?.content || '{}';
    
    // Clean JSON response
    diagnosisRaw = diagnosisRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let diagnosis: PerformanceDiagnosis;
    try {
      diagnosis = JSON.parse(diagnosisRaw);
    } catch {
      console.error('[Performance Optimizer] Failed to parse diagnosis, using defaults');
      diagnosis = {
        overall_health: 'moderate',
        score: 50,
        estimated_read_time_seconds: predictiveMetrics.estimated_read_time_seconds,
        predicted_scroll_depth: predictiveMetrics.predicted_scroll_depth,
        predicted_bounce_rate: predictiveMetrics.predicted_bounce_rate,
        issues: []
      };
    }

    // Merge predictive metrics with AI diagnosis
    diagnosis.estimated_read_time_seconds = predictiveMetrics.estimated_read_time_seconds;
    diagnosis.predicted_scroll_depth = diagnosis.predicted_scroll_depth || predictiveMetrics.predicted_scroll_depth;
    diagnosis.predicted_bounce_rate = diagnosis.predicted_bounce_rate || predictiveMetrics.predicted_bounce_rate;

    console.log('[Performance Optimizer] Diagnosis complete:', {
      health: diagnosis.overall_health,
      score: diagnosis.score,
      issues_count: diagnosis.issues?.length || 0
    });

    // STEP 3: Mode-specific processing
    if (mode === 'assisted') {
      // Generate suggestions
      const suggestionsPrompt = buildSuggestionsPrompt(title, content, diagnosis, companyName);
      
      const suggestionsResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em otimização de conteúdo. Retorne APENAS JSON válido, sem markdown ou explicações.'
            },
            { role: 'user', content: suggestionsPrompt }
          ],
          temperature: 0.5,
        }),
      });

      if (!suggestionsResponse.ok) {
        throw new Error(`Suggestions API error: ${suggestionsResponse.status}`);
      }

      const suggestionsData = await suggestionsResponse.json();
      let suggestionsRaw = suggestionsData.choices?.[0]?.message?.content || '{}';
      suggestionsRaw = suggestionsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let suggestions: OptimizationSuggestions;
      try {
        suggestions = JSON.parse(suggestionsRaw);
      } catch {
        console.error('[Performance Optimizer] Failed to parse suggestions');
        suggestions = {
          title_alternatives: [],
          sections_to_fix: [],
          highlight_blocks_to_add: []
        };
      }

      const response: AssistedResponse = {
        mode: 'assisted',
        diagnosis,
        suggestions
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Autonomous rewrite
      const rewritePrompt = buildAutonomousRewritePrompt(title, content, diagnosis, companyName);
      
      const rewriteResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em reescrita de conteúdo para performance. Retorne APENAS JSON válido, sem markdown ou explicações. O campo optimized_content deve conter o artigo completo em Markdown.'
            },
            { role: 'user', content: rewritePrompt }
          ],
          temperature: 0.6,
        }),
      });

      if (!rewriteResponse.ok) {
        throw new Error(`Rewrite API error: ${rewriteResponse.status}`);
      }

      const rewriteData = await rewriteResponse.json();
      let rewriteRaw = rewriteData.choices?.[0]?.message?.content || '{}';
      rewriteRaw = rewriteRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let rewriteResult: {
        optimized_title: string;
        optimized_content: string;
        changes_summary: string[];
        kpi_improvements: KPIImprovements;
      };

      try {
        rewriteResult = JSON.parse(rewriteRaw);
      } catch {
        console.error('[Performance Optimizer] Failed to parse rewrite result');
        throw new Error('Failed to generate optimized content');
      }

      const response: AutonomousResponse = {
        mode: 'autonomous',
        diagnosis,
        optimized_title: rewriteResult.optimized_title || title,
        optimized_content: rewriteResult.optimized_content || content,
        changes_summary: rewriteResult.changes_summary || [],
        kpi_improvements: rewriteResult.kpi_improvements || {
          estimated_read_time_delta: 0,
          predicted_scroll_depth_delta: 0,
          predicted_bounce_rate_delta: 0
        }
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[Performance Optimizer] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
