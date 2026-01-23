import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Hash, 
  AlignLeft, 
  Image, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Loader2,
  Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricData {
  value: number;
  min: number;
  max: number;
  status: 'below' | 'within' | 'above';
}

export interface StructureMetrics {
  words: MetricData;
  h2: MetricData;
  paragraphs: MetricData;
  images: MetricData;
}

interface StructureMetricsGridProps {
  metrics: StructureMetrics | null;
  onFix?: (area: 'words' | 'h2' | 'paragraphs' | 'images') => void;
  fixingArea?: string | null;
  loading?: boolean;
  className?: string;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  status: 'below' | 'within' | 'above';
  onFix?: () => void;
  fixing?: boolean;
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  min, 
  max, 
  status, 
  onFix,
  fixing 
}: MetricCardProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'above':
        return {
          arrow: TrendingUp,
          color: 'text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'below':
        return {
          arrow: TrendingDown,
          color: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      default:
        return {
          arrow: Minus,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800'
        };
    }
  };

  const config = getStatusConfig();
  const Arrow = config.arrow;

  return (
    <div className={cn(
      "p-3 rounded-lg border",
      config.bgColor,
      config.borderColor
    )}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg font-bold tabular-nums">{value}</span>
        <Arrow className={cn("h-4 w-4", config.color)} />
      </div>
      
      <div className="text-xs text-muted-foreground tabular-nums">
        {min} - {max}
      </div>
      
      {status === 'below' && onFix && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 h-7 text-xs gap-1"
          onClick={onFix}
          disabled={fixing}
        >
          {fixing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wrench className="h-3 w-3" />
          )}
          Corrigir
        </Button>
      )}
    </div>
  );
}

export function StructureMetricsGrid({ 
  metrics, 
  onFix, 
  fixingArea,
  loading,
  className 
}: StructureMetricsGridProps) {
  if (!metrics || loading) {
    return (
      <div className={cn("grid grid-cols-2 gap-2", className)}>
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="h-24 rounded-lg bg-muted/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">
        Estrutura
      </h4>
      
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<FileText className="h-4 w-4" />}
          label="Palavras"
          value={metrics.words.value}
          min={metrics.words.min}
          max={metrics.words.max}
          status={metrics.words.status}
          onFix={onFix ? () => onFix('words') : undefined}
          fixing={fixingArea === 'words'}
        />
        
        <MetricCard
          icon={<Hash className="h-4 w-4" />}
          label="H2"
          value={metrics.h2.value}
          min={metrics.h2.min}
          max={metrics.h2.max}
          status={metrics.h2.status}
          onFix={onFix ? () => onFix('h2') : undefined}
          fixing={fixingArea === 'h2'}
        />
        
        <MetricCard
          icon={<AlignLeft className="h-4 w-4" />}
          label="Parágrafos"
          value={metrics.paragraphs.value}
          min={metrics.paragraphs.min}
          max={metrics.paragraphs.max}
          status={metrics.paragraphs.status}
          onFix={onFix ? () => onFix('paragraphs') : undefined}
          fixing={fixingArea === 'paragraphs'}
        />
        
        <MetricCard
          icon={<Image className="h-4 w-4" />}
          label="Imagens"
          value={metrics.images.value}
          min={metrics.images.min}
          max={metrics.images.max}
          status={metrics.images.status}
          onFix={onFix ? () => onFix('images') : undefined}
          fixing={fixingArea === 'images'}
        />
      </div>
    </div>
  );
}
