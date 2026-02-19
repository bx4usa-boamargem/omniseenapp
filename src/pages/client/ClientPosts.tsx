import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useBlog } from "@/hooks/useBlog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Pencil, Calendar, Lightbulb, Settings, Target } from "lucide-react";
import { ContentCalendarTab } from "@/components/content/ContentCalendarTab";
import { OpportunitiesTab } from "@/components/content/OpportunitiesTab";
import { PreferencesTab } from "@/components/content/PreferencesTab";
import { SalesFunnelTab } from "@/components/content/SalesFunnelTab";
import { CreateContentModal } from "@/components/content/CreateContentModal";

export default function ClientPosts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { blog, loading: blogLoading } = useBlog();
  
  const [opportunitiesCount, setOpportunitiesCount] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Get initial tab from URL params
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') || 'calendar';

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

  if (blogLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Blog não encontrado</p>
      </div>
    );
  }

  const blogId = blog.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Posts</h1>
          <p className="text-muted-foreground text-sm">
            Crie, revise e aprove os posts do seu blog
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/client/articles/engine/new?mode=manual')}>
            <Pencil className="h-4 w-4 mr-2" />
            Escrever manualmente
          </Button>
          <Button className="gradient-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar conteúdo
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
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
        </TabsList>

        <TabsContent value="calendar">
          <ContentCalendarTab blogId={blogId} isClientContext />
        </TabsContent>

        <TabsContent value="funnel">
          <SalesFunnelTab blogId={blogId} isClientContext />
        </TabsContent>

        <TabsContent value="opportunities">
          <OpportunitiesTab blogId={blogId} isClientContext />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab blogId={blogId} isClientContext />
        </TabsContent>
      </Tabs>

      {/* Create Content Modal */}
      <CreateContentModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        blogId={blogId}
        isClientContext
      />
    </div>
  );
}
