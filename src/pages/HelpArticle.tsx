import { useState, useEffect } from "react";
import { sanitizeHTML } from "@/lib/sanitize";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, HelpCircle, Clock } from "lucide-react";

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  icon: string;
  order_index: number;
  header_gif_url: string | null;
  created_at: string;
  updated_at: string;
}

const categoryLabels: Record<string, string> = {
  onboarding: "Primeiros Passos",
  dashboard: "Painel Principal",
  content: "Conteúdos",
  ebooks: "Ebooks",
  strategy: "Estratégia",
  performance: "Desempenho",
  automation: "Automações",
};

const categoryColors: Record<string, string> = {
  onboarding: "bg-pink-500/10 text-pink-600",
  dashboard: "bg-blue-500/10 text-blue-600",
  content: "bg-emerald-500/10 text-emerald-600",
  ebooks: "bg-purple-500/10 text-purple-600",
  strategy: "bg-amber-500/10 text-amber-600",
  performance: "bg-rose-500/10 text-rose-600",
  automation: "bg-cyan-500/10 text-cyan-600",
};

function formatContent(content: string): JSX.Element[] {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let isInList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-2 my-4 pl-4">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary mt-1.5">•</span>
              <span
                className="text-muted-foreground"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHTML(item.replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>")),
                }}
              />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    isInList = false;
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushList();
      return;
    }

    // H2 headers
    if (trimmedLine.startsWith("## ")) {
      flushList();
      const text = trimmedLine.replace("## ", "");
      elements.push(
        <h2
          key={index}
          className="text-xl font-display font-semibold mt-8 mb-4 text-foreground"
        >
          {text}
        </h2>
      );
      return;
    }

    // H3 headers
    if (trimmedLine.startsWith("### ")) {
      flushList();
      const text = trimmedLine.replace("### ", "");
      elements.push(
        <h3
          key={index}
          className="text-lg font-medium mt-6 mb-3 text-foreground"
        >
          {text}
        </h3>
      );
      return;
    }

    // Visual blocks
    if (trimmedLine.startsWith("💡")) {
      flushList();
      elements.push(
        <div
          key={index}
          className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 my-4"
        >
          <p
            className="text-amber-700 dark:text-amber-400"
            dangerouslySetInnerHTML={{
              __html: trimmedLine.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
            }}
          />
        </div>
      );
      return;
    }

    if (trimmedLine.startsWith("⚠️")) {
      flushList();
      elements.push(
        <div
          key={index}
          className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 my-4"
        >
          <p
            className="text-destructive"
            dangerouslySetInnerHTML={{
              __html: trimmedLine.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
            }}
          />
        </div>
      );
      return;
    }

    if (trimmedLine.startsWith("📌")) {
      flushList();
      elements.push(
        <div
          key={index}
          className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-4"
        >
          <p
            className="text-primary"
            dangerouslySetInnerHTML={{
              __html: trimmedLine.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
            }}
          />
        </div>
      );
      return;
    }

    // List items
    if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      isInList = true;
      listItems.push(trimmedLine.slice(2));
      return;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmedLine)) {
      flushList();
      const text = trimmedLine.replace(/^\d+\.\s/, "");
      elements.push(
        <p
          key={index}
          className="text-muted-foreground my-2 pl-4"
          dangerouslySetInnerHTML={{
            __html: `<span class="text-primary font-medium">${trimmedLine.match(/^\d+/)?.[0]}.</span> ${text.replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>")}`,
          }}
        />
      );
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p
        key={index}
        className="text-muted-foreground leading-relaxed my-3"
        dangerouslySetInnerHTML={{
          __html: trimmedLine.replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>"),
        }}
      />
    );
  });

  flushList();
  return elements;
}

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user && slug) {
      fetchArticle();
    }
  }, [user, authLoading, slug, navigate]);

  const fetchArticle = async () => {
    try {
      const { data, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (error) throw error;
      setArticle(data);
    } catch (error) {
      console.error("Error fetching help article:", error);
      navigate("/help");
    } finally {
      setLoading(false);
    }
  };

  const estimateReadingTime = (content: string): number => {
    const words = content.split(/\s+/).length;
    return Math.ceil(words / 200);
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!article) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-medium mb-2">Artigo não encontrado</h2>
          <p className="text-muted-foreground mb-4">
            O artigo que você procura não existe ou foi removido.
          </p>
          <Button onClick={() => navigate("/help")}>Voltar para Ajuda</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6 -ml-2"
          onClick={() => navigate("/help")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Ajuda
        </Button>

        {/* Article Header */}
        <div className="mb-8">
          <Badge variant="secondary" className={categoryColors[article.category]}>
            {categoryLabels[article.category] || article.category}
          </Badge>
          <h1 className="text-3xl font-display font-bold mt-4 mb-3">
            {article.title}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{estimateReadingTime(article.content)} min de leitura</span>
          </div>
          
          {/* GIF Header */}
          {article.header_gif_url && (
            <div className="mt-6 rounded-xl overflow-hidden border bg-muted/30">
              <img
                src={article.header_gif_url}
                alt={article.title}
                className="w-full h-auto max-h-[400px] object-cover"
              />
            </div>
          )}
        </div>

        {/* Article Content */}
        <Card>
          <CardContent className="py-8 px-6 sm:px-8">
            <article className="prose prose-slate dark:prose-invert max-w-none">
              {formatContent(article.content)}
            </article>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Este artigo foi útil?{" "}
            <Button variant="link" className="p-0 h-auto text-primary">
              Enviar feedback
            </Button>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
