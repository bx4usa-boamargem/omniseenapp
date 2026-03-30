import { useState, useEffect } from 'react';
import type { OnboardingData } from '@/pages/client/ClientOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Trash2, Plus, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  data: OnboardingData;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  blogId: string;
}

export function StepCompetitors({ data, onUpdate, onNext, onBack, blogId }: Props) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Auto-suggest competitors on mount if empty
  useEffect(() => {
    if (data.competitors.length === 0 && data.companyDescription) {
      suggestCompetitors();
    }
  }, []);

  const suggestCompetitors = async () => {
    setLoading(true);
    try {
      const { data: result } = await supabase.functions.invoke('suggest-themes', {
        body: {
          niche: data.concepts[0] || data.companyName,
          keywords: data.concepts.slice(0, 3),
          existingTitles: [],
          count: 3,
          blog_id: blogId,
        },
      });
      // Create mock competitor suggestions from themes
      if (result?.themes) {
        const suggestions = result.themes.slice(0, 5).map((t: any, i: number) => ({
          name: t.targetAudience || `Concorrente ${i + 1}`,
          url: '',
          description: t.hook || '',
          isSuggestion: true,
        }));
        onUpdate({ competitors: [...data.competitors, ...suggestions] });
      }
    } catch (e) {
      console.error('Competitor suggestion error:', e);
    } finally {
      setLoading(false);
    }
  };

  const addCompetitor = () => {
    if (!newName.trim()) return;
    onUpdate({
      competitors: [
        ...data.competitors,
        { name: newName.trim(), url: newUrl.trim(), description: '', isSuggestion: false },
      ],
    });
    setNewName('');
    setNewUrl('');
  };

  const removeCompetitor = (index: number) => {
    onUpdate({
      competitors: data.competitors.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="lg:hidden text-center mb-6">
        <h2 className="text-2xl font-bold">
          Quais os sites dos seus <span className="text-primary">concorrentes?</span>
        </h2>
      </div>

      {/* Competitor list */}
      <div className="space-y-3">
        {data.competitors.map((comp, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-xl border">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{comp.name}</span>
                {comp.url && (
                  <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {comp.isSuggestion && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    <Sparkles className="h-3 w-3 mr-1" /> Sugestão
                  </Badge>
                )}
              </div>
              {comp.url && <p className="text-xs text-muted-foreground truncate">{comp.url}</p>}
              {comp.description && <p className="text-xs text-muted-foreground mt-1">{comp.description}</p>}
            </div>
            <button onClick={() => removeCompetitor(i)} className="text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add competitor */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome do concorrente"
          className="flex-1"
        />
        <Input
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          placeholder="site.com.br"
          className="flex-1"
        />
        <Button variant="outline" size="icon" onClick={addCompetitor} disabled={!newName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Button onClick={onNext} className="w-full gap-2">
        Os concorrentes fazem sentido, podemos continuar <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Ao continuar, você ganhará <span className="text-primary font-medium">+1 artigo bônus</span>
      </p>
    </div>
  );
}
