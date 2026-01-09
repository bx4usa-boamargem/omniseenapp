import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { useOnboarding } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomationCard } from "@/components/automation/AutomationCard";
import { ArticleQueue } from "@/components/automation/ArticleQueue";
import { AnalyticsSummaryWidget } from "@/components/dashboard/AnalyticsSummaryWidget";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { BlogSelector } from "@/components/admin/BlogSelector";
import { SetupChecklist } from "@/components/dashboard/SetupChecklist";
import { GlobalOnboardingGuide, ONBOARDING_STEPS } from "@/components/onboarding/GlobalOnboardingGuide";
import {
  Sparkles,
  FileText,
  Plus,
  BarChart3,
  Loader2,
  PenTool,
  Eye,
  Palette,
  Target,
  Zap,
  TrendingUp,
  Calendar,
  Upload,
  ChevronRight,
} from "lucide-react";
import { SectionHelper } from "@/components/blog-editor/SectionHelper";
import { DashboardQuickGrid } from "@/components/dashboard/DashboardQuickGrid";

interface Article {
  id: string;
  title: string;
  status: string;
  created_at: string;
  featured_image_url: string | null;
  view_count: number | null;
}

interface Profile {
  full_name: string | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { blog, loading: blogLoading, role, isPlatformAdmin, refetch: refetchBlog } = useBlog();
  const { showOnboarding, completeOnboarding, skipOnboarding, startTour } = useOnboarding('dashboard');
  const [articles, setArticles] = useState<Article[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const refreshTimer = useRef<number | null>(null);

  const blogId = useMemo(() => blog?.id ?? null, [blog?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchArticles = async (currentBlogId: string) => {
    const { data: articlesData } = await supabase
      .from("articles")
      .select("*")
      .eq("blog_id", currentBlogId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (articlesData) {
      setArticles(articlesData as Article[]);
    }
  };

  useEffect(() => {
    async function fetchData() {
      if (!user || !blog) return;

      try {
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
        }

        // Fetch articles for the blog
        await fetchArticles(blog.id);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user && blog) {
      fetchData();
    } else if (!blogLoading) {
      setLoadingData(false);
    }
  }, [user, blog, blogLoading]);

  useEffect(() => {
    if (!blogId) return;

    const channel = supabase
      .channel(`articles-live-${blogId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "articles",
          filter: `blog_id=eq.${blogId}`,
        },
        () => {
          if (refreshTimer.current) {
            window.clearTimeout(refreshTimer.current);
          }
          refreshTimer.current = window.setTimeout(() => {
            fetchArticles(blogId);
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) {
        window.clearTimeout(refreshTimer.current);
      }
      supabase.removeChannel(channel);
    };
  }, [blogId]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const userName = profile?.full_name?.split(" ")[0] || "usuário";
  const totalViews = articles.reduce((sum, a) => sum + (a.view_count || 0), 0);
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const draftCount = articles.filter((a) => a.status === "draft").length;

  if (authLoading || blogLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="p-4 rounded-2xl gradient-primary inline-block mb-6">
            <PenTool className="h-12 w-12 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4">Vamos criar seu blog!</h1>
          <p className="text-muted-foreground mb-8">
            Em poucos passos você terá um blog profissional pronto para receber artigos gerados por IA.
          </p>
          <Button size="lg" onClick={() => navigate("/onboarding")}>
            Começar configuração
            <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  if (!blog.onboarding_completed) {
    navigate("/onboarding");
    return null;
  }

  // Create a compatible blog object for components that need it
  const blogData = {
    id: blog.id,
    name: blog.name,
    slug: blog.slug,
    description: blog.description,
    logo_url: blog.logo_url,
    primary_color: blog.primary_color,
    secondary_color: blog.secondary_color,
    onboarding_completed: blog.onboarding_completed || false,
  };

  if (!blog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="p-4 rounded-2xl gradient-primary inline-block mb-6">
            <PenTool className="h-12 w-12 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4">Vamos criar seu blog!</h1>
          <p className="text-muted-foreground mb-8">
            Em poucos passos você terá um blog profissional pronto para receber artigos gerados por IA.
          </p>
          <Button size="lg" onClick={() => navigate("/onboarding")}>
            Começar configuração
            <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  if (!blog.onboarding_completed) {
    navigate("/onboarding");
    return null;
  }

  return (
    <DashboardLayout>
      {/* Onboarding Tour */}
      {showOnboarding && (
        <GlobalOnboardingGuide
          steps={ONBOARDING_STEPS.dashboard}
          title="Bem-vindo ao Dashboard"
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}

      <div className="container py-8">
        {/* Quick Access Grid */}
        <div className="mb-6">
          <DashboardQuickGrid blogSlug={blog.slug} isPlatformAdmin={isPlatformAdmin} onStartTour={startTour} />
        </div>

        {/* Admin Mode Banner */}
        {isPlatformAdmin && (
          <div className="mb-6">
            <BlogSelector selectedBlogId={blog.id} onSelectBlog={() => {}} />
          </div>
        )}

        {/* Greeting Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">
            {getGreeting()}, {userName}! 👋
          </h1>
          <p className="text-muted-foreground">
            Gerencie seu blog <span className="font-medium text-foreground">{blogData.name}</span>
          </p>
        </div>

        {/* Orientation Message + Setup Checklist */}
        {user && blog && (
          <div className="mb-8 space-y-4">
            <p className="text-muted-foreground">
              Para que você tenha maior desempenho e organização, é necessário que você faça as configurações iniciais do seu blog.
            </p>
            <SetupChecklist blogId={blog.id} userId={user.id} />
          </div>
        )}

        {/* Quick Stats */}
        <div className="mb-4">
          <SectionHelper
            title="Visão Geral do Blog"
            description="Métricas principais do seu blog em tempo real."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Artigos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{articles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Publicados</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{publishedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rascunhos</CardTitle>
              <PenTool className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{draftCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Visualizações</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalViews.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
        </div>

        {/* Create Content Section - Hidden for viewers */}
        <PermissionGate permission="articles.create">
          <div className="mb-8">
            <SectionHelper
              title="Criação de Conteúdo"
              description="Escolha uma fonte para criar seu próximo artigo com IA otimizada para SEO."
              action="Clique em uma das opções para iniciar."
            />
            <div className="grid gap-4 md:grid-cols-4">
              <Card
                className="border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                onClick={() => navigate("/app/articles/new")}
              >
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="p-3 rounded-full bg-primary/10 inline-block mb-3 group-hover:bg-primary/20 transition-colors">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold">Sugestão da IA</h3>
                    <p className="text-sm text-muted-foreground mt-1">Deixe a IA sugerir</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="hover:shadow-lg transition-all cursor-pointer"
                onClick={() => navigate("/app/keywords")}
              >
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="p-3 rounded-full bg-secondary inline-block mb-3">
                      <Target className="h-6 w-6 text-secondary-foreground" />
                    </div>
                    <h3 className="font-display font-semibold">Palavra-chave</h3>
                    <p className="text-sm text-muted-foreground mt-1">Pesquisar keyword</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="hover:shadow-lg transition-all cursor-pointer"
                onClick={() => navigate("/app/strategy")}
              >
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="p-3 rounded-full bg-secondary inline-block mb-3">
                      <Upload className="h-6 w-6 text-secondary-foreground" />
                    </div>
                    <h3 className="font-display font-semibold">Documento</h3>
                    <p className="text-sm text-muted-foreground mt-1">Usar PDF/Doc</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="hover:shadow-lg transition-all cursor-pointer"
                onClick={() => navigate("/app/clusters")}
              >
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="p-3 rounded-full bg-secondary inline-block mb-3">
                      <Zap className="h-6 w-6 text-secondary-foreground" />
                    </div>
                    <h3 className="font-display font-semibold">Cluster SEO</h3>
                    <p className="text-sm text-muted-foreground mt-1">Estratégia de conteúdo</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </PermissionGate>

        {/* Analytics Summary + Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {/* Analytics Summary Widget */}
          <AnalyticsSummaryWidget blogId={blog.id} />

          {/* Quick Actions */}
          <div className="space-y-4">
            <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate("/app/calendar")}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold">Calendário</h3>
                  <p className="text-sm text-muted-foreground">Ver programação</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate("/app/performance")}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold">Desempenho</h3>
                  <p className="text-sm text-muted-foreground">Ver métricas</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate("/app/articles")}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold">Gerenciar Artigos</h3>
                  <p className="text-sm text-muted-foreground">Ver todos os artigos</p>
                </div>
              </CardContent>
            </Card>

            {/* Editor Shortcut Card */}
            <Card
              className="hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-primary/10 via-secondary/5 to-primary/5 border-primary/20"
              onClick={() => navigate("/app/my-blog")}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="p-3 rounded-full bg-gradient-to-br from-primary to-secondary">
                  <Palette className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold">Editor de Blog</h3>
                  <p className="text-sm text-muted-foreground">Personalizar aparência</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Automation Section - Hidden for editors and viewers */}
        <PermissionGate permission="blog.settings">
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <AutomationCard blogId={blog.id} />
            <ArticleQueue blogId={blog.id} />
          </div>
        </PermissionGate>

        {/* Recent Articles */}
        <Card>
          <CardHeader>
            <CardTitle>Artigos Recentes</CardTitle>
            <CardDescription>Seus últimos artigos criados</CardDescription>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum artigo ainda.</p>
                <Button variant="link" onClick={() => navigate("/app/articles/new")}>
                  Criar seu primeiro artigo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/app/articles/${article.id}/edit`)}
                  >
                    <div>
                      <h4 className="font-medium">{article.title}</h4>
                      <p className="text-sm text-muted-foreground">{new Date(article.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        article.status === "published" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      }`}
                    >
                      {article.status === "published" ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
