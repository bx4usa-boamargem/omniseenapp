import type { OnboardingData } from '@/pages/client/ClientOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, ExternalLink, MessageCircle } from 'lucide-react';

interface Props {
  data: OnboardingData;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBlogSetup({ data, onUpdate, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="lg:hidden text-center mb-6">
        <h2 className="text-2xl font-bold">
          {data.companyName || 'Olá'}, criamos o seu <span className="text-primary">blog!</span>
        </h2>
      </div>

      {/* Blog created announcement */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <span className="text-lg">✨</span>
          <div>
            <p className="font-medium text-sm text-primary">Você ganhou um blog profissional de graça!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Isso que você está vendo ao lado já é o seu blog profissional no ar... legal, né? 
              Otimizamos ele para aparecer no Google, com todas as configurações necessárias.
            </p>
          </div>
        </div>
      </div>

      {/* CTA type */}
      <div className="space-y-3">
        <Label className="font-semibold">Qual será a finalidade dele?</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onUpdate({ ctaType: 'link' })}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              data.ctaType === 'link' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <ExternalLink className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="font-medium text-sm">Enviar os leitores para um link</p>
          </button>
          <button
            onClick={() => onUpdate({ ctaType: 'whatsapp' })}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              data.ctaType === 'whatsapp' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <MessageCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="font-medium text-sm">Chamar a gente no WhatsApp</p>
          </button>
        </div>
      </div>

      {/* CTA text */}
      <div className="space-y-2">
        <Label>Texto do botão</Label>
        <Input
          value={data.ctaText}
          onChange={e => onUpdate({ ctaText: e.target.value })}
          placeholder={data.ctaType === 'whatsapp' ? 'Fale conosco' : 'Saiba mais'}
        />
      </div>

      {/* CTA URL */}
      <div className="space-y-2">
        <Label>{data.ctaType === 'whatsapp' ? 'Número do WhatsApp' : 'Link do botão'}</Label>
        <Input
          value={data.ctaUrl}
          onChange={e => onUpdate({ ctaUrl: e.target.value })}
          placeholder={data.ctaType === 'whatsapp' ? '+55 11 99999-9999' : 'https://seusite.com.br'}
        />
      </div>

      <Button onClick={onNext} className="w-full gap-2">
        Continuar <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
