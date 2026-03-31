import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap, CreditCard, Bot, ChevronRight, Globe, Loader2, AlertTriangle, FileText } from "lucide-react";
import { SectionHelper } from "@/components/blog-editor/SectionHelper";
import { CustomDomainSettings } from "@/components/settings/CustomDomainSettings";
import { DeleteBlogDialog } from "@/components/dashboard/DeleteBlogDialog";
import { BlogContentSettings } from "@/components/settings/BlogContentSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Settings() {
  const navigate = useNavigate();
  const { hasPermission, loading: roleLoading } = useCurrentUserRole();
  const [loading, setLoading] = useState(true);
  const [blogId, setBlogId] = useState<string | null>(null);
  const [blogName, setBlogName] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch user's blog
      const { data: blog } = await supabase
        .from("blogs")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (blog) {
        setBlogId(blog.id);
        setBlogName(blog.name || "");
      }

      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  // Redirect if user doesn't have permission
  useEffect(() => {
    if (!roleLoading && !hasPermission("blog.settings")) {
      navigate("/access-denied");
    }
  }, [roleLoading, hasPermission, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const settingsCards = [
    {
      title: "Automação de Conteúdo",
      description: "Configure a geração automática de artigos e agendamentos",
      icon: Bot,
      href: "/app/automation",
    },
    {
      title: "Planos e Assinatura",
      description: "Gerencie seu plano, limites e faturamento",
      icon: CreditCard,
      href: "/app/subscription",
    },
    {
      title: "Upgrade de Plano",
      description: "Veja os planos disponíveis e faça upgrade",
      icon: Zap,
      href: "/app/pricing",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-display font-bold">Configurações</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas preferências</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <FileText className="h-4 w-4" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="domain" className="gap-2">
              <Globe className="h-4 w-4" />
              Domínio
            </TabsTrigger>
            <TabsTrigger value="danger" className="gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Perigo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="mb-6">
              <SectionHelper
                title="Configurações Gerais"
                description="Preferências de conta, automação e plano."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-4xl">
              {settingsCards.map((card) => (
                <Card 
                  key={card.href}
                  className="cursor-pointer hover:border-primary/50 transition-colors group"
                  onClick={() => navigate(card.href)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <card.icon className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-base mb-1">{card.title}</CardTitle>
                    <CardDescription className="text-sm">{card.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="domain">
            <div className="max-w-2xl">
              <div className="mb-6">
                <SectionHelper
                  title="Domínio Personalizado"
                  description="Configure um domínio próprio para credibilidade e SEO."
                  action="Insira o domínio e siga as instruções DNS."
                />
              </div>
              {blogId ? (
                <CustomDomainSettings blogId={blogId} />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>Você precisa criar um blog primeiro para configurar um domínio próprio.</p>
                    <Button onClick={() => navigate("/onboarding")} className="mt-4">
                      Criar Blog
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="danger">
            <div className="max-w-2xl">
              <div className="mb-6">
                <SectionHelper
                  title="Zona de Perigo"
                  description="Ações irreversíveis que afetam permanentemente o blog."
                  warning="Não podem ser desfeitas. Faça backup antes."
                />
              </div>
              <Card className="border-destructive/50">
                <CardHeader>
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <CardTitle>Deletar Blog</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                    <h4 className="font-medium mb-2">Deletar Blog</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Remove permanentemente o blog e todos os dados associados: artigos, 
                      configurações, personas, automações e histórico. Esta ação não pode 
                      ser desfeita.
                    </p>
                    <Button 
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={!blogId}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Deletar Blog Permanentemente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {blogId && (
              <DeleteBlogDialog
                blogId={blogId}
                blogName={blogName}
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
