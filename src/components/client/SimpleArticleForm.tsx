import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Zap, Brain, Loader2 } from 'lucide-react';

export interface SimpleFormData {
  theme: string;
  generationMode: 'fast' | 'deep';
}

interface SimpleArticleFormProps {
  onGenerate: (data: SimpleFormData) => void;
  isGenerating: boolean;
}

export function SimpleArticleForm({ onGenerate, isGenerating }: SimpleArticleFormProps) {
  const [theme, setTheme] = useState('');
  const [generationMode, setGenerationMode] = useState<'fast' | 'deep'>('deep');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim()) return;
    onGenerate({ theme: theme.trim(), generationMode });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Novo Artigo
        </CardTitle>
        <CardDescription>
          Digite o tema e a IA criará um artigo completo para você
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
          {/* Theme Input */}
          <div className="space-y-2 flex-1">
            <Label htmlFor="theme">Tema do Artigo</Label>
            <Textarea
              id="theme"
              placeholder='Ex: "Dicas para manter a casa limpa no verão" ou "Como escolher o melhor serviço de dedetização"'
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="min-h-[160px] resize-none text-base"
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              Seja específico sobre o tema do seu negócio. Pense no que seus clientes perguntam.
            </p>
          </div>

          {/* Generation Mode */}
          <div className="space-y-3">
            <Label>Modo de Geração</Label>
            <RadioGroup
              value={generationMode}
              onValueChange={(value) => setGenerationMode(value as 'fast' | 'deep')}
              className="grid grid-cols-2 gap-3"
              disabled={isGenerating}
            >
              <div>
                <RadioGroupItem value="fast" id="fast" className="peer sr-only" />
                <Label
                  htmlFor="fast"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                >
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <div className="text-center">
                    <p className="font-medium">Rápido</p>
                    <p className="text-xs text-muted-foreground">400-1000 palavras</p>
                  </div>
                </Label>
              </div>
              
              <div>
                <RadioGroupItem value="deep" id="deep" className="peer sr-only" />
                <Label
                  htmlFor="deep"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                >
                  <Brain className="h-5 w-5 text-purple-500" />
                  <div className="text-center">
                    <p className="font-medium">Profundo</p>
                    <p className="text-xs text-muted-foreground">1500-3000 palavras</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg gap-3"
            disabled={!theme.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Gerar Artigo com IA
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
