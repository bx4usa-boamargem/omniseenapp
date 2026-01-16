import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Zap, TrendingUp, Target, Loader2, Info, Radar } from "lucide-react";

interface FunnelAutopilotSettingsProps {
  blogId: string;
}

interface AutopilotConfig {
  funnel_autopilot: boolean;
  autopilot_top: number;
  autopilot_middle: number;
  autopilot_bottom: number;
  auto_publish_enabled: boolean;
  publish_delay_hours: number;
  quality_gate_enabled: boolean;
}

export function FunnelAutopilotSettings({ blogId }: FunnelAutopilotSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AutopilotConfig>({
    funnel_autopilot: false,
    autopilot_top: 1,
    autopilot_middle: 1,
    autopilot_bottom: 1,
    auto_publish_enabled: true,
    publish_delay_hours: 24,
    quality_gate_enabled: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (blogId) {
      fetchConfig();
    }
  }, [blogId]);

  async function fetchConfig() {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("blog_automation")
      .select("funnel_autopilot, autopilot_top, autopilot_middle, autopilot_bottom, auto_publish_enabled, publish_delay_hours, quality_gate_enabled")
      .eq("blog_id", blogId)
      .maybeSingle();

    if (data) {
      setConfig({
        funnel_autopilot: data.funnel_autopilot || false,
        autopilot_top: data.autopilot_top || 1,
        autopilot_middle: data.autopilot_middle || 1,
        autopilot_bottom: data.autopilot_bottom || 1,
      });
    }
    
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    
    const { error } = await supabase
      .from("blog_automation")
      .upsert({
        blog_id: blogId,
        funnel_autopilot: config.funnel_autopilot,
        autopilot_top: config.autopilot_top,
        autopilot_middle: config.autopilot_middle,
        autopilot_bottom: config.autopilot_bottom,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'blog_id' });

    if (error) {
      console.error("Error saving autopilot config:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } else {
      toast({
        title: "Configurações salvas",
        description: config.funnel_autopilot 
          ? "O piloto automático está ativo e converterá oportunidades diariamente."
          : "O piloto automático foi desativado.",
      });
    }
    
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalDaily = config.autopilot_top + config.autopilot_middle + config.autopilot_bottom;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Piloto Automático de Funil
        </CardTitle>
        <CardDescription>
          Converta automaticamente oportunidades do Radar em artigos todos os dias
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle principal */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="autopilot-toggle" className="font-medium">
              Ativar conversão automática diária
            </Label>
            <p className="text-xs text-muted-foreground">
              O sistema converterá oportunidades do Radar em artigos automaticamente
            </p>
          </div>
          <Switch
            id="autopilot-toggle"
            checked={config.funnel_autopilot}
            onCheckedChange={(checked) => setConfig({ ...config, funnel_autopilot: checked })}
          />
        </div>

        {config.funnel_autopilot && (
          <>
            {/* Configuração por estágio */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-sm font-medium">
                Converter automaticamente por dia:
              </Label>
              
              <div className="grid gap-4">
                {/* Topo */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border-l-4 border-l-orange-500">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Topo do Funil</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      value={config.autopilot_top}
                      onChange={(e) => setConfig({ ...config, autopilot_top: parseInt(e.target.value) || 0 })}
                      className="w-16 h-8"
                    />
                    <span className="text-xs text-muted-foreground">oportunidades</span>
                  </div>
                </div>

                {/* Meio */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border-l-4 border-l-purple-500">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Meio do Funil</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      value={config.autopilot_middle}
                      onChange={(e) => setConfig({ ...config, autopilot_middle: parseInt(e.target.value) || 0 })}
                      className="w-16 h-8"
                    />
                    <span className="text-xs text-muted-foreground">oportunidades</span>
                  </div>
                </div>

                {/* Fundo */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border-l-4 border-l-green-500">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Fundo do Funil</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      value={config.autopilot_bottom}
                      onChange={(e) => setConfig({ ...config, autopilot_bottom: parseInt(e.target.value) || 0 })}
                      className="w-16 h-8"
                    />
                    <span className="text-xs text-muted-foreground">oportunidades</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info alert */}
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>{totalDaily} artigo{totalDaily !== 1 ? 's' : ''}/dia</strong> será{totalDaily !== 1 ? 'ão' : ''} criado{totalDaily !== 1 ? 's' : ''} automaticamente como <strong>rascunho</strong>.
                <span className="block mt-1 text-xs opacity-80">
                  Você receberá uma notificação para revisar antes de publicar.
                </span>
              </AlertDescription>
            </Alert>

            {/* Fonte info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Radar className="h-3 w-3" />
              <span>As oportunidades são geradas pelo Radar de Mercado (Perplexity/AI)</span>
            </div>
          </>
        )}

        {/* Save button */}
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Configurações"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
