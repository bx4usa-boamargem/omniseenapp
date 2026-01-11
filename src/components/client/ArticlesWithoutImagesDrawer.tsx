import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImagePlus, PenSquare, Loader2, Image, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleGenerateImage = async (article: ArticleWithoutImage) => {
    setGeneratingFor(article.id);
    
    try {
      toast.loading('Gerando imagem de capa...', { id: `gen-image-${article.id}` });

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          title: article.title,
          content: article.content?.substring(0, 1000) || '',
          type: 'cover',
          blog_id: blogId
        }
      });

      if (error) throw error;

      if (!data?.url) {
        throw new Error('URL da imagem não retornada');
      }

      // Update article with new image
      const { error: updateError } = await supabase
        .from('articles')
        .update({ featured_image_url: data.url })
        .eq('id', article.id);

      if (updateError) throw updateError;

      toast.success('Imagem gerada com sucesso!', { id: `gen-image-${article.id}` });
      onImageGenerated?.();
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Erro ao gerar imagem', { id: `gen-image-${article.id}` });
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleOpenEditor = (articleId: string) => {
    onOpenChange(false);
    navigate(`/client/articles/${articleId}/edit`);
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
