import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, LinkIcon, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BrokenLink {
  id: string;
  article_id: string;
  url: string;
  anchor_text: string | null;
  status_code: number | null;
  error_message: string | null;
  is_fixed: boolean;
  detected_at: string | null;
  fixed_at: string | null;
}

interface BrokenLinksPanelProps {
  articleId: string;
  blogId: string;
}

export function BrokenLinksPanel({ articleId, blogId }: BrokenLinksPanelProps) {
  const [links, setLinks] = useState<BrokenLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fixingUrl, setFixingUrl] = useState<string | null>(null);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("article_broken_links")
        .select("*")
        .eq("article_id", articleId)
        .order("detected_at", { ascending: false });

      if (error) throw error;
      setLinks((data as BrokenLink[]) || []);
    } catch {
      // silently fail on initial load
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [articleId]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-broken-links", {
        body: { article_id: articleId, blog_id: blogId },
      });
      if (error) throw error;
      toast.success(data?.message || "Verificação concluída!");
      await fetchLinks();
    } catch (err: any) {
      toast.error("Erro ao verificar links: " + (err.message || "erro desconhecido"));
    } finally {
      setChecking(false);
    }
  };

  const handleFix = async (url: string) => {
    setFixingUrl(url);
    try {
      const { data, error } = await supabase.functions.invoke("fix-broken-link", {
        body: { article_id: articleId, url },
      });
      if (error) throw error;
      toast.success(data?.message || "Link corrigido!");
      await fetchLinks();
    } catch (err: any) {
      toast.error("Erro ao corrigir link: " + (err.message || "erro desconhecido"));
    } finally {
      setFixingUrl(null);
    }
  };

  const brokenCount = links.filter((l) => !l.is_fixed).length;
  const fixedCount = links.filter((l) => l.is_fixed).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Links Quebrados
            {brokenCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                {brokenCount}
              </Badge>
            )}
            {brokenCount === 0 && links.length > 0 && (
              <Badge className="ml-1 text-xs px-1.5 py-0 bg-green-500/20 text-green-600 border-green-500/30">
                OK
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheck}
            disabled={checking}
            className="gap-1.5"
          >
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Verificar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum link verificado ainda. Clique em "Verificar" para escanear.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Summary */}
            {links.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground pb-2 border-b">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  {brokenCount} quebrado{brokenCount !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {fixedCount} corrigido{fixedCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Link list */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-start gap-2 p-2 rounded-md border bg-card text-sm"
                >
                  {link.is_fixed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-mono text-xs" title={link.url}>
                      {link.url}
                    </p>
                    {link.anchor_text && (
                      <p className="text-xs text-muted-foreground truncate">
                        Âncora: {link.anchor_text}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {link.status_code && `HTTP ${link.status_code} · `}
                      {link.detected_at &&
                        format(new Date(link.detected_at), "dd/MM/yyyy", { locale: ptBR })}
                      {link.is_fixed && link.fixed_at && (
                        <span className="text-green-600">
                          {" "}
                          · Corrigido em{" "}
                          {format(new Date(link.fixed_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </p>
                  </div>
                  {!link.is_fixed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFix(link.url)}
                      disabled={fixingUrl === link.url}
                      className="flex-shrink-0 h-7 px-2 text-xs gap-1"
                    >
                      {fixingUrl === link.url ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wrench className="h-3 w-3" />
                      )}
                      Corrigir
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
