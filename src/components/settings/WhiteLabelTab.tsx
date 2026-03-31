import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Paintbrush, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function WhiteLabelTab() {
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    customLogo: '',
    customDomain: '',
    primaryColor: '#6366f1',
    accentColor: '#8b5cf6',
    companyName: '',
    hidePoweredBy: false,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Persist white label config
      toast.success('Configurações white label salvas!');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Paintbrush className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>White Label</CardTitle>
              <CardDescription>
                Personalize a plataforma com a identidade da sua marca
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome da empresa</Label>
              <Input
                value={config.companyName}
                onChange={e => setConfig(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Sua empresa"
                className="bg-background/60"
              />
            </div>
            <div className="space-y-2">
              <Label>Domínio personalizado</Label>
              <Input
                value={config.customDomain}
                onChange={e => setConfig(prev => ({ ...prev, customDomain: e.target.value }))}
                placeholder="app.suaempresa.com"
                className="bg-background/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>URL do logo</Label>
            <Input
              value={config.customLogo}
              onChange={e => setConfig(prev => ({ ...prev, customLogo: e.target.value }))}
              placeholder="https://..."
              className="bg-background/60"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cor primária</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={e => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="h-10 w-10 rounded-lg border border-border/40 cursor-pointer bg-transparent"
                />
                <Input
                  value={config.primaryColor}
                  onChange={e => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="flex-1 bg-background/60 font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor de destaque</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={e => setConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="h-10 w-10 rounded-lg border border-border/40 cursor-pointer bg-transparent"
                />
                <Input
                  value={config.accentColor}
                  onChange={e => setConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="flex-1 bg-background/60 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-border/30 bg-muted/20">
            <div>
              <Label htmlFor="hide-powered" className="cursor-pointer">Ocultar "Powered by Omniseen"</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Remove a marca Omniseen do rodapé do blog</p>
            </div>
            <Switch
              id="hide-powered"
              checked={config.hidePoweredBy}
              onCheckedChange={checked => setConfig(prev => ({ ...prev, hidePoweredBy: checked }))}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
