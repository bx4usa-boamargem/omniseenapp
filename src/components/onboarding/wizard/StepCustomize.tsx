import type { OnboardingData } from '@/pages/client/ClientOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface Props {
  data: OnboardingData;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onFinish: () => void;
  onBack: () => void;
  isLoading: boolean;
  blogSlug: string;
}

const COLOR_PRESETS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
];

export function StepCustomize({ data, onUpdate, onFinish, onBack, isLoading, blogSlug }: Props) {
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="lg:hidden text-center mb-6">
        <h2 className="text-2xl font-bold">
          Deixe seu blog com <span className="text-primary">sua cara!</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Não se preocupe, você sempre poderá mudar estas opções!
        </p>
      </div>

      {/* Blog slug / link */}
      <div className="space-y-2">
        <Label className="font-semibold">Link do Blog</Label>
        <div className="flex items-center gap-2">
          <Input
            value={data.blogSlug}
            onChange={e => onUpdate({ blogSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            placeholder={blogSlug}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">.app.omniseen.app</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Quer conectar um domínio próprio? Ative a sua conta e vá em Meu Blog {'>'} Domínio.
        </p>
      </div>

      {/* Color */}
      <div className="space-y-3">
        <Label className="font-semibold">Paleta de Cores</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map(color => (
            <button
              key={color}
              onClick={() => onUpdate({ primaryColor: color })}
              className={`h-10 w-10 rounded-full border-2 transition-all ${
                data.primaryColor === color ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-primary' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Cor personalizada:</Label>
          <input
            type="color"
            value={data.primaryColor}
            onChange={e => onUpdate({ primaryColor: e.target.value })}
            className="h-8 w-16 cursor-pointer rounded border"
          />
        </div>
      </div>

      {/* Logo placeholder */}
      <div className="space-y-2">
        <Label className="font-semibold">Logo Horizontal (opcional)</Label>
        <div className="border-2 border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">
          <p>Recomendamos .svg</p>
          <p className="text-xs mt-1">Você poderá adicionar depois nas configurações do blog.</p>
        </div>
      </div>

      {/* Blog preview mock */}
      <div className="rounded-xl border overflow-hidden">
        <div className="p-3 text-xs text-center" style={{ backgroundColor: data.primaryColor, color: 'white' }}>
          <p className="font-medium">Este já é o seu blog 100% funcional! 💜</p>
        </div>
        <div className="p-4 bg-muted/30">
          <div className="rounded-lg bg-card border p-4 space-y-2">
            <p className="font-semibold" style={{ color: data.primaryColor }}>
              {data.companyName || 'Seu Blog'}
            </p>
            <div className="h-2 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted rounded w-1/2" />
            <div className="h-24 bg-muted rounded mt-3" />
          </div>
        </div>
      </div>

      <Button onClick={onFinish} disabled={isLoading} className="w-full gap-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando seu blog...
          </>
        ) : (
          'Concluir onboarding →'
        )}
      </Button>
    </div>
  );
}
