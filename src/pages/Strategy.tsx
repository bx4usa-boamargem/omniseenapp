import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { toast } from "sonner";
import { 
  Loader2, 
  Building2, 
  BookOpen, 
  User, 
  Globe, 
  Target, 
  Sparkles, 
  Info, 
  Settings2, 
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UniversalStrategyTab } from "@/components/strategy/UniversalStrategyTab";
import { BusinessTab } from "@/components/strategy/BusinessTab";
import { LibraryTab } from "@/components/strategy/LibraryTab";
import { AudienceTab } from "@/components/strategy/AudienceTab";
import { CompetitorsTab } from "@/components/strategy/CompetitorsTab";
import { KeywordsTab } from "@/components/strategy/KeywordsTab";
import { SimpleKeywordsSection } from "@/components/strategy/SimpleKeywordsSection";

interface BusinessProfile {
  id?: string;
  blog_id: string;
  project_name: string;
  language: string;
  country: string;
  niche: string;
  target_audience: string;
  tone_of_voice: string;
  long_description: string;
  concepts: string[];
  pain_points: string[];
  desires: string[];
  brand_keywords: string[];
  is_library_enabled: boolean;
}

interface Persona {
  id: string;
  name: string;
  age_range: string;
  profession: string;
  goals: string[];
  challenges: string[];
  description: string;
  problems: string[];
  solutions: string[];
  objections: string[];
}

interface LibraryItem {
  id: string;
  type: "image" | "document";
  file_url: string;
  file_name: string;
  description: string | null;
  is_active: boolean;
}

interface KeywordSuggestion {
  keyword: string;
  type: string;
}

interface KeywordAnalysis {
  id: string;
  keyword: string;
  difficulty: number | null;
  search_volume: number | null;
  suggestions: KeywordSuggestion[];
  analyzed_at: string;
}

