import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Image, Lightbulb, Palette, PenTool, ClipboardCheck, Sparkles, Calendar, Eye, Cpu } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ModelPricing {
  model_name: string;
  cost_per_1k_input_tokens: number;
  cost_per_1k_output_tokens: number;
  cost_per_image: number;
  is_active: boolean;
}

interface PreferencesTabProps {
  blogId: string;
  isClientContext?: boolean;
}

interface ContentPreferences {
  use_ai_images: boolean;
  use_stock_images: boolean;
  use_own_images: boolean;
  default_word_count: number;
  image_style: string;
  writing_style: string;
  competitor_citation: string;
  default_instructions: string;
  grammatical_person: string;
  mention_project: boolean;
  use_external_data: boolean;
  include_faq: boolean;
  auto_approve: boolean;
  post_interval_hours: number;
  anticipate_scheduling: boolean;
  primary_color: string;
  primary_color_light: string;
  cta_text: string;
  ai_model_text: string;
  ai_model_image: string;
}

export function PreferencesTab({ blogId, isClientContext = false }: PreferencesTabProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [textModels, setTextModels] = useState<ModelPricing[]>([]);
  const [imageModels, setImageModels] = useState<ModelPricing[]>([]);
  const [preferences, setPreferences] = useState<ContentPreferences>({
    use_ai_images: true,
    use_stock_images: false,
    use_own_images: false,
    default_word_count: 1000,
    image_style: "photorealistic",
    writing_style: "informative",
    competitor_citation: "never",
    default_instructions: "",
    grammatical_person: "first",
    mention_project: false,
    use_external_data: false,
    include_faq: true,
    auto_approve: false,
    post_interval_hours: 24,
    anticipate_scheduling: false,
    primary_color: "#7c3aed",
    primary_color_light: "#a78bfa",
    cta_text: "Leia o post inteiro através do link na bio",
    ai_model_text: "google/gemini-2.5-flash",
    ai_model_image: "google/gemini-2.5-flash-image-preview",
  });

  useEffect(() => {
    fetchPreferences();
    fetchModels();
  }, [blogId]);

  async function fetchModels() {
    const { data } = await supabase
      .from("model_pricing")
      .select("*")
      .eq("is_active", true);
    
    if (data) {
      // Text models: have input token cost
      setTextModels(data.filter(m => m.cost_per_1k_input_tokens > 0).sort((a, b) => a.cost_per_1k_input_tokens - b.cost_per_1k_input_tokens));
      // Image models: have image cost
      setImageModels(data.filter(m => m.cost_per_image > 0).sort((a, b) => a.cost_per_image - b.cost_per_image));
    }
  }

  async function fetchPreferences() {
    if (!blogId) return;

    const { data, error } = await supabase
      .from("content_preferences")
      .select("*")
      .eq("blog_id", blogId)
      .single();

    if (data) {
      setPreferences({
        use_ai_images: data.use_ai_images ?? true,
        use_stock_images: data.use_stock_images ?? false,
        use_own_images: data.use_own_images ?? false,
        default_word_count: data.default_word_count ?? 1000,
        image_style: data.image_style ?? "photorealistic",
        writing_style: data.writing_style ?? "informative",
        competitor_citation: data.competitor_citation ?? "never",
        default_instructions: data.default_instructions ?? "",
        grammatical_person: data.grammatical_person ?? "first",
        mention_project: data.mention_project ?? false,
        use_external_data: data.use_external_data ?? false,
        include_faq: data.include_faq ?? true,
        auto_approve: data.auto_approve ?? false,
        post_interval_hours: data.post_interval_hours ?? 24,
        anticipate_scheduling: data.anticipate_scheduling ?? false,
        primary_color: data.primary_color ?? "#7c3aed",
        primary_color_light: data.primary_color_light ?? "#a78bfa",
        cta_text: data.cta_text ?? "Leia o post inteiro através do link na bio",
        ai_model_text: data.ai_model_text ?? "google/gemini-2.5-flash",
        ai_model_image: data.ai_model_image ?? "google/gemini-2.5-flash-image-preview",
      });
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);

    const { error } = await supabase
      .from("content_preferences")
      .upsert({
        blog_id: blogId,
        ...preferences,
        updated_at: new Date().toISOString(),
      }, { onConflict: "blog_id" });

    if (error) {
      toast.error("Erro ao salvar preferências");
      console.error(error);
    } else {
      toast.success("Preferências salvas com sucesso");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Image Strategies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Estratégias de Imagens
          </CardTitle>
          <CardDescription>
            Configure como as imagens serão geradas para seus artigos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Banner */}
          <div className="flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Você pode combinar múltiplas estratégias de imagens. Por exemplo, usar imagens IA como 
              padrão e suas próprias imagens quando disponíveis.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-base">Usar imagens geradas por IA</Label>
                <p className="text-sm text-muted-foreground">
                  Gerar automaticamente imagens com inteligência artificial
                </p>
              </div>
              <Switch
                checked={preferences.use_ai_images}
                onCheckedChange={(checked) =>
                  setPreferences(prev => ({ ...prev, use_ai_images: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border opacity-60">
              <div className="space-y-1">
                <Label className="text-base flex items-center gap-2">
                  Usar bancos de imagens profissionais
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">Em breve</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Buscar imagens de alta qualidade em bancos de imagens
                </p>
              </div>
              <Switch disabled checked={preferences.use_stock_images} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-base">Usar minhas próprias imagens</Label>
                <p className="text-sm text-muted-foreground">
                  Priorizar imagens da{" "}
                  <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/strategy")}>
                    sua biblioteca
                  </Button>
                </p>
              </div>
              <Switch
                checked={preferences.use_own_images}
                onCheckedChange={(checked) =>
                  setPreferences(prev => ({ ...prev, use_own_images: checked }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Writing Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            Estratégia de Escrita
          </CardTitle>
          <CardDescription>
            Defina as configurações padrão para geração de conteúdo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Tamanho padrão dos posts</Label>
              <Input
                type="number"
                min={500}
                max={5000}
                value={preferences.default_word_count}
                onChange={(e) =>
                  setPreferences(prev => ({ ...prev, default_word_count: parseInt(e.target.value) || 1000 }))
                }
              />
              <p className="text-xs text-muted-foreground">Entre 500 e 5000 palavras</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Estilo de Imagem
              </Label>
              <Select
                value={preferences.image_style}
                onValueChange={(value) =>
                  setPreferences(prev => ({ ...prev, image_style: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="photorealistic">Fotorrealismo</SelectItem>
                  <SelectItem value="illustration">Ilustração</SelectItem>
                  <SelectItem value="minimalist">Minimalista</SelectItem>
                  <SelectItem value="artistic">Artístico</SelectItem>
                  <SelectItem value="corporate">Corporativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estilo de Escrita</Label>
              <Select
                value={preferences.writing_style}
                onValueChange={(value) =>
                  setPreferences(prev => ({ ...prev, writing_style: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informative">Informativo</SelectItem>
                  <SelectItem value="narrative">Narrativo</SelectItem>
                  <SelectItem value="persuasive">Persuasivo</SelectItem>
                  <SelectItem value="educational">Educacional</SelectItem>
                  <SelectItem value="conversational">Conversacional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Citação de concorrentes</Label>
              <Select
                value={preferences.competitor_citation}
                onValueChange={(value) =>
                  setPreferences(prev => ({ ...prev, competitor_citation: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Nunca citar</SelectItem>
                  <SelectItem value="with_link">Citar com link</SelectItem>
                  <SelectItem value="mention_only">Apenas mencionar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Instruções padrão</Label>
            <Textarea
              placeholder="Adicione instruções que serão aplicadas a todos os artigos gerados..."
              value={preferences.default_instructions}
              onChange={(e) =>
                setPreferences(prev => ({ ...prev, default_instructions: e.target.value }))
              }
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              {preferences.default_instructions.length}/500 caracteres
            </p>
          </div>

          <div className="space-y-3">
            <Label>Pessoa gramatical</Label>
            <RadioGroup
              value={preferences.grammatical_person}
              onValueChange={(value) =>
                setPreferences(prev => ({ ...prev, grammatical_person: value }))
              }
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="first" id="first" />
                <Label htmlFor="first" className="font-normal cursor-pointer">
                  Primeira pessoa (nós)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="third" id="third" />
                <Label htmlFor="third" className="font-normal cursor-pointer">
                  Terceira pessoa (a empresa)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Content Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Opções de Conteúdo
          </CardTitle>
          <CardDescription>
            Configure elementos adicionais dos seus artigos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1 pr-4">
              <Label className="text-base">Mencionar o projeto no texto do post</Label>
              <p className="text-sm text-muted-foreground">
                Ao ativar, mencionaremos o seu projeto e a relação dele com o conteúdo do artigo de forma natural e contextualizada.
              </p>
            </div>
            <Switch
              checked={preferences.mention_project}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, mention_project: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1 pr-4">
              <Label className="text-base">Usar dados de estudos reais e realizar linkagem externa</Label>
              <p className="text-sm text-muted-foreground">
                Inclua dados e estudos externos (de outros sites), cite artigos de referências e faça linkagem para fontes externas confiáveis.
              </p>
            </div>
            <Switch
              checked={preferences.use_external_data}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, use_external_data: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1 pr-4">
              <Label className="text-base">Incluir sessão de perguntas frequentes</Label>
              <p className="text-sm text-muted-foreground">
                Inclua perguntas e respostas relevantes para os seus leitores ao final de cada artigo, melhorando o SEO e a experiência do usuário.
              </p>
            </div>
            <Switch
              checked={preferences.include_faq}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, include_faq: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Approval and Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Aprovação e agendamento
          </CardTitle>
          <CardDescription>
            Escolha o que acontece quando terminarmos de gerar um conteúdo novo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Controle de novos conteúdos</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setPreferences(prev => ({ ...prev, auto_approve: false }))}
                className={cn(
                  "flex items-start gap-4 rounded-lg border-2 p-4 text-left transition-all hover:bg-accent/50",
                  !preferences.auto_approve
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <div className="rounded-lg bg-muted p-2.5">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Prefiro revisar e agendar</p>
                  <p className="text-sm text-muted-foreground">
                    Você receberá uma notificação e poderá revisar antes de publicar
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPreferences(prev => ({ ...prev, auto_approve: true }))}
                className={cn(
                  "flex items-start gap-4 rounded-lg border-2 p-4 text-left transition-all hover:bg-accent/50",
                  preferences.auto_approve
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <div className="rounded-lg bg-muted p-2.5">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Aprove e agende automaticamente</p>
                  <p className="text-sm text-muted-foreground">
                    O conteúdo será publicado automaticamente conforme a programação
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Intervalo entre posts</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={preferences.post_interval_hours}
                onChange={(e) =>
                  setPreferences(prev => ({ ...prev, post_interval_hours: parseInt(e.target.value) || 24 }))
                }
                min={1}
                max={720}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo mínimo entre a publicação de cada novo conteúdo
            </p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1 pr-4">
              <Label className="text-base">Antecipar agendamentos futuros ao retirar um agendamento</Label>
              <p className="text-sm text-muted-foreground">
                Quando você remover um conteúdo da fila, os próximos agendamentos serão antecipados automaticamente para preencher o espaço vago.
              </p>
            </div>
            <Switch
              checked={preferences.anticipate_scheduling}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, anticipate_scheduling: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Configurações de IA
          </CardTitle>
          <CardDescription>
            Escolha os modelos de acordo com custo e qualidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Banner */}
          <div className="flex gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Modelos mais caros geralmente produzem resultados de maior qualidade e precisão. 
              O custo é calculado por uso.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Text Model */}
            <div className="space-y-2">
              <Label>Modelo para Texto (Artigos, SEO, Sugestões)</Label>
              <Select
                value={preferences.ai_model_text}
                onValueChange={(v) => setPreferences(prev => ({ ...prev, ai_model_text: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {textModels.map(m => (
                    <SelectItem key={m.model_name} value={m.model_name}>
                      {m.model_name.replace('google/', '').replace('openai/', '')} - ${(m.cost_per_1k_input_tokens * 1000).toFixed(3)}/1M tokens
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Usado para gerar artigos, melhorar SEO e sugestões de conteúdo
              </p>
            </div>

            {/* Image Model */}
            <div className="space-y-2">
              <Label>Modelo para Imagens</Label>
              <Select
                value={preferences.ai_model_image}
                onValueChange={(v) => setPreferences(prev => ({ ...prev, ai_model_image: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {imageModels.map(m => (
                    <SelectItem key={m.model_name} value={m.model_name}>
                      {m.model_name} - ${m.cost_per_image.toFixed(3)}/imagem
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Usado para gerar imagens de capa e conteúdo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Identidade Visual
          </CardTitle>
          <CardDescription>
            Gere conteúdos com a cara do seu projeto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Paleta de Cores</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Cor Principal</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={preferences.primary_color}
                    onChange={(e) => setPreferences(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="h-10 w-16 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input
                    value={preferences.primary_color}
                    onChange={(e) => setPreferences(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="flex-1 font-mono"
                    placeholder="#7c3aed"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Cor Principal - Clara (300)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={preferences.primary_color_light}
                    onChange={(e) => setPreferences(prev => ({ ...prev, primary_color_light: e.target.value }))}
                    className="h-10 w-16 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input
                    value={preferences.primary_color_light}
                    onChange={(e) => setPreferences(prev => ({ ...prev, primary_color_light: e.target.value }))}
                    className="flex-1 font-mono"
                    placeholder="#a78bfa"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Texto de chamada para ação</Label>
            <Input
              value={preferences.cta_text}
              onChange={(e) => setPreferences(prev => ({ ...prev, cta_text: e.target.value }))}
              placeholder="Leia o post inteiro através do link na bio"
            />
            <p className="text-xs text-muted-foreground">
              Texto que aparecerá como CTA nas imagens e posts gerados
            </p>
          </div>

          <div className="space-y-3">
            <Label>Exemplos de criativos</Label>
            <p className="text-sm text-muted-foreground">
              Prévia de como suas cores serão aplicadas nos criativos gerados
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {/* Creative 1 - Solid background */}
              <div
                className="aspect-square rounded-lg flex items-center justify-center p-4"
                style={{ backgroundColor: preferences.primary_color }}
              >
                <div className="text-center">
                  <Image className="h-8 w-8 mx-auto mb-2 text-white/80" />
                  <p className="text-xs text-white font-medium">Layout 1</p>
                </div>
              </div>

              {/* Creative 2 - Light background */}
              <div
                className="aspect-square rounded-lg flex items-center justify-center p-4 border"
                style={{ backgroundColor: preferences.primary_color_light }}
              >
                <div className="text-center">
                  <Image className="h-8 w-8 mx-auto mb-2 text-white/90" />
                  <p className="text-xs text-white font-medium">Layout 2</p>
                </div>
              </div>

              {/* Creative 3 - Gradient */}
              <div
                className="aspect-square rounded-lg flex items-center justify-center p-4"
                style={{
                  background: `linear-gradient(135deg, ${preferences.primary_color} 0%, ${preferences.primary_color_light} 100%)`
                }}
              >
                <div className="text-center">
                  <Image className="h-8 w-8 mx-auto mb-2 text-white/90" />
                  <p className="text-xs text-white font-medium">Layout 3</p>
                </div>
              </div>

              {/* Creative 4 - White with accent */}
              <div
                className="aspect-square rounded-lg flex items-center justify-center p-4 bg-card border-2"
                style={{ borderColor: preferences.primary_color }}
              >
                <div className="text-center">
                  <Image className="h-8 w-8 mx-auto mb-2" style={{ color: preferences.primary_color }} />
                  <p className="text-xs font-medium" style={{ color: preferences.primary_color }}>Layout 4</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Preferências
        </Button>
      </div>
    </div>
  );
}
