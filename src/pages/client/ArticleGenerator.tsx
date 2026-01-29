/**
 * Article Generator Page
 * 
 * Interface avançada de geração de artigos expondo o Article Engine.
 * Rota: /client/articles/generate
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Eye, 
  Loader2, 
  ArrowLeft,
  Zap,
  Brain,
  Search,
  Shield,
  ImageIcon,
  Target
} from 'lucide-react';
import { toast } from 'sonner';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { ArticleTemplatePreviewModal } from '@/components/client/ArticleTemplatePreviewModal';
import { NicheSelectorDropdown } from '@/components/client/NicheSelectorDropdown';
import { TemplateSelectorRadio } from '@/components/client/TemplateSelectorRadio';
import { ArticleGenerationProgress } from '@/components/client/ArticleGenerationProgress';
import type { TemplateType, ArticleMode, NicheType } from '@/lib/article-engine/types';
import { useQuery } from '@tanstack/react-query';

// Brazilian states
const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Progress simulation sequence
const PROGRESS_SEQUENCE = [
  { stage: 'validating', delay: 500, progress: 5 },
  { stage: 'classifying', delay: 1000, progress: 15 },
  { stage: 'selecting', delay: 1500, progress: 25 },
  { stage: 'researching', delay: 15000, progress: 45 },
  { stage: 'outlining', delay: 3000, progress: 55 },
  { stage: 'writing', delay: 25000, progress: 75 },
  { stage: 'optimizing', delay: 5000, progress: 90 }
];

interface GeneratorFormData {
  keyword: string;
  city: string;
  state: string;
  niche: NicheType;
  mode: ArticleMode;
  template: TemplateType | 'auto';
  webResearch: boolean;
  eatInjection: boolean;
  imageAlt: boolean;
}

export default function ArticleGenerator() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  
  // Fetch business profile
  const { data: businessProfile } = useQuery({
    queryKey: ['business-profile', blog?.id],
    queryFn: async () => {
      if (!blog?.id) return null;
      const { data } = await supabase
        .from('business_profile')
        .select('company_name, city, whatsapp, niche')
        .eq('blog_id', blog.id)
        .maybeSingle();
      return data;
    },
    enabled: !!blog?.id
  });
  
  const [formData, setFormData] = useState<GeneratorFormData>({
    keyword: '',
    city: businessProfile?.city || '',
    state: 'SP',
    niche: (businessProfile?.niche as NicheType) || 'pest_control',  // ROLLBACK: Default to pest_control
    mode: 'authority',
    template: 'auto',
    webResearch: true,
    eatInjection: true,   // ROLLBACK: Default to true
    imageAlt: true        // ROLLBACK: Default to true
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  
  // Refs for timers
  const progressTimersRef = useRef<NodeJS.Timeout[]>([]);
  const timeoutWarningRef = useRef<NodeJS.Timeout | null>(null);
  
  // Validation
  const isValid = formData.keyword.trim().length >= 3 && formData.city.trim().length > 0;
  
  // Clear all timers
  const clearAllTimers = () => {
    progressTimersRef.current.forEach(timer => clearTimeout(timer));
    progressTimersRef.current = [];
    if (timeoutWarningRef.current) {
      clearTimeout(timeoutWarningRef.current);
      timeoutWarningRef.current = null;
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, []);
  
  // Timeout warning effect
  useEffect(() => {
    if (isGenerating) {
      timeoutWarningRef.current = setTimeout(() => {
        setShowTimeoutWarning(true);
        toast.warning(
          'A geração está demorando mais que o esperado. Aguarde mais um momento...',
          { duration: 8000 }
        );
      }, 120000); // 2 minutes
      
      return () => {
        if (timeoutWarningRef.current) {
          clearTimeout(timeoutWarningRef.current);
        }
      };
    }
  }, [isGenerating]);
  
  const startProgressSimulation = () => {
    let accumulatedDelay = 0;
    
    PROGRESS_SEQUENCE.forEach(({ stage, delay, progress }) => {
      accumulatedDelay += delay;
      const timer = setTimeout(() => {
        setGenerationStage(stage);
        setGenerationProgress(progress);
      }, accumulatedDelay);
      progressTimersRef.current.push(timer);
    });
  };
  
  const handleInputChange = (field: keyof GeneratorFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleCancel = () => {
    clearAllTimers();
    setIsGenerating(false);
    setGenerationStage(null);
    setGenerationProgress(0);
    setShowTimeoutWarning(false);
    toast.info('Geração cancelada');
  };
  
  const handleGenerate = async () => {
    if (!isValid || !blog) return;
    
    setIsGenerating(true);
    setGenerationStage('validating');
    setGenerationProgress(5);
    setShowTimeoutWarning(false);
    
    // Start progress simulation
    startProgressSimulation();
    
    try {
      // ROLLBACK: Debug logging to verify payload
      console.log('[ArticleGenerator] Sending payload:', {
        niche: formData.niche,
        useEat: formData.eatInjection,
        contextualAlt: formData.imageAlt,
        mode: formData.mode
      });
      
      // Prepare payload for edge function with full Article Engine parameters
      const payload = {
        theme: formData.keyword.trim(),  // Edge function expects 'theme', not 'keyword'
        keywords: [formData.keyword.trim()],  // Also send as keywords array
        city: formData.city.trim(),
        state: formData.state,
        niche: formData.niche || 'pest_control',  // ROLLBACK: Ensure niche is never empty
        mode: formData.mode,
        webResearch: formData.webResearch,
        templateOverride: formData.template !== 'auto' ? formData.template : undefined,
        blogId: blog.id,
        blog_id: blog.id,  // Edge function also expects blog_id
        businessName: businessProfile?.company_name || blog.name,
        businessWhatsapp: businessProfile?.whatsapp,
        useEat: formData.eatInjection === true,  // ROLLBACK: Explicit boolean
        contextualAlt: formData.imageAlt === true,  // ROLLBACK: Explicit boolean
        // V2.2: Article Engine parameters based on mode
        // Authority mode: 8 images (min 6, max 10), Entry mode: 3 images
        image_count: formData.mode === 'authority' ? 8 : 3,
        word_count: formData.mode === 'authority' ? 2400 : 1000,
        generation_mode: formData.mode === 'authority' ? 'deep' : 'fast',
      };
      
      // Call edge function
      const { data, error } = await supabase.functions.invoke('generate-article-structured', {
        body: payload
      });
      
      if (error) {
        throw new Error(error.message || 'Erro ao gerar artigo');
      }
      
      // Edge function returns { success: true, article: { id, slug, ... } }
      const articleId = data?.article?.id || data?.articleId;
      if (!articleId) {
        console.error('Response structure:', data);
        throw new Error('Artigo não foi criado corretamente');
      }
      
      // Clear timers and set done
      clearAllTimers();
      setGenerationStage('done');
      setGenerationProgress(100);
      toast.success('Artigo gerado com sucesso!');
      
      // Navigate to preview
      navigate(`/client/articles/${articleId}/preview`);
      
    } catch (err: any) {
      console.error('Generation error:', err);
      clearAllTimers();
      toast.error(err.message || 'Erro ao gerar artigo');
    } finally {
      setIsGenerating(false);
      setGenerationStage(null);
      setGenerationProgress(0);
      setShowTimeoutWarning(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/client/articles')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Gerar Artigo de Autoridade Local
          </h1>
          <p className="text-muted-foreground">
            Configure e gere artigos otimizados com o Article Engine
          </p>
        </div>
      </div>
      
      {/* Form */}
      <div className="grid gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📝 Informações Básicas</CardTitle>
            <CardDescription>
              Defina a keyword e localização do artigo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Keyword */}
            <div className="space-y-2">
              <Label htmlFor="keyword">
                Palavra-chave <span className="text-destructive">*</span>
              </Label>
              <Input
                id="keyword"
                placeholder="Ex: desentupidora pinheiros, controle de pragas zona sul"
                value={formData.keyword}
                onChange={(e) => handleInputChange('keyword', e.target.value)}
                disabled={isGenerating}
              />
              {formData.keyword.length > 0 && formData.keyword.length < 3 && (
                <p className="text-xs text-destructive">
                  Mínimo 3 caracteres
                </p>
              )}
            </div>
            
            {/* City & State */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">
                  Cidade <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="Ex: São Paulo"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => handleInputChange('state', value)}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Niche */}
            <div className="space-y-2">
              <Label>
                Nicho <span className="text-destructive">*</span>
              </Label>
              <NicheSelectorDropdown
                value={formData.niche}
                onChange={(value) => handleInputChange('niche', value)}
                disabled={isGenerating}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Advanced Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">⚙️ Configurações Avançadas</CardTitle>
            <CardDescription>
              Personalize o modo de geração e template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Generation Mode */}
            <div className="space-y-3">
              <Label>Modo de Geração</Label>
              <RadioGroup
                value={formData.mode}
                onValueChange={(value) => handleInputChange('mode', value)}
                className="grid grid-cols-2 gap-4"
                disabled={isGenerating}
              >
                <div>
                  <RadioGroupItem value="entry" id="mode-entry" className="peer sr-only" />
                  <Label
                    htmlFor="mode-entry"
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                  >
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div className="text-center">
                      <p className="font-medium">Entry</p>
                      <p className="text-xs text-muted-foreground">800-1.200 palavras</p>
                      <p className="text-xs text-muted-foreground">Rápido e objetivo</p>
                    </div>
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem value="authority" id="mode-authority" className="peer sr-only" />
                  <Label
                    htmlFor="mode-authority"
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                  >
                    <Brain className="h-5 w-5 text-purple-500" />
                    <div className="text-center">
                      <p className="font-medium">Authority</p>
                      <p className="text-xs text-muted-foreground">1.200-3.000 palavras</p>
                      <p className="text-xs text-muted-foreground">Completo e detalhado</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <Separator />
            
            {/* Template Selection */}
            <div className="space-y-3">
              <Label>Template Estrutural</Label>
              <TemplateSelectorRadio
                value={formData.template}
                onChange={(value) => handleInputChange('template', value)}
                disabled={isGenerating}
              />
            </div>
            
            <Separator />
            
            {/* Feature Toggles */}
            <div className="space-y-4">
              {/* Web Research */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-blue-500" />
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">
                      Usar Web Research (Perplexity)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Pesquisa em tempo real para dados atualizados
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.webResearch}
                  onCheckedChange={(checked) => handleInputChange('webResearch', checked)}
                  disabled={isGenerating}
                />
              </div>
              
              {/* E-E-A-T */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-green-500" />
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">
                      Incluir E-E-A-T Local
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Frases de experiência e autoridade local
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.eatInjection}
                  onCheckedChange={(checked) => handleInputChange('eatInjection', checked)}
                  disabled={isGenerating}
                />
              </div>
              
              {/* Image ALT */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-4 w-4 text-orange-500" />
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">
                      Gerar ALT de Imagens Contextualizado
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      ALT texts no padrão "serviço por empresa em cidade"
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.imageAlt}
                  onCheckedChange={(checked) => handleInputChange('imageAlt', checked)}
                  disabled={isGenerating}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => setShowTemplatePreview(true)}
            disabled={!formData.keyword.trim() || isGenerating}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview Template
          </Button>
          
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={!isValid || isGenerating}
            className="gap-2 min-w-[200px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Gerar Artigo
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Generation Progress Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <ArticleGenerationProgress
              currentStage={generationStage}
              progress={generationProgress}
              showTimeoutWarning={showTimeoutWarning}
              keyword={formData.keyword}
              onCancel={handleCancel}
            />
          </div>
        </div>
      )}
      
      {/* Template Preview Modal */}
      <ArticleTemplatePreviewModal
        open={showTemplatePreview}
        onOpenChange={setShowTemplatePreview}
        keyword={formData.keyword}
        city={formData.city}
        mode={formData.mode}
        templateOverride={formData.template !== 'auto' ? formData.template : undefined}
        onGenerate={() => {
          setShowTemplatePreview(false);
          handleGenerate();
        }}
      />
    </div>
  );
}
