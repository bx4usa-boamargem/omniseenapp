import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Sparkles, Radar, TrendingUp, Target, Zap } from "lucide-react";

interface FunnelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogId: string;
  onContinue?: (data: FunnelData) => void;
  isClientContext?: boolean;
}

interface FunnelData {
  topOfFunnel: number;
  middleOfFunnel: number;
  bottomOfFunnel: number;
}

interface Opportunity {
  id: string;
  suggested_title: string;
  relevance_score: number;
  suggested_keywords: string[];
  goal: string;
  funnel_stage: string;
  why_now?: string;
}

interface GroupedOpportunities {
  topo: Opportunity[];
  meio: Opportunity[];
  fundo: Opportunity[];
}

export function FunnelModal({ open, onOpenChange, blogId, onContinue, isClientContext = false }: FunnelModalProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [opportunities, setOpportunities] = useState<GroupedOpportunities>({ topo: [], meio: [], fundo: [] });
  const [topCount, setTopCount] = useState(1);
  const [middleCount, setMiddleCount] = useState(1);
  const [bottomCount, setBottomCount] = useState(1);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && blogId) {
      fetchOpportunities();
    }
  }, [open, blogId]);

  async function fetchOpportunities() {
    setLoading(true);
    
    // Buscar oportunidades abertas agrupadas por estágio
    const { data, error } = await supabase
      .from("article_opportunities")
      .select("id, suggested_title, relevance_score, suggested_keywords, goal, funnel_stage, why_now")
      .eq("blog_id", blogId)
      .in("status", ["pending", "approved"])
      .order("relevance_score", { ascending: false });

    if (error) {
      console.error("Error fetching opportunities:", error);
      setLoading(false);
      return;
    }

    // Agrupar por funnel_stage
    const grouped: GroupedOpportunities = {
      topo: [],
      meio: [],
      fundo: [],
    };

    (data || []).forEach((opp: Opportunity) => {
      const stage = opp.funnel_stage || 'topo';
      if (stage === 'topo' || stage === 'meio' || stage === 'fundo') {
        grouped[stage].push(opp);
      } else {
        grouped.topo.push(opp);
      }
    });

    setOpportunities(grouped);
    
    // Ajustar contadores iniciais baseado no disponível
    setTopCount(Math.min(1, grouped.topo.length));
    setMiddleCount(Math.min(1, grouped.meio.length));
    setBottomCount(Math.min(1, grouped.fundo.length));
    
    setLoading(false);
  }

  const getAverageScore = (opps: Opportunity[]) => {
    if (opps.length === 0) return 0;
    return Math.round(opps.reduce((acc, o) => acc + (o.relevance_score || 0), 0) / opps.length);
  };

  const totalAvailable = opportunities.topo.length + opportunities.meio.length + opportunities.fundo.length;
  const totalSelected = topCount + middleCount + bottomCount;

  const handleGenerate = async () => {
    if (totalSelected === 0) return;
    
    setGenerating(true);
    const createdArticles: string[] = [];
    const errors: string[] = [];

    try {
      // Selecionar top N oportunidades de cada estágio
      const selectedOpps = [
        ...opportunities.topo.slice(0, topCount),
        ...opportunities.meio.slice(0, middleCount),
        ...opportunities.fundo.slice(0, bottomCount),
      ];

      for (const opp of selectedOpps) {
        try {
          const { data, error } = await supabase.functions.invoke('convert-opportunity-to-article', {
            body: { opportunityId: opp.id, blogId }
          });

          if (error) {
            console.error(`Error converting opportunity ${opp.id}:`, error);
            errors.push(opp.suggested_title);
            continue;
          }

          if (data?.article_id) {
            createdArticles.push(data.article_id);
          }
        } catch (err) {
          console.error(`Error converting opportunity ${opp.id}:`, err);
          errors.push(opp.suggested_title);
        }
      }

      if (createdArticles.length > 0) {
        toast({
          title: `${createdArticles.length} artigo${createdArticles.length > 1 ? 's' : ''} criado${createdArticles.length > 1 ? 's' : ''}!`,
          description: "Redirecionando para o editor...",
        });

        onContinue?.({
          topOfFunnel: topCount,
          middleOfFunnel: middleCount,
          bottomOfFunnel: bottomCount,
        });
        onOpenChange(false);

        // Redirecionar para o primeiro artigo criado
        navigate(`/client/articles/${createdArticles[0]}/edit`);
      } else {
        toast({
          variant: "destructive",
          title: "Nenhum artigo criado",
          description: errors.length > 0 
            ? `Falha ao processar: ${errors.join(', ')}` 
            : "Tente novamente mais tarde.",
        });
      }

    } catch (error: any) {
      console.error('Error in handleGenerate:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar artigos",
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const StageCard = ({ 
    stage, 
    opps, 
    count, 
    setCount, 
    color, 
    icon: Icon, 
    label, 
    description 
  }: { 
    stage: string;
    opps: Opportunity[];
    count: number;
    setCount: (n: number) => void;
    color: string;
    icon: any;
    label: string;
    description: string;
  }) => {
    const avgScore = getAverageScore(opps);
    const topOpp = opps[0];

    return (
      <Card className={`border-l-4 ${color}`}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
                <Badge variant="outline" className="text-xs">
                  {description}
                </Badge>
              </div>
              
              {opps.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm text-primary font-medium">
                    {opps.length} oportunidade{opps.length > 1 ? 's' : ''} disponíve{opps.length > 1 ? 'is' : 'l'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Score médio: {avgScore}% | Top: "{topOpp?.suggested_title?.slice(0, 40)}..."
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma oportunidade disponível
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <Label className="text-xs text-muted-foreground">Qtd.</Label>
              <Input
                type="number"
                min={0}
                max={opps.length}
                value={count}
                onChange={(e) => setCount(Math.min(parseInt(e.target.value) || 0, opps.length))}
                className="w-16 h-8"
                disabled={opps.length === 0}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <Radar className="h-5 w-5 text-primary" />
            Criar Artigos do Mercado Real
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : totalAvailable === 0 ? (
          <div className="py-8">
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <Radar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Nenhuma oportunidade disponível no momento.</strong>
                <span className="block mt-1 text-sm opacity-80">
                  Execute o Radar de Mercado para detectar tendências e oportunidades reais.
                </span>
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => {
                onOpenChange(false);
                navigate('/client/strategy?tab=radar');
              }}
              className="w-full mt-4"
              variant="outline"
            >
              <Radar className="h-4 w-4 mr-2" />
              Ir para Radar de Mercado
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Info Badge */}
            <div className="flex items-center justify-center">
              <Badge variant="secondary" className="gap-1">
                <Radar className="h-3 w-3" />
                {totalAvailable} oportunidades detectadas pelo Radar
              </Badge>
            </div>

            {/* Funnel Stages */}
            <div className="grid gap-3">
              <StageCard
                stage="topo"
                opps={opportunities.topo}
                count={topCount}
                setCount={setTopCount}
                color="border-l-orange-500"
                icon={TrendingUp}
                label="Topo do Funil"
                description="Educar e criar consciência"
              />

              <StageCard
                stage="meio"
                opps={opportunities.meio}
                count={middleCount}
                setCount={setMiddleCount}
                color="border-l-purple-500"
                icon={Target}
                label="Meio do Funil"
                description="Comparar soluções"
              />

              <StageCard
                stage="fundo"
                opps={opportunities.fundo}
                count={bottomCount}
                setCount={setBottomCount}
                color="border-l-green-500"
                icon={Zap}
                label="Fundo do Funil"
                description="Quebrar objeções"
              />
            </div>

            {/* Summary */}
            {totalSelected > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>
                  {totalSelected} artigo{totalSelected !== 1 ? 's' : ''} será{totalSelected !== 1 ? 'ão' : ''} criado{totalSelected !== 1 ? 's' : ''} como rascunho
                </span>
              </div>
            )}

            {/* Source info */}
            <p className="text-xs text-center text-muted-foreground">
              📡 Fonte: Radar de Mercado Semanal (Perplexity/AI)
            </p>
          </div>
        )}

        <Button 
          onClick={handleGenerate} 
          disabled={generating || totalSelected === 0 || totalAvailable === 0}
          className="w-full gradient-primary"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando artigos reais...
            </>
          ) : (
            <>
              Gerar {totalSelected > 0 ? `${totalSelected} artigo${totalSelected !== 1 ? 's' : ''} do mercado` : 'artigos'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
