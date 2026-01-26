import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, FileText, LayoutTemplate, Globe, Users, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBlog } from "@/hooks/useBlog";
import { supabase } from "@/integrations/supabase/client";
import { OpportunitiesCarouselBanner } from "@/components/dashboard/OpportunitiesCarouselBanner";
import { getBlogUrl, getInternalBlogUrl } from "@/utils/blogUrl";

export default function ClientDashboardMvp() {
  const navigate = useNavigate();
  const { blog } = useBlog();

  const [copied, setCopied] = useState(false);
  const [leadsCount, setLeadsCount] = useState<number | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const portalUrl = useMemo(() => {
    if (!blog) return "";
    // URL pública quando disponível (subdomínio/ custom domain)
    return getBlogUrl(blog);
  }, [blog]);

  const previewUrl = useMemo(() => {
    if (!blog) return "";
    return getInternalBlogUrl(blog.slug);
  }, [blog]);

  useEffect(() => {
    const fetchLeadsCount = async () => {
      if (!blog?.id) return;
      setLoadingLeads(true);
      try {
        const { count } = await supabase
          .from("brand_agent_leads")
          .select("*", { count: "exact", head: true })
          .eq("blog_id", blog.id);
        setLeadsCount(count ?? 0);
      } catch (e) {
        console.error("[ClientDashboardMvp] leads count error", e);
        setLeadsCount(null);
      } finally {
        setLoadingLeads(false);
      }
    };

    fetchLeadsCount();
  }, [blog?.id]);

  const handleCopyPortalUrl = async () => {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* 1) Oportunidades */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Compass className="h-6 w-6 text-primary" />
              Radar de Oportunidades
            </h1>
            <p className="text-sm text-muted-foreground">
              Comece por aqui: escolha um tema e transforme em artigo publicado.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/client/radar")}>
            Abrir Radar
          </Button>
        </div>

        {blog?.id ? (
          <OpportunitiesCarouselBanner blogId={blog.id} />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Carregando blog...
            </CardContent>
          </Card>
        )}
      </div>

      {/* 2) Criar */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Criar Artigo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gere um artigo inteligente e publique no seu portal.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/client/create")} className="flex-1">
                Criar agora
              </Button>
              <Button variant="outline" onClick={() => navigate("/client/articles")}>
                Ver lista
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              Criar Super Página
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gere uma landing page rápida, indexável e pronta para conversão.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/client/landing-pages/new")} className="flex-1">
                Criar agora
              </Button>
              <Button variant="outline" onClick={() => navigate("/client/landing-pages")}>
                Ver lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3) Publicar / Portal */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Portal Público
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Link do seu portal:</p>
              <p className="font-mono text-sm text-foreground truncate">{portalUrl || previewUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopyPortalUrl} disabled={!portalUrl} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copiar
              </Button>
              <Button onClick={() => window.open(portalUrl || previewUrl, "_blank")} className="gap-2">
                <Globe className="h-4 w-4" />
                Abrir
              </Button>
              <Button variant="outline" onClick={() => navigate("/client/portal")}>
                Editar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Dica: mesmo sem domínio próprio, você já pode publicar e compartilhar seu portal.
          </p>
        </CardContent>
      </Card>

      {/* Prova de valor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Leads Capturados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Leads gerados pelo seu Agente:</p>
            <div className="text-2xl font-bold">
              {loadingLeads ? <Loader2 className="h-5 w-5 animate-spin" /> : leadsCount ?? "—"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/client/leads")} className="gap-2">
              Ver Leads
            </Button>
            <Button variant="outline" onClick={() => navigate("/client/profile")}>
              Configurar Agente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
