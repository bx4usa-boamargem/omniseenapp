import { useEffect, useState } from 'react';
import { sanitizeHTML } from "@/lib/sanitize";
import { useParams, useNavigate } from 'react-router-dom';
import { smartNavigate, getClientArticleEditPath } from '@/utils/platformUrls';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, 
  ArrowLeft, 
  Send, 
  Edit3, 
  Trash2,
  Calendar,
  Sparkles,
  CheckCircle,
  Star,
  Clock,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePublishValidation, PublishValidationResult } from '@/hooks/usePublishValidation';
import { PublishWithBoostDialog } from '@/components/editor/PublishWithBoostDialog';

interface ArticleData {
  id: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  status: string;
  created_at: string;
  generation_source: string | null;
}

function calculateSEOScore(article: ArticleData): number {
  let score = 0;
  const maxScore = 100;

  // Title (25 points)
  if (article.title) {
    const titleLength = article.title.length;
    if (titleLength >= 30 && titleLength <= 70) score += 25;
    else if (titleLength >= 20 && titleLength <= 80) score += 15;
    else score += 5;
  }

  // Meta description (25 points)
  if (article.meta_description) {
    const metaLength = article.meta_description.length;
    if (metaLength >= 140 && metaLength <= 160) score += 25;
    else if (metaLength >= 100 && metaLength <= 180) score += 15;
    else score += 5;
  }

  // Keywords (20 points)
  if (article.keywords && article.keywords.length >= 3) {
    score += 20;
  } else if (article.keywords && article.keywords.length > 0) {
    score += 10;
  }

  // Content length (20 points)
  if (article.content) {
    const wordCount = article.content.split(/\s+/).length;
    if (wordCount >= 1000) score += 20;
    else if (wordCount >= 500) score += 15;
    else if (wordCount >= 300) score += 10;
  }

  // Featured image (10 points)
  if (article.featured_image_url) {
    score += article.featured_image_alt ? 10 : 5;
  }

  return Math.min(score, maxScore);
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

export default function ClientReviewCenter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { blog } = useBlog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  // Editable fields
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [keywords, setKeywords] = useState('');

  // Publish validation
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<PublishValidationResult | null>(null);
  const { validateForPublish, validating } = usePublishValidation(id, blog?.id);

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        setArticle(data);
        setTitle(data.title);
        setMetaDescription(data.meta_description || '');
        setKeywords(data.keywords?.join(', ') || '');
      } catch (error) {
        console.error('Error fetching article:', error);
        toast.error('Erro ao carregar artigo');
        navigate('/client/queue');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, navigate]);

  const handleSaveChanges = async () => {
    if (!article) return;
    setSaving(true);

    try {
      const keywordsArray = keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const { error } = await supabase
        .from('articles')
        .update({
          title,
          meta_description: metaDescription,
          keywords: keywordsArray,
        })
        .eq('id', article.id);

      if (error) throw error;

      setArticle({
        ...article,
        title,
        meta_description: metaDescription,
        keywords: keywordsArray,
      });

      toast.success('Alterações salvas!');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!article || !blog?.id) return;

    // Publish directly without SERP/score validation (SERP is optional)
    setSaving(true);

    try {
      // Save any pending changes first
      const keywordsArray = keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const { error: articleError } = await supabase
        .from('articles')
        .update({
          title,
          meta_description: metaDescription,
          keywords: keywordsArray,
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', article.id);

      if (articleError) throw articleError;

      // Update queue item if exists
      await supabase
        .from('article_queue')
        .update({ status: 'published' })
        .eq('article_id', article.id);

      toast.success('🚀 Artigo publicado com sucesso!');
      navigate('/client/queue');
    } catch (error) {
      console.error('Error publishing:', error);
      toast.error('Erro ao publicar artigo');
    } finally {
      setSaving(false);
    }
  };

  const handleBoostComplete = async (newScore: number, newContent: string) => {
    if (!article) return;
    
    // Update article with optimized content
    const { error } = await supabase
      .from('articles')
      .update({ content: newContent })
      .eq('id', article.id);

    if (!error) {
      setArticle({ ...article, content: newContent });
    }

    // Re-validate
    const validation = await validateForPublish();
    setValidationResult(validation);
  };

  const handlePublishAfterBoost = () => {
    setBoostDialogOpen(false);
    handlePublish();
  };

  const handleDiscard = async () => {
    if (!article) return;
    setSaving(true);

    try {
      const { error: articleError } = await supabase
        .from('articles')
        .update({ status: 'archived' })
        .eq('id', article.id);

      if (articleError) throw articleError;

      // Update queue item
      await supabase
        .from('article_queue')
        .delete()
        .eq('article_id', article.id);

      toast.success('Artigo descartado');
      navigate('/client/queue');
    } catch (error) {
      console.error('Error discarding:', error);
      toast.error('Erro ao descartar artigo');
    } finally {
      setSaving(false);
      setDiscardConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground mb-4">Artigo não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/client/queue')}>
          Voltar para a fila
        </Button>
      </div>
    );
  }

  const seoScore = calculateSEOScore({
    ...article,
    title,
    meta_description: metaDescription,
    keywords: keywords.split(',').map(k => k.trim()).filter(k => k.length > 0),
  });

  const hasChanges = 
    title !== article.title || 
    metaDescription !== (article.meta_description || '') ||
    keywords !== (article.keywords?.join(', ') || '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/client/queue')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Centro de Revisão</h1>
          <p className="text-muted-foreground">
            Revise e aprove este artigo antes de publicar
          </p>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="grid gap-6 lg:grid-cols-[400px,1fr]">
        {/* Left Panel - Controls */}
        <div className="space-y-6 order-2 lg:order-1">
          {/* Article Info Card */}
          <Card className="client-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Informações do Artigo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título do artigo"
                />
                <p className="text-xs text-muted-foreground">
                  {title.length}/70 caracteres
                </p>
              </div>

              <div className="flex items-center gap-4 py-2">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  Pronto p/ Revisão
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(article.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
                Origem: {article.generation_source === 'automation' ? 'Automação' : article.generation_source || 'Manual'}
              </div>
            </CardContent>
          </Card>

          {/* SEO Preview Card */}
          <Card className="client-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">SEO Preview</CardTitle>
                <div className="flex items-center gap-1">
                  <Star className={cn("h-4 w-4", getScoreColor(seoScore))} />
                  <span className={cn("font-semibold", getScoreColor(seoScore))}>
                    {seoScore}/100
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meta">Meta Description</Label>
                <Textarea
                  id="meta"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Descrição para buscadores..."
                  className="resize-none"
                  rows={3}
                />
                <p className={cn(
                  "text-xs",
                  metaDescription.length >= 140 && metaDescription.length <= 160
                    ? "text-emerald-500"
                    : "text-muted-foreground"
                )}>
                  {metaDescription.length}/160 caracteres (ideal: 140-160)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Palavras-chave</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="marketing, vendas, conversão..."
                />
                <p className="text-xs text-muted-foreground">
                  Separe com vírgulas (mínimo 3)
                </p>
              </div>

              {hasChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar Alterações
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="client-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ações</CardTitle>
              <CardDescription>
                Este artigo está pronto. Quer colocar no ar?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handlePublish}
                disabled={saving || validating}
                className="w-full client-btn-primary gap-2"
              >
                {(saving || validating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {validating ? 'Validando...' : 'Publicar Agora'}
              </Button>

              <Button
                variant="outline"
                onClick={() => smartNavigate(navigate, getClientArticleEditPath(article.id))}
                disabled={saving}
                className="w-full gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Editar Conteúdo
              </Button>

              <Button
                variant="ghost"
                onClick={() => setDiscardConfirm(true)}
                disabled={saving}
                className="w-full gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Desistir deste Artigo
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Preview */}
        <Card className="client-card overflow-hidden order-1 lg:order-2">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base">Preview do Artigo</CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(100vh-280px)] min-h-[500px]">
            <div className="p-6 space-y-6">
              {/* Featured Image */}
              {article.featured_image_url ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={article.featured_image_url}
                    alt={article.featured_image_alt || title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-muted/50 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Imagem será gerada</p>
                  </div>
                </div>
              )}

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                {title || 'Título do Artigo'}
              </h1>

              {/* Meta Info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </span>
                {article.content && (
                  <span>
                    {Math.ceil(article.content.split(/\s+/).length / 200)} min de leitura
                  </span>
                )}
              </div>

              {/* Content */}
              {article.content ? (
                <div 
                  className="prose prose-lg max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(article.content || "") }}
                />
              ) : (
                <div className="text-muted-foreground italic">
                  Conteúdo não disponível para preview.
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Discard Confirmation Dialog */}
      <AlertDialog open={discardConfirm} onOpenChange={setDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desistir deste artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              O artigo será arquivado e removido da fila de produção. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              className="bg-red-500 hover:bg-red-600"
            >
              Sim, desistir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish Validation Dialog */}
      {article && validationResult && (
        <PublishWithBoostDialog
          open={boostDialogOpen}
          onOpenChange={setBoostDialogOpen}
          articleId={article.id}
          blogId={blog?.id || ''}
          currentScore={validationResult.currentScore}
          minimumScore={validationResult.minScore}
          serpAnalyzed={validationResult.serpAnalyzed}
          content={article.content || ''}
          title={title}
          keyword={keywords.split(',')[0]?.trim() || title}
          onBoostComplete={handleBoostComplete}
          onAnalyzeComplete={() => {
            setBoostDialogOpen(false);
            toast.info('Tente publicar novamente para calcular o score.');
          }}
          onPublishAfterBoost={handlePublishAfterBoost}
        />
      )}
    </div>
  );
}
