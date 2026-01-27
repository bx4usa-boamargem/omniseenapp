import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Globe, Pencil, Copy, Archive, Trash2, MoreHorizontal, RotateCcw, Radar, Target, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface Article {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  created_at: string;
  published_at: string | null;
  featured_image_url: string | null;
  generation_source: string | null;
  opportunity_id: string | null;
  funnel_stage: string | null;
  category?: string | null;
}

interface ArticleCardProps {
  article: Article;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onView: () => void;
}

// Origin type determination
type OriginType = "radar" | "funnel" | "automation" | "manual";

function getOriginType(article: Article): OriginType {
  if (article.opportunity_id) return "radar";
  if (article.funnel_stage || article.generation_source === "sales_funnel") return "funnel";
  if (article.generation_source === "automation") return "automation";
  return "manual";
}

// Color mapping for placeholder backgrounds based on origin
const originColors: Record<OriginType, { bg: string; text: string }> = {
  radar: { bg: "bg-purple-500", text: "text-white" },
  funnel: { bg: "bg-orange-500", text: "text-white" },
  automation: { bg: "bg-blue-500", text: "text-white" },
  manual: { bg: "bg-slate-500", text: "text-white" },
};

// Origin labels and icons
const originLabels: Record<OriginType, { label: string; icon: typeof Radar }> = {
  radar: { label: "Radar", icon: Radar },
  funnel: { label: "Funil", icon: Target },
  automation: { label: "Auto", icon: Zap },
  manual: { label: "", icon: Radar }, // Won't be displayed
};

function getStatusBadge(status: string | null) {
  switch (status) {
    case "published":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Publicado</Badge>;
    case "archived":
      return <Badge variant="outline" className="text-amber-600 border-amber-500/30">Arquivado</Badge>;
    default:
      return <Badge variant="secondary">Rascunho</Badge>;
  }
}

export function ArticleCard({
  article,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
  onView,
}: ArticleCardProps) {
  const heroImage = article.featured_image_url;
  const originType = getOriginType(article);
  const colors = originColors[originType];
  const originInfo = originLabels[originType];
  const OriginIcon = originInfo.icon;

  // Display date - prefer published_at for published articles
  const displayDate = article.status === "published" && article.published_at 
    ? article.published_at 
    : article.created_at;

  return (
    <Card className="group overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200">
      {/* Thumbnail Area */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        {heroImage ? (
          <img
            src={heroImage}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={cn("w-full h-full flex items-center justify-center", colors.bg)}>
            <span className={cn("text-6xl font-bold opacity-30", colors.text)}>
              {article.title?.charAt(0)?.toUpperCase() || "A"}
            </span>
          </div>
        )}
        
        {/* Origin Badge - only show for non-manual origins */}
        {originType !== "manual" && (
          <div className="absolute top-2 right-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs backdrop-blur-sm gap-1",
                originType === "radar" && "bg-purple-500/80 text-white border-purple-400",
                originType === "funnel" && "bg-orange-500/80 text-white border-orange-400",
                originType === "automation" && "bg-blue-500/80 text-white border-blue-400"
              )}
            >
              <OriginIcon className="h-3 w-3" />
              {originInfo.label}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold text-base line-clamp-2 leading-tight">
            {article.title}
          </h3>
          {article.category && (
            <p className="text-xs text-muted-foreground">
              {article.category}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          {getStatusBadge(article.status)}
          <span className="text-xs text-muted-foreground">
            {format(new Date(displayDate), "d MMM yyyy", { locale: ptBR })}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {article.status === "published" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onView}
            >
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Abrir
            </Button>
          )}
          
          <Button
            variant={article.status === "published" ? "outline" : "default"}
            size="sm"
            className="flex-1"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              {article.status !== "archived" ? (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onRestore}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restaurar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
