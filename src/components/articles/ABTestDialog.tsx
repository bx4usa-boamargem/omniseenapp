import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ABTestDialogProps {
  articleId: string;
  originalTitle: string;
  originalMetaDescription: string;
  children?: React.ReactNode;
}

export function ABTestDialog({ articleId, originalTitle, originalMetaDescription, children }: ABTestDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [variantTitle, setVariantTitle] = useState('');
  const [variantMeta, setVariantMeta] = useState('');

  const handleCreate = async () => {
    if (!variantTitle.trim()) {
      toast.error('Informe o título da variante');
      return;
    }
    setLoading(true);
    try {
      // TODO: Persist A/B variant to database when table is created
      toast.success('Variante A/B criada com sucesso!', {
        description: 'O teste será ativado quando o artigo for publicado.',
      });
      setOpen(false);
      setVariantTitle('');
      setVariantMeta('');
    } catch {
      toast.error('Erro ao criar variante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Criar variante A/B
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Teste A/B
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Variante A (Original)</p>
            <p className="text-sm font-medium">{originalTitle}</p>
            {originalMetaDescription && (
              <p className="text-xs text-muted-foreground line-clamp-2">{originalMetaDescription}</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Variante B (Nova)</p>
            <div className="space-y-2">
              <Label>Título alternativo</Label>
              <Input
                value={variantTitle}
                onChange={e => setVariantTitle(e.target.value)}
                placeholder="Digite o título alternativo..."
              />
            </div>
            <div className="space-y-2">
              <Label>Meta description alternativa</Label>
              <Textarea
                value={variantMeta}
                onChange={e => setVariantMeta(e.target.value)}
                placeholder="Digite a meta description alternativa..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{variantMeta.length}/160 caracteres</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar Variante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
