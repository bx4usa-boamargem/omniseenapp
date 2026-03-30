import { useState } from 'react';
import type { OnboardingData } from '@/pages/client/ClientOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, X, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  data: OnboardingData;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  blogId: string;
}

export function StepAudience({ data, onUpdate, onNext, onBack, blogId }: Props) {
  const [conceptInput, setConceptInput] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const addConcept = (concept: string) => {
    const trimmed = concept.trim();
    if (trimmed && !data.concepts.includes(trimmed)) {
      onUpdate({ concepts: [...data.concepts, trimmed] });
    }
    setConceptInput('');
  };

  const removeConcept = (concept: string) => {
    onUpdate({ concepts: data.concepts.filter(c => c !== concept) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addConcept(conceptInput);
    }
  };

  const generateSuggestions = async () => {
    if (!data.companyDescription) return;
    setLoadingSuggestions(true);
    try {
      const { data: result } = await supabase.functions.invoke('suggest-niche-keywords', {
        body: { blogId },
      });
      if (result?.keywords) {
        const newConcepts = result.keywords
          .map((k: { keyword: string }) => k.keyword)
          .filter((k: string) => !data.concepts.includes(k))
          .slice(0, 8);
        onUpdate({ concepts: [...data.concepts, ...newConcepts] });
      }
    } catch (e) {
      console.error('Suggestion error:', e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const canContinue = data.targetAudience.trim().length >= 3 && data.concepts.length >= 1;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="lg:hidden text-center mb-6">
        <h2 className="text-2xl font-bold">
          Quem é o seu <span className="text-primary">público-alvo?</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Vamos usar isto para construir o seu funil de conteúdo!
        </p>
      </div>

      {/* Target audience */}
      <div className="space-y-2">
        <Label>Meu cliente ideal é um...</Label>
        <Input
          value={data.targetAudience}
          onChange={e => onUpdate({ targetAudience: e.target.value })}
          placeholder="Famílias jovens proprietárias de casas"
        />
      </div>

      {/* Concepts / Keywords */}
      <div className="space-y-3">
        <Label>Conceitos que precisa entender</Label>
        <div className="flex flex-wrap gap-2">
          {data.concepts.map(concept => (
            <Badge
              key={concept}
              variant="secondary"
              className="gap-1 pl-3 pr-1 py-1.5 text-sm bg-primary/10 text-primary border-primary/20"
            >
              {concept}
              <button
                onClick={() => removeConcept(concept)}
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          value={conceptInput}
          onChange={e => setConceptInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite um conceito..."
        />
      </div>

      {/* Generate suggestions */}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={generateSuggestions}
        disabled={loadingSuggestions}
      >
        {loadingSuggestions ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Gerar mais sugestões
      </Button>

      <Button onClick={onNext} disabled={!canContinue} className="w-full gap-2">
        O público faz sentido, podemos continuar <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Ao continuar, você ganhará <span className="text-primary font-medium">+1 artigo bônus</span>
      </p>
    </div>
  );
}
