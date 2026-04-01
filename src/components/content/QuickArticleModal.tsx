import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, ChevronDown, Loader2, Zap, Crown } from "lucide-react";
import { createArticleFromOpportunity } from '@/lib/createArticleFromOpportunity';

type ArticleType = 'normal' | 'premium';

interface QuickArticleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogId: string;
  isClientContext?: boolean;
}

const ARTICLE_TYPES: { id: ArticleType; label: string; icon: React.ReactNode; description: string; targetWords: number }[] = [
  {
    id: 'normal',
    label: 'Artigo Normal',
    icon: <Zap className="h-5 w-5" />,
    description: 'Conteúdo direto, Answer-First e focado na conversão rápida.',
    targetWords: 1200,
  },
  {
    id: 'premium',
    label: 'Artigo Premium',
    icon: <Crown className="h-5 w-5" />,
    description: 'Alta autoridade, rico em dados, frameworks e otimizado ao extremo para Citação de IA.',
    targetWords: 2500,
  },
];

export function QuickArticleModal({ open, onOpenChange, blogId, isClientContext = false }: QuickArticleModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isClient = isClientContext || location.pathname.startsWith('/client');
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [articleType, setArticleType] = useState<ArticleType>('premium');

  const handleGenerate = async () => {
    if (!theme.trim() || loading) return;
    
    setLoading(true);
    onOpenChange(false);

    const selected = ARTICLE_TYPES.find(t => t.id === articleType)!;
    
    try {
      await createArticleFromOpportunity(
        {
          id: '',
          suggested_title: theme.trim(),
        },
        blogId,
        navigate,
        selected.targetWords,
        articleType
      );
    } finally {
      setLoading(false);
      setTheme("");
    }
  };

  const handleCustomize = () => {
    onOpenChange(false);
    const basePath = isClient ? '/client/articles/engine/new' : '/articles/new';
    if (theme.trim()) {
      navigate(`${basePath}?theme=${encodeURIComponent(theme.trim())}`);
    } else {
      navigate(basePath);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar Artigo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-3">
            <Label htmlFor="theme" className="text-base font-medium">
              Tema do artigo
            </Label>
            <Textarea
              id="theme"
              placeholder="Ex: Como aumentar as vendas com marketing digital"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="min-h-[100px] resize-none"
              autoFocus
            />
          </div>

          {/* Article Type Selector */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Tipo do artigo</Label>
            <div className="grid grid-cols-2 gap-3">
              {ARTICLE_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setArticleType(type.id)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                    articleType === type.id
                      ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                      : 'border-border/40 bg-muted/10 hover:border-muted-foreground/30 hover:bg-muted/20'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    articleType === type.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {type.icon}
                  </div>
                  <span className="font-semibold text-sm">{type.label}</span>
                  <p className="text-xs text-muted-foreground leading-tight">{type.description}</p>
                  {type.id === 'premium' && (
                    <span className="absolute -top-2 -right-2 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium border border-primary/20">
                      Recomendado
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!theme.trim() || loading}
            className="w-full gradient-primary"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Artigo
              </>
            )}
          </Button>

          <button
            onClick={handleCustomize}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
          >
            <ChevronDown className="h-4 w-4" />
            Personalizar configurações (opcional)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
