/**
 * Article Generator Page V5.0
 * 
 * Interface avançada de geração de artigos expondo o Article Engine.
 * Rota: /client/articles/generate
 * 
 * V5.0: Polling real por article_id, sem timer fake, recovery seguro.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useGenerationPolling } from '@/hooks/useGenerationPolling';
import type { TemplateType, ArticleMode, NicheType } from '@/lib/article-engine/types';
import { useQuery } from '@tanstack/react-query';

// Brazilian states
const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// V5.0: Progress mapping from generation_stage to percentage (for display only)
const STAGE_PROGRESS_MAP: Record<string, number> = {
  validating: 5,
  classifying: 10,
  researching: 35,
  writing: 60,
  seo: 75,
  qa: 80,
  images: 88,
  finalizing: 95,
  completed: 100,
};

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
    niche: (businessProfile?.niche as NicheType) || 'pest_control',
    mode: 'authority',
    template: 'auto',
    webResearch: true,
    eatInjection: true,
    imageAlt: true
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [placeholderArticleId, setPlaceholderArticleId] = useState<string | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  
  // Refs
  const timeoutWarningRef = useRef<NodeJS.Timeout | null>(null);
  
  // V5.0: Real polling from DB
  const polling = useGenerationPolling({
    articleId: placeholderArticleId,
    enabled: isGenerating && !!placeholderArticleId,
    intervalMs: 1500,
    onComplete: useCallback(() => {
      console.log('[V5.0] ✅ Polling detected completion for', placeholderArticleId);
      setIsGenerating(false);
      setShowTimeoutWarning(false);
      if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
      toast.success('Artigo gerado com sucesso!');
      navigate(`/client/articles/${placeholderArticleId}/preview`);
    }, [placeholderArticleId, navigate]),
    onError: useCallback((error: string) => {
      console.error('[V5.0] ❌ Polling detected failure:', error);
      setIsGenerating(false);
      setShowTimeoutWarning(false);
      if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
      toast.error(error);
    }, [])
  });

  // V5.0: Derive progress from polling stage (DB is source of truth)
  const currentStage = isGenerating ? (polling.stage || 'validating') : null;
  const currentProgress = isGenerating 
    ? (polling.progress || STAGE_PROGRESS_MAP[polling.stage] || 5)
    : 0;
  
  // Validation
  const isValid = formData.keyword.trim().length >= 3 && formData.city.trim().length > 0;
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
    };
  }, []);
  
  // Timeout warning effect (3 minutes = very long)
  useEffect(() => {
    if (isGenerating) {
      timeoutWarningRef.current = setTimeout(() => {
        setShowTimeoutWarning(true);
      }, 180000); // 3 minutes
      
      return () => {
        if (timeoutWarningRef.current) {
          clearTimeout(timeoutWarningRef.current);
        }
      };
    }
  }, [isGenerating]);
  
  const handleInputChange = (field: keyof GeneratorFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleCancel = async () => {
    // V5.0: Mark placeholder as draft/failed on cancel
    if (placeholderArticleId) {
      await supabase
        .from('articles')
        .update({ status: 'draft', generation_stage: 'failed' })
        .eq('id', placeholderArticleId);
    }
    
    setIsGenerating(false);
    setPlaceholderArticleId(null);
    setShowTimeoutWarning(false);
    if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
    toast.info('Geração cancelada');
  };
  
  const handleGenerate = async () => {
    if (!isValid || !blog) return;
    
    setIsGenerating(true);
    setShowTimeoutWarning(false);
    
    try {
      // V5.0 Step 1: Create placeholder in DB
      console.log('[V5.0] Creating placeholder...');
      const { data: placeholder, error: placeholderError } = await supabase
        .from('articles')
        .insert({
          blog_id: blog.id,
          title: `Gerando: ${formData.keyword.trim()}`,
          status: 'generating',
          generation_stage: 'validating',
          generation_progress: 5,
          slug: `generating-${Date.now()}`,
        })
        .select('id')
        .single();

      if (placeholderError || !placeholder?.id) {
        console.error('[V5.0] Placeholder creation failed:', placeholderError);
        toast.error('Erro ao iniciar geração. Tente novamente.');
        setIsGenerating(false);
        return;
      }

      const articleId = placeholder.id;
      console.log('[V5.0] Placeholder created:', articleId);
      setPlaceholderArticleId(articleId);

      // V5.0 Step 2: Polling starts automatically via useGenerationPolling hook
      // (enabled becomes true when placeholderArticleId is set)

      // V5.0 Step 3: Call edge function with article_id (non-blocking for UI)
      const payload = {
        article_id: articleId,
        theme: formData.keyword.trim(),
        keywords: [formData.keyword.trim()],
        city: formData.city.trim(),
        state: formData.state,
        niche: formData.niche,
        mode: formData.mode,
        webResearch: formData.webResearch,
        templateOverride: formData.template !== 'auto' ? formData.template : undefined,
        blogId: blog.id,
        blog_id: blog.id,
        businessName: businessProfile?.company_name || blog.name,
        businessWhatsapp: businessProfile?.whatsapp,
        useEat: formData.eatInjection,
        contextualAlt: formData.imageAlt,
        image_count: formData.mode === 'authority' ? 8 : 3,
        word_count: formData.mode === 'authority' ? 2400 : 1000,
        generation_mode: formData.mode === 'authority' ? 'deep' : 'fast',
      };
      
      console.log('[V5.0] Invoking Engine v1 via create-generation-job...');
      
      // ENGINE V1: All generation goes through create-generation-job → orchestrate-generation
      const enginePayload = {
        keyword: formData.keyword.trim(),
        blog_id: blog.id,
        city: formData.city.trim(),
        state: formData.state || undefined,
        country: 'BR',
        language: 'pt-BR',
        niche: formData.niche || 'default',
        job_type: 'article' as const,
        intent: 'informational' as const,
        target_words: formData.mode === 'authority' ? 2500 : 1200,
        image_count: formData.mode === 'authority' ? 8 : 4,
      };

      // V5.0: Fire-and-forget — polling handles completion/failure
      supabase.functions.invoke('create-generation-job', {
        body: enginePayload
      }).then(({ data, error }) => {
        if (error) {
          const errorMsg = error.message || '';
          // V5.0: Timeout errors are OK — polling will detect completion
          const isTimeout = 
            errorMsg.includes('Failed to fetch') ||
            errorMsg.includes('FunctionsFetchError') ||
            errorMsg.includes('Failed to send') ||
            errorMsg.includes('timed out');
          
          if (isTimeout) {
            console.log('[V5.0] Invoke timeout — continuing polling...');
            return; // Polling will handle it
          }

          // Real errors (not timeout)
          if (errorMsg.includes('429')) {
            toast.error('Limite de requisições excedido. Aguarde alguns minutos.');
          } else if (errorMsg.includes('402')) {
            toast.error('Créditos insuficientes.');
          } else {
            console.error('[V5.0] Edge function error:', error);
            // Don't stop — let polling decide (backend may have already started)
          }
        }

        // Handle QUALITY_GATE_FAILED from response data
        if (data?.error === 'QUALITY_GATE_FAILED') {
          const errorCode = data?.code || '';
          const errorMap: Record<string, string> = {
            'missing_city': 'Cidade é obrigatória para gerar o artigo',
            'missing_niche': 'Nicho é obrigatório para gerar o artigo',
            'invalid_json': 'Erro ao processar resposta da IA. Tente novamente.',
            'missing_title': 'Artigo gerado sem título. Tente novamente.',
            'insufficient_sections': data?.details || 'Artigo com estrutura incompleta',
            'invalid_sections': data?.details || 'Artigo contém seções vazias',
            'insufficient_faq': data?.details || 'FAQ insuficiente no artigo',
            'insufficient_images': data?.details || 'Imagens insuficientes no artigo',
            'missing_hero_image': 'Hero image obrigatória não foi gerada',
            'insufficient_word_count': data?.details || 'Artigo muito curto',
            'missing_introduction': 'Artigo sem introdução adequada',
            'missing_conclusion': 'Artigo sem conclusão'
          };
          
          const errorMessage = errorMap[errorCode] || data?.message || 'Erro na geração';
          setIsGenerating(false);
          setPlaceholderArticleId(null);
          toast.error(errorMessage);
        }
      }).catch((err) => {
        // Network-level errors (timeout) — polling continues
        console.log('[V5.0] Invoke catch (likely timeout):', err?.message);
        // Don't stop generation — polling handles recovery
      });
      
    } catch (err: any) {
      console.error('[V5.0] Generation setup error:', err);
      setIsGenerating(false);
      setPlaceholderArticleId(null);
      toast.error(err.message || 'Erro ao iniciar geração');
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
      
      {/* Generation Progress Overlay — V5.0: Real polling data */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <ArticleGenerationProgress
              currentStage={currentStage}
              progress={currentProgress}
              showTimeoutWarning={showTimeoutWarning}
              keyword={formData.keyword}
              onCancel={handleCancel}
              isStuck={polling.isStuck}
              stuckDuration={polling.stuckCounter}
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
