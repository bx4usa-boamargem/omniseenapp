import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Sparkles, ArrowRight, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Autoplay from 'embla-carousel-autoplay';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useRadarOpportunities, RadarOpportunity } from '@/hooks/useRadarOpportunities';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { toast } from 'sonner';

interface OpportunitiesCarouselBannerProps {
  blogId: string;
  className?: string;
}

export function OpportunitiesCarouselBanner({ blogId, className }: OpportunitiesCarouselBannerProps) {
  const navigate = useNavigate();
  const { opportunities, totalPending, lastUpdatedAt, loading } = useRadarOpportunities(blogId, 5);
  const { checkLimit } = usePlanLimits();
  const [isCreating, setIsCreating] = React.useState<string | null>(null);

  const handleCreateArticle = useCallback(async (opportunity: RadarOpportunity) => {
    setIsCreating(opportunity.id);

    try {
      // Check article limits
      const limitResult = await checkLimit('articles');
      
      if (!limitResult.canCreate) {
        toast.error('Limite de artigos atingido', {
          description: 'Faça upgrade do seu plano para criar mais artigos.',
          action: {
            label: 'Ver Planos',
            onClick: () => navigate('/pricing')
          }
        });
        return;
      }

      // Navigate to quick creation
      const params = new URLSearchParams({
        quick: 'true',
        fromOpportunity: opportunity.id,
        theme: opportunity.suggested_title,
        mode: 'fast'
      });

      navigate(`/client/create?${params.toString()}`);
    } catch (error) {
      console.error('Error checking limits:', error);
      toast.error('Erro ao verificar limites');
    } finally {
      setIsCreating(null);
    }
  }, [checkLimit, navigate]);

  const handleViewRadar = useCallback(() => {
    navigate('/client/radar');
  }, [navigate]);

  // Don't render if no opportunities
  if (!loading && opportunities.length === 0) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <Card className={cn("bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-amber-500/20", className)}>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const autoplayPlugin = React.useMemo(
    () =>
      Autoplay({
        delay: 5000,
        stopOnInteraction: true,
        stopOnMouseEnter: true,
      }),
    []
  );

  return (
    <Card className={cn(
      "overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/5",
      "hover:border-amber-500/50 transition-all duration-300",
      className
    )}>
      <CardContent className="p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-amber-500/20">
              <Compass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-semibold text-sm md:text-base text-foreground">
              Nossa IA tem grandes oportunidades na sua região
            </span>
            {totalPending > 0 && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
                {totalPending} {totalPending === 1 ? 'nova' : 'novas'}
              </Badge>
            )}
          </div>
          
          {lastUpdatedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Atualizado {formatDistanceToNow(lastUpdatedAt, { locale: ptBR, addSuffix: true })}</span>
            </div>
          )}
        </div>

        {/* Carousel */}
        <Carousel
          plugins={[autoplayPlugin]}
          opts={{ 
            loop: true,
            align: 'start'
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {opportunities.map((opportunity) => (
              <CarouselItem key={opportunity.id} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                <div className="h-full">
                  <Card className="h-full bg-background/80 backdrop-blur-sm border-border/50 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 group">
                    <CardContent className="p-4 flex flex-col h-full">
                      {/* Score Badge */}
                      <div className="flex items-center justify-between mb-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs font-medium",
                            (opportunity.relevance_score || 0) >= 80 
                              ? "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10"
                              : (opportunity.relevance_score || 0) >= 60
                              ? "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              : "border-muted text-muted-foreground"
                          )}
                        >
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Score {opportunity.relevance_score || 0}
                        </Badge>
                      </div>

                      {/* Title */}
                      <h4 className="font-medium text-sm leading-tight mb-3 line-clamp-2 flex-grow group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {opportunity.suggested_title}
                      </h4>

                      {/* Keywords */}
                      {opportunity.suggested_keywords && opportunity.suggested_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {opportunity.suggested_keywords.slice(0, 2).map((kw, idx) => (
                            <span 
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Button */}
                      <Button
                        size="sm"
                        onClick={() => handleCreateArticle(opportunity)}
                        disabled={isCreating === opportunity.id}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all"
                      >
                        {isCreating === opportunity.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                            Criar Artigo
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          
          <CarouselPrevious className="hidden md:flex -left-3 h-8 w-8 bg-background/80 backdrop-blur-sm border-border/50" />
          <CarouselNext className="hidden md:flex -right-3 h-8 w-8 bg-background/80 backdrop-blur-sm border-border/50" />
        </Carousel>

        {/* Footer - Scarcity Message */}
        <div className="mt-4 pt-3 border-t border-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-sm">
            <span className="text-green-600 dark:text-green-400 font-semibold">
              💡 Hoje você tem +{totalPending} possibilidades
            </span>
            <span className="text-muted-foreground ml-1">
              de títulos que podem atrair muitos leads para sua página.
            </span>
          </p>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewRadar}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/10 shrink-0"
          >
            Ver todas no Radar
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
