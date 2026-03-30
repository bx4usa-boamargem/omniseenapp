/**
 * ClientOnboarding - Wizard multi-step self-service
 * Inspirado no fluxo Automarticles
 * 
 * Steps:
 * 1. Maturidade (iniciante/experiente)
 * 2. Dados da empresa (nome, descrição, tem site?)
 * 3. Público-alvo + conceitos
 * 4. Concorrentes
 * 5. Artigos sugeridos
 * 6. Setup do blog (CTA)
 * 7. Personalização (cores, logo, subdomínio)
 * 8. Conclusão
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { Loader2 } from 'lucide-react';

// Step components
import { StepMaturity } from '@/components/onboarding/wizard/StepMaturity';
import { StepCompany } from '@/components/onboarding/wizard/StepCompany';
import { StepAudience } from '@/components/onboarding/wizard/StepAudience';
import { StepCompetitors } from '@/components/onboarding/wizard/StepCompetitors';
import { StepArticles } from '@/components/onboarding/wizard/StepArticles';
import { StepBlogSetup } from '@/components/onboarding/wizard/StepBlogSetup';
import { StepCustomize } from '@/components/onboarding/wizard/StepCustomize';
import { StepComplete } from '@/components/onboarding/wizard/StepComplete';

export interface OnboardingData {
  // Step 1
  maturity: 'beginner' | 'experienced' | null;
  // Step 2
  hasSite: boolean;
  siteUrl: string;
  companyName: string;
  companyDescription: string;
  // Step 3
  targetAudience: string;
  concepts: string[];
  // Step 4
  competitors: Array<{ name: string; url: string; description: string; isSuggestion?: boolean }>;
  // Step 5
  suggestedArticles: Array<{
    title: string;
    keyword?: string;
    searchVolume?: number;
    trafficValue?: string;
    selected: boolean;
  }>;
  // Step 6
  ctaType: 'link' | 'whatsapp';
  ctaText: string;
  ctaUrl: string;
  // Step 7
  blogSlug: string;
  primaryColor: string;
  logoUrl: string;
}

const INITIAL_DATA: OnboardingData = {
  maturity: null,
  hasSite: false,
  siteUrl: '',
  companyName: '',
  companyDescription: '',
  targetAudience: '',
  concepts: [],
  competitors: [],
  suggestedArticles: [],
  ctaType: 'link',
  ctaText: '',
  ctaUrl: '',
  blogSlug: '',
  primaryColor: '#7C3AED',
  logoUrl: '',
};

const STEP_TITLES = [
  'Maturidade',
  'Empresa',
  'Público',
  'Concorrentes',
  'Artigos',
  'Blog',
  'Personalizar',
  'Pronto!',
];

export default function ClientOnboarding() {
  const { user } = useAuth();
  const { blog } = useBlog();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [articlesGenerating, setArticlesGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  // If blog already completed onboarding, redirect
  useEffect(() => {
    if (blog?.onboarding_completed) {
      navigate('/client/dashboard', { replace: true });
    }
  }, [blog, navigate]);

  // Pre-fill company name from blog
  useEffect(() => {
    if (blog && !data.companyName) {
      setData(prev => ({
        ...prev,
        companyName: blog.name || '',
        blogSlug: blog.slug || '',
      }));
    }
  }, [blog]);

  const totalSteps = STEP_TITLES.length;

  const updateData = (partial: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const skipOnboarding = async () => {
    if (!blog) return;
    try {
      await supabase
        .from('blogs')
        .update({ onboarding_completed: true })
        .eq('id', blog.id);
      navigate('/client/dashboard', { replace: true });
    } catch {
      navigate('/client/dashboard', { replace: true });
    }
  };

  const handleFinishOnboarding = async () => {
    if (!blog || !user) return;
    setArticlesGenerating(true);

    try {
      // 1. Save business profile
      const { error: profileError } = await supabase
        .from('business_profile')
        .upsert({
          blog_id: blog.id,
          company_name: data.companyName,
          long_description: data.companyDescription,
          niche: data.concepts[0] || blog.name,
          city: '',
          target_audience: data.targetAudience,
          brand_keywords: data.concepts,
          website_url: data.hasSite ? data.siteUrl : null,
        }, { onConflict: 'blog_id' });

      if (profileError) console.error('Profile save error:', profileError);

      // 2. Update blog settings
      await supabase
        .from('blogs')
        .update({
          name: data.companyName || blog.name,
          slug: data.blogSlug || blog.slug,
          primary_color: data.primaryColor,
          logo_url: data.logoUrl || null,
          cta_type: data.ctaType,
          cta_text: data.ctaText,
          cta_url: data.ctaUrl,
          onboarding_completed: true,
        })
        .eq('id', blog.id);

      // 3. Queue selected articles for generation
      const selectedArticles = data.suggestedArticles.filter(a => a.selected);
      if (selectedArticles.length > 0) {
        const queueItems = selectedArticles.map(article => ({
          blog_id: blog.id,
          suggested_theme: article.title,
          keywords: article.keyword ? [article.keyword] : [],
          status: 'pending',
          generation_source: 'onboarding',
        }));

        const { error: queueError } = await supabase
          .from('article_queue')
          .insert(queueItems);

        if (queueError) {
          console.error('Queue insert error:', queueError);
        } else {
          setGeneratedCount(selectedArticles.length);
        }
      }

      // 4. Save competitors
      if (data.competitors.length > 0) {
        const competitorRows = data.competitors.map(c => ({
          blog_id: blog.id,
          name: c.name,
          website_url: c.url,
          notes: c.description,
        }));

        await supabase
          .from('competitors')
          .insert(competitorRows)
          .select();
      }

      toast.success('Onboarding concluído! Seus artigos estão sendo gerados.');
      setCurrentStep(totalSteps - 1); // Go to complete step
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error('Erro ao finalizar. Tente novamente.');
    } finally {
      setArticlesGenerating(false);
    }
  };

  if (!blog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepMaturity
            data={data}
            onUpdate={updateData}
            onNext={nextStep}
          />
        );
      case 1:
        return (
          <StepCompany
            data={data}
            onUpdate={updateData}
            onNext={nextStep}
            onBack={prevStep}
            blogId={blog.id}
          />
        );
      case 2:
        return (
          <StepAudience
            data={data}
            onUpdate={updateData}
            onNext={nextStep}
            onBack={prevStep}
            blogId={blog.id}
          />
        );
      case 3:
        return (
          <StepCompetitors
            data={data}
            onUpdate={updateData}
            onNext={nextStep}
            onBack={prevStep}
            blogId={blog.id}
          />
        );
      case 4:
        return (
          <StepArticles
            data={data}
            onUpdate={updateData}
            onNext={nextStep}
            onBack={prevStep}
            blogId={blog.id}
          />
        );
      case 5:
        return (
          <StepBlogSetup
            data={data}
            onUpdate={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 6:
        return (
          <StepCustomize
            data={data}
            onUpdate={updateData}
            onFinish={handleFinishOnboarding}
            onBack={prevStep}
            isLoading={articlesGenerating}
            blogSlug={blog.slug}
          />
        );
      case 7:
        return (
          <StepComplete
            data={data}
            generatedCount={generatedCount}
            blogSlug={data.blogSlug || blog.slug}
            onGoToDashboard={() => navigate('/client/dashboard', { replace: true })}
            onViewArticles={() => navigate('/client/articles', { replace: true })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left panel - contextual branding */}
      <div className="hidden lg:flex lg:w-[45%] gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-primary-foreground">
          <div className="mb-8">
            <OmniseenLogo size="lg" className="brightness-0 invert" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-display font-bold leading-tight mb-4">
            {STEP_TITLES[currentStep] === 'Maturidade' && 'Quanto a blog, qual a sua maturidade?'}
            {STEP_TITLES[currentStep] === 'Empresa' && 'Conta para nós da sua empresa!'}
            {STEP_TITLES[currentStep] === 'Público' && 'Quem é o seu público-alvo?'}
            {STEP_TITLES[currentStep] === 'Concorrentes' && 'Quais os sites dos seus concorrentes?'}
            {STEP_TITLES[currentStep] === 'Artigos' && 'Encontramos os melhores artigos!'}
            {STEP_TITLES[currentStep] === 'Blog' && (
              <>{data.companyName || 'Olá'}, criamos o seu blog!</>
            )}
            {STEP_TITLES[currentStep] === 'Personalizar' && 'Deixe seu blog com sua cara!'}
            {STEP_TITLES[currentStep] === 'Pronto!' && (
              <>Parabéns, {data.companyName || 'seu blog'}! 🚀</>
            )}
          </h2>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            {currentStep === 0 && 'Quanto menos conhecimento, mais vamos fazer escolhas automaticamente por você!'}
            {currentStep === 1 && 'Esta é a parte mais importante! Conta o máximo que puder, assim a gente vai conseguir a melhor qualidade possível!'}
            {currentStep === 2 && 'Vamos usar isto para construir o seu funil de conteúdo, ou seja, quais os temas mais valiosos para escrevermos!'}
            {currentStep === 3 && 'Vamos usar isto para analisar o tráfego deles e descobrir temas ainda mais valiosos - e que geram leads para eles!'}
            {currentStep === 4 && 'A partir da descrição da sua empresa, do seu público e dos seus concorrentes, selecionamos os artigos mais relacionados e com maior potencial de acessos.'}
            {currentStep === 5 && 'Não se preocupe, você sempre poderá mudar estas opções!'}
            {currentStep === 6 && 'Não se preocupe, você sempre poderá mudar estas opções!'}
            {currentStep === 7 && 'Seu blog já está no ar e os artigos estão sendo gerados!'}
          </p>

          {/* Progress dots */}
          <div className="mt-12 flex items-center gap-2">
            {STEP_TITLES.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? 'w-8 bg-primary-foreground'
                    : i < currentStep
                    ? 'w-2 bg-primary-foreground/60'
                    : 'w-2 bg-primary-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-[55%] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="lg:hidden">
            <OmniseenLogo size="sm" />
          </div>
          {articlesGenerating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Escrevendo artigos...
            </div>
          )}
          {currentStep < totalSteps - 1 && (
            <button
              onClick={skipOnboarding}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pular onboarding e ativar conta
            </button>
          )}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 max-w-2xl mx-auto w-full">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
