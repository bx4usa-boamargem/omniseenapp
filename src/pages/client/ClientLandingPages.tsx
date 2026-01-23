import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Eye, Pencil, Trash2, Globe, GlobeLock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLandingPages } from "@/components/client/landingpage/hooks/useLandingPages";
import { useBlog } from "@/hooks/useBlog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ClientLandingPages() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  const { pages, loading, fetchPages, deletePage, publishPage, unpublishPage } = useLandingPages();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (blog?.id) {
      fetchPages(blog.id);
    }
  }, [blog?.id, fetchPages]);

  const handleDelete = async () => {
    if (deleteId) {
      await deletePage(deleteId);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "published") {
      return (
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
          <Globe className="h-3 w-3 mr-1" />
          Publicada
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-muted">
        <GlobeLock className="h-3 w-3 mr-1" />
        Rascunho
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Landing Pages</h1>
          <p className="text-muted-foreground mt-1">
            Crie páginas de alta conversão com IA para seus serviços
          </p>
        </div>
        <Button onClick={() => navigate("/client/landing-pages/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Criar Nova
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-5 bg-muted rounded w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma landing page ainda
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Crie sua primeira landing page otimizada para conversão usando nossa IA
            </p>
            <Button onClick={() => navigate("/client/landing-pages/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeira Página
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Card key={page.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-medium line-clamp-2">
                    {page.title}
                  </CardTitle>
                  {getStatusBadge(page.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>/{page.slug}</p>
                  <p className="mt-1">
                    {page.updated_at
                      ? format(new Date(page.updated_at), "dd MMM yyyy", { locale: ptBR })
                      : format(new Date(page.created_at), "dd MMM yyyy", { locale: ptBR })}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/client/landing-pages/${page.id}`)}
                    className="flex-1"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  
                  {page.status === "published" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unpublishPage(page.id)}
                    >
                      <GlobeLock className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => publishPage(page.id)}
                    >
                      <Globe className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(page.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir landing page?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A página será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
