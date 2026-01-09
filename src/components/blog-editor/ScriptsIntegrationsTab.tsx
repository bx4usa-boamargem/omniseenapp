import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Code, 
  ExternalLink, 
  CheckCircle2, 
  XCircle,
  BarChart3,
  Target,
  Facebook,
  Chrome
} from "lucide-react";
import { useGSCConnection } from "@/hooks/useGSCConnection";
import { SectionHelper } from "./SectionHelper";

interface TrackingConfig {
  ga_id?: string;
  gtm_id?: string;
  meta_pixel_id?: string;
  google_ads_id?: string;
}

interface ScriptsIntegrationsTabProps {
  blogId: string;
  scriptHead: string;
  scriptBody: string;
  scriptFooter: string;
  trackingConfig: TrackingConfig;
  onScriptHeadChange: (value: string) => void;
  onScriptBodyChange: (value: string) => void;
  onScriptFooterChange: (value: string) => void;
  onTrackingConfigChange: (config: TrackingConfig) => void;
}

export function ScriptsIntegrationsTab({
  blogId,
  scriptHead,
  scriptBody,
  scriptFooter,
  trackingConfig,
  onScriptHeadChange,
  onScriptBodyChange,
  onScriptFooterChange,
  onTrackingConfigChange,
}: ScriptsIntegrationsTabProps) {
  const { connection, isLoading, connect, disconnect } = useGSCConnection(blogId);
  const isConnected = !!connection;
  
  const updateTrackingField = (field: keyof TrackingConfig, value: string) => {
    onTrackingConfigChange({
      ...trackingConfig,
      [field]: value || undefined,
    });
  };

  return (
    <div className="space-y-8">
      {/* Manual Scripts Section */}
      <div className="space-y-4">
        <SectionHelper
          title="Scripts Manuais"
          description="Adicione códigos personalizados como pixels de rastreamento, widgets de chat ou scripts de terceiros que não estão nas integrações padrão."
          action="Cole o código HTML/JavaScript na área correspondente (head, body ou footer)."
          warning="Scripts mal configurados podem afetar o funcionamento ou a velocidade do seu blog. Insira apenas códigos de fontes confiáveis e testados."
        />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Script HTML no final da tag {"<head>"}</Label>
            <Textarea
              value={scriptHead}
              onChange={(e) => onScriptHeadChange(e.target.value)}
              placeholder="<!-- Cole seu script aqui -->"
              className="font-mono text-sm"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Script HTML no final da tag {"<body>"}</Label>
            <Textarea
              value={scriptBody}
              onChange={(e) => onScriptBodyChange(e.target.value)}
              placeholder="<!-- Cole seu script aqui -->"
              className="font-mono text-sm"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Script HTML do rodapé (white-label)</Label>
            <Textarea
              value={scriptFooter}
              onChange={(e) => onScriptFooterChange(e.target.value)}
              placeholder="<!-- Adicione HTML personalizado ao rodapé -->"
              className="font-mono text-sm"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Standard Integrations */}
      <div className="space-y-4">
        <SectionHelper
          title="Integrações Padrão"
          description="Configure rapidamente os principais serviços de rastreamento e análise sem precisar colar scripts manualmente. O sistema cuida da implementação técnica."
          action="Insira apenas o ID de cada serviço (não o script completo). Encontre esses IDs no painel de cada plataforma."
        />

        <div className="grid gap-4">
          {/* Google Search Console */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Chrome className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Google Search Console</CardTitle>
                    <CardDescription>Monitore o desempenho nas buscas</CardDescription>
                  </div>
                </div>
                {isConnected ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-muted">
                    <XCircle className="h-3 w-3 mr-1" />
                    Desconectado
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isConnected ? (
                <Button variant="outline" size="sm" onClick={disconnect} disabled={isLoading}>
                  Desconectar
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={connect} disabled={isLoading}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Conectar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Google Analytics */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Google Analytics 4</CardTitle>
                  <CardDescription>Analise o tráfego do seu blog</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={trackingConfig.ga_id || ""}
                  onChange={(e) => updateTrackingField("ga_id", e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="font-mono"
                />
              </div>
            </CardContent>
          </Card>

          {/* Google Tag Manager */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Code className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Google Tag Manager</CardTitle>
                  <CardDescription>Gerencie todas as suas tags em um só lugar</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                value={trackingConfig.gtm_id || ""}
                onChange={(e) => updateTrackingField("gtm_id", e.target.value)}
                placeholder="GTM-XXXXXXX"
                className="font-mono"
              />
            </CardContent>
          </Card>

          {/* Meta Pixel */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Facebook className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Meta Pixel (Facebook/Instagram)</CardTitle>
                  <CardDescription>Rastreie conversões e crie públicos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                value={trackingConfig.meta_pixel_id || ""}
                onChange={(e) => updateTrackingField("meta_pixel_id", e.target.value)}
                placeholder="1234567890123456"
                className="font-mono"
              />
            </CardContent>
          </Card>

          {/* Google Ads */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Target className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Google Ads</CardTitle>
                  <CardDescription>Rastreie conversões de anúncios</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                value={trackingConfig.google_ads_id || ""}
                onChange={(e) => updateTrackingField("google_ads_id", e.target.value)}
                placeholder="AW-XXXXXXXXX"
                className="font-mono"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
