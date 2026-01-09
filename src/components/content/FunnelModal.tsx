import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Info, Loader2, ArrowRight, Plus, Sparkles } from "lucide-react";

interface FunnelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogId: string;
  onContinue: (data: FunnelData) => void;
}

interface FunnelData {
  personaId: string;
  topOfFunnel: number;
  middleOfFunnel: number;
  bottomOfFunnel: number;
}

interface Persona {
  id: string;
  name: string;
  problems: string[];
  solutions: string[];
  objections: string[];
}

// Persona genérica para fallback
const GENERIC_PERSONA: Persona = {
  id: "generic",
  name: "Público Geral",
  problems: ["Problemas comuns do mercado"],
  solutions: ["Soluções disponíveis"],
  objections: ["Dúvidas frequentes"],
};

export function FunnelModal({ open, onOpenChange, blogId, onContinue }: FunnelModalProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [topCount, setTopCount] = useState(1);
  const [middleCount, setMiddleCount] = useState(1);
  const [bottomCount, setBottomCount] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    if (open && blogId) {
      fetchPersonas();
    }
  }, [open, blogId]);

  async function fetchPersonas() {
    setLoading(true);
    const { data, error } = await supabase
      .from("personas")
      .select("id, name, problems, solutions, objections")
      .eq("blog_id", blogId);

    if (data && data.length > 0) {
      setPersonas(data);
      setSelectedPersona(data[0].id);
    } else {
      // Use generic persona as fallback
      setPersonas([GENERIC_PERSONA]);
      setSelectedPersona(GENERIC_PERSONA.id);
    }
    setLoading(false);
  }

  const selectedPersonaData = personas.find(p => p.id === selectedPersona) || GENERIC_PERSONA;
  const isUsingGenericPersona = selectedPersona === "generic";
  
  // Always allow generation with fallback
  const totalArticles = topCount + middleCount + bottomCount;

  const handleContinue = async () => {
    if (totalArticles === 0) return;
    
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-funnel-articles', {
        body: {
          blogId,
          personaId: isUsingGenericPersona ? null : selectedPersona,
          topOfFunnel: topCount,
          middleOfFunnel: middleCount,
          bottomOfFunnel: bottomCount,
          useGenericPersona: isUsingGenericPersona,
        }
      });

      if (error) throw error;

      toast({
        title: "Artigos na fila!",
        description: `${data?.count || totalArticles} artigos foram adicionados à fila de automação.`,
      });

      onContinue({
        personaId: selectedPersona,
        topOfFunnel: topCount,
        middleOfFunnel: middleCount,
        bottomOfFunnel: bottomCount,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error generating funnel articles:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar artigos",
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Criar Artigos por Funil de Vendas
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Informative notice when using generic persona */}
            {isUsingGenericPersona && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  Não encontramos personas configuradas.
                  <span className="block mt-1 text-sm opacity-80">
                    Vamos usar padrões inteligentes automaticamente. Você pode personalizar depois.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Persona Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Persona</Label>
                <Link 
                  to="/strategy?tab=audience" 
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                  onClick={() => onOpenChange(false)}
                >
                  <Plus className="h-3 w-3" />
                  Criar nova persona
                </Link>
              </div>
              <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma persona" />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.name}
                      {persona.id === "generic" && (
                        <span className="text-xs text-muted-foreground ml-2">(padrão)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Opcional. Se não preencher, o sistema usa um padrão inteligente.
              </p>
            </div>

            {/* Funnel Stages */}
            <div className="grid gap-4">
              {/* Top of Funnel */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Topo de Funil</span>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                          Educar e criar consciência
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Aborda os problemas e desafios que a persona enfrenta, educando sobre as causas e consequências.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label className="text-xs text-muted-foreground">Qtd.</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={topCount}
                        onChange={(e) => setTopCount(parseInt(e.target.value) || 0)}
                        className="w-16 h-8"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Middle of Funnel */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Meio de Funil</span>
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200">
                          Comparar soluções
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Apresenta e compara soluções disponíveis, mostrando como resolver os problemas identificados.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label className="text-xs text-muted-foreground">Qtd.</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={middleCount}
                        onChange={(e) => setMiddleCount(parseInt(e.target.value) || 0)}
                        className="w-16 h-8"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bottom of Funnel */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Fundo de Funil</span>
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                          Quebrar objeções
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Responde às objeções e dúvidas finais, ajudando na decisão de compra ou contratação.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label className="text-xs text-muted-foreground">Qtd.</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={bottomCount}
                        onChange={(e) => setBottomCount(parseInt(e.target.value) || 0)}
                        className="w-16 h-8"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            {totalArticles > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>
                  {totalArticles} artigo{totalArticles !== 1 ? 's' : ''} será{totalArticles !== 1 ? 'ão' : ''} gerado{totalArticles !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={handleContinue} 
          disabled={generating || totalArticles === 0}
          className="w-full gradient-primary"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              Gerar {totalArticles > 0 ? `${totalArticles} artigo${totalArticles !== 1 ? 's' : ''}` : 'artigos'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
