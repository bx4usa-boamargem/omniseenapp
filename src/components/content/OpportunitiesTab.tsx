import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createArticleFromOpportunity } from '@/lib/createArticleFromOpportunity';
import { ArticleSizeModal } from '@/components/opportunities/ArticleSizeModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Sparkles, Check, Archive, Loader2, Clock, CheckCircle, ArchiveIcon, 
  Wand2, Search, ChevronDown, ChevronRight, Star, TrendingUp, Target,
  FileEdit, Undo2, Bell, Settings2, BarChart3, Eye, Share2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isToday, isThisWeek, isThisMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OpportunitiesTabProps {
  blogId: string;
  isClientContext?: boolean;
}

interface Opportunity {
  id: string;
  suggested_title: string;
  suggested_keywords: string[] | null;
  status: string;
  source: string | null;
  trend_source: string | null;
  created_at: string;
  relevance_score: number;
  relevance_factors: unknown;
  converted_article_id: string | null;
  converted_at: string | null;
}

interface NotificationSettings {
  min_relevance_score: number;
  notify_in_app: boolean;
  notify_email: boolean;
  email_address: string;
}

interface ConversionMetrics {
  total: number;
  converted: number;
  published: number;
  avgViews: number;
  avgShares: number;
}

type DateFilter = "all" | "today" | "week" | "month";
type SourceFilter = "all" | "ai" | "trends" | "competitors";

