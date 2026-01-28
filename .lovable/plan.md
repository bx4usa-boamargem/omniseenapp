
# Plano de Implementação: Early Redirect Pattern

## Verificação de Pré-requisito

**Status das colunas `status` em `articles` e `landing_pages`:**
- `articles.status`: tipo `string | null` (TEXT) ✅
- `landing_pages.status`: tipo `string` (TEXT) ✅

**Conclusão:** Ambas as colunas são TEXT, não ENUM. O valor "generating" pode ser usado diretamente SEM necessidade de migration SQL.

---

## Modificações por Arquivo

### 1. useLandingPages.ts

**Objetivo:** Separar o fluxo de geração em duas etapas:
1. `createPagePlaceholder` - Insert imediato com status "generating"
2. `generatePageContent` - Processamento pesado (IA + imagens)

**Localização:** `src/components/client/landingpage/hooks/useLandingPages.ts`

**Mudanças:**

1. Adicionar nova função `createPagePlaceholder` (inserir após linha 232):
```typescript
const createPagePlaceholder = useCallback(async (
  blogId: string, 
  templateType: string
): Promise<{ id: string } | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    
    const timestamp = Date.now();
    const { data, error } = await supabase
      .from("landing_pages")
      .insert({
        blog_id: blogId,
        user_id: user.id,
        title: "Nova Super Página",
        slug: `super-pagina-${timestamp}`,
        status: "generating",
        page_data: { template: templateType },
        template_type: templateType,
        generation_source: 'ai',
      })
      .select("id")
      .single();
    
    if (error) throw error;
    console.log("[createPagePlaceholder] Created placeholder with id:", data.id);
    return data;
  } catch (err) {
    console.error("[createPagePlaceholder] Error:", err);
    toast.error("Erro ao criar página");
    return null;
  }
}, []);
```

2. Adicionar função `generatePageContent` (inserir após `createPagePlaceholder`):
```typescript
const generatePageContent = useCallback(async (
  pageId: string,
  request: GenerateLandingPageRequest
): Promise<boolean> => {
  setGenerating(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    
    toast.info("Gerando estrutura da página...");
    
    // 1. Gerar estrutura via Edge Function
    const { data, error } = await supabase.functions.invoke("generate-landing-page", {
      body: request,
    });

    if (error || !data.success) {
      throw new Error(data?.error || "IA generation failed");
    }
    
    let pageData = data.page_data;
    const isPro = pageData.template === 'service_authority_pro_v1';
    
    // 2. Resolução de imagens (mesmo código existente)
    if (isPro) {
      toast.info("Gerando 15+ imagens fotográficas profissionais...");
      const imageResult = await resolveAllProImages(pageData, request.blog_id, user.id);
      pageData = imageResult.data;
    } else {
      // Imagens do template standard (código existente)
      if (pageData.hero?.image_prompt) {
        const heroUrl = await generateImageWithRetry(
          pageData.hero.image_prompt, 'hero', request.blog_id, user.id
        );
        pageData.hero.image_url = heroUrl;
      }
      if (Array.isArray(pageData.services)) {
        for (let i = 0; i < pageData.services.length; i++) {
          if (pageData.services[i].image_prompt) {
            const svcUrl = await generateImageWithRetry(
              pageData.services[i].image_prompt, `service_${i}`, request.blog_id, user.id
            );
            pageData.services[i].image_url = svcUrl;
          }
        }
      }
    }

    // 3. Atualizar o registro placeholder com conteúdo completo
    const { error: updateError } = await supabase
      .from("landing_pages")
      .update({
        title: data.seo_title || pageData.hero?.headline || "Nova Super Página",
        page_data: pageData,
        template_type: pageData.template || request.template_type || 'service_authority_v1',
        status: 'published',
        published_at: new Date().toISOString(),
        seo_title: data.seo_title || pageData.hero?.headline || "Nova Super Página",
        seo_description: data.seo_description || pageData.hero?.subheadline || "",
        seo_keywords: data.seo_keywords || [],
      })
      .eq("id", pageId);

    if (updateError) throw updateError;

    toast.success(isPro ? "🎉 Super Página PRO criada!" : "Super Página gerada!");
    return true;
  } catch (err: any) {
    console.error("[generatePageContent] Error:", err);
    
    // Marcar como falha
    await supabase
      .from("landing_pages")
      .update({ status: 'draft' })
      .eq("id", pageId);
    
    toast.error(err.message || "Falha na geração");
    return false;
  } finally {
    setGenerating(false);
  }
}, []);
```

