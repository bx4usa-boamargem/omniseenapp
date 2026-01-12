import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SEOTrendData {
  date: string;
  formattedDate: string;
  avgScore: number;
  totalArticles: number;
  articlesBelow60: number;
  articlesAbove80: number;
  optimizationsCount: number;
}

export interface SEOTrendResult {
  direction: "up" | "down" | "stable";
  change: number;
  message: string;
}

interface UseSEOTrendsResult {
  data: SEOTrendData[];
  isLoading: boolean;
  trend: SEOTrendResult;
  refetch: () => Promise<void>;
  saveSnapshot: (avgScore: number, totalArticles: number, articlesBelow60: number, articlesAbove80: number) => Promise<void>;
}

export function useSEOTrends(blogId: string | undefined, days: number = 30): UseSEOTrendsResult {
  const [data, setData] = useState<SEOTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrends = useCallback(async () => {
    if (!blogId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: snapshots, error } = await supabase
        .from("seo_daily_snapshots")
        .select("*")
        .eq("blog_id", blogId)
        .gte("snapshot_date", startDate.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true });

      if (error) throw error;

      const formattedData: SEOTrendData[] = (snapshots || []).map((s) => {
        const date = new Date(s.snapshot_date);
        return {
          date: s.snapshot_date,
          formattedDate: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          avgScore: s.avg_score,
          totalArticles: s.total_articles,
          articlesBelow60: s.articles_below_60 || 0,
          articlesAbove80: s.articles_above_80 || 0,
          optimizationsCount: s.optimizations_count || 0,
        };
      });

      setData(formattedData);
    } catch (error) {
      console.error("Error fetching SEO trends:", error);
    } finally {
      setIsLoading(false);
    }
  }, [blogId, days]);

  const saveSnapshot = useCallback(async (
    avgScore: number,
    totalArticles: number,
    articlesBelow60: number,
    articlesAbove80: number
  ) => {
    if (!blogId) return;

    try {
      await supabase.functions.invoke("save-seo-snapshot", {
        body: { blog_id: blogId },
      });
      // Refetch to update the chart
      await fetchTrends();
    } catch (error) {
      console.error("Error saving SEO snapshot:", error);
    }
  }, [blogId, fetchTrends]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  // Calculate trend
  const calculateTrend = (): SEOTrendResult => {
    if (data.length < 2) {
      return { direction: "stable", change: 0, message: "Coletando dados..." };
    }

    const first = data[0].avgScore;
    const last = data[data.length - 1].avgScore;
    const change = last - first;

    if (change > 5) {
      return { direction: "up", change, message: `+${change} pontos! Continue assim. 🚀` };
    }
    if (change < -5) {
      return { direction: "down", change, message: `${change} pontos. Vamos melhorar?` };
    }
    return { direction: "stable", change, message: "Score estável." };
  };

  return {
    data,
    isLoading,
    trend: calculateTrend(),
    refetch: fetchTrends,
    saveSnapshot,
  };
}
