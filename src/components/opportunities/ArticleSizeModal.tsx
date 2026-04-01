import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Zap, Crown } from 'lucide-react';

interface ArticleSizeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: (targetWords: number, articleType: 'normal' | 'premium') => void;
  loading?: boolean;
}

const TYPES = [
  {
    id: 'normal' as const,
    label: '⚡ Artigo Normal',
    description: 'Conteúdo direto, Answer-First e focado na conversão rápida. (1.000–1.300 palavras)',
    icon: <Zap className="h-5 w-5" />,
    targetWords: 1200,
  },
  {
    id: 'premium' as const,
    label: '👑 Artigo Premium',
    description: 'Alta autoridade, rico em dados, frameworks e otimizado para Citação de IA. (1.800–2.600 palavras)',
    icon: <Crown className="h-5 w-5" />,
    targetWords: 2500,
    recommended: true,
  },
];

export function ArticleSizeModal({ open, onOpenChange, title, onConfirm, loading }: ArticleSizeModalProps) {
  const [selected, setSelected] = useState<'normal' | 'premium'>('premium');

  const handleConfirm = () => {
    const type = TYPES.find(t => t.id === selected)!;
    onConfirm(type.targetWords, selected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/40 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Selecione o tipo do artigo</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            <span className="font-medium text-foreground">Título:</span> {title}
          </p>

          <div className="space-y-3">
            {TYPES.map(type => (
              <div
                key={type.id}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selected === type.id
                    ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                    : 'border-border/40 hover:border-muted-foreground/30 bg-muted/10'
                }`}
                onClick={() => setSelected(type.id)}
              >
                <div className={`p-2 rounded-lg mt-0.5 ${
                  selected === type.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {type.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.label}</span>
                    {type.recommended && (
                      <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Gerar Artigo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
