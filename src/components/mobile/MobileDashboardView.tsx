import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  ExternalLink, 
  Plus,
  TrendingUp,
  Edit3,
  Eye,
  MapPin,
  Zap,
  ChevronRight
} from 'lucide-react';
import { getBlogUrl } from '@/utils/blogUrl';

interface MobileDashboardViewProps {
  blog: {
    id: string;
    name: string;
    slug: string;
    custom_domain?: string | null;
    domain_verified?: boolean | null;
    platform_subdomain?: string | null;
  } | null;
  automationActive: boolean;
  totalArticles: number;
  draftCount: number;
  totalViews: number;
  territoriesCount: number;
}

export function MobileDashboardView({
  blog,
  automationActive,
  totalArticles,
  draftCount,
  totalViews,
  territoriesCount,
}: MobileDashboardViewProps) {
  const navigate = useNavigate();

  const handleOpenBlog = () => {
    if (blog) {
      const url = getBlogUrl(blog);
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Status Card - Shows if machine is working in 10 seconds */}
      <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-5 border border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${automationActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-lg font-semibold text-foreground">
              {automationActive ? 'Máquina Ativa' : 'Máquina Parada'}
            </span>
          </div>
          <Badge 
            className={`${
              automationActive 
                ? 'bg-green-500/20 text-green-600 border-green-500/30' 
                : 'bg-red-500/20 text-red-600 border-red-500/30'
            }`}
          >
            {automationActive ? '🟢 Ativa' : '🔴 Parada'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {automationActive 
            ? 'Publicando automaticamente' 
            : 'Ative a automação para publicar artigos'}
        </p>
      </div>

      {/* Metrics Grid - 2x2 with large numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-xs text-muted-foreground">Publicados</span>
          </div>
          <span className="text-3xl font-bold text-foreground">{totalArticles}</span>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Edit3 className="h-5 w-5 text-orange-500" />
            <span className="text-xs text-muted-foreground">Rascunhos</span>
          </div>
          <span className="text-3xl font-bold text-foreground">{draftCount}</span>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-5 w-5 text-blue-500" />
            <span className="text-xs text-muted-foreground">Visualizações</span>
          </div>
          <span className="text-3xl font-bold text-foreground">{totalViews.toLocaleString()}</span>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-5 w-5 text-purple-500" />
            <span className="text-xs text-muted-foreground">Territórios</span>
          </div>
          <span className="text-3xl font-bold text-foreground">{territoriesCount}</span>
        </div>
      </div>

      {/* Quick Actions - Large touch-friendly buttons */}
      <div className="space-y-3">
        <Button 
          onClick={() => navigate('/client/articles/engine/new')}
          className="w-full h-14 text-base gap-3 client-btn-primary"
        >
          <Plus className="h-6 w-6" />
          Criar Artigo
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline"
            onClick={handleOpenBlog}
            className="h-12 gap-2"
          >
            <ExternalLink className="h-5 w-5" />
            Abrir Blog
          </Button>

          <Button 
            variant="outline"
            onClick={() => navigate('/client/results')}
            className="h-12 gap-2"
          >
            <TrendingUp className="h-5 w-5" />
            Resultados
          </Button>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="space-y-2">
        <button
          onClick={() => navigate('/client/automation')}
          className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${automationActive ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
              <Zap className={`h-5 w-5 ${automationActive ? 'text-green-500' : 'text-yellow-500'}`} />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Automação</p>
              <p className="text-xs text-muted-foreground">
                {automationActive ? 'Funcionando normalmente' : 'Configurar máquina'}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
