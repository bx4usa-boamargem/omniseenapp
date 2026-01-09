import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Pencil, Settings, Calendar, Lightbulb, Link2, Users, Target } from "lucide-react";
import { ContentCalendarTab } from "@/components/content/ContentCalendarTab";
import { OpportunitiesTab } from "@/components/content/OpportunitiesTab";
import { PreferencesTab } from "@/components/content/PreferencesTab";
import { InternalLinkingTab } from "@/components/content/InternalLinkingTab";
import { ClientAreaTab } from "@/components/content/ClientAreaTab";
import { SalesFunnelTab } from "@/components/content/SalesFunnelTab";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { CreateContentModal } from "@/components/content/CreateContentModal";

export default function Articles() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { blog, loading: blogLoading } = useBlog();
  const { hasPermission, loading: roleLoading } = useCurrentUserRole();
  
  const [opportunitiesCount, setOpportunitiesCount] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    async function fetchOpportunities() {
      if (!blog) return;

      const { count } = await supabase
        .from('article_opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('blog_id', blog.id)
        .eq('status', 'pending');

      setOpportunitiesCount(count || 0);
    }

    if (blog) {
      fetchOpportunities();
    }
  }, [blog]);

  if (authLoading || blogLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || !blog) {
    navigate('/auth');
    return null;
  }

  const blogId = blog.id;

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Posts</h1>
            <p className="text-muted-foreground">
              Crie, revise e aprove os posts do seu blog
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PermissionGate permission="blog.settings">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Gerenciar categorias
              </Button>
            </PermissionGate>
            <PermissionGate permission="articles.create">
              <Button variant="outline" onClick={() => navigate('/articles/new?mode=manual')}>
                <Pencil className="h-4 w-4 mr-2" />
                Escrever manualmente
              </Button>
              <Button className="gradient-primary" onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar conteúdo
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Conteúdos</span>
            </TabsTrigger>
            <TabsTrigger value="funnel" className="gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Funil de Vendas</span>
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">Oportunidades</span>
              {opportunitiesCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {opportunitiesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Preferências</span>
            </TabsTrigger>
            <TabsTrigger value="linking" className="gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Linkagem Interna</span>
            </TabsTrigger>
            <TabsTrigger value="client" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Área do Cliente</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs bg-primary/20 text-primary">
                Novo
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <ContentCalendarTab blogId={blogId} />
          </TabsContent>

          <TabsContent value="funnel">
            <SalesFunnelTab blogId={blogId} />
          </TabsContent>

          <TabsContent value="opportunities">
            <OpportunitiesTab blogId={blogId} />
          </TabsContent>

          <TabsContent value="preferences">
            <PreferencesTab blogId={blogId} />
          </TabsContent>

          <TabsContent value="linking">
            <InternalLinkingTab blogId={blogId} />
          </TabsContent>

          <TabsContent value="client">
            <ClientAreaTab blogId={blogId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Content Modal */}
      <CreateContentModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        blogId={blogId}
      />
    </DashboardLayout>
  );
}