3. Atualizar o retorno do hook (linha ~729) para incluir as novas funções:
```typescript
return {
  pages,
  loading,
  generating,
  saving,
  fetchPages,
  generatePage,         // Manter para compatibilidade
  createPagePlaceholder, // NOVO
  generatePageContent,   // NOVO
  savePage,
  updatePage,
  deletePage,
  publishPage,
  unpublishPage,
  duplicatePage,
  archivePage,
  unarchivePage,
  analyzeSEO,
  fixSEO,
  regeneratePage
};
```

4. Atualizar interface `UseLandingPagesReturn` (linhas 7-25) para incluir:
```typescript
createPagePlaceholder: (blogId: string, templateType: string) => Promise<{ id: string } | null>;
generatePageContent: (pageId: string, request: GenerateLandingPageRequest) => Promise<boolean>;
```

---

### 2. LandingPageEditor.tsx

**Objetivo:** Implementar Early Redirect Pattern

**Localização:** `src/components/client/landingpage/LandingPageEditor.tsx`

**Mudanças:**

1. Atualizar import do hook (linha 70):
```typescript
const { 
  generatePage, 
  createPagePlaceholder,  // NOVO
  generatePageContent,    // NOVO
  savePage, 
  updatePage, 
  deletePage, 
  publishPage, 
  unpublishPage, 
  generating, 
  saving, 
  analyzeSEO, 
  fixSEO, 
  regeneratePage 
} = useLandingPages();
```

2. Adicionar import do Progress (topo do arquivo):
```typescript
import { Progress } from "@/components/ui/progress";
```

3. Adicionar estados para progresso de geração (após linha 88):
```typescript
const [generationProgress, setGenerationProgress] = useState(0);
const [generationStage, setGenerationStage] = useState<string | null>(null);
```

4. Modificar `handleGenerate` (linhas 197-221):
```typescript
const handleGenerate = async () => {
  if (!blog?.id) return;

  // 1. Criar placeholder IMEDIATO
  const placeholder = await createPagePlaceholder(blog.id, selectedTemplate);
  if (!placeholder) return;

  console.log("[handleGenerate] Placeholder created, navigating to:", placeholder.id);
  
  // 2. Navegar IMEDIATAMENTE para o editor
  navigate(`/client/landing-pages/${placeholder.id}`, { replace: true });
};
```

5. Adicionar useEffect para detectar status "generating" e iniciar geração (após linha 163):
```typescript
// Early Redirect Pattern: Detectar status "generating" e iniciar geração dentro do editor
useEffect(() => {
  const runGeneration = async () => {
    if (page?.status === "generating" && !generating && blog?.id) {
      console.log("[EarlyRedirect] Detected generating status, starting content generation");
      
      setGenerationStage("Gerando estrutura...");
      setGenerationProgress(10);
      
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 5, 85));
      }, 2000);
      
      const success = await generatePageContent(page.id, {
        blog_id: blog.id,
        company_name: businessProfile?.company_name,
        niche: businessProfile?.niche,
        city: businessProfile?.city,
        services: businessProfile?.services?.split(','),
        phone: businessProfile?.phone || "",
        template_type: page.page_data?.template || 'service_authority_v1'
      });
      
      clearInterval(progressInterval);
      setGenerationProgress(100);
      
      if (success) {
        setGenerationStage(null);
        // Recarregar página com dados finais
        await loadPage();
      } else {
        setGenerationStage("Erro na geração");
      }
    }
  };
  
  runGeneration();
}, [page?.status, generating, blog?.id, businessProfile]);
```

6. Adicionar UI de progresso no render (após linha 350, antes do loading check):
```typescript
// UI de Geração em Andamento
if (page?.status === "generating" || generating) {
  return (
    <div className="flex items-center justify-center h-96">
      <Card className="p-8 max-w-md w-full">
        <div className="space-y-6 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <div>
            <h3 className="font-semibold text-lg">Gerando sua Super Página...</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {generationStage || "Preparando conteúdo..."}
            </p>
          </div>
          <Progress value={generationProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Isso pode levar alguns minutos para páginas com muitas imagens.
          </p>
        </div>
      </Card>
    </div>
  );
}
```

---

### 3. ClientArticleEditor.tsx

**Objetivo:** Implementar Early Redirect Pattern para artigos

