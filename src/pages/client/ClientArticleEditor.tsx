import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { streamArticle, type ArticleData, type GenerationStage } from '@/utils/streamArticle';
import { SimpleArticleForm, type SimpleFormData } from '@/components/client/SimpleArticleForm';
import { ArticlePreview } from '@/components/ArticlePreview';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { GenerationProgress } from '@/components/seo/GenerationProgress';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Loader2, 
  FileText,
  Plus,
  CheckCircle2
} from 'lucide-react';

type EditorPhase = 'form' | 'generating' | 'editing';

export default function ClientArticleEditor() {
  const navigate = useNavigate();
  const { blog, loading: blogLoading } = useBlog();
  
  // Editor phase state
  const [phase, setPhase] = useState<EditorPhase>('form');
  
  // Article state (in memory until explicit save)
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [faq, setFaq] = useState<Array<{ question: string; answer: string }>>([]);
  
  // Generation state
  const [streamingText, setStreamingText] = useState('');
  const [generationStage, setGenerationStage] = useState<GenerationStage>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  
  // Current article object for preview (constructed from state)
  const articleForPreview: ArticleData | null = title ? {
    title,
    content,
    excerpt,
    meta_description: metaDescription,
    faq
  } : null;

  const handleGenerate = async (formData: SimpleFormData) => {
    if (!blog?.id) {
      toast.error('Blog não encontrado. Recarregue a página.');
      return;
    }

    // Reset state
    setPhase('generating');
    setIsGenerating(true);
    setStreamingText('');
    setTitle('');
    setContent('');
    setExcerpt('');
    setMetaDescription('');
    setFaq([]);
    setGenerationStage('analyzing');
    setGenerationProgress(0);

    await streamArticle({
      theme: formData.theme,
      blogId: blog.id,
      generationMode: formData.generationMode,
      tone: 'friendly',
      autoPublish: false, // Never auto-publish - we control this
      onStage: (stage) => setGenerationStage(stage),
      onProgress: (percent) => setGenerationProgress(percent),
      onDelta: (text) => {
        setStreamingText((prev) => prev + text);
      },
      onDone: (result) => {
        setIsGenerating(false);
        setGenerationStage(null);
        
        if (result) {
          // Populate editable state from generated article
          setTitle(result.title);
          setContent(result.content);
          setExcerpt(result.excerpt);
          setMetaDescription(result.meta_description);
          setFaq(result.faq || []);
          setPhase('editing');
          
          toast.success('Artigo gerado! Revise e edite antes de publicar.');
        }
      },
      onError: (error) => {
        setIsGenerating(false);
        setGenerationStage(null);
        setPhase('form');
        toast.error(error || 'Erro ao gerar artigo');
      },
    });
  };

  const handleSave = async (publish: boolean) => {
    if (!blog?.id || !title.trim() || !content.trim()) {
      toast.error('Preencha o título e conteúdo');
      return;
    }

    setIsSaving(true);

    try {
      // Generate slug
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { error } = await supabase
        .from('articles')
        .insert({
          blog_id: blog.id,
          title: title.trim(),
          slug: `${slug}-${Date.now()}`,
          content: content.trim(),
          excerpt: excerpt.trim(),
          meta_description: metaDescription.trim(),
          faq: faq.length > 0 ? faq : null,
          status: publish ? 'published' : 'draft',
          published_at: publish ? new Date().toISOString() : null,
        });

      if (error) throw error;

      toast.success(
        publish 
          ? 'Artigo publicado com sucesso!' 
          : 'Rascunho salvo com sucesso!'
      );
      
      navigate('/client/dashboard');
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Erro ao salvar artigo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewArticle = () => {
    setPhase('form');
    setTitle('');
    setContent('');
    setExcerpt('');
    setMetaDescription('');
    setFaq([]);
    setStreamingText('');
  };

  if (blogLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-border mb-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/client/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          {phase === 'editing' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleNewArticle}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Artigo
            </Button>
          )}
        </div>
        
        {phase === 'editing' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Rascunho
            </Button>
            
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Publicar
            </Button>
          </div>
        )}
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Column - Form/Editor */}
        <div className="flex flex-col min-h-0 overflow-auto">
          {phase === 'form' && (
            <SimpleArticleForm 
              onGenerate={handleGenerate} 
              isGenerating={isGenerating}
            />
          )}
          
          {phase === 'generating' && (
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Gerando Artigo...
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <GenerationProgress 
                  stage={generationStage} 
                  progress={generationProgress}
                  isActive={isGenerating}
                />
              </CardContent>
            </Card>
          )}
          
          {phase === 'editing' && (
            <div className="space-y-4 h-full flex flex-col">
              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Título</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título do artigo"
                  className="text-lg font-semibold"
                />
              </div>
              
              {/* Excerpt Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Resumo</label>
                <Input
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Breve resumo do artigo"
                />
              </div>
              
              {/* Content Editor */}
              <div className="flex-1 min-h-0 space-y-2">
                <label className="text-sm font-medium">Conteúdo</label>
                <div className="h-full min-h-[400px]">
                  <RichTextEditor
                    value={content}
                    onChange={setContent}
                    placeholder="Edite o conteúdo do artigo..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Preview */}
        <div className="min-h-0 overflow-auto">
          {phase === 'form' && (
            <Card className="h-full flex items-center justify-center bg-muted/30 border-dashed">
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-muted-foreground">Preview do Artigo</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  O artigo aparecerá aqui enquanto é gerado
                </p>
              </CardContent>
            </Card>
          )}
          
          {phase === 'generating' && (
            <ArticlePreview
              article={null}
              streamingText={streamingText}
              isStreaming={isGenerating}
            />
          )}
          
          {phase === 'editing' && articleForPreview && (
            <ArticlePreview
              article={articleForPreview}
              streamingText=""
              isStreaming={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
