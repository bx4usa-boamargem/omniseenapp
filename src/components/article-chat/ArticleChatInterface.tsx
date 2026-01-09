import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { ChatMessage } from "./ChatMessage";
import { ChatDraft } from "@/hooks/useArticleChatDraft";
import { 
  Send, 
  Loader2, 
  Mic,
  MicOff,
  FileText,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ArticleData {
  title: string;
  excerpt: string;
  meta_description: string;
  content: string;
  keywords: string[];
  faq?: Array<{ question: string; answer: string }>;
}

interface ArticleChatInterfaceProps {
  blogId: string;
  onArticleGenerated: (article: ArticleData) => void;
  className?: string;
  initialDraft?: ChatDraft | null;
  onDraftChange?: (draft: ChatDraft) => void;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Olá! 👋 Vou te ajudar a criar um artigo incrível. Para começar, me conta: sobre qual tema você gostaria de escrever hoje?\n\n💡 **Dica:** Você pode usar o microfone 🎤 para ditar suas ideias!'
};

export function ArticleChatInterface({ 
  blogId, 
  onArticleGenerated, 
  className,
  initialDraft,
  onDraftChange 
}: ArticleChatInterfaceProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { 
    isListening, 
    transcript, 
    isSupported, 
    error: speechError,
    startListening, 
    stopListening,
    resetTranscript
  } = useSpeechRecognition();

  // Initialize from draft or default message
  useEffect(() => {
    if (isInitialized) return;
    
    if (initialDraft && initialDraft.messages.length > 0) {
      setMessages(initialDraft.messages);
      setInput(initialDraft.currentInput || '');
      setIsReadyToGenerate(initialDraft.isReadyToGenerate);
      setIsInitialized(true);
    } else if (!initialDraft) {
      setMessages([INITIAL_MESSAGE]);
      setIsInitialized(true);
    }
  }, [initialDraft, isInitialized]);

  // Notify parent of draft changes
  useEffect(() => {
    if (!isInitialized || !onDraftChange) return;
    
    onDraftChange({
      messages,
      currentInput: input,
      isReadyToGenerate,
      generatedArticle: null
    });
  }, [messages, input, isReadyToGenerate, isInitialized, onDraftChange]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle speech transcript
  useEffect(() => {
    if (transcript) {
      setInput(prev => {
        const newValue = prev ? `${prev} ${transcript}` : transcript;
        return newValue;
      });
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Show speech error
  useEffect(() => {
    if (speechError) {
      toast({
        variant: "destructive",
        title: "Erro no microfone",
        description: speechError
      });
    }
  }, [speechError, toast]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('article-chat', {
        body: {
          messages: newMessages,
          blogId
        }
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      
      if (data.type === 'message') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        
        if (data.isReadyToGenerate) {
          setIsReadyToGenerate(true);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        variant: "destructive",
        title: "Erro no chat",
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const generateArticle = async () => {
    setIsGenerating(true);

    try {
      const response = await supabase.functions.invoke('article-chat', {
        body: {
          messages,
          blogId,
          generateArticle: true
        }
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      
      if (data.type === 'article' && data.article) {
        toast({
          title: "Artigo gerado!",
          description: "Seu artigo foi criado com sucesso."
        });
        onArticleGenerated(data.article);
      } else {
        throw new Error('Failed to generate article');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        variant: "destructive",
        title: "Erro na geração",
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const quickSuggestions = [
    { emoji: "💼", text: "Marketing para PMEs" },
    { emoji: "🛒", text: "E-commerce e vendas" },
    { emoji: "💡", text: "Produtividade" },
    { emoji: "📱", text: "Tecnologia" }
  ];

  return (
    <div className={cn("flex flex-col bg-card rounded-xl border shadow-sm", className)}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">Chat de Criação</h2>
            <p className="text-xs text-muted-foreground">Converse para criar seu artigo</p>
          </div>
        </div>
        
        {isListening && (
          <div className="flex items-center gap-2 text-primary text-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Ouvindo...
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="p-4 space-y-1">
          {messages.map((message, index) => (
            <ChatMessage 
              key={index} 
              role={message.role} 
              content={message.content} 
            />
          ))}
          
          {isLoading && (
            <div className="flex gap-3 p-4">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <p className="text-sm text-muted-foreground">Pensando...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick suggestions for first message */}
      {messages.length === 1 && (
        <div className="px-4 py-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">Sugestões rápidas:</p>
          <div className="grid grid-cols-2 gap-2">
            {quickSuggestions.map((suggestion) => (
              <Button
                key={suggestion.text}
                variant="outline"
                size="sm"
                className="justify-start text-xs h-auto py-2"
                onClick={() => {
                  setInput(suggestion.text);
                  inputRef.current?.focus();
                }}
              >
                <span className="mr-2">{suggestion.emoji}</span>
                {suggestion.text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Generate button */}
      {isReadyToGenerate && (
        <div className="px-4 py-3 border-t bg-primary/5">
          <Button 
            className="w-full gap-2" 
            onClick={generateArticle}
            disabled={isGenerating}
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando artigo...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Gerar Artigo Completo
              </>
            )}
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Fale agora..." : "Digite ou use o microfone..."}
            disabled={isLoading || isGenerating}
            className="flex-1"
          />
          
          {/* Microphone button - only show if supported */}
          {isSupported && (
            <Button 
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={toggleListening}
              disabled={isLoading || isGenerating}
              className={cn(
                "shrink-0 transition-all",
                isListening && "animate-pulse"
              )}
              title={isListening ? "Parar gravação" : "Iniciar gravação"}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <Button 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading || isGenerating}
            size="icon"
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {isSupported && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Pressione o microfone 🎤 para ditar • Enter para enviar
          </p>
        )}
      </div>
    </div>
  );
}
