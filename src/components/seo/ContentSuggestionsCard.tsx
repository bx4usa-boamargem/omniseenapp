import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lightbulb, Sparkles, ArrowRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { GSCDataPoint } from "@/hooks/useGSCAnalytics";

interface ContentSuggestion {
  theme: string;
  keywords: string[];
  potential: "alto" | "médio" | "baixo";
  basedOnQuery: string;
  reasoning: string;
}

interface ContentSuggestionsCardProps {
  blogId: string;
  topQueries: GSCDataPoint[];
}

export function ContentSuggestionsCard({ blogId, topQueries }: ContentSuggestionsCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);

  const generateSuggestions = async () => {
    if (topQueries.length === 0) {
      toast.error("Não há dados do Google Search Console para gerar sugestões");
      return;
    }

    setLoading(true);
    try {
      // Find queries with high impressions but low clicks (opportunities)
      const opportunities = topQueries
        .filter((q) => (q.impressions || 0) > 10 && (q.ctr || 0) < 0.05)
        .slice(0, 5);

      if (opportunities.length === 0) {
        // Use top queries instead
        opportunities.push(...topQueries.slice(0, 5));
      }

      const { data, error } = await supabase.functions.invoke("suggest-keywords", {
        body: {
          blog_id: blogId,
          context: `Baseado nas seguintes queries do Google Search Console que têm potencial de melhoria: ${opportunities.map((o) => o.key).join(", ")}`,
          count: 5,
        },
      });

      if (error) throw error;

      const generatedSuggestions: ContentSuggestion[] = (data.keywords || []).map(
        (kw: { keyword: string; reasoning?: string }, index: number) => ({
          theme: kw.keyword,
          keywords: [kw.keyword],
          potential: index < 2 ? "alto" : index < 4 ? "médio" : "baixo",
          basedOnQuery: opportunities[index]?.key || opportunities[0]?.key || "Análise GSC",
          reasoning: kw.reasoning || "Oportunidade identificada via GSC",
        })
      );

      setSuggestions(generatedSuggestions);
      toast.success("Sugestões geradas com sucesso!");
    } catch (error) {
      console.error("Error generating suggestions:", error);
      toast.error("Erro ao gerar sugestões");
    } finally {
      setLoading(false);
    }
  };

  // IMMEDIATE REDIRECT - Auto-run mode
  const handleCreateArticle = (suggestion: ContentSuggestion) => {
    const params = new URLSearchParams({
      quick: 'true',
      theme: suggestion.theme,
      mode: 'fast',
      images: '1'
    });
    
    navigate(`/app/articles/new?${params.toString()}`);
  };

  const getPotentialBadge = (potential: string) => {
    switch (potential) {
      case "alto":
        return <Badge className="bg-green-500/10 text-green-600">Alto potencial</Badge>;
      case "médio":
        return <Badge className="bg-yellow-500/10 text-yellow-600">Médio potencial</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">Baixo potencial</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Sugestões de Conteúdo com IA
            </CardTitle>
            <CardDescription>
              Ideias de artigos baseadas nos dados do Google Search Console
            </CardDescription>
          </div>
          <Button onClick={generateSuggestions} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Ideias
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Clique em "Gerar Ideias" para receber sugestões de conteúdo</p>
            <p className="text-sm mt-2">
              Baseadas nas suas queries do Google Search Console com maior potencial
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium">{suggestion.theme}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {suggestion.reasoning}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {getPotentialBadge(suggestion.potential)}
                      <span className="text-xs text-muted-foreground">
                        Baseado em: {suggestion.basedOnQuery}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCreateArticle(suggestion)}
                    className="gap-2"
                  >
                    Criar Artigo
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
