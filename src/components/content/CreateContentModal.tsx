import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Target, Upload, Layers, ArrowRight } from "lucide-react";
import { QuickArticleModal } from "./QuickArticleModal";
import { FunnelModal } from "./FunnelModal";
import { BulkGenerationModal } from "./BulkGenerationModal";

interface CreateContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogId: string;
  isClientContext?: boolean;
}

interface ContentOption {
  id: "quick" | "funnel" | "bulk" | "import";
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: { label: string; variant: "recommended" | "optional" };
}

const contentOptions: ContentOption[] = [
  {
    id: "quick",
    title: "Criar Artigo",
    description: "Artigo simples. Digite o tema e gere.",
    icon: <Sparkles className="h-6 w-6" />,
    badge: { label: "Recomendado", variant: "recommended" },
  },
  {
    id: "funnel",
    title: "Artigo por Funil",
    description: "Conteúdo estratégico por etapa do funil.",
    icon: <Target className="h-6 w-6" />,
    badge: { label: "Opcional", variant: "optional" },
  },
  {
    id: "bulk",
    title: "Geração em Massa",
    description: "Gere múltiplos artigos de uma vez.",
    icon: <Layers className="h-6 w-6" />,
  },
  {
    id: "import",
    title: "Importar Conteúdo",
    description: "PDF, vídeo, link ou texto.",
    icon: <Upload className="h-6 w-6" />,
  },
];

export function CreateContentModal({ open, onOpenChange, blogId, isClientContext = false }: CreateContentModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // Detect client context from location if not explicitly passed
  const isClient = isClientContext || location.pathname.startsWith('/client');
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [funnelModalOpen, setFunnelModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const handleOptionClick = (optionId: ContentOption["id"]) => {
    onOpenChange(false);
    
    switch (optionId) {
      case "quick":
        setQuickModalOpen(true);
        break;
      case "funnel":
        setFunnelModalOpen(true);
        break;
      case "bulk":
        setBulkModalOpen(true);
        break;
      case "import":
        navigate(isClient ? "/client/articles/engine/new" : "/articles/new");
        break;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              Criar Conteúdo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {contentOptions.map((option) => (
              <Card
                key={option.id}
                className={`cursor-pointer transition-all hover:border-primary hover:shadow-md group ${
                  option.id === "quick" ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => handleOptionClick(option.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${
                      option.id === "quick" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    }`}>
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{option.title}</span>
                        {option.badge && (
                          <Badge 
                            variant="outline" 
                            className={
                              option.badge.variant === "recommended"
                                ? "bg-primary/10 text-primary border-primary/30"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {option.badge.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <QuickArticleModal
        open={quickModalOpen}
        onOpenChange={setQuickModalOpen}
        blogId={blogId}
        isClientContext={isClient}
      />

      <FunnelModal
        open={funnelModalOpen}
        onOpenChange={setFunnelModalOpen}
        blogId={blogId}
        onContinue={() => setFunnelModalOpen(false)}
        isClientContext={isClient}
      />

      <BulkGenerationModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        blogId={blogId}
      />
    </>
  );
}
