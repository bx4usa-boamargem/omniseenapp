import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Rocket, ExternalLink, CheckCircle2, Home } from 'lucide-react';
import { toast } from 'sonner';
import { getArticleUrl } from '@/utils/blogUrl';

interface CreatedArticle {
  id: string;
  title: string;
  slug: string;
}

export default function ClientCreateArticle() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdArticle, setCreatedArticle] = useState<CreatedArticle | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Digite o tema do artigo');
      return;
    }

    if (!blog?.id) {
      console.error('ClientCreateArticle: Blog não encontrado', { blog });
      toast.error('Blog não encontrado. Recarregue a página.');
      return;
    }

    // LOG: Início da geração
    console.log('ClientCreateArticle: Iniciando geração', {
      topic: topic.trim(),
      blogId: blog.id,
      blogName: blog.name,
      timestamp: new Date().toISOString(),
    });

    setIsGenerating(true);

    try {
      // Call the universal generation pipeline
      const requestBody = {
        blogId: blog.id,
        theme: topic.trim(),
        funnel_mode: 'top',
        article_goal: 'educar',
        generation_mode: 'deep',
        autoPublish: true, // Auto-publish for subaccounts
      };
      
      console.log('ClientCreateArticle: Chamando API', { requestBody });

      const { data, error } = await supabase.functions.invoke('generate-article-structured', {
        body: requestBody,
      });

      // LOG: Resultado da API
      console.log('ClientCreateArticle: Resposta da API', { 
        success: !error, 
        hasData: !!data,
        hasArticle: !!data?.article,
        error: error ? { message: error.message, name: error.name } : null,
      });

      if (error) {
        console.error('ClientCreateArticle: Erro da API', {
          message: error.message,
          name: error.name,
          context: error.context,
        });
        throw error;
      }

      if (data?.article) {
        const article = data.article;
        
        console.log('ClientCreateArticle: Artigo criado com sucesso', {
          articleId: article.id,
          title: article.title,
          slug: article.slug,
        });

        setCreatedArticle({
          id: article.id,
          title: article.title,
          slug: article.slug,
        });

        // Toast with action to view article
        const articleUrl = getArticleUrl(blog, article.slug);
        toast.success('Artigo criado com sucesso!', {
          description: article.title,
          action: {
            label: 'Ver Artigo',
            onClick: () => window.open(articleUrl, '_blank'),
          },
          duration: 10000,
        });
      } else {
        console.error('ClientCreateArticle: Resposta sem artigo', { data });
        throw new Error('Artigo não foi gerado. Resposta inválida da API.');
      }
    } catch (error) {
      console.error('ClientCreateArticle: Erro capturado', {
        error,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao criar artigo', {
        description: `${errorMessage}. Tente novamente.`,
        duration: 10000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewArticle = () => {
    if (createdArticle && blog) {
      const url = getArticleUrl(blog, createdArticle.slug);
      window.open(url, '_blank');
    }
  };

  const handleCreateAnother = () => {
    setCreatedArticle(null);
    setTopic('');
  };

  // Success state - article was created
  if (createdArticle) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            Artigo Criado!
          </h1>
          <p className="text-muted-foreground mt-1">
            Seu artigo foi publicado com sucesso
          </p>
        </div>

        {/* Success Card */}
        <Card className="border-2 border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold">{createdArticle.title}</h2>
              <p className="text-muted-foreground">
                Seu artigo já está disponível no seu blog
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                size="lg" 
                onClick={handleViewArticle}
                className="flex-1 gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Ver Artigo no Blog
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleCreateAnother}
                className="flex-1 gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Criar Outro Artigo
              </Button>
            </div>

            <Button 
              variant="ghost" 
              onClick={() => navigate('/client/dashboard')}
              className="w-full gap-2"
            >
              <Home className="h-4 w-4" />
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          Criar Artigo
        </h1>
        <p className="text-muted-foreground mt-1">
          Diga o tema e a IA faz o resto
        </p>
      </div>

      {/* Main Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-xl">Sobre o que você quer escrever hoje?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Textarea
            placeholder='Ex: "Dicas para manter a casa limpa no verão" ou "Como escolher o melhor serviço de dedetização"'
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isGenerating}
            className="min-h-[120px] text-lg resize-none"
          />

          <div className="flex flex-col gap-4">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="w-full h-14 text-lg gap-3"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Gerando seu artigo...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" />
                  Gerar e Publicar
                </>
              )}
            </Button>

            {isGenerating && (
              <p className="text-sm text-muted-foreground text-center animate-pulse">
                Isso pode levar alguns segundos. Estamos criando um artigo completo para você.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">💡 Dicas para um bom artigo:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Seja específico sobre o tema do seu negócio</li>
            <li>• Pense no que seus clientes perguntam</li>
            <li>• Você pode criar quantos artigos quiser</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
