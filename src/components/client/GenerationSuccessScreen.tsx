import { useEffect } from 'react';
import { CheckCircle2, ExternalLink, Sparkles, Home, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import confetti from 'canvas-confetti';

interface GenerationSuccessScreenProps {
  title: string;
  url: string;
  onViewArticle: () => void;
  onCreateAnother: () => void;
  onGoHome: () => void;
}

export function GenerationSuccessScreen({
  title,
  url,
  onViewArticle,
  onCreateAnother,
  onGoHome,
}: GenerationSuccessScreenProps) {
  // Trigger confetti on mount
  useEffect(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#22c55e'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-lg border-2 border-green-500/30 bg-gradient-to-br from-background to-green-500/5 shadow-xl">
        <CardContent className="pt-8 pb-8 space-y-8">
          {/* Success Icon */}
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div className="absolute -top-2 -right-2">
                <PartyPopper className="h-8 w-8 text-yellow-500 animate-bounce" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
                🎉 Seu artigo está pronto!
              </h1>
              <p className="text-muted-foreground">
                Publicado com sucesso no seu blog
              </p>
            </div>
          </div>

          {/* Article Info */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Título</label>
              <p className="font-semibold text-foreground text-lg leading-tight">{title}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">URL</label>
              <p className="text-sm text-primary font-mono break-all">{url}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button 
              size="lg" 
              onClick={onViewArticle}
              className="w-full h-14 text-lg gap-3 bg-green-600 hover:bg-green-700"
            >
              <ExternalLink className="h-5 w-5" />
              Ver Artigo Agora
            </Button>
            
            <Button 
              size="lg" 
              variant="outline"
              onClick={onCreateAnother}
              className="w-full h-12 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Criar Outro Artigo
            </Button>

            <Button 
              variant="ghost" 
              onClick={onGoHome}
              className="w-full gap-2 text-muted-foreground hover:text-foreground"
            >
              <Home className="h-4 w-4" />
              Voltar ao Início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
