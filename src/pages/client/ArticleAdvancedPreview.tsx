/**
 * Article Advanced Preview Page
 * 
 * Preview detalhado do artigo gerado com metadados e ações.
 * Rota: /client/articles/:id/preview
 */

import { useParams, useNavigate } from 'react-router-dom';
import { checkContentQuality } from '@/utils/contentQualityChecker';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Edit, 
  Globe, 
  RefreshCw,
  FileText,
  Hash,
  BarChart3,
  Image as ImageIcon,
  Shield,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ArticleMetadataCard } from '@/components/client/ArticleMetadataCard';
import ReactMarkdown from 'react-markdown';

const TEMPLATE_NAMES: Record<string, string> = {
  complete_guide: 'Guia Completo',
  qa_format: 'Perguntas & Respostas',
  comparative: 'Comparativo Técnico',
  problem_solution: 'Problema → Solução',
  educational_steps: 'Educacional em Etapas'
};

export default function ArticleAdvancedPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Fetch article
  const { data: article, isLoading, error, refetch } = useQuery({
    queryKey: ['article-preview', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não fornecido');
      
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
  
  // Calculate metadata
  const calculateMetadata = () => {
    if (!article?.content) return null;
    
    const content = article.content;
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const h2Count = (content.match(/^## /gm) || []).length;
    const faqCount = Array.isArray(article.faq) ? article.faq.length : 0;
    const imageCount = Array.isArray(article.content_images) ? article.content_images.length : 0;
    
    // Keyword density
    const keywords = article.keywords || [];
    const primaryKeyword = keywords[0]?.toLowerCase() || '';
    const keywordOccurrences = primaryKeyword 
      ? (content.toLowerCase().match(new RegExp(primaryKeyword, 'g')) || []).length
      : 0;
    const keywordDensity = wordCount > 0 
      ? ((keywordOccurrences / wordCount) * 100).toFixed(1)
      : '0.0';
    
    // E-E-A-T detection
    const hasEat = content.includes('anos') && (content.includes('nossa equipe') || content.includes('experiência'));
    
    // SEO score (simplified)
    let seoScore = 50;
    if (wordCount >= 800) seoScore += 10;
    if (wordCount >= 1200) seoScore += 10;
    if (h2Count >= 5) seoScore += 10;
    if (faqCount >= 5) seoScore += 10;
    if (hasEat) seoScore += 10;
    
    return {
      wordCount,
      h2Count,
      faqCount,
      imageCount,
      keywordDensity: parseFloat(keywordDensity),
      hasEat,
      seoScore: Math.min(seoScore, 100),
      template: article.article_structure_type || 'complete_guide'
    };
  };
  
  const metadata = calculateMetadata();
  
  // Handle publish
  const handlePublish = async () => {
    if (!article) return;
    
    // Quality check before publishing
    const quality = checkContentQuality(article.content || '', article.title);
    if (!quality.canPublish) {
      toast.error(quality.issues.filter(i => i.type === 'error').map(i => i.message).join('; '));
      return;
    }
    if (quality.issues.length > 0) {
      toast.warning(`Qualidade (${quality.score}/100): ${quality.issues.map(i => i.message).join('; ')}`, { duration: 8000 });
    }

    try {
      const { error } = await supabase
        .from('articles')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', article.id);
      
      if (error) throw error;
      
      toast.success('Artigo publicado com sucesso!');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao publicar');
    }
  };
  
  // Handle regenerate
  const handleRegenerate = async () => {
    toast.info('Regeneração em desenvolvimento');
    // TODO: Implement regeneration
  };
  
  if (isLoading) {
    return (
      <div className="container max-w-5xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-96" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }
  
  if (error || !article) {
    return (
      <div className="container max-w-5xl py-6">
        <Card className="p-8 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Artigo não encontrado</h2>
          <p className="text-muted-foreground mb-4">
            O artigo solicitado não existe ou foi removido.
          </p>
          <Button onClick={() => navigate('/client/articles')}>
            Voltar para Artigos
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/client/articles')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold line-clamp-1">
              {article.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={article.status === 'published' ? 'default' : 'secondary'}>
                {article.status === 'published' ? 'Publicado' : 'Rascunho'}
              </Badge>
              {metadata?.template && (
                <Badge variant="outline">
                  {TEMPLATE_NAMES[metadata.template] || metadata.template}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/client/articles/${article.id}/edit`)}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            onClick={handleRegenerate}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerar
          </Button>
          {article.status !== 'published' && (
            <Button onClick={handlePublish} className="gap-2">
              <Globe className="h-4 w-4" />
              Publicar
            </Button>
          )}
        </div>
      </div>
      
      {/* Metadata Card */}
      {metadata && (
        <ArticleMetadataCard metadata={metadata} />
      )}
      
      {/* Content Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Conteúdo do Artigo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <article className="prose prose-sm dark:prose-invert max-w-none">
              {/* Title */}
              <h1>{article.title}</h1>
              
              {/* Excerpt */}
              {article.excerpt && (
                <p className="lead text-lg text-muted-foreground">
                  {article.excerpt}
                </p>
              )}
              
              {/* Featured Image */}
              {article.featured_image_url && (
                <figure className="my-6">
                  <img 
                    src={article.featured_image_url} 
                    alt={article.featured_image_alt || article.title}
                    className="rounded-lg w-full"
                  />
                  {article.featured_image_alt && (
                    <figcaption className="text-center text-sm text-muted-foreground mt-2">
                      {article.featured_image_alt}
                    </figcaption>
                  )}
                </figure>
              )}
              
              {/* Main Content */}
              {article.content && (
                <ReactMarkdown>
                  {article.content}
                </ReactMarkdown>
              )}
              
              {/* FAQ Section */}
              {Array.isArray(article.faq) && article.faq.length > 0 && (
                <section className="mt-8">
                  <h2>Perguntas Frequentes</h2>
                  <div className="space-y-4">
                    {article.faq.map((item: any, index: number) => (
                      <div key={index} className="border-b pb-4 last:border-0">
                        <h3 className="font-medium">{item.question}</h3>
                        <p className="text-muted-foreground">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </article>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
