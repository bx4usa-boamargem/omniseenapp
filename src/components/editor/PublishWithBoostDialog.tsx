import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  TrendingUp, 
  Search as SearchIcon, 
  AlertTriangle,
  Sparkles,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PublishWithBoostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string;
  blogId: string;
  currentScore: number | null;
  minimumScore: number;
  serpAnalyzed: boolean;
  content: string;
  title: string;
  keyword: string;
  onBoostComplete: (newScore: number, newContent: string) => void;
  onAnalyzeComplete?: () => void;
  onPublishAfterBoost?: () => void;
}

function ScoreGauge({ 
  currentScore, 
  minimumScore, 
  loading 
}: { 
  currentScore: number | null; 
  minimumScore: number; 
  loading: boolean;
}) {
  const score = currentScore ?? 0;
  const radius = 80;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const minDashOffset = circumference - (minimumScore / 100) * circumference;
  
  const scoreColor = score >= minimumScore 
    ? 'hsl(var(--chart-2))' 
    : score >= minimumScore * 0.8 
      ? 'hsl(var(--chart-4))' 
      : 'hsl(var(--destructive))';

  return (
    <div className="relative w-48 h-24 mx-auto">
      <svg 
        viewBox="0 0 200 110" 
        className="w-full h-full"
      >
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Minimum threshold marker */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.3)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={minDashOffset}
        />
        
        {/* Score arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={loading ? 'hsl(var(--muted-foreground))' : scoreColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={loading ? circumference : dashOffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      
      {/* Score display */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <span 
              className={cn(
                "text-3xl font-bold",
                score >= minimumScore ? "text-emerald-500" : "text-destructive"
              )}
            >
              {score}
            </span>
            <span className="text-xs text-muted-foreground">
              mínimo: {minimumScore}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function PublishWithBoostDialog({
  open,
  onOpenChange,
  articleId,
  blogId,
  currentScore,
  minimumScore,
  serpAnalyzed,
  content,
  title,
  keyword,
  onBoostComplete,
  onAnalyzeComplete,
  onPublishAfterBoost,
}: PublishWithBoostDialogProps) {
  const [boosting, setBoosting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [boostSuccess, setBoostSuccess] = useState(false);
  const [newScore, setNewScore] = useState<number | null>(null);

  const handleAnalyzeSERP = async () => {
    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke('analyze-serp', {
        body: { keyword, blogId },
      });

      if (error) throw error;

      toast.success('Análise SERP concluída!');
      onAnalyzeComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error analyzing SERP:', error);
      toast.error('Erro ao analisar concorrência');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBoostScore = async () => {
    setBoosting(true);
    setBoostSuccess(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('boost-content-score', {
        body: {
          articleId,
          content,
          title,
          keyword,
          blogId,
          targetScore: minimumScore + 10, // Aim above minimum
          optimizationType: 'full',
        },
      });

      if (error) throw error;

      if (data.optimizedContent && data.newScore !== undefined) {
        setNewScore(data.newScore);
        
        if (data.newScore >= minimumScore) {
          setBoostSuccess(true);
          toast.success(`Score aumentado para ${data.newScore}!`);
          onBoostComplete(data.newScore, data.optimizedContent);
        } else {
          toast.info(`Score aumentou para ${data.newScore}, mas ainda está abaixo do mínimo.`);
          onBoostComplete(data.newScore, data.optimizedContent);
        }
      }
    } catch (error) {
      console.error('Error boosting score:', error);
      toast.error('Erro ao otimizar conteúdo');
    } finally {
      setBoosting(false);
    }
  };

  const handlePublishNow = () => {
    onPublishAfterBoost?.();
    onOpenChange(false);
  };

  const displayScore = newScore ?? currentScore;
  const canPublishNow = (displayScore ?? 0) >= minimumScore;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Score Insuficiente para Publicação
          </DialogTitle>
          <DialogDescription>
            O conteúdo precisa atingir a pontuação mínima de mercado antes de ser publicado.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Score Gauge */}
          <ScoreGauge 
            currentScore={displayScore} 
            minimumScore={minimumScore}
            loading={boosting}
          />

          {/* Status Alert */}
          {!serpAnalyzed ? (
            <Alert variant="destructive">
              <SearchIcon className="h-4 w-4" />
              <AlertTitle>Análise SERP Necessária</AlertTitle>
              <AlertDescription>
                Para calcular o score, primeiro é necessário analisar a concorrência no Google.
              </AlertDescription>
            </Alert>
          ) : boostSuccess ? (
            <Alert className="border-emerald-500/50 bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <AlertTitle className="text-emerald-600">Otimização Concluída!</AlertTitle>
              <AlertDescription>
                O conteúdo foi otimizado e agora está pronto para publicação.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertTitle>Score Abaixo do Mínimo</AlertTitle>
              <AlertDescription>
                Use a otimização automática com IA para melhorar o conteúdo e atingir a pontuação necessária.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!serpAnalyzed ? (
            <Button
              onClick={handleAnalyzeSERP}
              disabled={analyzing}
              className="w-full sm:w-auto gap-2"
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SearchIcon className="h-4 w-4" />
              )}
              Analisar Concorrência
            </Button>
          ) : canPublishNow ? (
            <Button
              onClick={handlePublishNow}
              className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle className="h-4 w-4" />
              Publicar Agora
            </Button>
          ) : (
            <Button
              onClick={handleBoostScore}
              disabled={boosting}
              className="w-full sm:w-auto gap-2"
            >
              {boosting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Aumentar Score com IA
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