**Localização:** `src/pages/client/ClientArticleEditor.tsx`

**Mudanças:**

1. Adicionar função `createArticlePlaceholder` (após linha 180):
```typescript
const createArticlePlaceholder = async (blogId: string, theme: string): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    
    const slug = theme
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .substring(0, 60) + `-${Date.now()}`;
    
    const { data, error } = await supabase
      .from("articles")
      .insert({
        blog_id: blogId,
        title: theme,
        slug,
        status: "generating",
        generation_source: "form",
      })
      .select("id")
      .single();
    
    if (error) throw error;
    console.log("[createArticlePlaceholder] Created placeholder:", data.id);
    return data.id;
  } catch (err) {
    console.error("[createArticlePlaceholder] Error:", err);
    toast.error("Erro ao criar artigo");
    return null;
  }
};
```

2. Modificar `handleGenerate` (linhas 381-516) - substituir o início:
```typescript
const handleGenerate = async (formData: SimpleFormData) => {
  if (!blog?.id) {
    toast.error('Blog não encontrado. Recarregue a página.');
    return;
  }

  if (generationLockRef.current) {
    console.warn('[GUARD] Generation already in progress');
    return;
  }
  generationLockRef.current = true;

  try {
    // Check for duplicates
    const flowResult = await ensureSingleArticle(blog.id, formData.theme);
    if (flowResult.action === 'update' && flowResult.articleId) {
      toast.info('Artigo já existe. Abrindo para edição...');
      generationLockRef.current = false;
      navigate(`/client/articles/${flowResult.articleId}/edit`);
      return;
    }

    // 1. Criar placeholder IMEDIATO
    const placeholderId = await createArticlePlaceholder(blog.id, formData.theme);
    if (!placeholderId) {
      generationLockRef.current = false;
      return;
    }

    // 2. Navegar IMEDIATAMENTE para o editor
    console.log("[handleGenerate] Navigating to:", placeholderId);
    navigate(`/client/articles/${placeholderId}/edit`, { replace: true });
    
  } catch (err) {
    console.error("[handleGenerate] Error:", err);
    generationLockRef.current = false;
    toast.error("Erro ao iniciar geração");
  }
};
```

3. Modificar `loadExistingArticle` (linhas 302-347) para detectar status "generating":
```typescript
const loadExistingArticle = async (id: string) => {
  try {
    const { data, error } = await supabase.from('articles').select('*').eq('id', id).single();

    if (error || !data) {
      toast.error('Artigo não encontrado');
      navigate('/client/articles');
      return;
    }

    // Early Redirect Pattern: Se status é "generating", iniciar geração
    if (data.status === "generating") {
      console.log("[loadExistingArticle] Detected generating status, starting stream");
      setExistingArticleId(data.id);
      setTitle(data.title || '');
      setPhase('generating');
      setIsGenerating(true);
      setGenerationStage('analyzing');
      setGenerationProgress(0);
      
      // Buscar formData do localStorage se disponível, ou usar título
      const formData = {
        theme: data.title,
        generationMode: 'fast' as const,
        generateImages: true,
        scheduleMode: 'now' as const,
        scheduledDate: null,
        scheduledTime: null,
      };
      
      await streamArticle({
        theme: formData.theme,
        blogId: blog?.id || data.blog_id,
        generationMode: formData.generationMode,
        tone: 'friendly',
        autoPublish: true,
        onStage: (stage) => setGenerationStage(stage),
        onProgress: (percent) => setGenerationProgress(percent),
        onDelta: (text) => setStreamingText((prev) => prev + text),
        onDone: async (result) => {
          setIsGenerating(false);
          setGenerationStage(null);
          generationLockRef.current = false;

          if (result) {
            // Atualizar o placeholder com conteúdo gerado
            await supabase
              .from('articles')
              .update({
                title: result.title,
                content: result.content,
                excerpt: result.excerpt,
                meta_description: result.meta_description,
                faq: result.faq || [],
                status: 'published',
                published_at: new Date().toISOString(),
              })
              .eq('id', data.id);

            // Recarregar para obter dados completos
            loadExistingArticle(data.id);
            
            toast.success('Artigo gerado!');
            
            // Gerar imagens se necessário
            if (formData.generateImages) {
              await generateImagesWithArticleId(result, data.id);
            }
          }
        },
        onError: (error) => {
          setIsGenerating(false);
          setGenerationStage(null);
          generationLockRef.current = false;
          toast.error(error || 'Erro ao gerar artigo');
          
          // Marcar como draft em caso de erro
          supabase.from('articles').update({ status: 'draft' }).eq('id', data.id);
        },
      });
      return; // Early return - geração em andamento
    }

    // Fluxo normal para artigos existentes
    setExistingArticleId(data.id);
    setExistingArticleSlug(data.slug || null);
    setTitle(data.title || '');
    setContent(data.content || '');
    setExcerpt(data.excerpt || '');
    setMetaDescription(data.meta_description || '');
    setFaq(Array.isArray(data.faq) ? (data.faq as unknown as Array<{ question: string; answer: string }>) : []);
    setFeaturedImage(data.featured_image_url || null);
    setContentImages(Array.isArray(data.content_images) ? (data.content_images as unknown as ContentImage[]) : []);
    setPhase('editing');

    // Auto-detect missing images (código existente)
    if (!data.featured_image_url && data.content && data.content.length > 200) {
      toast.info('Este artigo não tem imagens. Use o menu de ações para gerar.', {
        duration: 5000,
        action: {
          label: 'Gerar Agora',
          onClick: () => handleGenerateMissingImages(data.id, data.title, data.content),
        },
      });
    }
  } catch (err) {
    console.error('Error loading article:', err);
    toast.error('Erro ao carregar artigo');
  }
};
```

