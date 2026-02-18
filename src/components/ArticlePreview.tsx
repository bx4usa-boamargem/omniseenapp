import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { FileText, Search, MessageSquare, RefreshCw, Loader2, ImageIcon, CheckCircle2, XCircle, Eye } from "lucide-react";
import { ArticleContent } from "@/components/public/ArticleContent";
import { ArticleCTARenderer } from "@/components/client/ArticleCTARenderer";
import type { ArticleData } from "@/utils/streamArticle";
import type { ContentImage, ImageGenerationProgress } from "@/utils/generateContentImages";

interface ArticlePreviewProps {
  article: ArticleData | null;
  streamingText: string;
  isStreaming: boolean;
  featuredImage?: string | null;
  contentImages?: ContentImage[];
  isGeneratingImages?: boolean;
  imageProgress?: ImageGenerationProgress | null;
  onRegenerateImages?: () => void;
}

const contextLabels: Record<string, string> = {
  hero: 'Capa',
  problem: 'Problema',
  solution: 'Solução',
  result: 'Resultado'
};

export function ArticlePreview({ 
  article, 
  streamingText, 
  isStreaming, 
  featuredImage, 
  contentImages = [],
  isGeneratingImages, 
  imageProgress,
  onRegenerateImages 
}: ArticlePreviewProps) {
  if (!article && !streamingText && !isStreaming) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted/30 border-dashed">
        <CardContent className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-muted-foreground">Preview do Artigo</h3>
          <p className="text-sm text-muted-foreground mt-1">
            O artigo gerado aparecerá aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isStreaming && !article) {
    return (
      <Card className="h-full overflow-auto">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-transparent p-0 overflow-hidden">
              {streamingText}
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
            </pre>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!article) return null;

  return (
    <Card className="h-full overflow-auto">
      {/* Image Generation Progress */}
      {isGeneratingImages && imageProgress && (
        <div className="border-b p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">
                Gerando imagens ({imageProgress.current}/{imageProgress.total})
              </span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {contextLabels[imageProgress.context] || imageProgress.context}
            </Badge>
          </div>
          <Progress value={(imageProgress.current / imageProgress.total) * 100} className="h-2" />
        </div>
      )}

      {/* Featured Image Section */}
      {isGeneratingImages && !featuredImage && (
        <div className="aspect-video bg-muted flex items-center justify-center border-b">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">Gerando imagem de capa...</span>
          </div>
        </div>
      )}
      
      {featuredImage && !isGeneratingImages && (
        <div className="relative group">
          <img 
            src={featuredImage} 
            alt="Imagem de capa do artigo" 
            className="w-full aspect-video object-cover"
          />
          {onRegenerateImages && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onRegenerateImages}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Melhorar imagens
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Image Status Summary */}
      {!isGeneratingImages && (featuredImage || contentImages.length > 0) && (
        <div className="border-b p-3 bg-muted/20">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              {featuredImage ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>Capa</span>
            </div>
            {['problem', 'solution', 'result'].map((ctx) => {
              const hasImage = contentImages.some(img => img.context === ctx);
              return (
                <div key={ctx} className="flex items-center gap-1.5">
                  {hasImage ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{contextLabels[ctx]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CardHeader className="pb-3 border-b">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>
          <p className="text-muted-foreground italic">{article.excerpt}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <span className="line-clamp-1">{article.meta_description}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Badge de Simulação */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground bg-muted/30 py-2 rounded-lg">
          <Eye className="h-3.5 w-3.5" />
          <span>Simulação do post publicado</span>
        </div>
        
        {/* Usar o mesmo componente do blog público */}
        <ArticleContent 
          content={article.content} 
          contentImages={contentImages} 
        />

        {article.faq && article.faq.length > 0 && (
          <div className="mt-8 pt-6 border-t">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Perguntas Frequentes</h2>
            </div>
            <div className="space-y-4">
              {article.faq.map((item, index) => (
                <div key={index} className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{item.question}</h3>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA da subconta */}
        {(article as any).cta && (
          <div className="mt-8 pt-6 border-t">
            <ArticleCTARenderer cta={(article as any).cta} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
