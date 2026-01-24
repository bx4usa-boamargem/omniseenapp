import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Lightbulb,
  FileText,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeywordOnboardingGuide } from "./KeywordOnboardingGuide";
import { AISuggestKeywordsModal } from "@/components/keywords/AISuggestKeywordsModal";

interface KeywordSuggestion {
  keyword: string;
  type: string;
}

interface KeywordAnalysis {
  id: string;
  keyword: string;
  difficulty: number | null;
  search_volume: number | null;
  suggestions: KeywordSuggestion[];
  analyzed_at: string;
  source?: string;
}

interface AnalysisResult {
  keyword: string;
  difficulty: number;
  searchVolume: number;
  suggestions: KeywordSuggestion[];
  titleSuggestions: string[];
}

interface KeywordsTabProps {
  blogId: string;
  keywordAnalyses: KeywordAnalysis[];
  setKeywordAnalyses: React.Dispatch<React.SetStateAction<KeywordAnalysis[]>>;
}

export function KeywordsTab({ blogId, keywordAnalyses, setKeywordAnalyses }: KeywordsTabProps) {
  const navigate = useNavigate();
  const [keywordInput, setKeywordInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAISuggestModal, setShowAISuggestModal] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("keyword-onboarding-completed");
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!keywordInput.trim() || !blogId) {
      toast.error("Digite uma palavra-chave para analisar");
      return;
    }

    setIsAnalyzing(true);
    setCurrentAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("keyword-analysis", {
        body: { blogId, keyword: keywordInput.trim() },
      });

      if (error) throw error;

      if (data?.analysis) {
        setCurrentAnalysis(data.analysis);

        if (data.saved) {
          setKeywordAnalyses((prev) => [data.saved as KeywordAnalysis, ...prev.slice(0, 19)]);
        }

        toast.success("Análise concluída!");
      }
    } catch (error) {
      console.error("Error analyzing keyword:", error);
      toast.error("Erro ao analisar palavra-chave");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 30) return "Fácil";
    if (difficulty <= 60) return "Médio";
    return "Difícil";
  };

  const getDifficultyBadgeVariant = (
    difficulty: number
  ): "default" | "secondary" | "destructive" => {
    if (difficulty <= 30) return "secondary";
    if (difficulty <= 60) return "default";
    return "destructive";
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Onboarding Guide */}
        {showOnboarding && (
          <KeywordOnboardingGuide onComplete={() => setShowOnboarding(false)} />
        )}

        {/* Header with counter */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold">Lista de Palavras-chave</h2>
            <p className="text-sm text-muted-foreground">
              Analise palavras-chave e descubra oportunidades de conteúdo
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              onClick={() => setShowAISuggestModal(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Sugerir com IA (baseado no nicho)
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowOnboarding(true)}
              className="text-xs"
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              Ver tutorial
            </Button>
            <Badge variant="outline" className="text-sm">
              {keywordAnalyses.length} palavras analisadas
            </Badge>
          </div>
        </div>

        {/* Analyze Keyword Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Analisar Palavra-chave</CardTitle>
                <CardDescription>
                  A IA vai estimar dificuldade, volume e sugerir variações
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                id="keyword-search-input"
                placeholder="Digite uma palavra-chave..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                disabled={isAnalyzing}
              />
              <Button 
                id="keyword-analyze-btn"
                onClick={handleAnalyze} 
                disabled={isAnalyzing || !keywordInput.trim()}
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analisar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Result Card */}
        {currentAnalysis && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Resultado para "{currentAnalysis.keyword}"
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Difficulty */}
                <div id="keyword-difficulty-card" className="p-4 rounded-lg bg-background border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 mb-3 cursor-help">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Dificuldade</span>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium mb-1">Dificuldade de Ranqueamento</p>
                      <ul className="text-xs space-y-1">
                        <li><strong>0-30%:</strong> Fácil - ideal para blogs novos</li>
                        <li><strong>31-60%:</strong> Médio - requer conteúdo de qualidade</li>
                        <li><strong>61-100%:</strong> Difícil - alta competição</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{currentAnalysis.difficulty}%</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant={getDifficultyBadgeVariant(currentAnalysis.difficulty)} className="cursor-help">
                            {getDifficultyLabel(currentAnalysis.difficulty)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {currentAnalysis.difficulty <= 30 
                            ? "Ótimo para começar! Você pode ranquear com conteúdo de qualidade."
                            : currentAnalysis.difficulty <= 60
                            ? "Precisa de conteúdo bem otimizado e algumas referências externas."
                            : "Competição alta. Considere focar em long-tails relacionadas primeiro."
                          }
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Progress value={currentAnalysis.difficulty} className="h-2" />
                  </div>
                </div>

                {/* Volume */}
                <div id="keyword-volume-card" className="p-4 rounded-lg bg-background border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 mb-3 cursor-help">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Volume Estimado</span>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Número aproximado de buscas mensais no Google.</p>
                      <p className="text-xs mt-1">Valores mais altos = mais potencial de tráfego, mas geralmente mais concorrência.</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      ~{formatVolume(currentAnalysis.searchVolume)}
                    </span>
                    <span className="text-sm text-muted-foreground">buscas/mês</span>
                  </div>
                </div>
              </div>

              {/* Related Keywords */}
              {currentAnalysis.suggestions.length > 0 && (
                <div id="keyword-related" className="space-y-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <span className="font-medium">Palavras-chave Relacionadas</span>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Palavras semanticamente relacionadas e long-tail.</p>
                      <p className="text-xs mt-1">Long-tail são frases mais específicas e geralmente mais fáceis de ranquear.</p>
                    </TooltipContent>
                  </Tooltip>
                  <p className="text-sm text-muted-foreground">
                    Clique para adicionar ao campo de busca:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentAnalysis.suggestions.map((sug, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => setKeywordInput(sug.keyword)}
                      >
                        {sug.keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Title Suggestions */}
              {currentAnalysis.titleSuggestions && currentAnalysis.titleSuggestions.length > 0 && (
                <div id="keyword-titles" className="space-y-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-medium">Sugestões de Títulos</span>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Títulos otimizados para SEO sugeridos pela IA.</p>
                      <p className="text-xs mt-1">Clique em qualquer um para criar um artigo com esse tema!</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="space-y-2">
                    {currentAnalysis.titleSuggestions.map((title, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer transition-colors group"
                        onClick={() => navigate(`/app/articles/new?theme=${encodeURIComponent(title)}`)}
                      >
                        <span className="text-sm">{title}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Analysis History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Histórico de Análises
            </CardTitle>
            <CardDescription>Suas últimas palavras-chave analisadas</CardDescription>
          </CardHeader>
          <CardContent>
            {keywordAnalyses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Nenhuma análise realizada</p>
                <p className="text-sm">Digite uma palavra-chave acima para começar.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {keywordAnalyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setKeywordInput(analysis.keyword)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{analysis.keyword}</span>
                          {analysis.source === "ai_suggestion" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30 cursor-help"
                                >
                                  IA
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Sugerido pela IA baseado no seu nicho</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(analysis.analyzed_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {analysis.difficulty !== null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant={getDifficultyBadgeVariant(analysis.difficulty)} className="cursor-help">
                                {getDifficultyLabel(analysis.difficulty)} {analysis.difficulty}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {analysis.difficulty <= 30 
                                ? "Fácil: ideal para blogs novos"
                                : analysis.difficulty <= 60
                                ? "Médio: precisa de conteúdo otimizado"
                                : "Difícil: alta competição"
                              }
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {analysis.search_volume !== null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="cursor-help">
                                Vol: {formatVolume(analysis.search_volume)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              ~{analysis.search_volume.toLocaleString()} buscas/mês
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* AI Suggest Keywords Modal */}
        <AISuggestKeywordsModal
          blogId={blogId}
          open={showAISuggestModal}
          onOpenChange={setShowAISuggestModal}
          onAddKeywords={async (keywords) => {
            // Save keywords to analysis history
            for (const keyword of keywords) {
              const { data } = await supabase
                .from("keyword_analyses")
                .insert({
                  blog_id: blogId,
                  keyword,
                  source: "ai_suggestion",
                })
                .select()
                .single();
              
              if (data) {
                setKeywordAnalyses((prev) => [{
                  id: data.id,
                  keyword: data.keyword,
                  difficulty: data.difficulty,
                  search_volume: data.search_volume,
                  analyzed_at: data.analyzed_at,
                  source: "ai_suggestion",
                  suggestions: [],
                }, ...prev.slice(0, 19)]);
              }
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
}
