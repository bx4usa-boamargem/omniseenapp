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
import { X, Sparkles, Loader2, ImageIcon, Images, FileText, LayoutList, Bot, Zap, TrendingUp, Newspaper } from "lucide-react";
import { FunnelModeSelector, type FunnelMode, type ArticleGoal } from "@/components/article/FunnelModeSelector";
import { SectionHelper } from "@/components/blog-editor/SectionHelper";
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
}> = {
  traditional: {
    name: 'Artigo Clássico',
    subtitle: 'SEO & Autoridade',
    icon: '📄',
    description: 'Estrutura limpa e objetiva. Ideal para ranqueamento no Google e construção de autoridade.',
    audience: 'Empresários, gestores, leitores técnicos',
    badge: 'Recomendado para SEO'
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
  }) => void;
  isGenerating: boolean;
  initialTheme?: string;
  initialKeywords?: string[];
}

// Updated word count suggestions (1200-1600 range)
const wordCountSuggestions = [1200, 1400, 1600, 2000];

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
  
  // NEW: Editorial Model
  const [editorialModel, setEditorialModel] = useState<EditorialModel>('traditional');

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

  const handleWordCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1200;
    setWordCount(value);
  };

  const handleWordCountBlur = () => {
    if (wordCount < 1200) {
      setWordCount(1200);
    }
  };

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
      editorialModel
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="theme" className="text-sm font-medium">
          Tema do Artigo <span className="text-destructive">*</span>
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

      <div className="space-y-2">
        <Label htmlFor="keywords" className="text-sm font-medium">
          Palavras-chave SEO
        </Label>
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
        <p className="text-xs text-muted-foreground">
          Máximo 5 palavras-chave. Pressione Enter para adicionar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tone" className="text-sm font-medium">
            Tom do Conteúdo
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
          <Label htmlFor="category" className="text-sm font-medium">
            Categoria
          </Label>
          <Input
            id="category"
            placeholder="Ex: Produtividade, Marketing, Tecnologia"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isGenerating}
          />
        </div>
      </div>

      {/* NEW: Editorial Model Section */}
      <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper className="h-5 w-5 text-amber-600" />
          <span className="font-medium text-sm">Modelo Editorial</span>
          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            Novo
          </Badge>
        </div>
        <SectionHelper
          title=""
          description="Estilo do artigo. Cada modelo tem estrutura e tom diferentes."
          action="Selecione conforme seu objetivo."
        />
        
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
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Público: {model.audience}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Funnel Mode & Article Goal Section */}
      <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">Estratégia do Artigo</span>
          <Badge variant="secondary" className="text-xs">
            Prompt Type V1.0
          </Badge>
        </div>
        <SectionHelper
          title=""
          description="Posição no funil e objetivo. Afeta tom e profundidade."
        />
        
        <FunnelModeSelector
          funnelMode={funnelMode}
          onFunnelModeChange={setFunnelMode}
          articleGoal={articleGoal}
          onArticleGoalChange={setArticleGoal}
          disabled={isGenerating}
        />
      </div>

      {/* Word Count Section */}
      <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">Tamanho do Artigo</span>
        </div>
        <SectionHelper
          title=""
          description="1.200-1.600 palavras é ideal para SEO. Padrão: 1.400."
        />
        
        <div className="space-y-3">
          <Label htmlFor="word-count" className="text-sm text-muted-foreground">
            Quantidade de palavras:
          </Label>
          
          {/* Quick suggestion buttons */}
          <div className="flex flex-wrap gap-2">
            {wordCountSuggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant={wordCount === suggestion ? "default" : "outline"}
                size="sm"
                onClick={() => setWordCount(suggestion)}
                disabled={isGenerating}
                className="min-w-[70px]"
              >
                {suggestion.toLocaleString('pt-BR')}
              </Button>
            ))}
          </div>
          
          {/* Numeric input */}
          <Input
            type="number"
            id="word-count"
            min={1200}
            max={1600}
            step={100}
            value={wordCount}
            onChange={handleWordCountChange}
            onBlur={handleWordCountBlur}
            disabled={isGenerating}
            placeholder="1400"
          />
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p>⏱️ Tempo de leitura estimado: <strong>{getReadingTime(wordCount)} minutos</strong></p>
            <p>📊 Tamanho ideal: 1.200 a 1.600 palavras (padrão profissional)</p>
            <p>⚠️ Mínimo: 1.200 palavras | Recomendado: 1.400 palavras</p>
          </div>
        </div>
      </div>

      {/* Article Structure Section */}
      <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-2 mb-2">
          <LayoutList className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">Estrutura do Artigo</span>
        </div>
        <SectionHelper
          title=""
          description="Quantidade de seções e elementos. Mais seções = maior profundidade."
        />
        
        {/* Section count slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">
              Quantidade de seções H2:
            </Label>
            <span className="text-sm font-medium">{sectionCount} seções</span>
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
            <span>5 (conciso)</span>
            <span>7 (completo)</span>
          </div>
        </div>

        {/* Structure toggles */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="include-faq" className="text-sm font-medium cursor-pointer">
                Incluir FAQ
              </Label>
              <p className="text-xs text-muted-foreground">
                Adiciona seção de perguntas frequentes
              </p>
            </div>
            <Switch
              id="include-faq"
              checked={includeFaq}
              onCheckedChange={setIncludeFaq}
              disabled={isGenerating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="include-conclusion" className="text-sm font-medium cursor-pointer">
                Incluir CTA Final
              </Label>
              <p className="text-xs text-muted-foreground">
                Adiciona seção de chamada para ação ao final
              </p>
            </div>
            <Switch
              id="include-conclusion"
              checked={includeConclusion}
              onCheckedChange={setIncludeConclusion}
              disabled={isGenerating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="include-blocks" className="text-sm font-medium cursor-pointer">
                Incluir Blocos Visuais
              </Label>
              <p className="text-xs text-muted-foreground">
                Adiciona blocos 💡 ⚠️ 📌 ✅ ❝ (varia por modelo)
              </p>
            </div>
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
          <span className="font-medium text-sm">Otimização Avançada</span>
          <Badge variant="secondary" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Novo
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="optimize-ai" className="text-sm font-medium cursor-pointer">
              Otimizar para tráfego de IAs
            </Label>
            <p className="text-xs text-muted-foreground">
              ChatGPT, Perplexity, Google AI Overviews
            </p>
          </div>
          <Switch
            id="optimize-ai"
            checked={optimizeForAI}
            onCheckedChange={setOptimizeForAI}
            disabled={isGenerating}
          />
        </div>
        
        {optimizeForAI && (
          <div className="text-xs text-muted-foreground space-y-1 p-2 rounded bg-background/50">
            <p>✅ Estrutura citável para respostas de IA</p>
            <p>✅ Dados e estatísticas específicas</p>
            <p>✅ Definições claras e factuais</p>
            <p>✅ Schema FAQ estruturado</p>
          </div>
        )}
      </div>

      {/* Image Generation Section */}
      <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">Geração de Imagens</span>
        </div>
        <SectionHelper
          title=""
          description="Imagens contextuais geradas por seção. Aumentam engajamento."
          action="Defina quantidade e se quer capa."
        />

        {/* Cover Image */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <ImageIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <Label htmlFor="generate-cover" className="text-sm font-medium cursor-pointer">
                Imagem de Capa
              </Label>
              <p className="text-xs text-muted-foreground">
                Gera uma imagem profissional para o topo do artigo
              </p>
            </div>
          </div>
          <Switch
            id="generate-cover"
            checked={generateCoverImage}
            onCheckedChange={setGenerateCoverImage}
            disabled={isGenerating}
          />
        </div>

        {/* Content Images */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Images className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label htmlFor="generate-content" className="text-sm font-medium cursor-pointer">
                  Imagens Contextualizadas
                </Label>
                <p className="text-xs text-muted-foreground">
                  Gera imagens baseadas no conteúdo de cada seção
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

          {generateContentImages && (
            <div className="ml-11 space-y-2">
              <div className="flex items-center gap-3">
                <Label htmlFor="image-count" className="text-sm text-muted-foreground whitespace-nowrap">
                  Quantidade:
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
                <span className="text-xs text-muted-foreground">(1 a cada 2 seções)</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• <strong>2 imagens:</strong> Artigos curtos (5 seções)</p>
                <p>• <strong>3 imagens:</strong> Recomendado (6-7 seções)</p>
                <p>• <strong>4 imagens:</strong> Artigos visuais (máximo)</p>
              </div>
            </div>
          )}
        </div>
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
    </form>
  );
}
