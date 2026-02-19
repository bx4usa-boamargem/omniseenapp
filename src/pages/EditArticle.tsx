import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArticlePreview } from "@/components/ArticlePreview";
import { SEOScoreAnalyzer } from "@/components/seo/SEOScoreAnalyzer";
import { SEOChangeComparison, ComparisonData } from "@/components/seo/SEOChangeComparison";
import { ArticleVersionHistory, ArticleVersion } from "@/components/seo/ArticleVersionHistory";
import { GenerationProgress, GenerationStage } from "@/components/seo/GenerationProgress";
import { ArticleExportDialog } from "@/components/ArticleExportDialog";
import { SchedulePublishDialog } from "@/components/scheduling/SchedulePublishDialog";
import { InternalLinksSuggestions } from "@/components/seo/InternalLinksSuggestions";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { ArticleSidebar } from "@/components/editor/ArticleSidebar";
import { SocialSharePanel } from "@/components/social/SocialSharePanel";
import { ImproveArticleDialog } from "@/components/editor/ImproveArticleDialog";
import { PublishWithTranslationDialog } from "@/components/editor/PublishWithTranslationDialog";
import { KeywordDensityChecker } from "@/components/editor/KeywordDensityChecker";
import { KeywordPositionGuide } from "@/components/editor/KeywordPositionGuide";
// streamArticle removed — Engine v1 async only
import { getArticleUrl } from "@/utils/blogUrl";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  Save, 
  Upload, 
  Loader2, 
  Sparkles,
  Trash2,
  History,
  ExternalLink,
  Download,
  Calendar,
  Clock,
  Eye,
  Edit3,
  Monitor,
  Smartphone,
  Columns
} from "lucide-react";
import { cn } from "@/lib/utils";


interface ContentImage {
  context: string;
  url: string;
  after_section: number;
}

interface Article {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  slug: string;
  category: string | null;
  keywords: string[] | null;
  meta_description: string | null;
  status: string | null;
  featured_image_url: string | null;
  featured_image_alt?: string | null;
  tags?: string[] | null;
  approved_at?: string | null;
  approved_by?: string | null;
  faq: { question: string; answer: string }[] | null;
  blog_id: string;
  scheduled_at: string | null;
  content_images?: ContentImage[] | null;
}