---

### 4. OmniseenLogo.tsx

**Objetivo:** Aumentar tamanho da logo no sidebar

**Localização:** `src/components/ui/OmniseenLogo.tsx`

**Mudança (linha 14):**
```typescript
// De:
sidebar: "h-12 max-w-[56px]",

// Para:
sidebar: "h-14 max-w-[80px]",
```

---

### 5. MinimalSidebar.tsx

**Objetivo:** Adicionar Radar como item de navegação primária

**Localização:** `src/components/layout/MinimalSidebar.tsx`

**Mudanças:**

1. Adicionar import do ícone Radar (linha 11):
```typescript
import { 
  PenTool, 
  FileText, 
  Users, 
  Bell, 
  HelpCircle,
  Layers,
  LayoutTemplate,
  Sparkles,
  Radar  // NOVO
} from 'lucide-react';
```

2. Adicionar função `isRadarActive` (após linha 102):
```typescript
const isRadarActive = () => {
  return location.pathname.startsWith('/client/radar');
};
```

3. Adicionar item Radar na navegação (após linha 139, depois de "Leads"):
```typescript
{/* Radar - primary navigation */}
<SidebarNavItem
  icon={Radar}
  label="Radar"
  isActive={isRadarActive()}
  onClick={() => navigate('/client/radar')}
/>
```

---

## Resumo das Alterações

| # | Arquivo | Alteração Principal |
|---|---------|---------------------|
| 1 | `useLandingPages.ts` | Adicionar `createPagePlaceholder` e `generatePageContent` |
| 2 | `LandingPageEditor.tsx` | Early Redirect + UI de progresso |
| 3 | `ClientArticleEditor.tsx` | Early Redirect + detecção de "generating" |
| 4 | `OmniseenLogo.tsx` | Aumentar tamanho: `h-14 max-w-[80px]` |
| 5 | `MinimalSidebar.tsx` | Adicionar Radar na navegação |

---

## Critérios de Aceite

| # | Teste | Comportamento Esperado |
|---|-------|------------------------|
| 1 | Clicar "Criar Super Página" | Navega para `/client/landing-pages/{id}` em < 1s |
| 2 | Super Página no editor | Mostra barra de progresso durante geração |
| 3 | Após geração Super Página | Status muda para "published", página renderiza |
| 4 | Clicar "Gerar Artigo" | Navega para `/client/articles/{id}/edit` em < 1s |
| 5 | Artigo no editor | Mostra streaming de texto em tempo real |
| 6 | Após geração Artigo | Status muda para "published", conteúdo exibido |
| 7 | Sidebar - Logo | Tamanho adequado de marca (não favicon) |
| 8 | Sidebar - Radar | Visível e navegável para `/client/radar` |

---

## Garantias de Escopo

**NÃO será alterado:**
- Backend/Edge Functions
- Estrutura de banco de dados
- Billing/Pricing
- Layout geral
- Outras funcionalidades

**SERÁ alterado apenas:**
- Fluxo de criação (placeholder → navigate → generate in editor)
- Tamanho do logo
- Navegação do Radar
