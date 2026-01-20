import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { ContextStep } from "@/components/onboarding/ContextStep";
import { ProfileStep } from "@/components/onboarding/ProfileStep";
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check,
  Target,
  User,
  Rocket,
  Loader2,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { SectionHelper } from "@/components/blog-editor/SectionHelper";

const STEPS = [
  { id: 1, title: "Contexto", icon: Target },
  { id: 2, title: "Perfil", icon: User },
  { id: 3, title: "Seu Blog", icon: Rocket },
];

interface OnboardingData {
  // Contexto (Step 1)
  blogObjective: string;
  userType: string;
  // Perfil (Step 2)
  phone: string;
  referralSource: string;
  // Blog (Step 3)
  blogName: string;
  blogSlug: string;
}

// Error Boundary Fallback Component - Captura erros de runtime e exibe mensagem amigável
function OnboardingErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error; 
  resetErrorBoundary: () => void;
}) {
  console.error('[Onboarding] Error caught by boundary:', error);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Algo deu errado</h2>
          <p className="text-muted-foreground text-sm">
            Ocorreu um erro inesperado durante o onboarding.
          </p>
        </div>
        
        {/* Mostrar detalhes do erro em desenvolvimento */}
        <div className="p-3 rounded-lg bg-muted/50 text-left">
          <p className="text-xs font-mono text-muted-foreground break-all">
            {error.message || 'Erro desconhecido'}
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <Button 
            onClick={resetErrorBoundary} 
            className="w-full gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/auth'}
            className="w-full"
          >
            Voltar ao login
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [existingBlog, setExistingBlog] = useState<string | null>(null);
  
  const [data, setData] = useState<OnboardingData>({
    blogObjective: "",
    userType: "",
    phone: "",
    referralSource: "",
    blogName: "",
    blogSlug: "",
  });

  // Debug: Log state changes
  useEffect(() => {
    console.log('[Onboarding] Current step:', currentStep);
    console.log('[Onboarding] Data state:', data);
  }, [currentStep, data]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    async function checkExistingBlog() {
      if (!user) return;
      
      const { data: blogData } = await supabase
        .from("blogs")
        .select("id, onboarding_completed")
        .eq("user_id", user.id)
        .single();
      
      if (blogData) {
        setExistingBlog(blogData.id);
        if (blogData.onboarding_completed) {
          navigate("/client/dashboard");
        }
      }
    }
    
    if (user) {
      checkExistingBlog();
    }
  }, [user, navigate]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setData({
      ...data,
      blogName: name,
      blogSlug: generateSlug(name),
    });
  };

  const progress = (currentStep / STEPS.length) * 100;

  const nextStep = () => {
    console.log('[Onboarding] nextStep called. Current:', currentStep, '-> Next:', currentStep + 1);
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    console.log('[Onboarding] prevStep called. Current:', currentStep, '-> Prev:', currentStep - 1);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      // 1. Update profile with new fields
      await supabase
        .from("profiles")
        .update({
          phone: data.phone || null,
          referral_source: data.referralSource || null,
          user_type: data.userType || null,
          blog_objective: data.blogObjective || null,
        })
        .eq("user_id", user.id);

      // 2. Create or update blog with minimal data
      const blogPayload = {
        name: data.blogName,
        slug: data.blogSlug,
        platform_subdomain: data.blogSlug, // Ativa subdomínio instantaneamente
        user_id: user.id,
        onboarding_completed: true,
        // Default values - user can customize later
        primary_color: "#FF7A00",
        secondary_color: "#FF9A3C",
        cta_text: "Saiba mais",
        cta_type: "link",
      };

      if (existingBlog) {
        const { error } = await supabase
          .from("blogs")
          .update(blogPayload)
          .eq("id", existingBlog);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("blogs")
          .insert(blogPayload);
        
        if (error) throw error;
      }
      
      toast({
        title: "Bem-vindo ao OMNISEEN! 🎉",
        description: "Seu blog foi criado. Agora você pode começar a criar artigos.",
      });
      
      // Use window.location para garantir redirect correto no subdomínio
      window.location.href = `${window.location.origin}/client/dashboard`;
    } catch (error: unknown) {
      console.error("Error saving onboarding:", error);
      const message = error instanceof Error ? error.message : "Erro ao salvar dados";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.blogObjective !== "" && data.userType !== "";
      case 2:
        return true; // All fields optional
      case 3:
        return data.blogName.length >= 3 && data.blogSlug.length >= 3;
      default:
        return true;
    }
  };

  // Handle error boundary reset - volta para step 1
  const handleErrorReset = () => {
    setCurrentStep(1);
    setData({
      blogObjective: "",
      userType: "",
      phone: "",
      referralSource: "",
      blogName: "",
      blogSlug: "",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg gradient-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">OMNISEEN</span>
          </div>
        </div>
      </header>

      <main className="container max-w-xl py-8 px-4">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 ${
                  step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    step.id < currentStep
                      ? "gradient-primary text-primary-foreground"
                      : step.id === currentStep
                      ? "border-2 border-primary text-primary bg-primary/10"
                      : "border-2 border-muted text-muted-foreground"
                  }`}
                >
                  {step.id < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className="hidden sm:block text-sm font-medium">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Etapa {currentStep} de {STEPS.length}
          </p>
        </div>

        {/* Step Content - Wrapped in Error Boundary */}
        <ErrorBoundary 
          FallbackComponent={OnboardingErrorFallback}
          onReset={handleErrorReset}
        >
          <div className="bg-card rounded-2xl border shadow-sm p-6 md:p-8 animate-fade-in">
            {currentStep === 1 && (
              <ContextStep
                blogObjective={data.blogObjective}
                userType={data.userType}
                onBlogObjectiveChange={(value) => setData({ ...data, blogObjective: value })}
                onUserTypeChange={(value) => setData({ ...data, userType: value })}
              />
            )}

            {currentStep === 2 && (
              <ProfileStep
                phone={data.phone || ""}
                referralSource={data.referralSource || ""}
                onPhoneChange={(value) => setData({ ...data, phone: value })}
                onReferralSourceChange={(value) => setData({ ...data, referralSource: value })}
              />
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">
                    Criação do Blog
                  </h2>
                  <SectionHelper
                    title=""
                    description="Nome inicial. Personalize cores e domínio depois."
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-base font-medium">
                      Nome do blog *
                    </Label>
                    <Input
                      id="name"
                      placeholder="Ex: Marketing Digital Pro"
                      value={data.blogName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug" className="text-base font-medium">
                      Endereço do seu blog
                    </Label>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                      <span className="text-muted-foreground text-sm">
                        {data.blogSlug || "seu-blog"}.omniseen.app
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Você poderá conectar um domínio próprio depois
                    </p>
                  </div>
                </div>

                {/* Preview card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                  <p className="text-sm font-medium text-foreground mb-2">
                    ✨ O que você terá:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Blog com design profissional</li>
                    <li>• Criação de artigos via chat com IA</li>
                    <li>• SEO otimizado automaticamente</li>
                    <li>• Analytics integrado</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="ghost"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>

              {currentStep < STEPS.length ? (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="gap-2 gradient-primary text-primary-foreground"
                >
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isLoading}
                  className="gap-2 gradient-primary text-primary-foreground"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      Criar meu blog
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </ErrorBoundary>

        {/* Skip hint */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          Todos os campos podem ser alterados posteriormente nas configurações
        </p>
      </main>
    </div>
  );
}
