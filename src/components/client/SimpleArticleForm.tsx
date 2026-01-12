import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Zap, Brain, Loader2, Mic, MicOff } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface SimpleFormData {
  theme: string;
  generationMode: 'fast' | 'deep';
}

interface SimpleArticleFormProps {
  onGenerate: (data: SimpleFormData) => void;
  isGenerating: boolean;
  disabled?: boolean; // NEW: External lock for preventing double-submission
}

export function SimpleArticleForm({ onGenerate, isGenerating, disabled = false }: SimpleArticleFormProps) {
  const [theme, setTheme] = useState('');
  const [generationMode, setGenerationMode] = useState<'fast' | 'deep'>('deep');
  const isLocked = isGenerating || disabled;
  
  const { 
    isListening, 
    transcript, 
    isSupported, 
    error: speechError,
    startListening, 
    stopListening,
    resetTranscript
  } = useSpeechRecognition();

  // Update theme when transcript changes
  useEffect(() => {
    if (transcript) {
      setTheme(prev => prev ? `${prev} ${transcript}` : transcript);
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Show speech error
  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

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
          Digite ou fale o tema e a IA criará um artigo completo para você
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
          {/* Theme Input with Microphone */}
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="theme">Tema do Artigo</Label>
              {isSupported && (
                <Button 
                  type="button"
                  variant={isListening ? "destructive" : "ghost"}
                  size="sm"
                  onClick={toggleListening}
                  disabled={isLocked}
                  className={cn(
                    "gap-2 transition-all",
                    isListening && "animate-pulse"
                  )}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Parar
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Falar
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* Recording Indicator */}
            {isListening && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  Gravando... Fale o tema do seu artigo
                </span>
              </div>
            )}
            
            <Textarea
              id="theme"
              placeholder={isListening 
                ? 'Fale agora... 🎤' 
                : 'Ex: "Dicas para manter a casa limpa no verão" ou "Como escolher o melhor serviço de dedetização"'}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className={cn(
                "min-h-[160px] resize-none text-base",
                isListening && "border-red-500 ring-2 ring-red-500/20"
              )}
              disabled={isLocked}
            />
            <p className="text-xs text-muted-foreground">
              {isSupported 
                ? 'Digite ou use o microfone 🎤 para ditar o tema do seu artigo.'
                : 'Seja específico sobre o tema do seu negócio. Pense no que seus clientes perguntam.'}
            </p>
          </div>

          {/* Generation Mode */}
          <div className="space-y-3">
            <Label>Modo de Geração</Label>
            <RadioGroup
              value={generationMode}
              onValueChange={(value) => setGenerationMode(value as 'fast' | 'deep')}
              className="grid grid-cols-2 gap-3"
              disabled={isLocked}
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
            disabled={!theme.trim() || isLocked}
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
