import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EconomicsTooltipProps {
  averageTicket: number | null;
  closingRate: number | null;
  opportunityValue: number;
  valuePerExposure: number;
  valuePerIntent: number;
  isConfigured: boolean;
}

export function EconomicsTooltip({
  averageTicket,
  closingRate,
  opportunityValue,
  valuePerExposure,
  valuePerIntent,
  isConfigured,
}: EconomicsTooltipProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (!isConfigured) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">
              Configure a economia do seu negócio em "Minha Empresa" para ver valores personalizados.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-primary cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm p-3">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">
              Baseado nos dados do seu negócio:
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Ticket médio:</span>
              <span className="font-medium">{formatCurrency(averageTicket || 0)}</span>
              
              <span className="text-muted-foreground">Fechamento:</span>
              <span className="font-medium">{closingRate || 0}%</span>
              
              <span className="text-muted-foreground">Valor por oportunidade:</span>
              <span className="font-medium">{formatCurrency(opportunityValue)}</span>
            </div>
            <div className="pt-2 border-t border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-violet-600 dark:text-violet-400">Exposição Comercial</span>
                <span>{formatCurrency(valuePerExposure)} (10%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-600 dark:text-emerald-400">Intenção Comercial</span>
                <span>{formatCurrency(valuePerIntent)} (150%)</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
