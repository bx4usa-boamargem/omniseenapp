import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ArticleSizeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: (targetWords: number) => void;
  loading?: boolean;
}

const SIZES = [
  {
    id: 'quick',
    label: '⚡ Rápido',
    description: '400 a 1.000 palavras — ideal para ideias rápidas',
    targetWords: 700,
  },
  {
    id: 'deep',
    label: '🧠 Profundo',
    description: '1.500 a 3.000 palavras — SEO completo',
    targetWords: 2500,
    recommended: true,
  },
];

export function ArticleSizeModal({ open, onOpenChange, title, onConfirm, loading }: ArticleSizeModalProps) {
  const [selected, setSelected] = useState('deep');

  const handleConfirm = () => {
    const size = SIZES.find(s => s.id === selected);
    onConfirm(size?.targetWords || 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/40 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Selecione o tamanho do artigo</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            <span className="font-medium text-foreground">Título:</span> {title}
          </p>

          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-3">
            {SIZES.map(size => (
              <div
                key={size.id}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  selected === size.id
                    ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                    : 'border-border/40 hover:border-muted-foreground/30 bg-muted/10'
                }`}
                onClick={() => setSelected(size.id)}
              >
                <RadioGroupItem value={size.id} id={size.id} className="mt-0.5" />
                <Label htmlFor={size.id} className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{size.label}</span>
                    {size.recommended && (
                      <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{size.description}</p>
                </Label>
              </div>
            ))}
          </RadioGroup>
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
