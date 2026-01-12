import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, CheckCircle, AlertTriangle, XCircle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { calculateSEOScore, SEOScoreResult } from "@/utils/seoScore";
import { ArticleSEOItem } from "./ArticleSEOList";

interface SEOAnalysisModalProps {
  article: ArticleSEOItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogId: string;
  userId: string;
  onArticleUpdated: () => void;
}

interface SEOItemConfig {
  key: keyof SEOScoreResult["details"];
  label: string;
  fixType: "title" | "meta" | "content" | "density";
  description: string;
}

const SEO_ITEMS: SEOItemConfig[] = [
  { key: "title", label: "Título", fixType: "title", description: "50-60 caracteres, palavra-chave incluída" },
  { key: "meta", label: "Meta Description", fixType: "meta", description: "140-160 caracteres, palavra-chave incluída" },
  { key: "keywords", label: "Palavras-chave", fixType: "density", description: "3-5 palavras-chave estratégicas" },
  { key: "content", label: "Conteúdo", fixType: "content", description: "1500-2500 palavras para melhor ranqueamento" },
  { key: "density", label: "Densidade", fixType: "density", description: "0.5%-2.5% de densidade de keywords" },
  { key: "image", label: "Imagem", fixType: "content", description: "Imagem destacada configurada" },
];

