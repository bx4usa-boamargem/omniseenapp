import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DollarSign, Save, Loader2, CheckCircle2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ValuePerLeadSettingsProps {
  blogId: string;
  currency?: 'BRL' | 'USD';
}

export function ValuePerLeadSettings({ blogId, currency = 'BRL' }: ValuePerLeadSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [valuePerVisibility, setValuePerVisibility] = useState<number>(5.00);
  const [valuePerIntent, setValuePerIntent] = useState<number>(50.00);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!blogId) return;
      
      setLoading(true);
      try {
        const { data } = await supabase
          .from('business_profile')
          .select('value_per_visibility, value_per_intent')
          .eq('blog_id', blogId)
          .maybeSingle();

        if (data) {
          if (data.value_per_visibility !== null) {
            setValuePerVisibility(Number(data.value_per_visibility));
          }
          if (data.value_per_intent !== null) {
            setValuePerIntent(Number(data.value_per_intent));
          }
        }
      } catch (error) {
        console.error('Error fetching value settings:', error);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [blogId]);

  const handleSave = async () => {
    if (!blogId) return;
    
    setSaving(true);
    setSaved(false);

    try {
      const { error } = await supabase
        .from('business_profile')
        .update({
          value_per_visibility: valuePerVisibility,
          value_per_intent: valuePerIntent
        })
        .eq('blog_id', blogId);

      if (error) throw error;

      setSaved(true);
      toast.success('Valores salvos!', {
        description: 'O ROI será recalculado com os novos valores.',
      });

      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving values:', error);
      toast.error('Erro ao salvar valores');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Configuração de Valor por Conversão
        </CardTitle>
        <CardDescription>
          Defina o valor comercial de cada tipo de conversão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Value per Visibility */}
          <div className="space-y-2">
            <Label htmlFor="valuePerVisibility" className="flex items-center gap-2">
              Valor por Visibilidade Qualificada
              <span className="text-xs text-muted-foreground">(≥60% de leitura)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {currency === 'BRL' ? 'R$' : '$'}
              </span>
              <Input
                id="valuePerVisibility"
                type="number"
                min="0"
                step="0.50"
                value={valuePerVisibility}
                onChange={(e) => setValuePerVisibility(Number(e.target.value))}
                className="pl-10 font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cada pessoa que leu seu conteúdo de forma qualificada
            </p>
          </div>

          {/* Value per Intent */}
          <div className="space-y-2">
            <Label htmlFor="valuePerIntent" className="flex items-center gap-2">
              Valor por Intenção Comercial
              <span className="text-xs text-muted-foreground">(clique no CTA)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {currency === 'BRL' ? 'R$' : '$'}
              </span>
              <Input
                id="valuePerIntent"
                type="number"
                min="0"
                step="1"
                value={valuePerIntent}
                onChange={(e) => setValuePerIntent(Number(e.target.value))}
                className="pl-10 font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cada pessoa que demonstrou interesse em falar com você
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-300">
                Como definir esses valores?
              </p>
              <ul className="text-muted-foreground mt-1 space-y-1">
                <li>• <strong>Visibilidade:</strong> Valor de branding por pessoa alcançada (ex: {currency === 'BRL' ? 'R$ 2-10' : '$1-5'})</li>
                <li>• <strong>Intenção:</strong> Valor de um lead qualificado no seu negócio (ex: {currency === 'BRL' ? 'R$ 20-100' : '$10-50'})</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="gap-2"
            variant={saved ? "outline" : "default"}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Valores
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
