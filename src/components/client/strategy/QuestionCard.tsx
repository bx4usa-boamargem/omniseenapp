import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Search, ShoppingCart, CreditCard } from 'lucide-react';

interface QuestionCardProps {
  question: string;
  intent: string;
  audience_pain: string;
}

const intentConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  informational: { 
    label: 'Informacional', 
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    icon: Search
  },
  commercial: { 
    label: 'Comercial', 
    color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
    icon: ShoppingCart
  },
  transactional: { 
    label: 'Transacional', 
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
    icon: CreditCard
  },
};

export function QuestionCard({ question, intent, audience_pain }: QuestionCardProps) {
  const config = intentConfig[intent] || intentConfig.informational;
  const Icon = config.icon;
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-1.5 rounded-lg bg-violet-500/10 shrink-0 mt-0.5">
            <HelpCircle className="h-4 w-4 text-violet-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm leading-relaxed">"{question}"</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className={`text-xs ${config.color}`}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
        
        {audience_pain && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Dor do público:</span> {audience_pain}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
