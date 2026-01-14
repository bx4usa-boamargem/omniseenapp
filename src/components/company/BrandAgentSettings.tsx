import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Bot, 
  Loader2, 
  Save, 
  CheckCircle2, 
  MessageCircle, 
  Zap, 
  Link2, 
  Clock,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface BrandAgentSettingsProps {
  blogId: string;
}

interface AgentConfig {
  id?: string;
  is_enabled: boolean;
  agent_name: string;
  agent_avatar_url: string | null;
  welcome_message: string;
  personality_traits: string[];
  conversion_goals: string[];
  max_tokens_per_day: number;
  tokens_used_today: number;
  webhook_url: string | null;
  webhook_secret: string | null;
  proactive_delay_seconds: number;
}

const defaultConfig: AgentConfig = {
  is_enabled: false,
  agent_name: 'Consultor',
  agent_avatar_url: null,
  welcome_message: 'Olá! Como posso ajudar você hoje?',
  personality_traits: ['profissional', 'consultivo'],
  conversion_goals: ['lead'],
  max_tokens_per_day: 50000,
  tokens_used_today: 0,
  webhook_url: null,
  webhook_secret: null,
  proactive_delay_seconds: 5,
};

const conversionGoalOptions = [
  { value: 'lead', label: 'Capturar Lead', description: 'Nome, telefone, e-mail' },
  { value: 'agendamento', label: 'Agendamento', description: 'Marcar reunião ou visita' },
  { value: 'orcamento', label: 'Orçamento', description: 'Solicitar proposta' },
];

export function BrandAgentSettings({ blogId }: BrandAgentSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('brand_agent_config')
          .select('*')
          .eq('blog_id', blogId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching agent config:', error);
        }

        if (data) {
          setConfig({
            id: data.id,
            is_enabled: data.is_enabled || false,
            agent_name: data.agent_name || 'Consultor',
            agent_avatar_url: data.agent_avatar_url,
            welcome_message: data.welcome_message || defaultConfig.welcome_message,
            personality_traits: data.personality_traits || defaultConfig.personality_traits,
            conversion_goals: data.conversion_goals || defaultConfig.conversion_goals,
            max_tokens_per_day: data.max_tokens_per_day || defaultConfig.max_tokens_per_day,
            tokens_used_today: data.tokens_used_today || 0,
            webhook_url: data.webhook_url,
            webhook_secret: data.webhook_secret,
            proactive_delay_seconds: data.proactive_delay_seconds || 5,
          });
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (blogId) {
      fetchConfig();
    }
  }, [blogId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const payload = {
        blog_id: blogId,
        is_enabled: config.is_enabled,
        agent_name: config.agent_name,
        agent_avatar_url: config.agent_avatar_url,
        welcome_message: config.welcome_message,
        personality_traits: config.personality_traits,
        conversion_goals: config.conversion_goals,
        max_tokens_per_day: config.max_tokens_per_day,
        webhook_url: config.webhook_url || null,
        webhook_secret: config.webhook_secret || null,
        proactive_delay_seconds: config.proactive_delay_seconds,
      };

      const { error } = await supabase
        .from('brand_agent_config')
        .upsert(payload, { onConflict: 'blog_id' });

      if (error) throw error;

      setSaved(true);
      toast.success('Configurações do agente salvas!');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleConversionGoal = (goal: string) => {
    setConfig(prev => ({
      ...prev,
      conversion_goals: prev.conversion_goals.includes(goal)
        ? prev.conversion_goals.filter(g => g !== goal)
        : [...prev.conversion_goals, goal],
    }));
  };

  const tokensPercentage = Math.round((config.tokens_used_today / config.max_tokens_per_day) * 100);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Agente Comercial de IA
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              </CardTitle>
              <CardDescription>
                Um vendedor digital que atende visitantes no seu blog 24/7
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={config.is_enabled}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_enabled: checked }))}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status Alert */}
        {config.is_enabled ? (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">Agente ativo</p>
              <p className="text-sm text-green-600 dark:text-green-300">
                Seu agente está atendendo visitantes nos artigos públicos
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">Agente desativado</p>
              <p className="text-sm text-amber-600 dark:text-amber-300">
                Ative para começar a capturar leads automaticamente
              </p>
            </div>
          </div>
        )}

        {/* Identity Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Identidade do Agente
          </h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent_name">Nome do Agente</Label>
              <Input
                id="agent_name"
                placeholder="Ex: Ana, Carlos, Consultor"
                value={config.agent_name}
                onChange={(e) => setConfig(prev => ({ ...prev, agent_name: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Como o agente vai se apresentar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proactive_delay">
                Tempo para mensagem proativa
              </Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[config.proactive_delay_seconds]}
                  onValueChange={([value]) => setConfig(prev => ({ ...prev, proactive_delay_seconds: value }))}
                  min={3}
                  max={30}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12 text-right">{config.proactive_delay_seconds}s</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome_message">Mensagem de Boas-vindas</Label>
            <Textarea
              id="welcome_message"
              placeholder="Olá! Como posso ajudar você hoje?"
              value={config.welcome_message}
              onChange={(e) => setConfig(prev => ({ ...prev, welcome_message: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>
        </div>

        {/* Conversion Goals */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Objetivos de Conversão
          </h3>
          
          <div className="grid gap-3 sm:grid-cols-3">
            {conversionGoalOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleConversionGoal(option.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  config.conversion_goals.includes(option.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-sm">{option.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Usage Limits */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Limites de Uso
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tokens usados hoje</span>
              <span className="font-medium">
                {config.tokens_used_today.toLocaleString()} / {config.max_tokens_per_day.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(tokensPercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Aproximadamente {Math.round(config.max_tokens_per_day / 2000)} conversas por dia
            </p>
          </div>

          <div className="space-y-2">
            <Label>Limite diário de tokens</Label>
            <div className="flex items-center gap-3">
              <Slider
                value={[config.max_tokens_per_day]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, max_tokens_per_day: value }))}
                min={10000}
                max={200000}
                step={10000}
                className="flex-1"
              />
              <span className="text-sm font-mono w-20 text-right">
                {(config.max_tokens_per_day / 1000).toFixed(0)}k
              </span>
            </div>
          </div>
        </div>

        {/* Webhook Integration */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Integração via Webhook
          </h3>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="webhook_url">URL do Webhook</Label>
              <Input
                id="webhook_url"
                type="url"
                placeholder="https://seu-sistema.com/webhook/leads"
                value={config.webhook_url || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, webhook_url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Receba leads capturados em tempo real no seu CRM ou sistema
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook_secret">Secret do Webhook (opcional)</Label>
              <Input
                id="webhook_secret"
                type="password"
                placeholder="Chave secreta para validação"
                value={config.webhook_secret || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, webhook_secret: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            size="lg" 
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
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
