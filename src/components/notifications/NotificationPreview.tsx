import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreStars } from '@/components/consultant/ScoreStars';
import { Eye, Target, ExternalLink } from 'lucide-react';

interface NotificationPreviewProps {
  threshold: number;
}

export function NotificationPreview({ threshold }: NotificationPreviewProps) {
  // Example notification based on threshold
  const exampleScore = Math.min(threshold + 5, 98);

  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Preview da Notificação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-white">
                  🎯 OPORTUNIDADE DE ALTO IMPACTO
                </span>
                <ScoreStars score={exampleScore} size="sm" />
              </div>
              
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-2">
                "5 Erros que Fazem Você Perder Clientes por Falta de Automação"
              </h4>
              
              <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xs font-medium text-green-700 dark:text-green-400">
                  💰 Alinhamento comercial:
                </p>
                <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                  Este artigo posiciona você como especialista em automação e direciona leads qualificados para seu WhatsApp.
                </p>
              </div>
              
              <Button size="sm" className="mt-3 gap-2">
                <ExternalLink className="h-4 w-4" />
                Criar Artigo Agora
              </Button>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          Você receberá notificações quando oportunidades com score ≥ {threshold}% forem detectadas
        </p>
      </CardContent>
    </Card>
  );
}
