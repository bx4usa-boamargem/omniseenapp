import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { ArticleGenerationScreen } from '@/components/client/ArticleGenerationScreen';

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

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error('Digite o tema do artigo');
      return;
    }

    if (!blog?.id) {
      console.error('ClientCreateArticle: Blog não encontrado', { blog });
      toast.error('Blog não encontrado. Recarregue a página.');
      return;
    }

    // Open fullscreen generation screen
    setIsGenerating(true);
  };

  const handleGenerationComplete = (article: CreatedArticle) => {
    setIsGenerating(false);
    setTopic('');
    navigate('/client/dashboard');
  };

  const handleGenerationCancel = () => {
    setIsGenerating(false);
  };

  // Fullscreen generation experience
  if (isGenerating && blog) {
    return (
      <ArticleGenerationScreen
        topic={topic.trim()}
        blog={blog}
        onComplete={handleGenerationComplete}
        onCancel={handleGenerationCancel}
      />
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
            className="min-h-[120px] text-lg resize-none"
          />

          <div className="flex flex-col gap-4">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!topic.trim()}
              className="w-full h-14 text-lg gap-3"
            >
              <Rocket className="h-5 w-5" />
              Gerar e Publicar
            </Button>
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
