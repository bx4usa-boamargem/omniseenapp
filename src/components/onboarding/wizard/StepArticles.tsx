import { useState, useEffect } from 'react';
import type { OnboardingData } from '@/pages/client/ClientOnboarding';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Trash2, Search, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  data: OnboardingData;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  blogId: string;
}

export function StepArticles({ data, onUpdate, onNext, onBack, blogId }: Props) {
  const [loading, setLoading] = useState(false);

  // Auto-generate articles on mount if empty
  useEffect(() => {
    if (data.suggestedArticles.length === 0) {
      generateArticles();
    }
  }, []);

  const generateArticles = async () => {
    setLoading(true);
    try {
      const { data: result } = await supabase.functions.invoke('suggest-themes', {
        body: {
          niche: data.companyDescription?.substring(0, 200) || data.companyName,
          keywords: data.concepts.slice(0, 5),
          existingTitles: data.suggestedArticles.map(a => a.title),
          count: 5,
          blog_id: blogId,
        },
      });

      if (result?.themes) {
        const articles = result.themes.map((t: any) => ({
          title: t.title,
          keyword: t.keywords?.[0] || '',
          searchVolume: t.estimatedSearchVolume === 'alto' ? 74000 : t.estimatedSearchVolume === 'médio' ? 12000 : 1200,
          trafficValue: t.estimatedSearchVolume === 'alto' ? 'R$16.068/mês' : t.estimatedSearchVolume === 'médio' ? 'R$1.314/mês' : 'R$200/mês',
          selected: true,
        }));
        onUpdate({ suggestedArticles: articles });
      }
    } catch (e) {
      console.error('Article suggestion error:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleArticle = (index: number) => {
    const updated = [...data.suggestedArticles];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    onUpdate({ suggestedArticles: updated });
  };

  const removeArticle = (index: number) => {
    onUpdate({ suggestedArticles: data.suggestedArticles.filter((_, i) => i !== index) });
  };

  const selectedCount = data.suggestedArticles.filter(a => a.selected).length;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="lg:hidden text-center mb-6">
        <h2 className="text-2xl font-bold">
          Encontramos os melhores <span className="text-primary">artigos!</span>
        </h2>
      </div>

      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm text-primary">Você desbloqueou a nossa análise avançada!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Analisamos dezenas de palavras-chave, pesquisamos centenas de concorrentes e trouxemos os melhores artigos para você, incluindo o valor em tráfego que irá economizar.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando os melhores artigos para você...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.suggestedArticles.map((article, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                article.selected ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'
              }`}
              onClick={() => toggleArticle(i)}
            >
              <div className="mt-1">
                {article.selected ? (
                  <Sparkles className="h-5 w-5 text-primary" />
                ) : (
                  <Search className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{article.title}</p>
                {article.keyword && (
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Search className="h-3 w-3" /> {article.keyword}
                    </span>
                    {article.searchVolume && (
                      <span>📊 {article.searchVolume.toLocaleString()} buscas por mês</span>
                    )}
                    {article.trafficValue && (
                      <span className="text-green-600">💰 {article.trafficValue} em tráfego</span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); removeArticle(i); }}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        Não gostou? Altere os títulos ou apague e <button onClick={generateArticles} className="text-primary hover:underline font-medium">receba outra sugestão :)</button>
      </p>

      <Button onClick={onNext} disabled={selectedCount === 0} className="w-full gap-2">
        Iniciar geração dos artigos ({selectedCount}) <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
