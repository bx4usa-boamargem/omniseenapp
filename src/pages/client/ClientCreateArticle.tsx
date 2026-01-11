import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Rocket } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientCreateArticle() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Digite o tema do artigo');
      return;
    }

    if (!blog?.id) {
      toast.error('Blog não encontrado');
      return;
    }

    setIsGenerating(true);

    try {
      // Call the universal generation pipeline
      const { data, error } = await supabase.functions.invoke('generate-article-structured', {
        body: {
          blogId: blog.id,
          theme: topic.trim(),
          funnel_mode: 'top',
          article_goal: 'educar',
          generation_mode: 'deep',
          autoPublish: true, // Auto-publish for subaccounts
        },
      });

      if (error) throw error;

      if (data?.article) {
        toast.success('Seu artigo foi criado e publicado!', {
          description: 'Você pode ver no seu blog agora.',
          duration: 5000,
        });
        navigate('/client/dashboard');
      } else {
        throw new Error('Artigo não foi gerado');
      }
    } catch (error) {
      console.error('Error generating article:', error);
      toast.error('Erro ao criar artigo', {
        description: 'Tente novamente em alguns segundos.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

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