export function OpportunitiesTab({ blogId, isClientContext = false }: OpportunitiesTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // Detect client context from location if not explicitly passed
  const isClient = isClientContext || location.pathname.startsWith('/client');
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  
  // Collapsible sections
  const [showApproved, setShowApproved] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  
  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    min_relevance_score: 80,
    notify_in_app: true,
    notify_email: false,
    email_address: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Conversion metrics
  const [metrics, setMetrics] = useState<ConversionMetrics>({
    total: 0,
    converted: 0,
    published: 0,
    avgViews: 0,
    avgShares: 0,
  });

  useEffect(() => {
    fetchOpportunities();
    fetchNotificationSettings();
    fetchConversionMetrics();
  }, [blogId]);

  async function fetchOpportunities() {
    if (!blogId) return;

    // Filter for last 30 days only
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    const { data, error } = await supabase
      .from("article_opportunities")
      .select("*")
      .eq("blog_id", blogId)
      .gte("created_at", cutoffDate)
      .order("relevance_score", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching opportunities:", error);
    } else {
      setOpportunities(data || []);
    }
    setLoading(false);
  }

  async function fetchNotificationSettings() {
    if (!user || !blogId) return;

    const { data } = await supabase
      .from("opportunity_notifications")
      .select("*")
      .eq("blog_id", blogId)
      .eq("user_id", user.id)
      .single();

    if (data) {
      setNotificationSettings({
        min_relevance_score: data.min_relevance_score || 80,
        notify_in_app: data.notify_in_app ?? true,
        notify_email: data.notify_email ?? false,
        email_address: data.email_address || "",
      });
    }
  }

  async function fetchConversionMetrics() {
    if (!blogId) return;

    // Filter for last 30 days only
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    const { data: allOpps } = await supabase
      .from("article_opportunities")
      .select("id, converted_article_id")
      .eq("blog_id", blogId)
      .gte("created_at", cutoffDate);

    const total = allOpps?.length || 0;
    const convertedIds = allOpps?.filter(o => o.converted_article_id).map(o => o.converted_article_id) || [];
    const converted = convertedIds.length;

    if (convertedIds.length > 0) {
      const { data: articles } = await supabase
        .from("articles")
        .select("status, view_count, share_count")
        .in("id", convertedIds as string[]);

      const published = articles?.filter(a => a.status === "published").length || 0;
      const totalViews = articles?.reduce((acc, a) => acc + (a.view_count || 0), 0) || 0;
      const totalShares = articles?.reduce((acc, a) => acc + (a.share_count || 0), 0) || 0;

      setMetrics({
        total,
        converted,
        published,
        avgViews: converted > 0 ? Math.round(totalViews / converted) : 0,
        avgShares: converted > 0 ? Math.round(totalShares / converted) : 0,
      });
    } else {
      setMetrics({ total, converted: 0, published: 0, avgViews: 0, avgShares: 0 });
    }
  }

  async function saveNotificationSettings() {
    if (!user || !blogId) return;
    setSavingSettings(true);

    const { error } = await supabase
      .from("opportunity_notifications")
      .upsert({
        blog_id: blogId,
        user_id: user.id,
        min_relevance_score: notificationSettings.min_relevance_score,
        notify_in_app: notificationSettings.notify_in_app,
        notify_email: notificationSettings.notify_email,
        email_address: notificationSettings.email_address,
      }, { onConflict: "blog_id,user_id" });

    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Configurações salvas!");
      setSettingsOpen(false);
    }
    setSavingSettings(false);
  }

  // Filter logic
  const filterOpportunities = (status: string) => {
    return opportunities.filter(opp => {
      if (opp.status !== status) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = opp.suggested_title.toLowerCase().includes(query);
        const matchesKeywords = opp.suggested_keywords?.some(k => k.toLowerCase().includes(query));
        if (!matchesTitle && !matchesKeywords) return false;
      }

      // Date filter
      if (dateFilter !== "all") {
        const date = new Date(opp.created_at);
        if (dateFilter === "today" && !isToday(date)) return false;
        if (dateFilter === "week" && !isThisWeek(date)) return false;
        if (dateFilter === "month" && !isThisMonth(date)) return false;
      }

      // Source filter
      if (sourceFilter !== "all") {
        const source = opp.source || opp.trend_source || "ai";
        if (sourceFilter !== source) return false;
      }

      return true;
    });
  };

  const pendingOpportunities = filterOpportunities("pending");
  const approvedOpportunities = filterOpportunities("approved");
  const archivedOpportunities = filterOpportunities("archived");

  const pendingCount = opportunities.filter(o => o.status === "pending").length;
  const approvedCount = opportunities.filter(o => o.status === "approved").length;
  const archivedCount = opportunities.filter(o => o.status === "archived").length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleApprove = async (ids: string[]) => {
    if (ids.length === 0) return;
    setProcessing(true);

    const { error } = await supabase
      .from("article_opportunities")
      .update({ status: "approved" })
      .in("id", ids);

    if (error) {
      toast.error("Erro ao aprovar oportunidades");
    } else {
      toast.success(`${ids.length} oportunidade(s) aprovada(s)`);
      setSelectedIds([]);
      fetchOpportunities();
    }
    setProcessing(false);
  };

  const handleArchive = async (ids: string[]) => {
    if (ids.length === 0) return;
    setProcessing(true);

    const { error } = await supabase
      .from("article_opportunities")
      .update({ status: "archived" })
      .in("id", ids);

    if (error) {
      toast.error("Erro ao arquivar oportunidades");
    } else {
      toast.success(`${ids.length} oportunidade(s) arquivada(s)`);
      setSelectedIds([]);
      fetchOpportunities();
    }
    setProcessing(false);
  };

  const handleRestore = async (id: string, targetStatus: "pending" | "approved") => {
    setProcessing(true);

    const { error } = await supabase
      .from("article_opportunities")
      .update({ status: targetStatus })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao restaurar oportunidade");
    } else {
      toast.success(`Oportunidade movida para ${targetStatus === "pending" ? "pendentes" : "aprovadas"}`);
      fetchOpportunities();
    }
    setProcessing(false);
  };

  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  const openSizeModal = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setSizeModalOpen(true);
  };

  const handleCreateArticle = async (targetWords: number) => {
    if (!selectedOpportunity || creatingId) return;
    setCreatingId(selectedOpportunity.id);
    setSizeModalOpen(false);
    
    try {
      await createArticleFromOpportunity(
        {
          id: selectedOpportunity.id,
          suggested_title: selectedOpportunity.suggested_title,
          suggested_keywords: selectedOpportunity.suggested_keywords,
        },
        blogId,
        navigate,
        targetWords
      );
    } finally {
      setCreatingId(null);
      setSelectedOpportunity(null);
    }
  };

  const handleGenerateOpportunities = async (mode: "standard" | "trends" | "competitor_gaps" = "standard", count = 5) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-opportunities', {
        body: { blogId, count, mode }
      });

      if (error) {
        console.error('Error generating opportunities:', error);
        if (error.message?.includes('402')) {
          toast.error('Créditos insuficientes. Adicione créditos à sua conta.');
        } else if (error.message?.includes('429')) {
          toast.error('Limite de requisições excedido. Tente novamente em alguns minutos.');
        } else {
          toast.error('Erro ao gerar oportunidades');
        }
        return;
      }

      const modeLabels = {
        standard: "padrão",
        trends: "por tendências",
        competitor_gaps: "por gaps de concorrentes",
      };

      toast.success(`${data.count} oportunidades geradas (${modeLabels[mode]})!`);
      fetchOpportunities();
      fetchConversionMetrics();
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao gerar oportunidades');
    } finally {
      setGenerating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-muted-foreground";
  };

  const getScoreStars = (score: number) => {
    const stars = Math.round(score / 20);
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-3 w-3",
          i < stars ? "fill-warning text-warning" : "text-muted-foreground/30"
        )}
      />
    ));
  };

  const getSourceBadge = (source: string | null) => {
    switch (source) {
      case "trends":
        return <Badge variant="outline" className="text-xs gap-1"><TrendingUp className="h-3 w-3" /> Tendências</Badge>;
      case "competitors":
        return <Badge variant="outline" className="text-xs gap-1"><Target className="h-3 w-3" /> Concorrentes</Badge>;
      default:
        return <Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> IA</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conversion Metrics */}
      {metrics.total > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Métricas de Conversão</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-2xl font-bold">{metrics.total}</p>
                <p className="text-xs text-muted-foreground">Total de oportunidades</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  {metrics.total > 0 ? Math.round((metrics.converted / metrics.total) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Taxa de conversão</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.published}</p>
                <p className="text-xs text-muted-foreground">Artigos publicados</p>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{metrics.avgViews}</p>
                  <p className="text-xs text-muted-foreground">Média de views</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{metrics.avgShares}</p>
                  <p className="text-xs text-muted-foreground">Média de shares</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={cn(
            "border-warning/30 bg-warning/5 cursor-pointer transition-all hover:border-warning/50",
            dateFilter === "all" && sourceFilter === "all" && !searchQuery && "ring-2 ring-warning/30"
          )}
          onClick={() => { setShowApproved(false); setShowArchived(false); }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/20">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "border-success/30 bg-success/5 cursor-pointer transition-all hover:border-success/50",
            showApproved && "ring-2 ring-success/30"
          )}
          onClick={() => setShowApproved(!showApproved)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/20">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "border-muted bg-muted/5 cursor-pointer transition-all hover:border-muted-foreground/30",
            showArchived && "ring-2 ring-muted-foreground/30"
          )}
          onClick={() => setShowArchived(!showArchived)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <ArchiveIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{archivedCount}</p>
                <p className="text-sm text-muted-foreground">Arquivadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou palavra-chave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por data" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as datas</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            <SelectItem value="ai">IA</SelectItem>
            <SelectItem value="trends">Tendências</SelectItem>
            <SelectItem value="competitors">Concorrentes</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Notification Settings */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Notificações</DialogTitle>
              <DialogDescription>
                Receba alertas quando oportunidades de alta relevância forem geradas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Score mínimo de relevância</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={notificationSettings.min_relevance_score}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      min_relevance_score: parseInt(e.target.value) || 0,
                    }))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Você será notificado apenas para oportunidades com score igual ou acima deste valor.
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações no app</Label>
                  <p className="text-xs text-muted-foreground">Receba alertas dentro do sistema</p>
                </div>
                <Switch
                  checked={notificationSettings.notify_in_app}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({
                    ...prev,
                    notify_in_app: checked,
                  }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações por email</Label>
                  <p className="text-xs text-muted-foreground">Receba alertas no seu email</p>
                </div>
                <Switch
                  checked={notificationSettings.notify_email}
                  onCheckedChange={(checked) => setNotificationSettings(prev => ({
                    ...prev,
                    notify_email: checked,
                  }))}
                />
              </div>
              
              {notificationSettings.notify_email && (
                <div className="space-y-2">
                  <Label>Email para notificações</Label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={notificationSettings.email_address}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      email_address: e.target.value,
                    }))}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveNotificationSettings} disabled={savingSettings}>
                {savingSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.length} item(ns) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleArchive(selectedIds)}
                  disabled={processing}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(selectedIds)}
                  disabled={processing}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Opportunities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Oportunidades Pendentes</CardTitle>
            <CardDescription>
              Sugestões de artigos geradas pela inteligência artificial
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select
              value="generate"
              onValueChange={(v) => {
                if (v === "standard") handleGenerateOpportunities("standard", 5);
                else if (v === "trends") handleGenerateOpportunities("trends", 5);
                else if (v === "competitor_gaps") handleGenerateOpportunities("competitor_gaps", 5);
                else if (v === "bulk") handleGenerateOpportunities("standard", 10);
              }}
            >
              <SelectTrigger className="w-[180px]" disabled={generating}>
                <div className="flex items-center gap-2">
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  <span>Gerar com IA</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Geração Padrão (5)
                  </div>
                </SelectItem>
                <SelectItem value="trends">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Baseado em Tendências 🔥
                  </div>
                </SelectItem>
                <SelectItem value="competitor_gaps">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Gaps de Concorrentes 🎯
                  </div>
                </SelectItem>
                <SelectItem value="bulk">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Gerar 10 sugestões
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {pendingOpportunities.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma oportunidade pendente</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || dateFilter !== "all" || sourceFilter !== "all" 
                  ? "Nenhuma oportunidade corresponde aos filtros aplicados."
                  : "A IA analisará seu nicho e sugerirá novos temas."}
              </p>
              {!searchQuery && dateFilter === "all" && sourceFilter === "all" && (
                <Button onClick={() => handleGenerateOpportunities("standard", 5)} disabled={generating}>
                  {generating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Gerar Oportunidades
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOpportunities.map((opportunity) => (
                <OpportunityItem
                  key={opportunity.id}
                  opportunity={opportunity}
                  selected={selectedIds.includes(opportunity.id)}
                  onSelect={() => toggleSelect(opportunity.id)}
                  onApprove={() => handleApprove([opportunity.id])}
                  onArchive={() => handleArchive([opportunity.id])}
                  processing={processing}
                  getScoreStars={getScoreStars}
                  getScoreColor={getScoreColor}
                  getSourceBadge={getSourceBadge}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Opportunities */}
      {approvedCount > 0 && (
        <Collapsible open={showApproved} onOpenChange={setShowApproved}>
          <Card className="border-success/30">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <CardTitle className="text-lg">Oportunidades Aprovadas ({approvedOpportunities.length})</CardTitle>
                  </div>
                  {showApproved ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {approvedOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma oportunidade aprovada corresponde aos filtros.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {approvedOpportunities.map((opportunity) => (
                      <div
                        key={opportunity.id}
                        className="flex items-start gap-4 p-4 rounded-lg border border-success/20 bg-success/5"
                      >
                        <div className="p-2 rounded-lg bg-success/20">
                          <CheckCircle className="h-5 w-5 text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex">{getScoreStars(opportunity.relevance_score)}</div>
                            <span className={cn("text-sm font-medium", getScoreColor(opportunity.relevance_score))}>
                              {opportunity.relevance_score}%
                            </span>
                            {getSourceBadge(opportunity.source || opportunity.trend_source)}
                          </div>
                          <h4 className="font-medium">{opportunity.suggested_title}</h4>
                          {opportunity.suggested_keywords && opportunity.suggested_keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {opportunity.suggested_keywords.slice(0, 5).map((kw, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Aprovado {formatDistanceToNow(new Date(opportunity.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRestore(opportunity.id, "pending")}
                            disabled={processing}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchive([opportunity.id])}
                            disabled={processing}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openSizeModal(opportunity)}
                          >
                            <FileEdit className="h-4 w-4 mr-1" />
                            Criar Artigo
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Archived Opportunities */}
      {archivedCount > 0 && (
        <Collapsible open={showArchived} onOpenChange={setShowArchived}>
          <Card className="border-muted">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArchiveIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Oportunidades Arquivadas ({archivedOpportunities.length})</CardTitle>
                  </div>
                  {showArchived ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {archivedOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma oportunidade arquivada corresponde aos filtros.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {archivedOpportunities.map((opportunity) => (
                      <div
                        key={opportunity.id}
                        className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30 opacity-70"
                      >
                        <div className="p-2 rounded-lg bg-muted">
                          <ArchiveIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-muted-foreground">{opportunity.suggested_title}</h4>
                          {opportunity.suggested_keywords && opportunity.suggested_keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {opportunity.suggested_keywords.slice(0, 3).map((kw, i) => (
                                <Badge key={i} variant="outline" className="text-xs opacity-60">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(opportunity.id, "pending")}
                            disabled={processing}
                          >
                            <Undo2 className="h-4 w-4 mr-1" />
                            Restaurar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}

// Sub-component for opportunity items
interface OpportunityItemProps {
  opportunity: Opportunity;
  selected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onArchive: () => void;
  processing: boolean;
  getScoreStars: (score: number) => JSX.Element[];
  getScoreColor: (score: number) => string;
  getSourceBadge: (source: string | null) => JSX.Element;
}

function OpportunityItem({
  opportunity,
  selected,
  onSelect,
  onApprove,
  onArchive,
  processing,
  getScoreStars,
  getScoreColor,
  getSourceBadge,
}: OpportunityItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border transition-colors",
        selected && "border-primary bg-primary/5"
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
      />
      <div className="p-2 rounded-lg bg-primary/10">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex">{getScoreStars(opportunity.relevance_score)}</div>
          <span className={cn("text-sm font-medium", getScoreColor(opportunity.relevance_score))}>
            {opportunity.relevance_score}%
          </span>
          {getSourceBadge(opportunity.source || opportunity.trend_source)}
        </div>
        <h4 className="font-medium">{opportunity.suggested_title}</h4>
        {opportunity.suggested_keywords && opportunity.suggested_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {opportunity.suggested_keywords.slice(0, 5).map((kw, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {kw}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Criado {formatDistanceToNow(new Date(opportunity.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onArchive}
          disabled={processing}
        >
          <Archive className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={onApprove}
          disabled={processing}
        >
          <Check className="h-4 w-4 mr-1" />
          Aprovar
        </Button>
      </div>
    </div>
  );
}
