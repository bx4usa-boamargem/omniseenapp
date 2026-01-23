import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MoreHorizontal,
  Pencil,
  Send,
  Archive,
  RefreshCw,
  Trash2,
  Loader2,
  ExternalLink
} from "lucide-react";
import { usePublishValidation, PublishValidationResult } from "@/hooks/usePublishValidation";
import { PublishWithBoostDialog } from "@/components/editor/PublishWithBoostDialog";

interface ArticleActionsDropdownProps {
  articleId: string;
  articleTitle: string;
  status: string;
  slug: string;
  blogSlug?: string;
  blogId?: string;
  articleContent?: string;
  articleKeywords?: string[];
  onActionComplete?: () => void;
}

export function ArticleActionsDropdown({
  articleId,
  articleTitle,
  status,
  slug,
  blogSlug,
  blogId,
  articleContent,
  articleKeywords,
  onActionComplete
}: ArticleActionsDropdownProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);

  // Publish validation
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<PublishValidationResult | null>(null);
  const { validateForPublish, validating } = usePublishValidation(articleId, blogId);

  const handlePublish = async () => {
    // STEP 1: Validate SERP Score if blogId is provided
    if (blogId) {
      setLoading('publish');
      const validation = await validateForPublish();
      
      if (!validation.canPublish) {
        setValidationResult(validation);
        setBoostDialogOpen(true);
        setLoading(null);
        return; // Block publication
      }
    }

    // STEP 2: Proceed with publication
    setLoading('publish');
    try {
      const { error } = await supabase
        .from('articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (error) throw error;

      toast({
        title: "Artigo publicado!",
        description: `"${articleTitle}" está agora publicado.`
      });
      
      onActionComplete?.();
    } catch (error) {
      console.error('Error publishing:', error);
      toast({
        title: "Erro ao publicar",
        description: "Não foi possível publicar o artigo.",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const handleBoostComplete = async (newScore: number, newContent: string) => {
    // Update article with optimized content
    await supabase
      .from('articles')
      .update({ content: newContent })
      .eq('id', articleId);

    // Re-validate
    const validation = await validateForPublish();
    setValidationResult(validation);
  };

  const handlePublishAfterBoost = () => {
    setBoostDialogOpen(false);
    handlePublish();
  };

  const handleUnpublish = async () => {
    setLoading('unpublish');
    try {
      const { error } = await supabase
        .from('articles')
        .update({
          status: 'draft',
          published_at: null
        })
        .eq('id', articleId);

      if (error) throw error;

      toast({
        title: "Artigo despublicado",
        description: `"${articleTitle}" foi movido para rascunhos.`
      });
      
      onActionComplete?.();
    } catch (error) {
      console.error('Error unpublishing:', error);
      toast({
        title: "Erro ao despublicar",
        description: "Não foi possível despublicar o artigo.",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    setLoading('delete');
    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId);

      if (error) throw error;

      toast({
        title: "Artigo excluído",
        description: `"${articleTitle}" foi excluído permanentemente.`
      });
      
      setDeleteDialogOpen(false);
      onActionComplete?.();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o artigo.",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const handleRenew = async () => {
    setLoading('renew');
    try {
      // Call the renew edge function (regenerates content + images)
      const { data, error } = await supabase.functions.invoke('regenerate-article-images', {
        body: {
          article_id: articleId,
          regenerate_type: 'all'
        }
      });

      if (error) throw error;

      toast({
        title: "Conteúdo renovado!",
        description: `As imagens de "${articleTitle}" foram atualizadas.`
      });
      
      setRenewDialogOpen(false);
      onActionComplete?.();
    } catch (error) {
      console.error('Error renewing:', error);
      toast({
        title: "Erro ao renovar",
        description: "Não foi possível renovar o conteúdo.",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const isPublished = status === 'published';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate(`/articles/${articleId}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          
          {blogSlug && isPublished && (
            <DropdownMenuItem onClick={() => window.open(`/blog/${blogSlug}/${slug}`, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver publicado
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {isPublished ? (
            <DropdownMenuItem 
              onClick={handleUnpublish}
              disabled={loading === 'unpublish'}
            >
              {loading === 'unpublish' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Despublicar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              onClick={handlePublish}
              disabled={loading === 'publish'}
            >
              {loading === 'publish' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Publicar
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={() => setRenewDialogOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Renovar imagens
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O artigo "{articleTitle}" será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading === 'delete'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading === 'delete' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renew Confirmation Dialog */}
      <AlertDialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renovar imagens?</AlertDialogTitle>
            <AlertDialogDescription>
              As imagens do artigo "{articleTitle}" serão regeneradas com IA. O texto e a URL serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRenew}
              disabled={loading === 'renew'}
            >
              {loading === 'renew' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Renovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish Validation Dialog */}
      {blogId && validationResult && (
        <PublishWithBoostDialog
          open={boostDialogOpen}
          onOpenChange={setBoostDialogOpen}
          articleId={articleId}
          blogId={blogId}
          currentScore={validationResult.currentScore}
          minimumScore={validationResult.minScore}
          serpAnalyzed={validationResult.serpAnalyzed}
          content={articleContent || ''}
          title={articleTitle}
          keyword={articleKeywords?.[0] || articleTitle}
          onBoostComplete={handleBoostComplete}
          onAnalyzeComplete={() => {
            setBoostDialogOpen(false);
          }}
          onPublishAfterBoost={handlePublishAfterBoost}
        />
      )}
    </>
  );
}
