import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowUpDown, FileText, Sparkles, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { calculateSEOScore } from "@/utils/seoScore";
import { SEOScoreGauge } from "@/components/seo/SEOScoreGauge";

export interface ArticleSEOItem {
  id: string;
  title: string;
  content: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  featured_image_url: string | null;
  status: string;
  seoScore: number;
}

interface ArticleSEOListProps {
  blogId: string;
  userId?: string;
  onSelectArticle: (article: ArticleSEOItem) => void;
  onScoreCalculated?: (avgScore: number, totalArticles: number) => void;
  onOptimizationStart?: () => void;
}

export function ArticleSEOList({ blogId, userId, onSelectArticle, onScoreCalculated, onOptimizationStart }: ArticleSEOListProps) {
  const [articles, setArticles] = useState<ArticleSEOItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [currentFixingTitle, setCurrentFixingTitle] = useState("");

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, content, meta_description, keywords, featured_image_url, status")
        .eq("blog_id", blogId)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const articlesWithScore = (data || []).map((article) => {
        const { totalScore } = calculateSEOScore({
          title: article.title,
          metaDescription: article.meta_description || "",
          content: article.content,
          keywords: article.keywords || [],
          featuredImage: article.featured_image_url,
        });
        return { ...article, seoScore: totalScore };
      });

      // Sort by SEO score (worst first by default)
      articlesWithScore.sort((a, b) => 
        sortAsc ? a.seoScore - b.seoScore : b.seoScore - a.seoScore
      );

      setArticles(articlesWithScore);

      // Calculate and report average score
      if (onScoreCalculated && articlesWithScore.length > 0) {
        const avgScore = Math.round(
          articlesWithScore.reduce((sum, a) => sum + a.seoScore, 0) / articlesWithScore.length
        );
        onScoreCalculated(avgScore, articlesWithScore.length);
      } else if (onScoreCalculated) {
        onScoreCalculated(0, 0);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [blogId, sortAsc]);

  // REGRA 2: SEO NUNCA BLOQUEIA - todos os artigos são elegíveis
  // Keywords serão geradas automaticamente pelo backend
  const eligibleArticles = articles.filter(a => a.seoScore < 60);

  const handleFixAllSEO = async () => {
    if (eligibleArticles.length === 0) {
      toast.info("Nenhum artigo com score abaixo de 60% para corrigir");
      return;
    }

    // Notify parent that optimization is starting
    onOptimizationStart?.();
    
    setIsFixingAll(true);
    setFixProgress(0);

    let fixedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < eligibleArticles.length; i++) {
      const article = eligibleArticles[i];
      setFixProgress(((i + 1) / eligibleArticles.length) * 100);
      setCurrentFixingTitle(article.title.substring(0, 40) + (article.title.length > 40 ? "..." : ""));

      try {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        // Fix title - REGRA 2: enviar article_id para persistência de keywords auto-geradas
        const { data: titleData, error: titleError } = await supabase.functions.invoke("improve-seo-item", {
          body: {
            type: "title",
            currentValue: article.title,
            keywords: article.keywords || [], // Backend gera automaticamente se vazio
            context: article.content,
            user_id: userId,
            blog_id: blogId,
            article_id: article.id, // Permite persistência de keywords geradas
          },
        });

        if (titleError) throw titleError;

        if (titleData?.improvedValue) {
          updates.title = titleData.improvedValue;
        }

        // Fix meta description - REGRA 3: gera automaticamente se vazia ou inválida
        const { data: metaData, error: metaError } = await supabase.functions.invoke("improve-seo-item", {
          body: {
            type: "meta",
            currentValue: article.meta_description || "",
            keywords: article.keywords || [], // Backend gera automaticamente se vazio
            context: article.content,
            articleTitle: titleData?.improvedValue || article.title,
            user_id: userId,
            blog_id: blogId,
            article_id: article.id, // Permite persistência de meta gerada
          },
        });

        if (metaError) throw metaError;

        if (metaData?.improvedValue) {
          updates.meta_description = metaData.improvedValue;
        }

        // Fix content length (if below 800 words) - expands content to improve SEO score
        const wordCount = (article.content || '').split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount < 800 && article.keywords && article.keywords.length > 0) {
          const { data: contentData, error: contentError } = await supabase.functions.invoke("improve-seo-item", {
            body: {
              type: "content",
              currentValue: article.content || "",
              keywords: article.keywords,
              user_id: userId,
              blog_id: blogId,
            },
          });

          if (!contentError && contentData?.improvedValue) {
            updates.content = contentData.improvedValue;
          }
        }

        // Update article only if we have improvements
        if (Object.keys(updates).length > 1) {
          const { error: updateError } = await supabase
            .from("articles")
            .update(updates)
            .eq("id", article.id);
          
          if (updateError) throw updateError;
          fixedCount++;
        }
      } catch (error) {
        console.error(`Error fixing article ${article.title}:`, error);
        errors.push(article.title.substring(0, 20));
      }
    }

    setIsFixingAll(false);
    setFixProgress(0);
    setCurrentFixingTitle("");

    // Show detailed result - REGRA 2: sem mensagens sobre keywords
    let message = `${fixedCount} artigo(s) otimizado(s)`;
    if (errors.length > 0) {
      message += `, ${errors.length} com erro`;
    }
    
    if (fixedCount > 0) {
      toast.success(message);
    } else if (errors.length > 0) {
      toast.error(message);
    } else {
      toast.info(message);
    }
    
    // Add delay before refetch to ensure database propagation
    await new Promise(resolve => setTimeout(resolve, 500));
    await fetchArticles(); // Refresh list to show updated scores
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum artigo publicado para analisar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Artigos para Análise</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* REGRA 2: Removido aviso de "sem keywords" - backend gera automaticamente */}
            {eligibleArticles.length > 0 && (
              isFixingAll ? (
                <div className="flex items-center gap-2 min-w-[200px]">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="truncate">{currentFixingTitle}</span>
                    </div>
                    <Progress value={fixProgress} className="h-1.5" />
                  </div>
                </div>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleFixAllSEO}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Corrigir Todos com IA ({eligibleArticles.length})
                </Button>
              )
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortAsc(!sortAsc)}
              className="gap-2"
            >
              <ArrowUpDown className="h-4 w-4" />
              {sortAsc ? "Pior primeiro" : "Melhor primeiro"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {articles.map((article) => (
            <div
              key={article.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-4">
                <h4 className="font-medium truncate">{article.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {/* REGRA 2: Mensagem informativa ao invés de bloqueio */}
                  {(article.keywords || []).slice(0, 3).join(", ") || "IA gerará keywords automaticamente"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <SEOScoreGauge 
                  score={article.seoScore} 
                  size="sm" 
                  showLabel={false}
                  animated={false}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectArticle(article)}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Analisar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}