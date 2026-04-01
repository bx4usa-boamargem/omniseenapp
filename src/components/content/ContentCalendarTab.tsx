import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Check, 
  FileEdit, 
  Sparkles, 
  Target, 
  Youtube, 
  Instagram, 
  FileText, 
  PenLine,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Radar,
  GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ContentCalendarTabProps {
  blogId: string;
  isClientContext?: boolean;
}

interface Article {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  generation_source: string | null;
  opportunity_id: string | null;
  funnel_stage: string | null;
}

export function ContentCalendarTab({ blogId, isClientContext = false }: ContentCalendarTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // Detect client context from location if not explicitly passed
  const isClient = isClientContext || location.pathname.startsWith('/client');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [articles, setArticles] = useState<Article[]>([]);
  
  // Helper to get the correct edit route
  const getEditRoute = (articleId: string) => 
    isClient ? `/client/articles/${articleId}/edit` : `/app/articles/${articleId}/edit`;
  const [showDrafts, setShowDrafts] = useState(true);
  const [showPublished, setShowPublished] = useState(true);

  // Filter states - only real article statuses
  const allFilters = ["published", "scheduled", "draft"];
  const [activeFilters, setActiveFilters] = useState<string[]>(allFilters);
  const hasInactiveFilters = activeFilters.length < allFilters.length;

  const toggleFilter = (status: string) => {
    setActiveFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const clearFilters = () => setActiveFilters(allFilters);

  // Filter draft articles
  const draftArticles = articles.filter(a => a.status === "draft");

  // Filter recently published articles (last 7 days)
  const recentlyPublished = articles.filter(a => {
    if (a.status !== "published" || !a.published_at) return false;
    const publishDate = new Date(a.published_at);
    const sevenDaysAgo = subDays(new Date(), 7);
    return publishDate >= sevenDaysAgo;
  });

  // Articles without scheduled date (excluding drafts shown separately)
  const unscheduledArticles = articles.filter(a => 
    !a.published_at && !a.scheduled_at && a.status !== "draft" && a.status !== "published"
  );

  useEffect(() => {
    async function fetchData() {
      if (!blogId) return;

      // Fetch ALL articles - single source of truth
      const { data: articlesData } = await supabase
        .from("articles")
        .select("id, title, status, published_at, scheduled_at, created_at, generation_source, opportunity_id, funnel_stage")
        .eq("blog_id", blogId)
        .order("created_at", { ascending: false });

      if (articlesData) {
        setArticles(articlesData as Article[]);
      }
    }

    fetchData();

    // Realtime subscription for articles only
    const channel = supabase
      .channel('calendar-articles')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'articles',
        filter: `blog_id=eq.${blogId}`,
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [blogId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array(startDayOfWeek).fill(null);

  const getItemsForDay = (day: Date): Article[] => {
    return articles.filter((article) => {
      // Check if status filter is active
      if (!activeFilters.includes(article.status)) return false;
      
      if (article.status === "published" && article.published_at) {
        return isSameDay(new Date(article.published_at), day);
      }
      if (article.status === "scheduled" && article.scheduled_at) {
        return isSameDay(new Date(article.scheduled_at), day);
      }
      // Show drafts by creation date
      if (article.status === "draft") {
        return isSameDay(new Date(article.created_at), day);
      }
      return false;
    });
  };

  const getFunnelPriorityStyles = (article: Article) => {
    switch (article.funnel_stage) {
      case "top":
        return "border-l-4 border-l-blue-500";
      case "middle":
        return "border-l-4 border-l-amber-500";
      case "bottom":
        return "border-l-4 border-l-emerald-500";
      default:
        return "border-l-4 border-l-transparent";
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500/20 text-blue-600 border-blue-500/30";
      case "published":
        return "bg-success/20 text-success border-success/30";
      case "draft":
        return "bg-muted text-muted-foreground border-border";
      case "archived":
        return "bg-gray-500/20 text-gray-600 border-gray-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleDragStart = (e: React.DragEvent, articleId: string) => {
    e.dataTransfer.setData("articleId", articleId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-primary/10", "ring-1", "ring-primary/40");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-primary/10", "ring-1", "ring-primary/40");
  };

  const handleDrop = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-primary/10", "ring-1", "ring-primary/40");
    const articleId = e.dataTransfer.getData("articleId");
    if (!articleId) return;

    const { error } = await supabase
      .from("articles")
      .update({ scheduled_at: day.toISOString(), status: "scheduled" })
      .eq("id", articleId);

    if (error) {
      toast.error("Erro ao reagendar artigo");
    } else {
      toast.success("Artigo reagendado com sucesso!");
      // Realtime will handle refresh
    }
  };

  const getSourceIcon = (article: Article) => {
    // Priority: opportunity_id (Radar) > funnel_stage > generation_source
    if (article.opportunity_id) {
      return <Radar className="h-3 w-3 text-purple-500" />;
    }
    if (article.funnel_stage) {
      return <Target className="h-3 w-3 text-orange-500" />;
    }
    switch (article.generation_source) {
      case "ai_suggestion":
        return <Sparkles className="h-3 w-3 text-primary" />;
      case "sales_funnel":
        return <Target className="h-3 w-3 text-orange-500" />;
      case "youtube":
        return <Youtube className="h-3 w-3 text-red-500" />;
      case "instagram":
        return <Instagram className="h-3 w-3 text-pink-500" />;
      case "pdf":
      case "csv":
        return <FileText className="h-3 w-3 text-blue-500" />;
      case "manual":
        return <PenLine className="h-3 w-3 text-muted-foreground" />;
      default:
        return <FileEdit className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getOriginBadge = (article: Article) => {
    if (article.opportunity_id) {
      return (
        <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[9px] px-1.5">
          📡 Radar
        </Badge>
      );
    }
    if (article.funnel_stage || article.generation_source === 'sales_funnel') {
      return (
        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[9px] px-1.5">
          🎯 Funil
        </Badge>
      );
    }
    if (article.generation_source === 'automation') {
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[9px] px-1.5">
          ⚡ Auto
        </Badge>
      );
    }
    return null;
  };

  const getArticleTime = (article: Article) => {
    const dateStr = article.scheduled_at || article.published_at || article.created_at;
    if (!dateStr) return null;
    return format(new Date(dateStr), "HH:mm");
  };

  return (
    <div className="space-y-4">
      {/* Calendar Card */}
      <Card>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold capitalize min-w-[180px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Hoje
            </Button>
          </div>
          
          {/* Interactive Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {hasInactiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-7 px-2 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
            <button
              onClick={() => toggleFilter("published")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all",
                activeFilters.includes("published")
                  ? "bg-success/20 border-success/50 text-success"
                  : "bg-muted/30 border-dashed border-muted-foreground/30 text-muted-foreground opacity-50"
              )}
            >
              <div className="w-2 h-2 rounded-full bg-success" />
              Publicado
            </button>
            <button
              onClick={() => toggleFilter("scheduled")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all",
                activeFilters.includes("scheduled")
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-600"
                  : "bg-muted/30 border-dashed border-muted-foreground/30 text-muted-foreground opacity-50"
              )}
            >
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Agendado
            </button>
            <button
              onClick={() => toggleFilter("draft")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all",
                activeFilters.includes("draft")
                  ? "bg-muted border-muted-foreground/50 text-muted-foreground"
                  : "bg-muted/30 border-dashed border-muted-foreground/30 text-muted-foreground opacity-50"
              )}
            >
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              Rascunho
            </button>
          </div>
        </div>

        <CardContent className="p-4">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {emptyDays.map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[120px] p-1" />
            ))}
            {days.map((day) => {
              const dayArticles = getItemsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[120px] p-2 border rounded-lg transition-colors flex flex-col",
                    isToday && "border-primary border-2 bg-primary/5",
                    !isToday && "border-border/50 hover:border-border"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  {/* Day Number */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                        isToday && "bg-primary text-primary-foreground",
                        !isSameMonth(day, currentMonth) && "text-muted-foreground/50"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  {/* Articles - draggable + priority colored */}
                  <div className="flex-1 space-y-1.5 overflow-hidden">
                    {dayArticles.slice(0, 3).map((article) => (
                      <div
                        key={article.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, article.id)}
                        onClick={() => navigate(getEditRoute(article.id))}
                        className={cn(
                          "p-2 rounded-lg border cursor-grab hover:opacity-80 transition-opacity group",
                          getStatusStyles(article.status),
                          getFunnelPriorityStyles(article)
                        )}
                      >
                        {/* Time and Source Icon */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                          <span className="flex items-center gap-1 text-[10px] opacity-70">
                            <Clock className="h-2.5 w-2.5" />
                            {getArticleTime(article)}
                          </span>
                          {getSourceIcon(article)}
                          {article.status === "published" && <Check className="h-3 w-3 text-success ml-auto" />}
                        </div>
                        {/* Title */}
                        <p className="text-xs font-medium line-clamp-2 leading-tight">
                          {article.title}
                        </p>
                        {/* Origin Badge */}
                        {getOriginBadge(article) && (
                          <div className="mt-1">
                            {getOriginBadge(article)}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* More items indicator */}
                    {dayArticles.length > 3 && (
                      <span className="text-[10px] text-muted-foreground pl-1">
                        +{dayArticles.length - 3} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Priority Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-border/50">
            <span className="text-xs font-medium text-muted-foreground">Etapa do funil:</span>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-sm border-l-4 border-l-blue-500 bg-muted" />
              <span className="text-muted-foreground">Topo</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-sm border-l-4 border-l-amber-500 bg-muted" />
              <span className="text-muted-foreground">Meio</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-sm border-l-4 border-l-emerald-500 bg-muted" />
              <span className="text-muted-foreground">Fundo</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 ml-auto">
              Arraste artigos entre dias para reagendar
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Rascunhos Recentes */}
      <Collapsible open={showDrafts} onOpenChange={setShowDrafts}>
        <Card>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <FileEdit className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Rascunhos Recentes</span>
                {draftArticles.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {draftArticles.length}
                  </Badge>
                )}
              </div>
              {showDrafts ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2">
              {draftArticles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum rascunho pendente
                </p>
              ) : (
                draftArticles.map((draft) => (
                  <div
                    key={draft.id}
                    onClick={() => navigate(getEditRoute(draft.id))}
                    className="p-3 rounded-lg border bg-muted/30 hover:bg-muted cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{draft.title}</p>
                        <span className="text-xs text-muted-foreground">
                          Criado em {format(new Date(draft.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getOriginBadge(draft)}
                        {getSourceIcon(draft)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Publicados Recentemente */}
      <Collapsible open={showPublished} onOpenChange={setShowPublished}>
        <Card>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span className="font-medium">Publicados Recentemente</span>
                {recentlyPublished.length > 0 && (
                  <Badge variant="secondary" className="text-xs bg-success/20 text-success">
                    {recentlyPublished.length}
                  </Badge>
                )}
              </div>
              {showPublished ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2">
              {recentlyPublished.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum artigo publicado nos últimos 7 dias
                </p>
              ) : (
                recentlyPublished.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => navigate(getEditRoute(article.id))}
                    className="p-3 rounded-lg border bg-success/10 border-success/30 hover:bg-success/20 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{article.title}</p>
                        <span className="text-xs text-muted-foreground">
                          Publicado em {format(new Date(article.published_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getOriginBadge(article)}
                        {getSourceIcon(article)}
                        <Check className="h-4 w-4 text-success" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Unscheduled Articles */}
      {unscheduledArticles.length > 0 && (
        <Card>
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Conteúdos sem data</span>
              <Badge variant="secondary" className="text-xs">
                {unscheduledArticles.length}
              </Badge>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {unscheduledArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => navigate(`/app/articles/${article.id}/edit`)}
                className="p-3 rounded-lg border bg-muted/30 hover:bg-muted cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{article.title}</p>
                    <span className="text-xs text-muted-foreground">
                      Criado em {format(new Date(article.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getOriginBadge(article)}
                    {getSourceIcon(article)}
                    <Badge variant="outline" className="text-[10px]">{article.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
