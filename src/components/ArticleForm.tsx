import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Sparkles, Loader2, ImageIcon, Images, FileText, LayoutList, Bot, Zap, TrendingUp, Newspaper, Info } from "lucide-react";
import { FunnelModeSelector, type FunnelMode, type ArticleGoal } from "@/components/article/FunnelModeSelector";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { cn } from "@/lib/utils";

// NEW: Editorial Model Types
export type EditorialModel = 'traditional' | 'strategic' | 'visual_guided';

// NEW: Editorial Model Configurations
const EDITORIAL_MODELS: Record<EditorialModel, {
  name: string;
  subtitle: string;
  icon: string;
  description: string;
  audience: string;
  badge: string;
  recommended?: boolean;
}> = {
  traditional: {
    name: 'Artigo Clássico',
    subtitle: 'SEO & Autoridade',
    icon: '📄',
    description: 'Estrutura limpa e objetiva. Ideal para ranqueamento no Google e construção de autoridade.',
    audience: 'Empresários, gestores, leitores técnicos',
    badge: 'Recomendado para SEO',
    recommended: true
  },
  strategic: {
    name: 'Artigo de Impacto',
    subtitle: 'Conversão & Persuasão',
    icon: '🎯',
    description: 'Blocos visuais intensos e linguagem persuasiva. Ideal para landing pages e vendas.',
    audience: 'Leads em decisão, visitantes de campanhas',
    badge: 'Alta conversão'
  },
  visual_guided: {
    name: 'Artigo Visual',
    subtitle: 'Leitura Fluida',
    icon: '📱',
    description: 'Alternância clara entre imagem e texto. Perfeito para mobile e redes sociais.',
    audience: 'Leitor mobile, marketing, educacional',
    badge: 'Mobile-first'
  }
};

// Generation Mode Type
export type GenerationMode = 'fast' | 'deep';

interface ArticleFormProps {
  onGenerate: (data: {
    theme: string;
    keywords: string[];
    tone: 'formal' | 'casual' | 'technical' | 'friendly';
    category: string;
    generateCoverImage: boolean;
    generateContentImages: boolean;
    contentImageCount: number;
    wordCount: number;
    sectionCount: number;
    includeFaq: boolean;
    includeConclusion: boolean;
    includeVisualBlocks: boolean;
    optimizeForAI: boolean;
    funnelMode: FunnelMode;
    articleGoal: ArticleGoal | null;
    editorialModel: EditorialModel;
    generationMode: GenerationMode; // NOVO - fast (400-1000) ou deep (1500-3000)
  }) => void;
  isGenerating: boolean;
  initialTheme?: string;
  initialKeywords?: string[];
}

// Updated word count suggestions (1200-1600 range)
const wordCountSuggestions = [1200, 1400, 1600];

