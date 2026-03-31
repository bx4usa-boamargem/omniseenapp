import { useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ABTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string;
  blogId: string;
  currentTitle: string;
  currentMetaDescription: string;
}

export function ABTestDialog({
  open,
  onOpenChange,
  articleId,
  blogId,
  currentTitle,
  currentMetaDescription,
}: ABTestDialogProps) {
  const [testType, setTestType] = useState<'title' | 'meta_description'>('title');
  const [variantB, setVariantB] = useState('');
  const [creating, setCreating] = useState(false);

  const variantA = testType === 'title' ? currentTitle : currentMetaDescription;

  const handleCreate = async () => {
    if (!variantB.trim()) {
      toast.error('Digite a variante B');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('ab_tests').insert({
        blog_id: blogId,
        article_id: articleId,
        test_type: testType,
        variant_a: variantA,
        variant_b: variantB.trim(),
        is_active: true,
      });

      if (error) throw error;
      toast.success('Teste A/B criado! As variantes serão alternadas automaticamente.');
      onOpenChange(false);
      setVariantB('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar teste');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Criar Teste A/B
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>O que testar</Label>
            <Select value={testType} onValueChange={(v) => setTestType(v as 'title' | 'meta_description')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Título</SelectItem>
                <SelectItem value="meta_description">Meta Description</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Variante A (atual)</Label>
            <Input value={variantA} readOnly className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Variante B (alternativa)</Label>
            <Input
              value={variantB}
              onChange={(e) => setVariantB(e.target.value)}
              placeholder={testType === 'title' ? 'Título alternativo...' : 'Meta description alternativa...'}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            O sistema alternará entre as variantes e medirá impressões e cliques via Google Search Console para determinar a vencedora automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Iniciar Teste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
