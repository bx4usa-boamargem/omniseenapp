import { useValueProofMetrics } from '@/hooks/useValueProofMetrics';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  MousePointerClick, 
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ValueProofDashboardProps {
  blogId: string;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  delta: number | null;
  deltaInverted?: boolean; // For position where lower is better
  emptyState?: {
    message: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  tooltip?: string;
  onClick?: () => void;
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  delta, 
  deltaInverted = false,
  emptyState, 
  tooltip,
  onClick 
}: MetricCardProps) {
  const isEmpty = value === 0 || value === '0' || value === '--';
  
  // Determine delta display
  let deltaColor = 'text-muted-foreground';
  let DeltaIcon = Minus;
  
  if (delta !== null) {
    const isPositive = deltaInverted ? delta < 0 : delta > 0;
    const isNegative = deltaInverted ? delta > 0 : delta < 0;
    
    if (isPositive) {
      deltaColor = 'text-green-500';
      DeltaIcon = TrendingUp;
    } else if (isNegative) {
      deltaColor = 'text-red-500';
      DeltaIcon = TrendingDown;
    }
  }

  const content = (
    <div 
      className={`client-card p-4 sm:p-5 transition-all ${onClick ? 'cursor-pointer hover:border-primary/50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          {icon}
        </div>
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
      </div>
      
      {isEmpty && emptyState ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{emptyState.message}</p>
          {emptyState.action && (
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                emptyState.action?.onClick();
              }}
            >
              {emptyState.action.label}
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <span className="text-2xl sm:text-3xl font-bold text-foreground">
            {value}
          </span>
          {delta !== null && (
            <div className={`flex items-center gap-1 text-sm ${deltaColor}`}>
              <DeltaIcon className="h-3.5 w-3.5" />
              <span>{deltaInverted ? Math.abs(delta) : delta > 0 ? `+${delta}` : delta}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function ValueProofDashboard({ blogId }: ValueProofDashboardProps) {
  const { metrics, loading, error } = useValueProofMetrics(blogId);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 sm:h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-card p-4 border-destructive/50">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Prova de Valor</h2>
            <p className="text-sm text-muted-foreground">Últimos 7 dias vs período anterior</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/client/results')}
            className="gap-1.5"
          >
            Ver detalhes
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Metric Cards Grid - 3 columns */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          {/* Visits */}
          <MetricCard
            icon={<Eye className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />}
            label="Visitas"
            value={metrics.visits.toLocaleString()}
            delta={metrics.visitsDelta}
            tooltip="Total de visualizações em seus artigos"
            onClick={() => navigate('/client/results')}
          />

          {/* CTA Clicks */}
          <MetricCard
            icon={<MousePointerClick className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />}
            label="Cliques no CTA"
            value={metrics.ctaClicks}
            delta={metrics.clicksDelta}
            emptyState={{
              message: "Aguardando primeiro clique",
            }}
            tooltip="Cliques em botões de conversão"
            onClick={() => navigate('/client/results')}
          />

          {/* Real Leads */}
          <MetricCard
            icon={<MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />}
            label="Leads Reais"
            value={metrics.realLeads}
            delta={metrics.leadsDelta}
            emptyState={{
              message: "Aguardando contatos",
            }}
            tooltip="Contatos iniciados via WhatsApp"
            onClick={() => navigate('/client/leads')}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}