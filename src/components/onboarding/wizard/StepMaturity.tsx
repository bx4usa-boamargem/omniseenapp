import type { OnboardingData } from '@/pages/client/ClientOnboarding';
import { ArrowRight } from 'lucide-react';

interface Props {
  data: OnboardingData;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
}

const options = [
  {
    value: 'beginner' as const,
    label: 'Sou iniciante',
    badge: 'Recomendado',
    description: 'Nunca usei um blog, ou até já usei, mas não sei muito bem como construir uma estratégia para gerar cliques no Google. Prefiro que façam escolhas por mim.',
    icon: '📝',
  },
  {
    value: 'experienced' as const,
    label: 'Tenho experiência',
    description: 'Já usei um blog e tenho interesse em revisar e customizar a minha estratégia de SEO. Indicado para profissionais e agências de marketing.',
    icon: '📊',
  },
];

export function StepMaturity({ data, onUpdate, onNext }: Props) {
  const handleSelect = (value: 'beginner' | 'experienced') => {
    onUpdate({ maturity: value });
    // Auto-advance after selection
    setTimeout(onNext, 300);
  };

  return (
    <div className="space-y-6">
      <div className="lg:hidden text-center mb-8">
        <h2 className="text-2xl font-bold">
          Quanto a blog, qual a sua <span className="text-primary">maturidade?</span>
        </h2>
        <p className="text-muted-foreground mt-2">
          Quanto menos conhecimento, mais vamos fazer escolhas automaticamente por você!
        </p>
      </div>

      <div className="space-y-4">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all hover:border-primary hover:shadow-md ${
              data.maturity === opt.value
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border'
            }`}
          >
            <span className="text-3xl mt-1">{opt.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">{opt.label}</span>
                {opt.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                    {opt.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
