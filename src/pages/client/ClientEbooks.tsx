import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, Sparkles, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBlog } from "@/hooks/useBlog";
import { EbookCard } from "@/components/ebooks/EbookCard";
import { Skeleton } from "@/components/ui/skeleton";

interface Ebook {
  id: string;
  title: string;
  status: string;
  cover_image_url: string | null;
  pdf_url: string | null;
  created_at: string;
  source_article_id: string | null;
}

export default function ClientEbooks() {
  const navigate = useNavigate();
  const { blog, loading: blogLoading } = useBlog();
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (blog) {
      fetchEbooks();
    } else if (!blogLoading) {
      setLoading(false);
    }
  }, [blog, blogLoading]);

  const fetchEbooks = async () => {
    if (!blog) return;
    
    try {
      const { data: ebooksData } = await supabase
        .from("ebooks")
        .select("id, title, status, cover_image_url, pdf_url, created_at, source_article_id")
        .eq("blog_id", blog.id)
        .order("created_at", { ascending: false });

      setEbooks(ebooksData || []);
    } catch (error) {
      console.error("Error fetching ebooks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ebooks").delete().eq("id", id);
    if (!error) {
      setEbooks(ebooks.filter((e) => e.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">eBooks</h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Admin
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Gere material rico para usar de isca digital e nutrir seus leads
          </p>
        </div>
        <Button className="gradient-primary gap-2" onClick={() => navigate("/client/ebooks/new")}>
          <Plus className="h-4 w-4" />
          Criar eBook
        </Button>
      </div>

      {/* Intro Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="p-3 rounded-xl bg-primary/10 h-fit">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Transforme seus artigos em eBooks prontos para gerar leads
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Gere material rico para usar de isca digital e nutrir seus leads. Em apenas 1 minuto
                você gera eBooks para enviar para a sua audiência por email, captando leads ou
                postando no LinkedIn.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Conteúdo expandido por IA</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Capa profissional automática</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Download className="h-4 w-4 text-primary" />
                  <span>PDF pronto para download</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* eBooks Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : ebooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum eBook criado ainda
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              Crie seu primeiro eBook a partir de um artigo existente e comece a gerar leads
              qualificados.
            </p>
            <Button className="gradient-primary gap-2" onClick={() => navigate("/client/ebooks/new")}>
              <Plus className="h-4 w-4" />
              Criar primeiro eBook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ebooks.map((ebook) => (
            <EbookCard
              key={ebook.id}
              ebook={ebook}
              onDelete={handleDelete}
              onClick={() => navigate(`/client/ebooks/${ebook.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
