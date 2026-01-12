import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ArticleToFix {
  id: string;
  title: string;
  meta_description: string | null;
  content: string | null;
  keywords: string[] | null;
  seoScore: number;
}

interface FixAllSEOButtonProps {
  articles: ArticleToFix[];
  blogId?: string;
  userId?: string;
  onComplete: () => void;
}

export function FixAllSEOButton({ articles, blogId, userId, onComplete }: FixAllSEOButtonProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentArticle, setCurrentArticle] = useState("");

  // REGRA 2: SEO NUNCA BLOQUEIA - todos os artigos são elegíveis
  // Keywords serão geradas automaticamente pelo backend
  const eligibleArticles = articles.filter(a => a.seoScore < 60);

  const handleFixAll = async () => {
    if (eligibleArticles.length === 0) {
      toast.info("Nenhum artigo com score abaixo de 60% para corrigir");
      return;
    }

    setIsFixing(true);
    setCurrentIndex(0);

    let fixedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < eligibleArticles.length; i++) {
      const article = eligibleArticles[i];
      setCurrentIndex(i + 1);
      setCurrentArticle(article.title);

      try {
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

        // Update article
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (titleData?.improvedValue) {
          updates.title = titleData.improvedValue;
        }

        if (metaData?.improvedValue) {
          updates.meta_description = metaData.improvedValue;
        }

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

    setIsFixing(false);
    setCurrentIndex(0);
    setCurrentArticle("");

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
    
    onComplete();
  };

  if (eligibleArticles.length === 0) {
    return null;
  }

  // REGRA 2: Botão sempre habilitado - keywords geradas automaticamente
  const buttonLabel = `Corrigir Todos com IA (${eligibleArticles.length} artigos)`;

  return (
    <div className="flex flex-col gap-2">
      {isFixing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Otimizando {currentIndex}/{eligibleArticles.length}: {currentArticle.substring(0, 30)}...
            </span>
          </div>
          <Progress value={(currentIndex / eligibleArticles.length) * 100} className="h-2" />
        </div>
      ) : (
        <Button 
          onClick={handleFixAll} 
          variant="default" 
          size="sm"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>
      )}
    </div>
  );
}
