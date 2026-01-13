import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Zap, Calendar, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FrequencySelectorProps {
  frequency: 'immediate' | 'daily' | 'weekly';
  digestTime: string;
  onFrequencyChange: (frequency: 'immediate' | 'daily' | 'weekly') => void;
  onDigestTimeChange: (time: string) => void;
}

const frequencies = [
  {
    value: 'immediate' as const,
    icon: Zap,
    label: 'Imediata',
    description: 'Assim que uma oportunidade for detectada'
  },
  {
    value: 'daily' as const,
    icon: Calendar,
    label: 'Resumo diário',
    description: 'Um resumo consolidado por dia'
  },
  {
    value: 'weekly' as const,
    icon: CalendarDays,
    label: 'Resumo semanal',
    description: 'Um resumo consolidado por semana (segundas-feiras)'
  }
];

const timeOptions = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

export function FrequencySelector({ 
  frequency, 
  digestTime, 
  onFrequencyChange, 
  onDigestTimeChange 
}: FrequencySelectorProps) {
  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Frequência de Notificação
        </CardTitle>
        <CardDescription>
          Escolha quando deseja receber as notificações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={frequency} 
          onValueChange={(v) => onFrequencyChange(v as typeof frequency)}
          className="space-y-3"
        >
          {frequencies.map((freq) => (
            <div
              key={freq.value}
              className={cn(
                "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                frequency === freq.value 
                  ? "border-primary bg-primary/5" 
                  : "border-slate-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
              )}
              onClick={() => onFrequencyChange(freq.value)}
            >
              <RadioGroupItem 
                value={freq.value} 
                id={`freq-${freq.value}`}
                className="mt-1"
              />
              <div className="flex items-start gap-3 flex-1">
                <freq.icon className={cn(
                  "h-5 w-5 mt-0.5",
                  frequency === freq.value ? "text-primary" : "text-gray-400"
                )} />
                <div>
                  <Label 
                    htmlFor={`freq-${freq.value}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {freq.label}
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {freq.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </RadioGroup>

        {(frequency === 'daily' || frequency === 'weekly') && (
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <Label className="text-sm font-medium">
              Horário preferido para resumos:
            </Label>
            <Select value={digestTime} onValueChange={onDigestTimeChange}>
              <SelectTrigger className="w-32 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
