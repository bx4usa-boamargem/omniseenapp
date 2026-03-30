import { useState } from 'react';
import type { OnboardingData } from '@/pages/client/ClientOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Globe, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  data: OnboardingData;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  blogId: string;
}

export function StepCompany({ data, onUpdate, onNext, onBack, blogId }: Props) {
  const [loadingScrape, setLoadingScrape] = useState(false);

  const handleScrapeUrl = async () => {
    if (!data.siteUrl) return;
    setLoadingScrape(true);
    try {
      const { data: result } = await supabase.functions.invoke('scrape-website', {
        body: { url: data.siteUrl, blogId },
      });
      if (result?.company_name) {
        onUpdate({
          companyName: result.company_name || data.companyName,
          companyDescription: result.description || data.companyDescription,
        });
      }
    } catch (e) {
      console.error('Scrape error:', e);
    } finally {
      setLoadingScrape(false);
    }
  };

  const canContinue = data.companyName.trim().length >= 2 && data.companyDescription.trim().length >= 10;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="lg:hidden text-center mb-6">
        <h2 className="text-2xl font-bold">
          Conta para nós da sua <span className="text-primary">empresa!</span>
        </h2>
      </div>

      {/* Has site or not */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onUpdate({ hasSite: true })}
          className={`p-4 rounded-xl border-2 text-center transition-all ${
            data.hasSite ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <Globe className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p className="font-medium text-sm">Já temos um site</p>
          <p className="text-xs text-muted-foreground mt-1">Com ou sem blog, já temos o nosso lugar na internet!</p>
        </button>
        <button
          onClick={() => onUpdate({ hasSite: false, siteUrl: '' })}
          className={`p-4 rounded-xl border-2 text-center transition-all ${
            !data.hasSite ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="h-8 w-8 mx-auto mb-2 text-2xl">🚀</div>
          <p className="font-medium text-sm">Ainda não temos um site</p>
          <p className="text-xs text-muted-foreground mt-1">Estamos chegando na internet agora!</p>
        </button>
      </div>

      {/* Company name */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Nome da empresa</Label>
          {data.hasSite && data.siteUrl && (
            <button
              onClick={handleScrapeUrl}
              disabled={loadingScrape}
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              {loadingScrape ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Ler outro site
            </button>
          )}
        </div>
        <Input
          value={data.companyName}
          onChange={e => onUpdate({ companyName: e.target.value })}
          placeholder="Nome da sua empresa"
        />
      </div>

      {/* Site URL if has site */}
      {data.hasSite && (
        <div className="space-y-2">
          <Label>URL do site</Label>
          <div className="flex gap-2">
            <Input
              value={data.siteUrl}
              onChange={e => onUpdate({ siteUrl: e.target.value })}
              placeholder="https://seusite.com.br"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleScrapeUrl}
              disabled={loadingScrape || !data.siteUrl}
            >
              {loadingScrape ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analisar'}
            </Button>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label>Descrição da empresa</Label>
        <Textarea
          value={data.companyDescription}
          onChange={e => onUpdate({ companyDescription: e.target.value })}
          placeholder="Descreva o que sua empresa faz, quais serviços oferece, qual seu diferencial..."
          rows={6}
        />
      </div>

      <Button onClick={onNext} disabled={!canContinue} className="w-full gap-2">
        A descrição faz sentido, podemos continuar <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Ao continuar, você ganhará <span className="text-primary font-medium">+1 artigo bônus</span>
      </p>
    </div>
  );
}
