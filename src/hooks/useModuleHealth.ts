import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

interface RadarTrend {
  date: string;
  generated: number;
  converted: number;
}

interface RadarHealth {
  opportunitiesGenerated: number;
  conversionRate: number;
  avgScore: number;
  cost7d: number;
  highScoreCount: number;
  trend: RadarTrend[];
}

interface AgentHealth {
  activeAgents: number;
  conversations24h: number;
  leads7d: number;
  conversionRate: number;
  tokensUsed: number;
  mrrAgents: number;
  avgTokensPerConversation: number;
}

interface SEODistribution {
  range: string;
  count: number;
  color: string;
}

interface SEOHealth {
  avgScore: number;
  criticalArticles: number;
  excellentArticles: number;
  qualityGateApproval: number;
  totalArticles: number;
  scoreDistribution: SEODistribution[];
}

interface JourneyPhaseStatus {
  phase: string;
  status: "healthy" | "warning" | "critical";
  metric: string;
  value: number;
}

export interface ModuleHealth {
  radar: RadarHealth;
  agent: AgentHealth;
  seo: SEOHealth;
  journey: JourneyPhaseStatus[];
  loading: boolean;
  error: string | null;
}

const AGENT_PRICE_USD = 47;

export function useModuleHealth() {
  const [health, setHealth] = useState<ModuleHealth>({
    radar: {
      opportunitiesGenerated: 0,
      conversionRate: 0,
      avgScore: 0,
      cost7d: 0,
      highScoreCount: 0,
      trend: [],
    },
    agent: {
      activeAgents: 0,
      conversations24h: 0,
      leads7d: 0,
      conversionRate: 0,
      tokensUsed: 0,
      mrrAgents: 0,
      avgTokensPerConversation: 0,
    },
    seo: {
      avgScore: 0,
      criticalArticles: 0,
      excellentArticles: 0,
      qualityGateApproval: 0,
      totalArticles: 0,
      scoreDistribution: [],
    },
    journey: [],
    loading: true,
    error: null,
  });

  const fetchHealth = useCallback(async () => {
    try {
      const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Fetch all data in parallel
      const [
        opportunitiesResult,
        convertedResult,
        highScoreResult,
        aiCostsResult,
        agentConfigResult,
        conversationsResult,
        leadsResult,
        articlesResult,
        qualityGateResult,
        configuredBlogsResult,
      ] = await Promise.all([
        // Radar: All opportunities last 7 days
        supabase
          .from("article_opportunities")
          .select("id, relevance_score, created_at, status")
          .gte("created_at", sevenDaysAgo),
        
        // Radar: Converted opportunities
        supabase
          .from("article_opportunities")
          .select("id")
          .gte("created_at", sevenDaysAgo)
          .eq("status", "converted"),
        
        // Radar: High score opportunities (>= 70)
        supabase
          .from("article_opportunities")
          .select("id")
          .gte("created_at", sevenDaysAgo)
          .gte("relevance_score", 70),
        
        // Radar: AI costs for market intel
        supabase
          .from("ai_usage_logs")
          .select("cost_usd")
          .gte("created_at", sevenDaysAgo)
          .eq("endpoint", "weekly-market-intel"),
        
        // Agent: Active configurations
        supabase
          .from("brand_agent_config")
          .select("id, is_enabled, tokens_used_today")
          .eq("is_enabled", true),
        
        // Agent: Conversations last 24h
        supabase
          .from("brand_agent_conversations")
          .select("id, tokens_used")
          .gte("created_at", twentyFourHoursAgo),
        
        // Agent: Leads last 7 days
        supabase
          .from("brand_agent_leads")
          .select("id")
          .gte("created_at", sevenDaysAgo),
        
        // SEO: Published articles
        supabase
          .from("articles")
          .select("id, title, meta_description, content, keywords, quality_gate_status")
          .eq("status", "published"),
        
        // SEO: Quality gate approved articles
        supabase
          .from("articles")
          .select("id")
          .eq("quality_gate_status", "approved"),
        
        // Journey: Configured blogs (onboarding completed)
        supabase
          .from("blogs")
          .select("id")
          .eq("onboarding_completed", true),
      ]);

      // Process Radar metrics
      const opportunities = opportunitiesResult.data || [];
      const converted = convertedResult.data || [];
      const highScore = highScoreResult.data || [];
      const aiCosts = aiCostsResult.data || [];

      const totalOpportunities = opportunities.length;
      const totalConverted = converted.length;
      const conversionRate = totalOpportunities > 0 
        ? (totalConverted / totalOpportunities) * 100 
        : 0;
      
      const avgScore = opportunities.length > 0
        ? opportunities.reduce((sum, o) => sum + (o.relevance_score || 0), 0) / opportunities.length
        : 0;
      
      const cost7d = aiCosts.reduce((sum, c) => sum + (c.cost_usd || 0), 0);

      // Build trend data (last 7 days)
      const trendMap = new Map<string, { generated: number; converted: number }>();
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        trendMap.set(date, { generated: 0, converted: 0 });
      }
      
      opportunities.forEach(o => {
        const date = format(new Date(o.created_at), "yyyy-MM-dd");
        if (trendMap.has(date)) {
          const current = trendMap.get(date)!;
          current.generated++;
          if (o.status === "converted") {
            current.converted++;
          }
        }
      });

      const trend: RadarTrend[] = Array.from(trendMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));

      // Process Agent metrics
      const agentConfigs = agentConfigResult.data || [];
      const conversations = conversationsResult.data || [];
      const leads = leadsResult.data || [];

      const activeAgents = agentConfigs.length;
      const conversations24h = conversations.length;
      const leads7d = leads.length;
      const agentConversionRate = conversations24h > 0 
        ? (leads7d / conversations24h) * 100 
        : 0;
      const tokensUsed = agentConfigs.reduce((sum, c) => sum + (c.tokens_used_today || 0), 0);
      const mrrAgents = activeAgents * AGENT_PRICE_USD;
      const avgTokensPerConversation = conversations24h > 0
        ? conversations.reduce((sum, c) => sum + (c.tokens_used || 0), 0) / conversations24h
        : 0;

      // Process SEO metrics
      const articles = articlesResult.data || [];
      const qualityGateApproved = qualityGateResult.data || [];
      
      // Calculate SEO scores for articles
      let criticalCount = 0;
      let excellentCount = 0;
      let totalScore = 0;
      const distribution = [
        { range: "0-40", count: 0, color: "hsl(var(--destructive))" },
        { range: "41-60", count: 0, color: "hsl(var(--warning))" },
        { range: "61-80", count: 0, color: "hsl(var(--secondary))" },
        { range: "81-100", count: 0, color: "hsl(var(--success))" },
      ];

      articles.forEach(article => {
        // Simple SEO score calculation
        let score = 0;
        if (article.title && article.title.length >= 30 && article.title.length <= 60) score += 25;
        else if (article.title) score += 10;
        
        if (article.meta_description && article.meta_description.length >= 120 && article.meta_description.length <= 160) score += 25;
        else if (article.meta_description) score += 10;
        
        if (article.keywords && article.keywords.length >= 3) score += 25;
        else if (article.keywords && article.keywords.length > 0) score += 10;
        
        if (article.content) {
          const wordCount = article.content.split(/\s+/).length;
          if (wordCount >= 1200) score += 25;
          else if (wordCount >= 600) score += 15;
          else score += 5;
        }

        totalScore += score;
        
        if (score < 60) criticalCount++;
        if (score >= 80) excellentCount++;
        
        if (score <= 40) distribution[0].count++;
        else if (score <= 60) distribution[1].count++;
        else if (score <= 80) distribution[2].count++;
        else distribution[3].count++;
      });

      const avgSeoScore = articles.length > 0 ? totalScore / articles.length : 0;
      const qualityGateApproval = articles.length > 0 
        ? (qualityGateApproved.length / articles.length) * 100 
        : 0;

      // Build journey status
      const configuredBlogs = configuredBlogsResult.data || [];
      const journey: JourneyPhaseStatus[] = [
        {
          phase: "Configuração",
          status: configuredBlogs.length > 0 ? "healthy" : "warning",
          metric: "Blogs configurados",
          value: configuredBlogs.length,
        },
        {
          phase: "Inteligência",
          status: totalOpportunities > 0 ? "healthy" : cost7d > 0 ? "warning" : "critical",
          metric: "Oportunidades/semana",
          value: totalOpportunities,
        },
        {
          phase: "Geração",
          status: conversionRate >= 30 ? "healthy" : conversionRate >= 10 ? "warning" : "critical",
          metric: "Taxa de conversão",
          value: Math.round(conversionRate),
        },
        {
          phase: "Publicação",
          status: qualityGateApproval >= 70 ? "healthy" : qualityGateApproval >= 40 ? "warning" : "critical",
          metric: "Aprovação Quality Gate",
          value: Math.round(qualityGateApproval),
        },
        {
          phase: "Conversão",
          status: agentConversionRate >= 5 ? "healthy" : agentConversionRate >= 2 ? "warning" : "critical",
          metric: "Leads capturados",
          value: leads7d,
        },
      ];

      setHealth({
        radar: {
          opportunitiesGenerated: totalOpportunities,
          conversionRate,
          avgScore,
          cost7d,
          highScoreCount: highScore.length,
          trend,
        },
        agent: {
          activeAgents,
          conversations24h,
          leads7d,
          conversionRate: agentConversionRate,
          tokensUsed,
          mrrAgents,
          avgTokensPerConversation,
        },
        seo: {
          avgScore: avgSeoScore,
          criticalArticles: criticalCount,
          excellentArticles: excellentCount,
          qualityGateApproval,
          totalArticles: articles.length,
          scoreDistribution: distribution,
        },
        journey,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching module health:", error);
      setHealth(prev => ({
        ...prev,
        loading: false,
        error: "Erro ao carregar métricas de saúde",
      }));
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { ...health, refetch: fetchHealth };
}
