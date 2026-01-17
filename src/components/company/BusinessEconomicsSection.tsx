import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DollarSign, Percent, Calculator, ChevronDown, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calculateBusinessValues } from '@/hooks/useBusinessEconomics';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BusinessEconomicsSectionProps {
  blogId: string;
}

export type CurrencyType = 'BRL' | 'USD';

export function BusinessEconomicsSection({ blogId }: BusinessEconomicsSectionProps) {
  const [averageTicket, setAverageTicket] = useState<string>('');
  const [closingRate, setClosingRate] = useState<string>('');
  const [customOpportunityValue, setCustomOpportunityValue] = useState<string>('');
  const [averageMargin, setAverageMargin] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyType>('BRL');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('business_profile')
          .select('average_ticket, closing_rate, custom_opportunity_value, average_margin, currency')
          .eq('blog_id', blogId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setAverageTicket(data.average_ticket?.toString() || '');
          setClosingRate(data.closing_rate?.toString() || '');
          setCustomOpportunityValue(data.custom_opportunity_value?.toString() || '');
          setAverageMargin(data.average_margin?.toString() || '');
          setCurrency((data.currency as CurrencyType) || 'BRL');
        }
      } catch (error) {
        console.error('Error fetching business economics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (blogId) {
      fetchData();
    }
  }, [blogId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('business_profile')
        .update({
          average_ticket: averageTicket ? parseFloat(averageTicket) : null,
          closing_rate: closingRate ? parseFloat(closingRate) : null,
          custom_opportunity_value: customOpportunityValue ? parseFloat(customOpportunityValue) : null,
          average_margin: averageMargin ? parseFloat(averageMargin) : null,
          currency,
          business_economics_configured: !!(averageTicket && closingRate),
        })
        .eq('blog_id', blogId);

      if (error) throw error;

      setIsSaved(true);
      toast.success('Economia do negócio salva com sucesso!');
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error('Error saving business economics:', error);
      toast.error('Erro ao salvar economia do negócio');
    } finally {
      setIsSaving(false);
    }
  };

  // Cálculos em tempo real
  const { opportunityValue, valuePerExposure, valuePerIntent } = calculateBusinessValues(
    averageTicket ? parseFloat(averageTicket) : null,
    closingRate ? parseFloat(closingRate) : null,
    customOpportunityValue ? parseFloat(customOpportunityValue) : null
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const currencySymbol = currency === 'BRL' ? 'R$' : '$';

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          📊 Economia do Negócio
        </CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Para calcular seu retorno com precisão, precisamos entender a economia do seu negócio.
          </p>
          <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyType)}>
            <SelectTrigger className="w-[110px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BRL">🇧🇷 R$ BRL</SelectItem>
              <SelectItem value="USD">🇺🇸 $ USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campos principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="averageTicket" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Ticket Médio por Venda
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Valor médio que você recebe por cada venda fechada</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
              <Input
                id="averageTicket"
                type="number"
                placeholder={currency === 'BRL' ? '500' : '100'}
                value={averageTicket}
                onChange={(e) => setAverageTicket(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closingRate" className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-blue-500" />
              Taxa de Fechamento
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>De cada 100 pessoas interessadas, quantas viram clientes?</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="relative">
              <Input
                id="closingRate"
                type="number"
                placeholder="20"
                value={closingRate}
                onChange={(e) => setClosingRate(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
        </div>

        {/* Preview do cálculo */}
        {averageTicket && closingRate && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Calculator className="h-4 w-4" />
              Valores calculados automaticamente
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-background rounded-md p-3 border">
                <div className="text-muted-foreground text-xs mb-1">Valor por Oportunidade</div>
                <div className="font-bold text-lg">{formatCurrency(opportunityValue)}</div>
                <div className="text-xs text-muted-foreground">
                  {currencySymbol} {averageTicket} × {closingRate}%
                </div>
              </div>
              
              <div className="bg-background rounded-md p-3 border">
                <div className="text-muted-foreground text-xs mb-1">Exposição Comercial</div>
                <div className="font-bold text-lg text-violet-600 dark:text-violet-400">{formatCurrency(valuePerExposure)}</div>
                <div className="text-xs text-muted-foreground">
                  10% do valor (leitura ≥60%)
                </div>
              </div>
              
              <div className="bg-background rounded-md p-3 border">
                <div className="text-muted-foreground text-xs mb-1">Intenção Comercial</div>
                <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(valuePerIntent)}</div>
                <div className="text-xs text-muted-foreground">
                  150% do valor (clique CTA)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configurações avançadas */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-4 w-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
            ⚙️ Configurações Avançadas (opcional)
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="customOpportunityValue" className="text-sm">
                  Valor manual da oportunidade
                  <span className="text-xs text-muted-foreground ml-2">(sobrescreve cálculo)</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                  <Input
                    id="customOpportunityValue"
                    type="number"
                    placeholder="Deixe vazio para usar cálculo"
                    value={customOpportunityValue}
                    onChange={(e) => setCustomOpportunityValue(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="averageMargin" className="text-sm">
                  Margem média do negócio
                  <span className="text-xs text-muted-foreground ml-2">(para ROI líquido)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="averageMargin"
                    type="number"
                    placeholder="30"
                    value={averageMargin}
                    onChange={(e) => setAverageMargin(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Botão salvar */}
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !averageTicket || !closingRate}
          className="w-full"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : isSaved ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Salvo!
            </>
          ) : (
            'Salvar Economia do Negócio'
          )}
        </Button>

        {/* Info box */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-blue-800 dark:text-blue-200">
              <p className="font-medium">Por que isso importa?</p>
              <p className="text-blue-700 dark:text-blue-300">
                Com esses dados, todos os dashboards de ROI serão calculados com base na sua realidade. 
                Você verá exatamente quanto cada exposição comercial e cada intenção de contato valem para o seu negócio.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
