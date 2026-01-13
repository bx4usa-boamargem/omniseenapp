import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Target, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThresholdSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

const presetThresholds = [
  { 
    value: 70, 
    label: '70% (Todas as relevantes)',
    description: 'Receba notificações de todas as oportunidades relevantes'
  },
  { 
    value: 80, 
    label: '80% (Recomendado)',
    description: 'Equilíbrio entre quantidade e qualidade'
  },
  { 
    value: 90, 
    label: '90% (Apenas alto impacto)',
    description: 'Apenas oportunidades com maior potencial de conversão',
    recommended: true
  }
];

export function ThresholdSelector({ value, onChange }: ThresholdSelectorProps) {
  const handlePresetChange = (presetValue: string) => {
    onChange(parseInt(presetValue, 10));
  };

  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Threshold de Relevância
        </CardTitle>
        <CardDescription>
          Defina o score mínimo para receber notificações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={value.toString()} 
          onValueChange={handlePresetChange}
          className="space-y-3"
        >
          {presetThresholds.map((preset) => (
            <div
              key={preset.value}
              className={cn(
                "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                value === preset.value 
                  ? "border-primary bg-primary/5" 
                  : "border-slate-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
              )}
              onClick={() => onChange(preset.value)}
            >
              <RadioGroupItem 
                value={preset.value.toString()} 
                id={`threshold-${preset.value}`}
                className="mt-1"
              />
              <div className="flex-1">
                <Label 
                  htmlFor={`threshold-${preset.value}`}
                  className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                >
                  {preset.label}
                  {preset.recommended && (
                    <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                      <Star className="h-3 w-3 fill-current" />
                      RECOMENDADO
                    </span>
                  )}
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {preset.description}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Ajuste fino:</span>
            <span className="text-lg font-bold text-primary">{value}%</span>
          </div>
          <Slider
            value={[value]}
            onValueChange={([v]) => onChange(v)}
            min={50}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
