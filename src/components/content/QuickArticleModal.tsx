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
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";

interface QuickArticleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogId: string;
  isClientContext?: boolean;
}

export function QuickArticleModal({ open, onOpenChange, blogId, isClientContext = false }: QuickArticleModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // Detect client context from location if not explicitly passed
  const isClient = isClientContext || location.pathname.startsWith('/client');
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!theme.trim()) return;
    
    setLoading(true);
    
    // Navigate to article creation with pre-filled theme
    // The generation will use intelligent defaults automatically
    onOpenChange(false);
    const basePath = isClient ? '/client/create' : '/articles/new';
    navigate(`${basePath}?theme=${encodeURIComponent(theme.trim())}&quick=true`);
    
    setLoading(false);
    setTheme("");
  };

  const handleCustomize = () => {
    onOpenChange(false);
    const basePath = isClient ? '/client/create' : '/articles/new';
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

        <div className="space-y-6 py-4">
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
            <p className="text-sm text-muted-foreground text-center">
              Digite apenas o tema. O sistema cuida do resto.
            </p>
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
