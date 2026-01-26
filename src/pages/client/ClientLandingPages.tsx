import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Loader2, Globe, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBlog } from "@/hooks/useBlog";
import { useLandingPages } from "@/components/client/landingpage/hooks/useLandingPages";
import { getCanonicalBlogUrl } from "@/utils/blogUrl";

export default function ClientLandingPages() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  const { pages, loading, fetchPages } = useLandingPages();

  const publicBaseUrl = useMemo(() => (blog ? getCanonicalBlogUrl(blog) : ""), [blog]);

  useEffect(() => {
    if (!blog?.id) return;
    fetchPages(blog.id);
  }, [blog?.id, fetchPages]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
            <FileText className="h-8 w-8 text-primary" />
            Super Páginas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Landing pages rápidas, indexáveis e orientadas a conversão.
          </p>
        </div>

        <Button onClick={() => navigate("/client/landing-pages/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Criar Super Página
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[240px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma Super Página ainda</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Clique em "Criar Super Página" para gerar uma landing page com base na sua empresa e no SERP.
            </p>
            <Button onClick={() => navigate("/client/landing-pages/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar agora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pages.map((p) => (
            <Card key={p.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="pt-6 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{p.title}</p>
                    <Badge variant={p.status === "published" ? "default" : "secondary"}>
                      {p.status === "published" ? "Publicada" : "Rascunho"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span className="font-mono truncate">/p/{p.slug}</span>
                    {p.status === "published" && publicBaseUrl && (
                      <a
                        href={`${publicBaseUrl}/p/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4" />
                        abrir
                      </a>
                    )}
                  </div>
                </div>

                <Button variant="outline" onClick={() => navigate(`/client/landing-pages/${p.id}`)} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}