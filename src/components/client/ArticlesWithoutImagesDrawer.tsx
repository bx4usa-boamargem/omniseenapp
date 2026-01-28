import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { smartNavigate, getClientArticleEditPath } from '@/utils/platformUrls';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImagePlus, PenSquare, Loader2, Image, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { base64ToBlob } from '@/utils/imageUtils';

interface ArticleWithoutImage {
  id: string;
  title: string;
  content: string | null;
}

interface ArticlesWithoutImagesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: ArticleWithoutImage[];
  blogId: string;
  onImageGenerated?: () => void;
}

export function ArticlesWithoutImagesDrawer({
  open,
  onOpenChange,
  articles,
  blogId,
  onImageGenerated
}: ArticlesWithoutImagesDrawerProps) {
  const navigate = useNavigate();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const articlesWithoutImage = articles.filter(a => !('featured_image_url' in a) || !(a as any).featured_image_url);

  // Validar se o artigo tem título
  const hasValidTitle = (article: ArticleWithoutImage): boolean => {
    return !!article.title?.trim();
  };

  const handleGenerateImage = async (article: ArticleWithoutImage) => {
    // Validação robusta no frontend
    if (!hasValidTitle(article)) {
      toast.error('Este artigo não possui título. Adicione um título antes de gerar a imagem.', { 
        id: `gen-image-${article.id}`,
        action: {
          label: 'Editar',
          onClick: () => handleOpenEditor(article.id)
        }
      });
      return;
    }

    setGeneratingFor(article.id);
    
    try {
      toast.loading('Gerando imagem de capa...', { id: `gen-image-${article.id}` });

      // Get current user for cost tracking
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Enviar SEMPRE o título - prompt é gerado automaticamente pela edge function
      // Enviar article_id para persistência direta na edge function
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          articleTitle: article.title,
          articleTheme: article.title,
          context: 'cover',
          blog_id: blogId,
          article_id: article.id,  // Permite persistência direta no DB
          user_id: currentUser?.id, // ✅ CRITICAL: Pass user_id for cost logging
        }
      });

      if (error) {
        console.error('Error generating image:', error);
        const errorData = typeof error.message === 'string' ? error.message : JSON.stringify(error);
        
        if (errorData.includes('MISSING_TITLE') || errorData.includes('título')) {
          throw new Error('O artigo precisa ter um título antes de gerar imagem.');
        }
        throw new Error(error.message || 'Erro ao gerar imagem');
      }

      // Handle response - prefer publicUrl (already uploaded by edge function)
      if (!data?.imageBase64 && !data?.imageUrl && !data?.publicUrl) {
        throw new Error('Imagem não foi gerada pela IA');
      }

      // Prefer publicUrl from edge function (already persisted)
      let publicUrl = data.publicUrl || data.imageUrl;
      
      // Fallback: If we only got base64, upload to storage manually
      if (!publicUrl && data.imageBase64) {
        const imageBlob = await base64ToBlob(data.imageBase64);
        const fileName = `articles/${article.id}/cover-${Date.now()}.png`;
        
        // FIX: Use correct bucket 'article-images' not 'blog-images'
        const { error: uploadError } = await supabase.storage
          .from('article-images')
          .upload(fileName, imageBlob, { contentType: 'image/png', upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('article-images')
          .getPublicUrl(fileName);
        
        publicUrl = publicUrlData.publicUrl;
      }

      // Update article with new image URL
      const { error: updateError } = await supabase
        .from('articles')
        .update({ featured_image_url: publicUrl })
        .eq('id', article.id);

      if (updateError) throw updateError;

      console.log(`[Image Generated] articleId=${article.id}, url=${publicUrl?.substring(0, 50)}...`);
      toast.success('Imagem gerada com sucesso!', { id: `gen-image-${article.id}` });
      onImageGenerated?.();
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast.error(error.message || 'Erro ao gerar imagem', { id: `gen-image-${article.id}` });
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleOpenEditor = (articleId: string) => {
    onOpenChange(false);
    smartNavigate(navigate, getClientArticleEditPath(articleId));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[440px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-amber-500" />
            Artigos sem Imagem
          </SheetTitle>
          <SheetDescription>
            {articlesWithoutImage.length} artigo(s) precisam de imagem de capa.
            Gere uma imagem ou abra o editor para mais opções.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-4 space-y-3">
            {articlesWithoutImage.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-green-500/10 mb-4">
                  <ImagePlus className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-muted-foreground font-medium">
                  Todos os artigos têm imagem! 🎉
                </p>
                <p className="text-sm text-muted-foreground/80 mt-1">
                  Seu blog está bem otimizado visualmente.
                </p>
              </div>
            ) : (
              articlesWithoutImage.map(article => (
                <div 
                  key={article.id}
                  className="p-4 rounded-xl border border-border hover:border-amber-500/30 bg-card transition-all"
                >
                  <h4 className="font-medium text-foreground line-clamp-2 mb-3">
                    {article.title}
                  </h4>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 gap-2"
                      onClick={() => handleGenerateImage(article)}
                      disabled={generatingFor === article.id}
                    >
                      {generatingFor === article.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4" />
                          Gerar Capa
                        </>
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleOpenEditor(article.id)}
                    >
                      <PenSquare className="h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <p className="text-xs text-muted-foreground text-center">
            💡 Dica: Imagens de capa aumentam cliques em até 94%
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