export function ArticleForm({ onGenerate, isGenerating, initialTheme, initialKeywords }: ArticleFormProps) {
  const [theme, setTheme] = useState(initialTheme || "");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(initialKeywords || []);
  const [tone, setTone] = useState<'formal' | 'casual' | 'technical' | 'friendly'>('friendly');
  const [category, setCategory] = useState("");
  const [generateCoverImage, setGenerateCoverImage] = useState(true);
  const [generateContentImages, setGenerateContentImages] = useState(true);
  const [contentImageCount, setContentImageCount] = useState(3);
  // Updated default word count to 1400
  const [wordCount, setWordCount] = useState(1400);
  
  // Article structure options
  const [sectionCount, setSectionCount] = useState(6);
  const [includeFaq, setIncludeFaq] = useState(true);
  const [includeConclusion, setIncludeConclusion] = useState(true);
  const [includeVisualBlocks, setIncludeVisualBlocks] = useState(true);
  const [optimizeForAI, setOptimizeForAI] = useState(false);
  
  // Funnel mode and article goal (Universal Prompt Type)
  const [funnelMode, setFunnelMode] = useState<FunnelMode>('middle');
  const [articleGoal, setArticleGoal] = useState<ArticleGoal | null>(null);
  
  // Editorial Model
  const [editorialModel, setEditorialModel] = useState<EditorialModel>('traditional');
  
  // Generation Mode (fast = 400-1000 palavras, deep = 1500-3000 palavras)
  const [generationMode, setGenerationMode] = useState<GenerationMode>('deep'); // Default é SEMPRE deep

  // Update theme when initialTheme changes (e.g., from YouTube import)
  useEffect(() => {
    if (initialTheme) {
      setTheme(initialTheme);
    }
  }, [initialTheme]);

  // Update keywords when initialKeywords changes (e.g., from opportunity)
  useEffect(() => {
    if (initialKeywords && initialKeywords.length > 0) {
      setKeywords(initialKeywords);
    }
  }, [initialKeywords]);

  const addKeyword = () => {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed) && keywords.length < 5) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  const getReadingTime = (words: number) => Math.ceil(words / 200);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim()) return;
    onGenerate({ 
      theme, 
      keywords, 
      tone, 
      category, 
      generateCoverImage,
      generateContentImages,
      contentImageCount: generateContentImages ? contentImageCount : 0,
      wordCount,
      sectionCount,
      includeFaq,
      includeConclusion,
      includeVisualBlocks,
      optimizeForAI,
      funnelMode,
      articleGoal,
      editorialModel,
      generationMode // NUNCA undefined - default é 'deep'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* LAYER 1: ESSENTIAL - Always visible */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Digite apenas o tema e clique em gerar. <strong>O sistema cuida do resto.</strong> Personalize abaixo se quiser.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="theme" className="text-sm font-medium flex items-center gap-2">
          Tema do Artigo <span className="text-destructive">*</span>
          <Badge variant="secondary" className="text-xs">Único campo obrigatório</Badge>
        </Label>
        <Textarea
          id="theme"
          placeholder="Ex: Como aumentar a produtividade no trabalho remoto usando técnicas de gestão de tempo"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="min-h-[80px] resize-none"
          disabled={isGenerating}
        />
        <p className="text-xs text-muted-foreground">
          Descreva o tema do artigo de forma clara e específica
        </p>
      </div>

      {/* GENERATION MODE SELECTOR - Sempre visível */}
      <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">Modo de Geração</span>
        </div>
        
        <RadioGroup 
          value={generationMode} 
          onValueChange={(v) => setGenerationMode(v as GenerationMode)}
          className="grid grid-cols-2 gap-3"
          disabled={isGenerating}
        >
          <div 
            className={cn(
              "flex items-start space-x-3 p-4 rounded-lg border transition-all cursor-pointer",
              generationMode === 'fast' 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50 bg-background"
            )}
            onClick={() => !isGenerating && setGenerationMode('fast')}
          >
            <RadioGroupItem value="fast" id="mode-fast" className="mt-0.5" disabled={isGenerating} />
            <div className="flex-1">
              <Label htmlFor="mode-fast" className="font-semibold cursor-pointer flex items-center gap-2 text-sm">
                ⚡ Rápido
              </Label>
              <p className="text-xs text-muted-foreground mt-1">400-1.000 palavras</p>
              <p className="text-xs text-muted-foreground">Ideal para chat e ideias rápidas</p>
            </div>
          </div>
          
          <div 
            className={cn(
              "flex items-start space-x-3 p-4 rounded-lg border transition-all cursor-pointer",
              generationMode === 'deep' 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50 bg-background"
            )}
            onClick={() => !isGenerating && setGenerationMode('deep')}
          >
            <RadioGroupItem value="deep" id="mode-deep" className="mt-0.5" disabled={isGenerating} />
            <div className="flex-1">
              <Label htmlFor="mode-deep" className="font-semibold cursor-pointer flex items-center gap-2 text-sm">
                🧠 Profundo
                <Badge className="text-xs bg-primary text-primary-foreground">Recomendado</Badge>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">1.500-3.000 palavras</p>
              <p className="text-xs text-muted-foreground">Ativo editorial completo para SEO</p>
            </div>
          </div>
        </RadioGroup>
      </div>

      <Button 
        type="submit" 
        className="w-full gradient-primary" 
        size="lg"
        disabled={!theme.trim() || isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Gerando artigo...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Gerar Artigo com IA
          </>
        )}
      </Button>

      {/* LAYER 2: GUIDED OPTIONS - Collapsible */}
      <CollapsibleSection
        title="Opções de Personalização"
        layer="guided"
        reassuringText="Você pode ignorar esta seção. O sistema já usa padrões inteligentes."
      >
        <div className="space-y-6">
          {/* Editorial Model Section */}
          <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Newspaper className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-sm">Modelo Editorial</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recomendado: Artigo Clássico. Funciona para 90% dos casos.
            </p>
            
            <RadioGroup 
              value={editorialModel} 
              onValueChange={(v) => setEditorialModel(v as EditorialModel)}
              className="space-y-3"
            >
              {(Object.entries(EDITORIAL_MODELS) as [EditorialModel, typeof EDITORIAL_MODELS[EditorialModel]][]).map(([key, model]) => (
                <div 
                  key={key}
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border transition-all cursor-pointer",
                    editorialModel === key 
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10" 
                      : "border-border hover:border-amber-300 bg-background"
                  )}
                  onClick={() => !isGenerating && setEditorialModel(key)}
                >
                  <RadioGroupItem value={key} id={`editorial-${key}`} className="mt-1" disabled={isGenerating} />
                  <div className="flex-1">
                    <Label htmlFor={`editorial-${key}`} className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                      <span>{model.icon}</span>
                      {model.name}
                      {model.recommended && (
                        <Badge className="text-xs bg-primary text-primary-foreground">Recomendado</Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-normal ml-auto">
                        {model.badge}
                      </Badge>
                    </Label>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                      {model.subtitle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {model.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Word Count Section - Simplified */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Tamanho do Artigo</span>
              <Badge variant="outline" className="text-xs">Padrão: 1.400</Badge>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {wordCountSuggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant={wordCount === suggestion ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWordCount(suggestion)}
                  disabled={isGenerating}
                  className="min-w-[80px]"
                >
                  {suggestion.toLocaleString('pt-BR')}
                  {suggestion === 1400 && wordCount !== 1400 && (
                    <span className="ml-1 text-xs opacity-70">✓</span>
                  )}
                </Button>
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground">
              ⏱️ Tempo de leitura: <strong>{getReadingTime(wordCount)} min</strong> • Ideal para SEO: 1.200-1.600 palavras
            </p>
          </div>

          {/* Image Generation Section */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Imagens</span>
              <Badge variant="outline" className="text-xs">Ativado por padrão</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              O sistema já gera imagens automaticamente. Altere apenas se necessário.
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label htmlFor="generate-cover" className="text-sm font-medium cursor-pointer">
                    Imagem de Capa
                  </Label>
                </div>
              </div>
              <Switch
                id="generate-cover"
                checked={generateCoverImage}
                onCheckedChange={setGenerateCoverImage}
                disabled={isGenerating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Images className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label htmlFor="generate-content" className="text-sm font-medium cursor-pointer">
                    Imagens no Conteúdo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    3 imagens contextualizadas
                  </p>
                </div>
              </div>
              <Switch
                id="generate-content"
                checked={generateContentImages}
                onCheckedChange={setGenerateContentImages}
                disabled={isGenerating}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* LAYER 3: ADVANCED - Collapsible */}
      <CollapsibleSection
        title="Configurações Avançadas"
        layer="advanced"
        reassuringText="Para usuários experientes. Pode ignorar sem problemas."
      >
        <div className="space-y-6">
          {/* Funnel Mode & Article Goal Section */}
          <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Funil de Vendas</span>
              <Badge variant="outline" className="text-xs">Opcional</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              O sistema já define um funil inteligente para você. Altere apenas se quiser.
            </p>
            
            <FunnelModeSelector
              funnelMode={funnelMode}
              onFunnelModeChange={setFunnelMode}
              articleGoal={articleGoal}
              onArticleGoalChange={setArticleGoal}
              disabled={isGenerating}
            />
          </div>

          {/* Keywords Section */}
          <div className="space-y-2 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm">Palavras-chave SEO</span>
              <Badge variant="outline" className="text-xs">Opcional</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Você não precisa se preocupar com isso agora. A IA extrai palavras-chave automaticamente do tema.
            </p>
            <div className="flex gap-2">
              <Input
                id="keywords"
                placeholder="Digite uma palavra-chave"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isGenerating || keywords.length >= 5}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={addKeyword}
                disabled={isGenerating || keywords.length >= 5}
              >
                Adicionar
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="ml-1 hover:text-destructive"
                      disabled={isGenerating}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Tone and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-2">
              <Label htmlFor="tone" className="text-sm font-medium flex items-center gap-2">
                Tom do Conteúdo
                <Badge variant="outline" className="text-xs">Padrão: Amigável</Badge>
              </Label>
              <Select 
                value={tone} 
                onValueChange={(v) => setTone(v as typeof tone)}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">😊 Amigável</SelectItem>
                  <SelectItem value="formal">👔 Formal</SelectItem>
                  <SelectItem value="casual">💬 Casual</SelectItem>
                  <SelectItem value="technical">🔧 Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium flex items-center gap-2">
                Categoria
                <Badge variant="outline" className="text-xs">Opcional</Badge>
              </Label>
              <Input
                id="category"
                placeholder="Ex: Produtividade, Marketing"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Article Structure Section */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-2">
              <LayoutList className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Estrutura Detalhada</span>
              <Badge variant="outline" className="text-xs">Padrões já aplicados</Badge>
            </div>
            
            {/* Section count slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">
                  Seções H2:
                </Label>
                <span className="text-sm font-medium">{sectionCount}</span>
              </div>
              <Slider
                value={[sectionCount]}
                onValueChange={(v) => setSectionCount(v[0])}
                min={5}
                max={7}
                step={1}
                disabled={isGenerating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Conciso</span>
                <span>Completo</span>
              </div>
            </div>

            {/* Structure toggles */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="include-faq" className="text-sm cursor-pointer">
                  Incluir FAQ
                </Label>
                <Switch
                  id="include-faq"
                  checked={includeFaq}
                  onCheckedChange={setIncludeFaq}
                  disabled={isGenerating}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="include-conclusion" className="text-sm cursor-pointer">
                  Incluir CTA Final
                </Label>
                <Switch
                  id="include-conclusion"
                  checked={includeConclusion}
                  onCheckedChange={setIncludeConclusion}
                  disabled={isGenerating}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="include-blocks" className="text-sm cursor-pointer">
                  Blocos Visuais 💡 ⚠️ 📌
                </Label>
                <Switch
                  id="include-blocks"
                  checked={includeVisualBlocks}
                  onCheckedChange={setIncludeVisualBlocks}
                  disabled={isGenerating}
                />
              </div>
            </div>
          </div>

          {/* AI Optimization Section */}
          <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Otimização para IAs</span>
              <Badge variant="secondary" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Novo
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="optimize-ai" className="text-sm font-medium cursor-pointer">
                  Otimizar para ChatGPT, Perplexity
                </Label>
                <p className="text-xs text-muted-foreground">
                  Estrutura citável para respostas de IA
                </p>
              </div>
              <Switch
                id="optimize-ai"
                checked={optimizeForAI}
                onCheckedChange={setOptimizeForAI}
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Content Images Count - Advanced */}
          {generateContentImages && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <Label htmlFor="image-count" className="text-sm text-muted-foreground whitespace-nowrap">
                  Quantidade de imagens no conteúdo:
                </Label>
                <Select 
                  value={String(contentImageCount)} 
                  onValueChange={(v) => setContentImageCount(Number(v))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="image-count" className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </form>
  );
}
