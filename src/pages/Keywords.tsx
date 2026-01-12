import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, Loader2, Search, Target, Lightbulb, FileText, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface KeywordSuggestion {
  keyword: string;
  type: string;
}

interface KeywordAnalysis {
  id: string;
  keyword: string;
  difficulty: number | null;
  search_volume: number | null;
  suggestions: unknown;
  analyzed_at: string;
}

interface AnalysisResult {
  keyword: string;
  competitiveness: 'baixa' | 'média' | 'alta';
  competitivenessReason: string;
  searchIntent: 'informacional' | 'transacional' | 'navegacional';
  suggestions: KeywordSuggestion[];
  titleSuggestions: string[];
  contentTips: string[];
}

interface Blog {
  id: string;
  name: string;
}

export default function Keywords() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [analyses, setAnalyses] = useState<KeywordAnalysis[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;

    try {
      const { data: blogData } = await supabase
        .from('blogs')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

      if (!blogData) {
        setLoadingData(false);
        return;
      }

      setBlog(blogData);

      const { data: analysesData } = await supabase
        .from('keyword_analyses')
        .select('*')
        .eq('blog_id', blogData.id)
        .order('analyzed_at', { ascending: false })
        .limit(20);

      if (analysesData) {
        setAnalyses(analysesData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  }

  const handleAnalyze = async () => {
    if (!blog || !keyword.trim()) return;

    setIsAnalyzing(true);
    setCurrentAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('keyword-analysis', {
        body: {
          blogId: blog.id,
          keyword: keyword.trim(),
        },
      });

      if (error) throw error;

      if (data?.analysis) {
        setCurrentAnalysis(data.analysis);
        fetchData(); // Refresh list
        toast({
          title: "Análise concluída!",
          description: `Palavra-chave "${keyword}" analisada com sucesso.`,
        });
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível analisar a palavra-chave. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCompetitivenessColor = (competitiveness: string) => {
    switch (competitiveness) {
      case 'baixa': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'média': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'alta': return 'bg-red-500/20 text-red-700 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSearchIntentLabel = (intent: string) => {
    switch (intent) {
      case 'informacional': return 'Informacional';
      case 'transacional': return 'Transacional';
      case 'navegacional': return 'Navegacional';
      default: return intent;
    }
  };

  const getSearchIntentDescription = (intent: string) => {
    switch (intent) {
      case 'informacional': return 'Usuários buscando aprender ou entender algo';
      case 'transacional': return 'Usuários prontos para comprar ou agir';
      case 'navegacional': return 'Usuários buscando um site ou marca específica';
      default: return '';
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex h-16 items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg gradient-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">Omniseen</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Análise de Palavras-chave</h1>
          <p className="text-muted-foreground">
            Analise palavras-chave e descubra oportunidades de conteúdo com IA.
          </p>
        </div>

        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Analisar Palavra-chave
            </CardTitle>
            <CardDescription>
              A IA vai analisar competitividade, intenção de busca e sugerir variações qualitativas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Digite uma palavra-chave..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                className="flex-1"
              />
              <Button onClick={handleAnalyze} disabled={isAnalyzing || !keyword.trim()}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
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

        {/* Current Analysis Result */}
        {currentAnalysis && (
          <Card className="mb-8 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>"{currentAnalysis.keyword}"</span>
                <Badge variant="outline">Nova análise</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Qualitative Metrics */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Competitiveness */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Competitividade</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-base px-3 py-1 mb-2 ${getCompetitivenessColor(currentAnalysis.competitiveness)}`}
                  >
                    {currentAnalysis.competitiveness.charAt(0).toUpperCase() + currentAnalysis.competitiveness.slice(1)}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    {currentAnalysis.competitivenessReason}
                  </p>
                </div>

                {/* Search Intent */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Intenção de Busca</span>
                  </div>
                  <Badge variant="secondary" className="text-base px-3 py-1 mb-2">
                    {getSearchIntentLabel(currentAnalysis.searchIntent)}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    {getSearchIntentDescription(currentAnalysis.searchIntent)}
                  </p>
                </div>
              </div>

              {/* Content Tips */}
              {currentAnalysis.contentTips && currentAnalysis.contentTips.length > 0 && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Dicas de Conteúdo
                  </h4>
                  <ul className="space-y-2">
                    {currentAnalysis.contentTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Keywords */}
              {currentAnalysis.suggestions && currentAnalysis.suggestions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Palavras-chave Relacionadas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentAnalysis.suggestions.map((s, i) => (
                      <Badge 
                        key={i} 
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => setKeyword(s.keyword)}
                      >
                        {s.keyword}
                        <span className="ml-1 text-xs opacity-60">({s.type})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Title Suggestions */}
              {currentAnalysis.titleSuggestions && currentAnalysis.titleSuggestions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Sugestões de Títulos
                  </h4>
                  <div className="space-y-2">
                    {currentAnalysis.titleSuggestions.map((title, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/app/articles/new?theme=${encodeURIComponent(title)}`)}
                      >
                        <span>{title}</span>
                        <Button size="sm" variant="ghost">
                          Criar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Análises</CardTitle>
            <CardDescription>
              Suas últimas palavras-chave analisadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma análise ainda.</p>
                <p className="text-sm">Comece analisando uma palavra-chave acima.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <div 
                    key={analysis.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => setKeyword(analysis.keyword)}
                  >
                    <div>
                      <p className="font-medium">{analysis.keyword}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(analysis.analyzed_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Reanalisar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
