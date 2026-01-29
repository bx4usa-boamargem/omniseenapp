/**
 * Template Selector Radio
 * 
 * Radio buttons para os 5 templates estruturais + Auto.
 */

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Wand2, 
  BookOpen, 
  HelpCircle, 
  Scale, 
  AlertTriangle, 
  GraduationCap 
} from 'lucide-react';
import type { TemplateType } from '@/lib/article-engine/types';

interface TemplateSelectorRadioProps {
  value: TemplateType | 'auto';
  onChange: (value: TemplateType | 'auto') => void;
  disabled?: boolean;
}

const TEMPLATE_OPTIONS: Array<{
  value: TemplateType | 'auto';
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'auto',
    label: 'Auto-selecionar',
    description: 'Inteligente',
    icon: <Wand2 className="h-4 w-4 text-primary" />
  },
  {
    value: 'complete_guide',
    label: 'Guia Completo',
    description: 'Abrangente',
    icon: <BookOpen className="h-4 w-4 text-blue-500" />
  },
  {
    value: 'qa_format',
    label: 'Perguntas & Respostas',
    description: 'FAQ expandido',
    icon: <HelpCircle className="h-4 w-4 text-green-500" />
  },
  {
    value: 'comparative',
    label: 'Comparativo',
    description: 'Decisão de compra',
    icon: <Scale className="h-4 w-4 text-purple-500" />
  },
  {
    value: 'problem_solution',
    label: 'Problema → Solução',
    description: 'Urgência',
    icon: <AlertTriangle className="h-4 w-4 text-orange-500" />
  },
  {
    value: 'educational_steps',
    label: 'Educacional',
    description: 'Passo a passo',
    icon: <GraduationCap className="h-4 w-4 text-cyan-500" />
  }
];

export function TemplateSelectorRadio({
  value,
  onChange,
  disabled = false
}: TemplateSelectorRadioProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(val) => onChange(val as TemplateType | 'auto')}
      className="grid grid-cols-2 md:grid-cols-3 gap-3"
      disabled={disabled}
    >
      {TEMPLATE_OPTIONS.map((option) => (
        <div key={option.value}>
          <RadioGroupItem 
            value={option.value} 
            id={`template-${option.value}`} 
            className="peer sr-only" 
          />
          <Label
            htmlFor={`template-${option.value}`}
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
          >
            {option.icon}
            <div className="text-center">
              <p className="font-medium text-sm">{option.label}</p>
              <p className="text-[10px] text-muted-foreground">{option.description}</p>
            </div>
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
