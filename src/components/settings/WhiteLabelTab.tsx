import { useState, useEffect } from 'react';
import { Palette, Image, Mail, Eye, EyeOff, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';

interface WhiteLabelConfig {
  is_enabled: boolean;
  custom_brand_name: string;
  custom_logo_url: string;
  custom_favicon_url: string;
  custom_primary_color: string;
  custom_support_email: string;
  hide_powered_by: boolean;
  report_logo_url: string;
  report_company_name: string;
  wordpress_plugin_branding: boolean;
}

const defaultConfig: WhiteLabelConfig = {
  is_enabled: false,
  custom_brand_name: '',
  custom_logo_url: '',
  custom_favicon_url: '',
  custom_primary_color: '#6366f1',
  custom_support_email: '',
  hide_powered_by: false,
  report_logo_url: '',
  report_company_name: '',
  wordpress_plugin_branding: false,
};

export function WhiteLabelTab() {
  const { currentTenant } = useTenantContext();
  const [config, setConfig] = useState<WhiteLabelConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentTenant?.id) {
      fetchConfig();
    }
  }, [currentTenant?.id]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('white_label_settings')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (!error && data) {
        setConfig({
          is_enabled: data.is_enabled ?? false,
          custom_brand_name: data.custom_brand_name ?? '',
          custom_logo_url: data.custom_logo_url ?? '',
          custom_favicon_url: data.custom_favicon_url ?? '',
          custom_primary_color: data.custom_primary_color ?? '#6366f1',
          custom_support_email: data.custom_support_email ?? '',
          hide_powered_by: data.hide_powered_by ?? false,
          report_logo_url: data.report_logo_url ?? '',
          report_company_name: data.report_company_name ?? '',
          wordpress_plugin_branding: data.wordpress_plugin_branding ?? false,
        });
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('white_label_settings')
        .upsert({
          tenant_id: currentTenant.id,
          ...config,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' });

      if (error) throw error;
      toast.success('Configurações salvas com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">White-Label</h3>
        <p className="text-sm text-muted-foreground">
          Personalize a plataforma com a marca da sua agência para seus clientes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Ativar White-Label
            </span>
            <Switch
              checked={config.is_enabled}
              onCheckedChange={(checked) => setConfig({ ...config, is_enabled: checked })}
            />
          </CardTitle>
          <CardDescription>
            Quando ativo, remove toda menção à Omniseen e usa sua marca.
          </CardDescription>
        </CardHeader>
      </Card>

      {config.is_enabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Identidade Visual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da Marca</Label>
                  <Input
                    value={config.custom_brand_name}
                    onChange={(e) => setConfig({ ...config, custom_brand_name: e.target.value })}
                    placeholder="Nome da sua agência"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor Principal</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.custom_primary_color}
                      onChange={(e) => setConfig({ ...config, custom_primary_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={config.custom_primary_color}
                      onChange={(e) => setConfig({ ...config, custom_primary_color: e.target.value })}
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>URL do Logo</Label>
                  <Input
                    value={config.custom_logo_url}
                    onChange={(e) => setConfig({ ...config, custom_logo_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL do Favicon</Label>
                  <Input
                    value={config.custom_favicon_url}
                    onChange={(e) => setConfig({ ...config, custom_favicon_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Relatórios e Comunicações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo nos Relatórios</Label>
                  <Input
                    value={config.report_logo_url}
                    onChange={(e) => setConfig({ ...config, report_logo_url: e.target.value })}
                    placeholder="URL do logo para relatórios"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Empresa nos Relatórios</Label>
                  <Input
                    value={config.report_company_name}
                    onChange={(e) => setConfig({ ...config, report_company_name: e.target.value })}
                    placeholder="Nome exibido nos relatórios"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email de Suporte</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={config.custom_support_email}
                    onChange={(e) => setConfig({ ...config, custom_support_email: e.target.value })}
                    placeholder="suporte@suaagencia.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <EyeOff className="h-5 w-5" />
                Opções Avançadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Ocultar "Powered by Omniseen"</p>
                  <p className="text-sm text-muted-foreground">Remove o rodapé de créditos nos blogs.</p>
                </div>
                <Switch
                  checked={config.hide_powered_by}
                  onCheckedChange={(checked) => setConfig({ ...config, hide_powered_by: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Plugin WordPress sem marca</p>
                  <p className="text-sm text-muted-foreground">Plugin discreto sem menção à Omniseen para clientes.</p>
                </div>
                <Switch
                  checked={config.wordpress_plugin_branding}
                  onCheckedChange={(checked) => setConfig({ ...config, wordpress_plugin_branding: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