export function SEOAnalysisModal({
  article,
  open,
  onOpenChange,
  blogId,
  userId,
  onArticleUpdated,
}: SEOAnalysisModalProps) {
  const [seoResult, setSeoResult] = useState<SEOScoreResult | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixingAll, setFixingAll] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<ArticleSEOItem | null>(null);

  useEffect(() => {
    if (article) {
      setCurrentArticle(article);
      const result = calculateSEOScore({
        title: article.title,
        metaDescription: article.meta_description || "",
        content: article.content,
        keywords: article.keywords || [],
        featuredImage: article.featured_image_url,
      });
      setSeoResult(result);
    }
  }, [article]);

  const handleFix = async (type: "title" | "meta" | "content" | "density") => {
    if (!currentArticle || !userId) return;

    // Validate keywords exist
    if (!currentArticle.keywords || currentArticle.keywords.length === 0) {
      toast.error("Adicione pelo menos 1 palavra-chave para otimizar com IA");
      return;
    }

    setFixing(type);
    try {
      const currentValue = type === "title" 
        ? currentArticle.title 
        : type === "meta" 
          ? currentArticle.meta_description || ""
          : currentArticle.content || "";

      const { data, error } = await supabase.functions.invoke("improve-seo-item", {
        body: {
          type,
          currentValue,
          keywords: currentArticle.keywords,
          context: currentArticle.content || "",
          articleTitle: currentArticle.title,
          user_id: userId,
          blog_id: blogId,
        },
      });

      if (error) throw error;

      // FIX: Use correct field name from edge function response
      const improved = data.improvedValue;

      if (!improved) {
        throw new Error("AI não retornou conteúdo melhorado");
      }

      // Update article in database - CRITICAL: Only UPDATE, never INSERT
      // Also CRITICAL: Never include featured_image_url or content_images in updates
      const updateData: Record<string, string> = {};
      if (type === "title") updateData.title = improved;
      else if (type === "meta") updateData.meta_description = improved;
      else if (type === "content" || type === "density") updateData.content = improved;

      console.log('[SEO Modal] UPDATE article (never INSERT):', {
        articleId: currentArticle.id,
        fieldsUpdated: Object.keys(updateData)
      });

      // Verify we're not touching image fields
      console.assert(!('featured_image_url' in updateData), 'ERRO: featured_image_url não deve ser atualizado');
      console.assert(!('content_images' in updateData), 'ERRO: content_images não deve ser atualizado');

      const { error: updateError } = await supabase
        .from("articles")
        .update(updateData)
        .eq("id", currentArticle.id);

      if (updateError) throw updateError;

      // CRITICAL: Re-fetch from DB to ensure UI reflects actual persisted data
      const { data: freshArticle, error: fetchError } = await supabase
        .from("articles")
        .select("title, meta_description, content, keywords, featured_image_url, content_images")
        .eq("id", currentArticle.id)
        .single();

      if (fetchError) {
        console.error("Error refetching article:", fetchError);
        toast.error("Erro ao verificar atualização");
        return;
      }

      // Log image preservation for debugging
      console.log('[SEO Modal] After fix, images preserved:', {
        featured_image_url: freshArticle.featured_image_url,
        content_images: freshArticle.content_images
      });

      // Update local state with REAL data from DB
      setCurrentArticle({
        ...currentArticle,
        title: freshArticle.title,
        meta_description: freshArticle.meta_description,
        content: freshArticle.content,
        featured_image_url: freshArticle.featured_image_url,
      });

      // Recalculate SEO score with fresh data
      const newResult = calculateSEOScore({
        title: freshArticle.title,
        metaDescription: freshArticle.meta_description || "",
        content: freshArticle.content,
        keywords: freshArticle.keywords || [],
        featuredImage: freshArticle.featured_image_url,
      });
      setSeoResult(newResult);

      // Log what changed
      const typeLabel = type === "title" ? "Título" : type === "meta" ? "Meta description" : type === "content" ? "Conteúdo" : "Densidade";
      toast.success(`${typeLabel} otimizado com sucesso!`);
      onArticleUpdated();
    } catch (error) {
      console.error("Error fixing SEO:", error);
      toast.error("Erro ao otimizar SEO");
    } finally {
      setFixing(null);
    }
  };

  const handleFixAll = async () => {
    if (!currentArticle) return;

    // Validate keywords exist
    if (!currentArticle.keywords || currentArticle.keywords.length === 0) {
      toast.error("Adicione pelo menos 1 palavra-chave para otimizar com IA");
      return;
    }

    setFixingAll(true);
    const itemsToFix = SEO_ITEMS.filter((item) => {
      if (!seoResult) return false;
      const detail = seoResult.details[item.key];
      return detail.score < detail.max * 0.8;
    });

    let fixedCount = 0;
    for (const item of itemsToFix) {
      if (item.key === "image" || item.key === "keywords") continue; // Skip - needs manual action
      try {
        await handleFix(item.fixType);
        fixedCount++;
      } catch (error) {
        console.error(`Failed to fix ${item.key}:`, error);
      }
    }

    setFixingAll(false);
    if (fixedCount > 0) {
      toast.success(`${fixedCount} otimizações aplicadas com sucesso!`);
    } else {
      toast.info("Nenhuma otimização foi necessária");
    }
  };

  const getScoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return "text-green-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (pct >= 50) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const needsImprovement = seoResult
    ? Object.values(seoResult.details).some((d) => d.score < d.max * 0.8)
    : false;

  if (!currentArticle || !seoResult) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise SEO com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Article Title */}
          <div>
            <h3 className="font-medium text-lg truncate">{currentArticle.title}</h3>
            <p className="text-sm text-muted-foreground">
              {(currentArticle.keywords || []).join(", ") || "Sem palavras-chave"}
            </p>
          </div>

          {/* Overall Score */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Score SEO Geral</span>
                <Badge
                  className={
                    seoResult.totalScore >= 80
                      ? "bg-green-500/10 text-green-600"
                      : seoResult.totalScore >= 60
                      ? "bg-yellow-500/10 text-yellow-600"
                      : "bg-red-500/10 text-red-600"
                  }
                >
                  {seoResult.totalScore}%
                </Badge>
              </div>
              <Progress value={seoResult.totalScore} className="h-2" />
            </CardContent>
          </Card>

          {/* Individual Items */}
          <div className="space-y-3">
            {SEO_ITEMS.map((item) => {
              const detail = seoResult.details[item.key];
              const canFix = item.key !== "image" && item.key !== "keywords";
              const isGood = detail.score >= detail.max * 0.8;

              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {getScoreIcon(detail.score, detail.max)}
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${getScoreColor(detail.score, detail.max)}`}>
                      {detail.score}/{detail.max}
                    </span>
                    {canFix && !isGood && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFix(item.fixType)}
                        disabled={fixing !== null || fixingAll}
                        className="gap-2"
                      >
                        {fixing === item.fixType ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        Corrigir
                      </Button>
                    )}
                    {isGood && (
                      <Badge variant="outline" className="text-green-600">
                        OK
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fix All Button */}
          {needsImprovement && (
            <Button
              onClick={handleFixAll}
              disabled={fixing !== null || fixingAll}
              className="w-full gap-2"
            >
              {fixingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Otimizando tudo...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Corrigir Tudo com IA
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
