import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, Loader2, Plus, Network, FileText, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ClusterArticle {
  id: string;
  is_pillar: boolean;
  suggested_title: string | null;
  suggested_keywords: string[] | null;
  status: string;
  article_id: string | null;
}

interface Cluster {
  id: string;
  name: string;
  pillar_keyword: string;
  description: string | null;
  status: string;
  created_at: string;
  cluster_articles: ClusterArticle[];
}

export default function Clusters() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { blog, loading: blogLoading } = useBlog();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCluster, setNewCluster] = useState({ keyword: '', description: '' });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchData();
  }, [user, blog]);

  async function fetchData() {
    if (!user || !blog) return;

    try {
      // Get clusters with articles
      const { data: clustersData } = await supabase
        .from('content_clusters')
        .select(`
          *,
          cluster_articles (*)
        `)
        .eq('blog_id', blog.id)
        .order('created_at', { ascending: false });

      if (clustersData) {
        setClusters(clustersData);
      }
    } catch (error) {
      console.error("Error fetching clusters:", error);
    } finally {
      setLoadingData(false);
    }
  }

  const handleCreateCluster = async () => {
    if (!blog || !newCluster.keyword.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-cluster', {
        body: {
          blogId: blog.id,
          pillarKeyword: newCluster.keyword,
          description: newCluster.description || undefined,
        },
      });

      if (error) throw error;

      if (data?.cluster) {
        toast({
          title: "Cluster criado!",
          description: "Sua estrutura de conteúdo foi gerada com sucesso.",
        });
        setDialogOpen(false);
        setNewCluster({ keyword: '', description: '' });
        fetchData();
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Cluster creation error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o cluster. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading || blogLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg gradient-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">Omniseen</span>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cluster
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Cluster de Conteúdo</DialogTitle>
                <DialogDescription>
                  A IA vai gerar uma estrutura de artigos otimizada para SEO em torno do seu tema principal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="keyword">Palavra-chave Principal</Label>
                  <Input
                    id="keyword"
                    placeholder="Ex: marketing digital para pequenas empresas"
                    value={newCluster.keyword}
                    onChange={(e) => setNewCluster({ ...newCluster, keyword: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o objetivo do cluster..."
                    value={newCluster.description}
                    onChange={(e) => setNewCluster({ ...newCluster, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCluster} disabled={isCreating || !newCluster.keyword.trim()}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Criar com IA
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Clusters de Conteúdo</h1>
          <p className="text-muted-foreground">
            Organize seus artigos em estruturas SEO-otimizadas com artigos pilar e satélites.
          </p>
        </div>

        {clusters.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Network className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhum cluster ainda</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                Clusters ajudam a organizar seu conteúdo em torno de temas principais, melhorando seu SEO com links internos estratégicos.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Cluster
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {clusters.map((cluster) => {
              const pillarArticle = cluster.cluster_articles.find(a => a.is_pillar);
              const satelliteArticles = cluster.cluster_articles.filter(a => !a.is_pillar);
              const completedCount = cluster.cluster_articles.filter(a => a.article_id).length;

              return (
                <Card key={cluster.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Network className="h-5 w-5 text-primary" />
                          {cluster.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {cluster.description || `Cluster focado em "${cluster.pillar_keyword}"`}
                        </CardDescription>
                      </div>
                      <Badge variant={cluster.status === 'active' ? 'default' : 'secondary'}>
                        {cluster.status === 'active' ? 'Ativo' : cluster.status === 'completed' ? 'Completo' : 'Planejamento'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>{completedCount} de {cluster.cluster_articles.length} artigos criados</span>
                      </div>

                      {/* Pillar Article */}
                      {pillarArticle && (
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-primary border-primary">Pilar</Badge>
                            {pillarArticle.article_id ? (
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600">Criado</Badge>
                            ) : (
                              <Badge variant="secondary">Planejado</Badge>
                            )}
                          </div>
                          <p className="font-medium">{pillarArticle.suggested_title}</p>
                          {pillarArticle.suggested_keywords && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {pillarArticle.suggested_keywords.map((kw, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Satellite Articles */}
                      <div className="space-y-2">
                        {satelliteArticles.slice(0, 3).map((article) => (
                          <div key={article.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{article.suggested_title}</span>
                            </div>
                            {article.article_id ? (
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs">Criado</Badge>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/app/articles/new?theme=${encodeURIComponent(article.suggested_title || '')}`)}>
                                Criar
                              </Button>
                            )}
                          </div>
                        ))}
                        {satelliteArticles.length > 3 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            +{satelliteArticles.length - 3} artigos satélite
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