export default function EditArticle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [blogData, setBlogData] = useState<{ slug: string; custom_domain: string | null; domain_verified: boolean | null } | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "split">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("article-editor-tab");
      if (saved === "preview" || saved === "split") return saved as "editor" | "preview" | "split";
    }
    return "editor";
  });
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Persist active tab preference
  useEffect(() => {
    localStorage.setItem("article-editor-tab", activeTab);
  }, [activeTab]);


  // Generation progress states
  const [generationStage, setGenerationStage] = useState<GenerationStage>(null);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Editable fields
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [category, setCategory] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [slug, setSlug] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [featuredImageAlt, setFeaturedImageAlt] = useState("");

  // SEO Fix states
  const [isFixingTitle, setIsFixingTitle] = useState(false);
  const [isFixingMeta, setIsFixingMeta] = useState(false);
  const [isFixingContent, setIsFixingContent] = useState(false);
  const [isFixingDensity, setIsFixingDensity] = useState(false);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [fixAllStep, setFixAllStep] = useState(0);
  const [fixAllTotal, setFixAllTotal] = useState(0);

  // Version history states
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);

  // Comparison dialog states
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    type: 'title' | 'meta' | 'content' | 'density';
    newValue: string;
    oldValue: string;
  } | null>(null);

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Featured image states
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Scheduling states
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  // Social share states
  const [showSocialShare, setShowSocialShare] = useState(false);

  // Approval states
  const [isApproved, setIsApproved] = useState(false);
  const [approvedAt, setApprovedAt] = useState<Date | null>(null);

  // Improve with AI states
  const [isImprovingArticle, setIsImprovingArticle] = useState(false);
  const [showImproveDialog, setShowImproveDialog] = useState(false);
  const [improveResults, setImproveResults] = useState<{
    improvements: { type: 'paragraph' | 'visual_block' | 'seo' | 'cta'; description: string; location?: string }[];
    stats: { addedVisualBlocks: number; fixedParagraphs: number; seoIssues: number; totalImprovements: number };
    improvedContent: string;
    originalContent: string;
  } | null>(null);

  // Keyword suggestion states
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<{ keyword: string; reason: string }[]>([]);

  // Publish with translation states
  const [showPublishTranslationDialog, setShowPublishTranslationDialog] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [existingTranslations, setExistingTranslations] = useState<string[]>([]);

  useEffect(() => {
    async function fetchArticle() {
      if (!user || !id) return;

      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Artigo não encontrado.",
        });
        navigate("/articles");
        return;
      }

      // Fetch blog data including custom domain
      const { data: blog } = await supabase
        .from("blogs")
        .select("slug, custom_domain, domain_verified")
        .eq("id", data.blog_id)
        .single();
      
      if (blog) {
        setBlogData(blog);
      }


      // Fetch existing translations
      const { data: translations } = await supabase
        .from("article_translations")
        .select("language_code")
        .eq("article_id", id);
      
      if (translations) {
        setExistingTranslations(translations.map(t => t.language_code));
      }

      // Parse FAQ and content_images
      const parsedArticle = {
        ...data,
        faq: typeof data.faq === 'string' ? JSON.parse(data.faq) : data.faq,
        content_images: Array.isArray(data.content_images) ? (data.content_images as unknown as ContentImage[]) : []
      } as Article;

      setArticle(parsedArticle);
      setTitle(data.title || "");
      setExcerpt(data.excerpt || "");
      setMetaDescription(data.meta_description || "");
      setCategory(data.category || "");
      setKeywords(data.keywords || []);
      setStatus(data.status || "draft");
      setFeaturedImage(data.featured_image_url || null);
      setScheduledAt(data.scheduled_at ? new Date(data.scheduled_at) : null);
      setSlug(data.slug || "");
      setTags(data.tags || []);
      setFeaturedImageAlt(data.featured_image_alt || "");
      setIsApproved(!!data.approved_at);
      setApprovedAt(data.approved_at ? new Date(data.approved_at) : null);
      setLoading(false);
    }

    if (!authLoading && user) {
      fetchArticle();
    }
  }, [user, authLoading, id, navigate, toast]);

  // Fetch version history
  const fetchVersions = useCallback(async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from("article_versions")
      .select("*")
      .eq("article_id", id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setVersions(data as ArticleVersion[]);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchVersions();
    }
  }, [id, fetchVersions]);

  // Save version before changes
  const saveVersion = async (changeType: string, changeDescription: string) => {
    if (!article || !id) return;

    const versionNumber = versions.length + 1;

    await supabase.from("article_versions").insert({
      article_id: id,
      version_number: versionNumber,
      title: title,
      content: article.content,
      excerpt: excerpt,
      meta_description: metaDescription,
      keywords: keywords,
      faq: article.faq,
      change_type: changeType,
      change_description: changeDescription,
      created_by: user?.id
    });

    await fetchVersions();
  };

  // Calculate SEO score for comparison
  const calculateSEOScore = (
    checkTitle: string, 
    checkMeta: string, 
    checkContent: string | null,
    checkKeywords: string[]
  ) => {
    let score = 0;
    const contentText = checkContent || '';
    const wordCount = contentText.split(/\s+/).filter(w => w.length > 0).length;
    
    // Title check
    const titleLength = checkTitle.length;
    const keywordInTitle = checkKeywords.some(kw => checkTitle.toLowerCase().includes(kw.toLowerCase()));
    if (titleLength >= 50 && titleLength <= 60 && keywordInTitle) score += 15;
    else if (titleLength >= 30 && titleLength <= 70) score += keywordInTitle ? 10 : 8;
    else score += 5;

    // Meta check
    const metaLength = checkMeta.length;
    const keywordInMeta = checkKeywords.some(kw => checkMeta.toLowerCase().includes(kw.toLowerCase()));
    if (metaLength >= 140 && metaLength <= 160 && keywordInMeta) score += 15;
    else if (metaLength >= 100 && metaLength <= 160) score += keywordInMeta ? 10 : 8;
    else score += metaLength > 0 ? 5 : 0;

    // Keywords check
    if (checkKeywords.length >= 3 && checkKeywords.length <= 5) score += 15;
    else if (checkKeywords.length >= 1) score += 8;

    // Content check
    if (wordCount >= 1500 && wordCount <= 2500) score += 20;
    else if (wordCount >= 800) score += 12;
    else if (wordCount > 2500) score += 18;
    else score += Math.min(wordCount / 100, 5);

    // Density check
    const contentLower = contentText.toLowerCase();
    const avgDensity = checkKeywords.length > 0 
      ? checkKeywords.reduce((acc, kw) => {
          const matches = contentLower.match(new RegExp(kw.toLowerCase(), 'gi'));
          return acc + ((matches?.length || 0) / Math.max(wordCount, 1)) * 100;
        }, 0) / checkKeywords.length
      : 0;
    const mainKeywordFound = checkKeywords.some(kw => {
      const matches = contentLower.match(new RegExp(kw.toLowerCase(), 'gi'));
      return (matches?.length || 0) >= 3;
    });
    if (avgDensity >= 0.5 && avgDensity <= 2.5 && mainKeywordFound) score += 20;
    else if (avgDensity > 0) score += 10;

    // Image check
    if (article?.featured_image_url) score += 15;

    return score;
  };

  // Handle SEO fixes
  const handleFixSEO = async (type: 'title' | 'meta' | 'content' | 'density') => {
    if (!article) return;

    // REGRA 2: SEO NUNCA BLOQUEIA - keywords são geradas automaticamente pelo backend
    // Removida validação bloqueante - backend gera keywords se necessário

    const setFixing = {
      title: setIsFixingTitle,
      meta: setIsFixingMeta,
      content: setIsFixingContent,
      density: setIsFixingDensity,
    }[type];

    setFixing(true);

    try {
      const changeDescription = {
        title: 'Otimização de título com IA',
        meta: 'Otimização de meta description com IA',
        content: 'Expansão de conteúdo com IA',
        density: 'Otimização de densidade de palavras-chave com IA',
      }[type];

      await saveVersion(`seo_${type}`, changeDescription);

      const currentValue = {
        title: title,
        meta: metaDescription,
        content: article.content || '',
        density: article.content || '',
      }[type];

      // Calculate word count for content expansion
      const contentText = article.content || '';
      const currentWordCount = contentText.split(/\s+/).filter(w => w.length > 0).length;
      const targetWordCount = 1500; // Ideal for SEO

      const response = await supabase.functions.invoke('improve-seo-item', {
        body: {
          type,
          currentValue,
          keywords,
          context: article.content,
          articleTitle: title,
          wordCount: currentWordCount,
          targetWordCount: type === 'content' ? targetWordCount : undefined,
        }
      });

      if (response.error) throw new Error(response.error.message);

      const { improvedValue } = response.data;

      if (!improvedValue) throw new Error('Não foi possível gerar melhoria');

      const oldTitle = type === 'title' ? title : title;
      const newTitle = type === 'title' ? improvedValue : title;
      const oldMeta = type === 'meta' ? metaDescription : metaDescription;
      const newMeta = type === 'meta' ? improvedValue : metaDescription;
      const oldContent = type === 'content' || type === 'density' ? article.content : article.content;
      const newContent = type === 'content' || type === 'density' ? improvedValue : article.content;

      const oldScore = calculateSEOScore(oldTitle, oldMeta, oldContent, keywords);
      const newScore = calculateSEOScore(newTitle, newMeta, newContent, keywords);

      const comparison: ComparisonData = {
        changeType: type,
        before: {
          value: currentValue,
          score: type === 'title' ? (title.length >= 50 && title.length <= 60 && keywords.some(k => title.toLowerCase().includes(k.toLowerCase())) ? 15 : 8) : 
                 type === 'meta' ? (metaDescription.length >= 140 && metaDescription.length <= 160 ? 15 : 8) : 10,
          maxScore: type === 'content' ? 20 : 15,
        },
        after: {
          value: improvedValue,
          score: type === 'title' ? 15 : type === 'meta' ? 15 : 20,
          maxScore: type === 'content' ? 20 : 15,
        },
        keywords,
        totalScoreBefore: oldScore,
        totalScoreAfter: newScore,
      };

      setPendingChange({
        type,
        newValue: improvedValue,
        oldValue: currentValue,
      });

      setComparisonData(comparison);
      setShowComparison(true);

    } catch (error) {
      console.error('Error fixing SEO:', error);
      toast({
        variant: "destructive",
        title: "Erro ao otimizar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setFixing(false);
    }
  };

  // Apply pending change and persist to database
  const handleKeepChange = async () => {
    if (!pendingChange || !article) return;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    switch (pendingChange.type) {
      case 'title':
        setTitle(pendingChange.newValue);
        updateData.title = pendingChange.newValue;
        break;
      case 'meta':
        setMetaDescription(pendingChange.newValue);
        updateData.meta_description = pendingChange.newValue;
        break;
      case 'content':
      case 'density':
        setArticle(prev => prev ? { ...prev, content: pendingChange.newValue } : null);
        updateData.content = pendingChange.newValue;
        break;
    }

    const { error } = await supabase
      .from("articles")
      .update(updateData)
      .eq("id", article.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar otimização",
        description: error.message,
      });
      return;
    }

    toast({ title: "SEO otimizado e salvo!" });
    setShowComparison(false);
    setPendingChange(null);
    setComparisonData(null);
  };

  const handleUndoChange = () => {
    setShowComparison(false);
    setPendingChange(null);
    setComparisonData(null);
    toast({ title: "Alteração descartada" });
  };

  const handleRestoreVersion = async (version: ArticleVersion) => {
    if (!article) return;
    
    setIsRestoring(true);
    
    try {
      await saveVersion('rollback', `Restaurado para versão ${version.version_number}`);
      
      setTitle(version.title);
      setExcerpt(version.excerpt || '');
      setMetaDescription(version.meta_description || '');
      setKeywords(version.keywords || []);
      setArticle(prev => prev ? {
        ...prev,
        content: version.content,
        faq: version.faq
      } : null);

      toast({ title: `Restaurado para versão ${version.version_number}` });
      setShowHistory(false);
    } catch (error) {
      console.error('Error restoring version:', error);
      toast({
        variant: "destructive",
        title: "Erro ao restaurar versão",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleFixAllSEO = async () => {
    if (!article) return;

    // REGRA 3: SEO NUNCA BLOQUEIA - keywords são geradas automaticamente pelo backend
    // Se não houver keywords, informar que serão geradas automaticamente
    if (!keywords || keywords.length === 0) {
      toast({
        title: "Keywords serão geradas automaticamente",
        description: "A IA irá criar palavras-chave estratégicas para este artigo.",
      });
      // NÃO retorna - continua a execução
    }

    const contentText = article.content || '';
    const wordCount = contentText.split(/\s+/).filter(w => w.length > 0).length;
    
    const fixableItems: ('title' | 'meta' | 'content' | 'density')[] = [];
    
    const titleLength = title.length;
    const keywordInTitle = keywords.some(kw => title.toLowerCase().includes(kw.toLowerCase()));
    if (!(titleLength >= 50 && titleLength <= 60 && keywordInTitle)) {
      fixableItems.push('title');
    }
    
    const metaLength = metaDescription.length;
    const keywordInMeta = keywords.some(kw => metaDescription.toLowerCase().includes(kw.toLowerCase()));
    if (!(metaLength >= 140 && metaLength <= 160 && keywordInMeta)) {
      fixableItems.push('meta');
    }
    
    if (wordCount < 1500 && wordCount >= 300) {
      fixableItems.push('content');
    }
    
    const contentLower = contentText.toLowerCase();
    const avgDensity = keywords.length > 0 
      ? keywords.reduce((acc, kw) => {
          const matches = contentLower.match(new RegExp(kw.toLowerCase(), 'gi'));
          return acc + ((matches?.length || 0) / Math.max(wordCount, 1)) * 100;
        }, 0) / keywords.length
      : 0;
    const mainKeywordFound = keywords.some(kw => {
      const matches = contentLower.match(new RegExp(kw.toLowerCase(), 'gi'));
      return (matches?.length || 0) >= 3;
    });
    if (!(avgDensity >= 0.5 && avgDensity <= 2.5 && mainKeywordFound) && keywords.length > 0) {
      fixableItems.push('density');
    }

    if (fixableItems.length === 0) {
      toast({ title: "Todos os itens de SEO já estão otimizados!" });
      return;
    }

    setIsFixingAll(true);
    setFixAllTotal(fixableItems.length);
    setFixAllStep(0);

    await saveVersion('seo_bulk_start', 'Início da otimização em massa');

    for (let i = 0; i < fixableItems.length; i++) {
      const itemType = fixableItems[i];
      setFixAllStep(i + 1);

      try {
        const currentValue = {
          title: title,
          meta: metaDescription,
          content: article.content || '',
          density: article.content || '',
        }[itemType];

        const response = await supabase.functions.invoke('improve-seo-item', {
          body: {
            type: itemType,
            currentValue,
            keywords,
            context: article.content,
            articleTitle: title,
          }
        });

        if (response.error) throw new Error(response.error.message);

        const { improvedValue } = response.data;

        if (improvedValue) {
          const dbField = itemType === 'title' ? 'title' : 
                          itemType === 'meta' ? 'meta_description' : 'content';
          
          // Persist to database immediately
          await supabase
            .from("articles")
            .update({ 
              [dbField]: improvedValue,
              updated_at: new Date().toISOString()
            })
            .eq("id", article.id);

          switch (itemType) {
            case 'title':
              setTitle(improvedValue);
              break;
            case 'meta':
              setMetaDescription(improvedValue);
              break;
            case 'content':
            case 'density':
              setArticle(prev => prev ? { ...prev, content: improvedValue } : null);
              break;
          }

          await saveVersion(`seo_${itemType}`, `Otimização automática: ${itemType}`);
        }
      } catch (error) {
        console.error(`Error fixing ${itemType}:`, error);
      }
    }

    setIsFixingAll(false);
    setFixAllStep(0);
    setFixAllTotal(0);
    toast({ 
      title: "SEO otimizado!", 
      description: `${fixableItems.length} itens corrigidos automaticamente.`
    });
  };

  const handleSave = async (publish: boolean = false, translateLanguages: string[] = []) => {
    if (!article) return;

    setSaving(true);
    setShowPublishTranslationDialog(false);

    // ========================================================================
    // POLIDOR FINAL - CONTRATO EDITORIAL ABSOLUTO
    // ========================================================================
    // Aplica normalização de estrutura antes de salvar (H1, parágrafos, CTA)
    // ========================================================================
    let contentToSave = article.content;
    
    if (contentToSave) {
      try {
        console.log('[POLISH] Applying final editorial polish before save...');
        
        const polishResponse = await supabase.functions.invoke('polish-article-final', {
          body: { content: contentToSave }
        });

        if (polishResponse.data?.success && polishResponse.data?.content) {
          contentToSave = polishResponse.data.content;
          
          // Update local state with polished content
          setArticle(prev => prev ? { ...prev, content: contentToSave } : null);
          
          const changes = polishResponse.data.changes || [];
          if (changes.length > 0) {
            console.log(`[POLISH] Applied changes: ${changes.join(', ')}`);
            toast({
              title: "Estrutura normalizada",
              description: `${changes.length} ajuste(s) aplicado(s) conforme Contrato Editorial.`,
            });
          }
        }
      } catch (polishError) {
        console.warn('[POLISH] Failed to apply polish (non-blocking):', polishError);
        // Non-blocking: continue with original content
      }
    }

    const newStatus = publish ? "published" : status;

    const updateData: Record<string, unknown> = {
      title,
      excerpt,
      meta_description: metaDescription,
      category,
      keywords,
      status: newStatus,
      content: contentToSave,
      faq: article.faq,
      featured_image_url: featuredImage,
      featured_image_alt: featuredImageAlt,
      tags,
      slug,
      updated_at: new Date().toISOString(),
    };

    if (publish) {
      updateData.published_at = new Date().toISOString();
      updateData.scheduled_at = null;
    }

    const { error } = await supabase
      .from("articles")
      .update(updateData)
      .eq("id", article.id);

    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } else {
      toast({ title: publish ? "Artigo publicado!" : "Alterações salvas!" });
      if (publish) {
        setStatus("published");
        setScheduledAt(null);

        // Trigger translations in background if languages selected
        if (translateLanguages.length > 0) {
          setIsTranslating(true);
          toast({
            title: "Traduzindo artigo...",
            description: `Traduzindo para ${translateLanguages.length} idioma(s) em segundo plano.`,
          });

          supabase.functions.invoke('translate-article', {
            body: {
              article_id: article.id,
              target_languages: translateLanguages,
            }
          }).then(({ error: transError }) => {
            setIsTranslating(false);
            if (transError) {
              toast({
                variant: "destructive",
                title: "Erro ao traduzir",
                description: "Algumas traduções podem não ter sido concluídas.",
              });
            } else {
              toast({
                title: "Traduções concluídas!",
                description: `O artigo foi traduzido para ${translateLanguages.length} idioma(s).`,
              });
              // Update existing translations
              setExistingTranslations(prev => [...new Set([...prev, ...translateLanguages])]);
            }
          });
        }
      }
    }
  };

  const handlePublishClick = () => {
    // REGRA 2: SEO NUNCA BLOQUEIA - keywords são geradas automaticamente pelo backend
    // Removido toast bloqueante - publicação direta
    setShowPublishTranslationDialog(true);
  };

  const handlePublishWithTranslation = (translateLanguages: string[]) => {
    handleSave(true, translateLanguages);
  };

  const handleSchedule = async (scheduledDate: Date) => {
    if (!article) return;

    setIsScheduling(true);

    const { error } = await supabase
      .from("articles")
      .update({
        status: "scheduled",
        scheduled_at: scheduledDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    setIsScheduling(false);
    setShowScheduleDialog(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao agendar",
        description: error.message,
      });
    } else {
      setStatus("scheduled");
      setScheduledAt(scheduledDate);
      toast({ 
        title: "Artigo agendado!",
        description: `Será publicado em ${format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
      });
    }
  };

  const handleCancelSchedule = async () => {
    if (!article) return;

    const { error } = await supabase
      .from("articles")
      .update({
        status: "draft",
        scheduled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao cancelar agendamento",
        description: error.message,
      });
    } else {
      setStatus("draft");
      setScheduledAt(null);
      toast({ title: "Agendamento cancelado" });
    }
  };

  const handleContentUpdate = (newContent: string) => {
    setArticle(prev => prev ? { ...prev, content: newContent } : null);
  };

  const handleDelete = async () => {
    if (!article || !confirm("Tem certeza que deseja excluir este artigo?")) return;

    const { error } = await supabase
      .from("articles")
      .delete()
      .eq("id", article.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    } else {
      toast({ title: "Artigo excluído" });
      navigate("/articles");
    }
  };

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

  const addSuggestedKeyword = async (keyword: string) => {
    if (!article || keywords.includes(keyword) || keywords.length >= 5) return;
    
    const newKeywords = [...keywords, keyword];
    setKeywords(newKeywords);
    
    await supabase
      .from("articles")
      .update({ 
        keywords: newKeywords,
        updated_at: new Date().toISOString()
      })
      .eq("id", article.id);
      
    toast({ title: `Palavra-chave "${keyword}" adicionada!` });
  };

  const handleSuggestKeywords = async () => {
    if (!article) return;
    
    setIsLoadingSuggestions(true);
    setSuggestedKeywords([]);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-keywords`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            title,
            content: article.content?.substring(0, 3000) || '',
            blog_id: article.blog_id,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao sugerir keywords');
      }

      const data = await response.json();
      
      if (data.keywords && Array.isArray(data.keywords)) {
        setSuggestedKeywords(data.keywords);
        toast({ title: `${data.keywords.length} keywords sugeridas!` });
      }
    } catch (error) {
      console.error('Error suggesting keywords:', error);
      toast({
        variant: "destructive",
        title: "Erro ao sugerir keywords",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle featured image upload
  const handleImageUpload = async (file: File) => {
    if (!article) return;

    setIsUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `cover-${article.id}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('article-images')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('article-images')
        .getPublicUrl(data.path);

      setFeaturedImage(urlData.publicUrl);
      
      await supabase
        .from('articles')
        .update({ featured_image_url: urlData.publicUrl })
        .eq('id', article.id);

      toast({ title: "Imagem carregada com sucesso!" });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar imagem",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Generate featured image with AI
  const handleGenerateImage = async () => {
    if (!article) return;

    setIsGeneratingImage(true);

    try {
      // Get current user for cost tracking
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          articleTitle: title,
          articleTheme: title,
          context: 'hero',
          blog_id: article.blog_id,
          user_id: currentUser?.id, // ✅ CRITICAL: Pass user_id for cost logging
        }
      });

      if (error) throw new Error(error.message || 'Falha ao gerar imagem');
      if (!data?.imageBase64 && !data?.imageUrl) throw new Error('Imagem não gerada');

      let publicUrl = data.imageUrl;
      
      // If we only got base64, upload to storage
      if (!publicUrl && data.imageBase64) {
        // Import helper inline to avoid circular deps
        const { base64ToBlob } = await import('@/utils/imageUtils');
        const blob = await base64ToBlob(data.imageBase64);
        const fileName = `cover-${article.id}-${Date.now()}.png`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('article-images')
          .upload(fileName, blob, { contentType: 'image/png', upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('article-images')
          .getPublicUrl(uploadData.path);

        publicUrl = urlData.publicUrl;
      }

      setFeaturedImage(publicUrl);
      
      await supabase
        .from('articles')
        .update({ featured_image_url: publicUrl })
        .eq('id', article.id);

      console.log(`[Image Generated] articleId=${article.id}, url=${publicUrl?.substring(0, 50)}...`);
      toast({ title: "Imagem gerada com sucesso!" });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar imagem",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!article) return;

    setFeaturedImage(null);
    
    await supabase
      .from('articles')
      .update({ featured_image_url: null })
      .eq('id', article.id);

    toast({ title: "Imagem removida" });
  };

  const handleApprove = async () => {
    if (!article) return;

    const now = new Date();
    const { error } = await supabase
      .from('articles')
      .update({ 
        approved_at: now.toISOString(),
        approved_by: user?.id 
      })
      .eq('id', article.id);

    if (!error) {
      setIsApproved(true);
      setApprovedAt(now);
      toast({ title: "Conteúdo aprovado!" });
    }
  };

  const handleRemoveApproval = async () => {
    if (!article) return;

    const { error } = await supabase
      .from('articles')
      .update({ 
        approved_at: null,
        approved_by: null 
      })
      .eq('id', article.id);

    if (!error) {
      setIsApproved(false);
      setApprovedAt(null);
      toast({ title: "Aprovação removida" });
    }
  };

  const handleDownloadAssets = async () => {
    if (!featuredImage) {
      toast({ title: "Nenhuma imagem para baixar", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(featuredImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug || 'article'}-cover.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Imagem baixada!" });
    } catch (error) {
      toast({ title: "Erro ao baixar imagem", variant: "destructive" });
    }
  };

  // Handle improve article with AI
  const handleImproveWithAI = async () => {
    if (!article) return;

    setIsImprovingArticle(true);

    try {
      // Fetch business profile and editorial template for context
      const [profileRes, templateRes] = await Promise.all([
        supabase.from('business_profile').select('*').eq('blog_id', article.blog_id).single(),
        supabase.from('editorial_templates').select('*').eq('blog_id', article.blog_id).eq('is_default', true).single()
      ]);

      const response = await supabase.functions.invoke('improve-article-complete', {
        body: {
          content: article.content || '',
          title,
          metaDescription,
          keywords,
          businessProfile: profileRes.data ? {
            company_name: profileRes.data.company_name,
            niche: profileRes.data.niche,
            tone_of_voice: profileRes.data.tone_of_voice
          } : undefined,
          editorialTemplate: templateRes.data ? {
            cta_template: templateRes.data.cta_template,
            tone_rules: templateRes.data.tone_rules
          } : undefined
        }
      });

      if (response.error) throw new Error(response.error.message);

      const { improvedContent, improvements, stats } = response.data;

      if (stats.totalImprovements > 0) {
        // Save version before applying changes
        await saveVersion('ai_improve', 'Melhoria automática com IA');
        
        // Store results for dialog
        setImproveResults({
          improvements,
          stats,
          improvedContent,
          originalContent: article.content || ''
        });

        // Apply the improved content
        setArticle(prev => prev ? { ...prev, content: improvedContent } : null);
        setShowImproveDialog(true);
      } else {
        toast({
          title: "Artigo já otimizado!",
          description: "Nenhuma melhoria necessária."
        });
      }
    } catch (error) {
      console.error('Error improving article:', error);
      toast({
        variant: "destructive",
        title: "Erro ao melhorar artigo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsImprovingArticle(false);
    }
  };

  const handleKeepImprovements = () => {
    setShowImproveDialog(false);
    setImproveResults(null);
    toast({ title: "Melhorias mantidas com sucesso!" });
  };

  const handleDiscardImprovements = () => {
    if (improveResults?.originalContent) {
      setArticle(prev => prev ? { ...prev, content: improveResults.originalContent } : null);
    }
    setShowImproveDialog(false);
    setImproveResults(null);
    toast({ title: "Melhorias descartadas" });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const articleUrl = blogData && slug ? getArticleUrl(blogData, slug) : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/articles")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-sm">Editar Artigo</h1>
              <div className="flex items-center gap-2">
                {status === "published" ? (
                  <Badge variant="default" className="text-xs h-5">Publicado</Badge>
                ) : status === "scheduled" && scheduledAt ? (
                  <Badge variant="secondary" className="text-xs h-5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(scheduledAt, "dd/MM HH:mm", { locale: ptBR })}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs h-5">Rascunho</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImproveWithAI}
              disabled={isImprovingArticle || isRegenerating}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              {isImprovingArticle ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Melhorar com IA
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
            >
              <History className="mr-2 h-4 w-4" />
              Histórico
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={saving || isRegenerating}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>

            {status === "published" && blogData && article?.slug && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(getArticleUrl(blogData, article.slug), '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver
              </Button>
            )}


            {status !== "published" && (
              <Button
                size="sm"
                className="gradient-primary"
                onClick={handlePublishClick}
                disabled={saving || isRegenerating}
              >
                <Upload className="mr-2 h-4 w-4" />
                Publicar
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - 2 Column Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column - Editor + Preview */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          {/* Tabs */}
          <div className="border-b px-4 py-2 bg-muted/30">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "editor" | "preview" | "split")}>
              <TabsList className="h-9">
                <TabsTrigger value="editor" className="gap-2">
                  <Edit3 className="h-4 w-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="split" className="gap-2">
                  <Columns className="h-4 w-4" />
                  Lado a Lado
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === "editor" && (
              <div className="space-y-4 max-w-4xl mx-auto">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isRegenerating}
                    className="text-lg font-semibold"
                    placeholder="Título do artigo"
                  />
                </div>

                {/* Content Editor */}
                <div className="space-y-2">
                  <Label>Conteúdo</Label>
                  <RichTextEditor
                    value={article?.content || ""}
                    onChange={handleContentUpdate}
                    disabled={isRegenerating}
                    placeholder="Escreva o conteúdo do artigo..."
                  />
                </div>

                {/* Generation Progress */}
                <GenerationProgress
                  stage={generationStage}
                  progress={generationProgress}
                  isActive={isRegenerating}
                />

                {/* SEO Score */}
                <SEOScoreAnalyzer
                  title={title}
                  content={article?.content || ""}
                  metaDescription={metaDescription}
                  keywords={keywords}
                  excerpt={excerpt}
                  featuredImage={featuredImage}
                  onFixTitle={() => handleFixSEO('title')}
                  onFixMeta={() => handleFixSEO('meta')}
                  onFixContent={() => handleFixSEO('content')}
                  onFixDensity={() => handleFixSEO('density')}
                  onFixAll={handleFixAllSEO}
                  isFixingTitle={isFixingTitle}
                  isFixingMeta={isFixingMeta}
                  isFixingContent={isFixingContent}
                  isFixingDensity={isFixingDensity}
                  isFixingAll={isFixingAll}
                  fixAllStep={fixAllStep}
                  fixAllTotal={fixAllTotal}
                  onSuggestKeywords={handleSuggestKeywords}
                  suggestedKeywords={suggestedKeywords}
                  onAddSuggestedKeyword={addSuggestedKeyword}
                  isLoadingSuggestions={isLoadingSuggestions}
                />

                {/* Keyword SEO Tools */}
                {keywords.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <KeywordDensityChecker
                      content={article?.content || ""}
                      keywords={keywords}
                    />
                    <KeywordPositionGuide
                      content={article?.content || ""}
                      keywords={keywords}
                    />
                  </div>
                )}

                {/* Internal Links */}
                {article && (
                  <InternalLinksSuggestions
                    articleId={article.id}
                    blogId={article.blog_id}
                    content={article.content || ""}
                    onContentUpdate={handleContentUpdate}
                  />
                )}
              </div>
            )}
            
            {activeTab === "preview" && (
              <div className="max-w-4xl mx-auto">
                {/* Toggle Desktop/Mobile */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Button
                    variant={previewMode === "desktop" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("desktop")}
                    className="gap-1.5"
                  >
                    <Monitor className="h-4 w-4" />
                    Desktop
                  </Button>
                  <Button
                    variant={previewMode === "mobile" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("mobile")}
                    className="gap-1.5"
                  >
                    <Smartphone className="h-4 w-4" />
                    Mobile
                  </Button>
                </div>

                {/* Preview Container com largura condicional */}
                <div className={cn(
                  "mx-auto transition-all duration-300",
                  previewMode === "mobile" 
                    ? "max-w-[375px] border rounded-3xl shadow-lg p-2 bg-background" 
                    : "max-w-4xl"
                )}>
                  <ArticlePreview
                    article={article ? {
                      title,
                      excerpt,
                      meta_description: metaDescription,
                      content: article.content || "",
                      faq: article.faq || []
                    } : null}
                    streamingText={streamingText}
                    isStreaming={isRegenerating}
                    featuredImage={featuredImage}
                    contentImages={article?.content_images as any[] || []}
                  />
                </div>
              </div>
            )}
            
            {activeTab === "split" && (
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Editor lado esquerdo */}
                <div className="overflow-auto space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title-split">Título</Label>
                    <Input
                      id="title-split"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={isRegenerating}
                      className="text-lg font-semibold"
                    />
                  </div>
                  <RichTextEditor
                    value={article?.content || ""}
                    onChange={handleContentUpdate}
                    disabled={isRegenerating}
                    placeholder="Escreva o conteúdo do artigo..."
                  />
                </div>
                
                {/* Preview lado direito */}
                <div className="overflow-auto border-l pl-4">
                  <ArticlePreview
                    article={article ? {
                      title,
                      excerpt,
                      meta_description: metaDescription,
                      content: article.content || "",
                      faq: article.faq || []
                    } : null}
                    streamingText={streamingText}
                    isStreaming={isRegenerating}
                    featuredImage={featuredImage}
                    contentImages={article?.content_images as any[] || []}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="w-80 flex-shrink-0 overflow-hidden bg-muted/20">
          <ArticleSidebar
            articleId={id}
            status={status}
            scheduledAt={scheduledAt}
            category={category}
            onCategoryChange={setCategory}
            slug={slug}
            onSlugChange={setSlug}
            tags={tags}
            onTagsChange={setTags}
            featuredImage={featuredImage}
            featuredImageAlt={featuredImageAlt}
            onFeaturedImageAltChange={setFeaturedImageAlt}
            onImageUpload={handleImageUpload}
            onImageGenerate={handleGenerateImage}
            onImageRemove={handleRemoveImage}
            isUploadingImage={isUploadingImage}
            isGeneratingImage={isGeneratingImage}
            metaDescription={metaDescription}
            onMetaDescriptionChange={setMetaDescription}
            keywords={keywords}
            keywordInput={keywordInput}
            onKeywordInputChange={setKeywordInput}
            onAddKeyword={addKeyword}
            onRemoveKeyword={removeKeyword}
            isApproved={isApproved}
            approvedAt={approvedAt}
            onApprove={handleApprove}
            onRemoveApproval={handleRemoveApproval}
            onRewriteWithAI={() => toast({ title: "Em breve", description: "Função em desenvolvimento" })}
            onOpenSocialShare={() => setShowSocialShare(true)}
            onDownloadAssets={handleDownloadAssets}
            onRequestReview={() => toast({ title: "Em breve", description: "Função em desenvolvimento" })}
            onSchedule={() => setShowScheduleDialog(true)}
            onDelete={handleDelete}
            disabled={isRegenerating}
          />
        </div>
      </main>

      {/* Dialogs */}
      <SEOChangeComparison
        isOpen={showComparison}
        onClose={() => {
          setShowComparison(false);
          setPendingChange(null);
          setComparisonData(null);
        }}
        data={comparisonData}
        onUndo={handleUndoChange}
        onKeep={handleKeepChange}
      />

      <ArticleVersionHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        versions={versions}
        onRestore={handleRestoreVersion}
        isRestoring={isRestoring}
        currentTitle={title}
        currentMeta={metaDescription}
        currentContent={article?.content}
        currentKeywords={keywords}
        currentFeaturedImage={featuredImage}
      />

      {article && (
        <ArticleExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          article={{
            title,
            content: article.content || "",
            excerpt,
            meta_description: metaDescription,
            featured_image_url: featuredImage,
            faq: article.faq || [],
            keywords,
            category,
          }}
        />
      )}

      <SchedulePublishDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onSchedule={handleSchedule}
        isScheduling={isScheduling}
        currentSchedule={scheduledAt}
      />

      <SocialSharePanel
        open={showSocialShare}
        onOpenChange={setShowSocialShare}
        title={title}
        excerpt={excerpt}
        featuredImage={featuredImage}
        articleUrl={articleUrl}
        keywords={keywords}
      />

      {improveResults && (
        <ImproveArticleDialog
          open={showImproveDialog}
          onOpenChange={setShowImproveDialog}
          improvements={improveResults.improvements}
          stats={improveResults.stats}
          onKeep={handleKeepImprovements}
          onDiscard={handleDiscardImprovements}
        />
      )}

      <PublishWithTranslationDialog
        open={showPublishTranslationDialog}
        onOpenChange={setShowPublishTranslationDialog}
        onPublish={handlePublishWithTranslation}
        isPublishing={saving}
        existingTranslations={existingTranslations}
      />
    </div>
  );
}