export default function Strategy() {
  const { user } = useAuth();
  const { blog, loading: blogLoading } = useBlog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Business Profile State
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    blog_id: "",
    project_name: "",
    language: "pt-BR",
    country: "Brasil",
    niche: "",
    target_audience: "",
    tone_of_voice: "friendly",
    long_description: "",
    concepts: [],
    pain_points: [],
    desires: [],
    brand_keywords: [],
    is_library_enabled: false,
  });

  // Personas State
  const [personas, setPersonas] = useState<Persona[]>([]);

  // Library State
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  // Keyword Analysis State
  const [keywordAnalyses, setKeywordAnalyses] = useState<KeywordAnalysis[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!user || !blog) return;

      try {
        // Fetch business profile
        const { data: profileData } = await supabase
          .from("business_profile")
          .select("*")
          .eq("blog_id", blog.id)
          .maybeSingle();

        if (profileData) {
          setBusinessProfile({
            id: profileData.id,
            blog_id: profileData.blog_id,
            project_name: profileData.project_name || "",
            language: profileData.language || "pt-BR",
            country: profileData.country || "Brasil",
            niche: profileData.niche || "",
            target_audience: profileData.target_audience || "",
            tone_of_voice: profileData.tone_of_voice || "friendly",
            long_description: profileData.long_description || "",
            concepts: profileData.concepts || [],
            pain_points: profileData.pain_points || [],
            desires: profileData.desires || [],
            brand_keywords: profileData.brand_keywords || [],
            is_library_enabled: profileData.is_library_enabled || false,
          });
        } else {
          setBusinessProfile((prev) => ({ ...prev, blog_id: blog.id }));
        }

        // Fetch personas
        const { data: personasData } = await supabase
          .from("personas")
          .select("*")
          .eq("blog_id", blog.id)
          .order("created_at", { ascending: false });

        if (personasData) {
          setPersonas(
            personasData.map((p) => ({
              id: p.id,
              name: p.name,
              age_range: p.age_range || "",
              profession: p.profession || "",
              goals: p.goals || [],
              challenges: p.challenges || [],
              description: p.description || "",
              problems: p.problems || [],
              solutions: p.solutions || [],
              objections: p.objections || [],
            })),
          );
        }

        // Fetch library items
        const { data: libraryData } = await supabase
          .from("user_library")
          .select("*")
          .eq("blog_id", blog.id)
          .order("created_at", { ascending: false });

        if (libraryData) {
          setLibraryItems(libraryData as LibraryItem[]);
        }

        // Fetch keyword analyses history
        const { data: keywordsData } = await supabase
          .from("keyword_analyses")
          .select("*")
          .eq("blog_id", blog.id)
          .order("analyzed_at", { ascending: false })
          .limit(20);

        if (keywordsData) {
          setKeywordAnalyses(
            keywordsData.map((item) => ({
              id: item.id,
              keyword: item.keyword,
              difficulty: item.difficulty,
              search_volume: item.search_volume,
              suggestions: (item.suggestions as unknown as KeywordSuggestion[]) || [],
              analyzed_at: item.analyzed_at,
            })),
          );
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (blog) {
      fetchData();
    } else if (!blogLoading) {
      setLoading(false);
    }
  }, [user, blog, blogLoading]);

  const blogId = blog?.id || null;

  const handleUpdateBusinessProfile = async (data: Partial<BusinessProfile>) => {
    if (!businessProfile.id) return;
    
    try {
      await supabase
        .from("business_profile")
        .update(data)
        .eq("id", businessProfile.id);
      
      setBusinessProfile((prev) => ({ ...prev, ...data }));
    } catch (error) {
      console.error("Error updating business profile:", error);
      toast.error("Erro ao atualizar configurações");
    }
  };

  if (loading || blogLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Estratégia</h1>
          <p className="text-muted-foreground">
            Configure sua estratégia de conteúdo para que a IA gere artigos mais alinhados ao seu negócio.
          </p>
        </div>

        {/* Main Strategy Content */}
        <div className="space-y-6">
          {/* Universal Strategy Tab - Always visible */}
          {blogId && <UniversalStrategyTab blogId={blogId} />}

          {/* Simple Keywords Section - Always visible */}
          {blogId && (
            <div className="mt-6">
              <SimpleKeywordsSection blogId={blogId} />
            </div>
          )}

          {/* Advanced SEO Section - Collapsible */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="mt-8">
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between gap-2 h-auto py-4 border-dashed"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <span className="font-medium">Configurações Avançadas de SEO</span>
                    <p className="text-xs text-muted-foreground font-normal">
                      SEO técnico para usuários avançados. Não é obrigatório para gerar artigos.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="ml-2">
                  Opcional
                </Badge>
                {showAdvanced ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-6">
              <Alert className="mb-6 bg-muted/50 border-dashed">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Avançado:</strong> Estas configurações são opcionais e servem para refinamento de SEO. 
                  A Estratégia Principal já é suficiente para gerar artigos.
                </AlertDescription>
              </Alert>

              <Tabs defaultValue="keywords" className="space-y-6">
                <TabsList className="flex flex-wrap gap-1 h-auto p-1">
                  <TabsTrigger value="keywords" className="gap-2">
                    <Target className="h-4 w-4" />
                    <span className="hidden sm:inline">Análise de Palavras-chave</span>
                    {keywordAnalyses.length > 0 && (
                      <Badge variant="outline" className="ml-1 text-xs px-1.5 py-0">
                        {keywordAnalyses.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="competitors" className="gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">Concorrentes</span>
                  </TabsTrigger>
                  <TabsTrigger value="audience" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Personas Avançadas</span>
                  </TabsTrigger>
                  <TabsTrigger value="library" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">Biblioteca</span>
                  </TabsTrigger>
                  <TabsTrigger value="business" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Meu Negócio</span>
                  </TabsTrigger>
                </TabsList>

                {/* Keywords Analysis Tab (Advanced) */}
                <TabsContent value="keywords">
                  {blogId && (
                    <KeywordsTab
                      blogId={blogId}
                      keywordAnalyses={keywordAnalyses}
                      setKeywordAnalyses={setKeywordAnalyses}
                    />
                  )}
                </TabsContent>

                {/* Concorrentes Tab */}
                <TabsContent value="competitors">
                  {blogId && <CompetitorsTab blogId={blogId} />}
                </TabsContent>

                {/* Público-alvo Tab */}
                <TabsContent value="audience">
                  {blogId && (
                    <AudienceTab
                      blogId={blogId}
                      personas={personas}
                      setPersonas={setPersonas}
                      niche={businessProfile.niche}
                    />
                  )}
                </TabsContent>

                {/* Minha Biblioteca Tab */}
                <TabsContent value="library">
                  {blogId && (
                    <LibraryTab
                      blogId={blogId}
                      libraryItems={libraryItems}
                      setLibraryItems={setLibraryItems}
                      isLibraryEnabled={businessProfile.is_library_enabled}
                      setIsLibraryEnabled={(enabled) =>
                        setBusinessProfile((prev) => ({ ...prev, is_library_enabled: enabled }))
                      }
                      onUpdateBusinessProfile={handleUpdateBusinessProfile}
                    />
                  )}
                </TabsContent>

                {/* Meu Negócio Tab */}
                <TabsContent value="business">
                  {blogId && (
                    <BusinessTab
                      blogId={blogId}
                      businessProfile={businessProfile}
                      setBusinessProfile={setBusinessProfile}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </DashboardLayout>
  );
}
