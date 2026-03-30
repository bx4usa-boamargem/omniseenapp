import type { OnboardingData } from '@/pages/client/ClientOnboarding';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  data: OnboardingData;
  generatedCount: number;
  blogSlug: string;
  onGoToDashboard: () => void;
  onViewArticles: () => void;
}

export function StepComplete({ data, generatedCount, blogSlug, onGoToDashboard, onViewArticles }: Props) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-5xl mb-4">🚀</div>
        <h2 className="text-2xl font-bold mb-2">
          Parabéns, seu novo blog já está no ar e os seus artigos já foram publicados!
        </h2>
        <p className="text-muted-foreground">
          Com a OMNISEEN você pode ficar tranquilo. <strong>Basta ativar sua conta, deixar o blog 100% automático e ir aproveitar a vida!</strong> 🎉
        </p>
      </div>

      {/* Generated articles info */}
      {generatedCount > 0 && (
        <div className="text-center">
          <p className="text-lg">
            <span className="text-primary font-bold">{data.companyName}</span>, tem mais{' '}
            <span className="text-primary font-bold">artigos</span> esperando por você!
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>Ative a sua conta</strong> e continue gerando mais conteúdos
          </p>
        </div>
      )}

      {/* Article list */}
      {data.suggestedArticles.filter(a => a.selected).length > 0 && (
        <div className="space-y-2">
          {data.suggestedArticles.filter(a => a.selected).map((article, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="h-2 w-2 rounded-full bg-primary/40" />
              <p className="text-sm text-muted-foreground">{article.title}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Button onClick={onGoToDashboard} className="w-full gap-2" size="lg">
          Ativar a minha conta <ArrowRight className="h-4 w-4" />
        </Button>
        <Button onClick={onViewArticles} variant="outline" className="w-full gap-2">
          Ver os artigos gerados <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
