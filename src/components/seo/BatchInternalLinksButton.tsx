import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link2, Loader2, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProcessingResult {
  articleId: string;
  title: string;
  linksAdded: number;
  error?: string;
}

interface BatchInternalLinksButtonProps {
  blogId: string;
  onComplete?: () => void;
  variant?: "default" | "compact";
}

export function BatchInternalLinksButton({
  blogId,
  onComplete,
  variant = "default",
}: BatchInternalLinksButtonProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleBatchProcess = async () => {
    setProcessing(true);
    setProgress(10);

    try {
      // Simulate progress while waiting for edge function
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 2000);

      const response = await supabase.functions.invoke("batch-internal-links", {
        body: { blogId },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data as {
        success: boolean;
        processed: number;
        linksInserted: number;
        details: ProcessingResult[];
        message?: string;
      };

      if (data.message) {
        toast({
          title: "Aviso",
          description: data.message,
        });
      } else if (data.linksInserted > 0) {
        toast({
          title: "Links internos gerados! ✅",
          description: `${data.linksInserted} links inseridos em ${data.processed} artigos`,
        });
      } else {
        toast({
          title: "Processamento concluído",
          description: "Nenhum link novo foi encontrado para inserir.",
        });
      }

      onComplete?.();
    } catch (error) {
      console.error("Error in batch internal links:", error);
      toast({
        variant: "destructive",
        title: "Erro ao processar links",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  if (variant === "compact") {
    return (
      <Button
        onClick={handleBatchProcess}
        disabled={processing}
        size="sm"
        variant="outline"
        className="gap-2"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Gerar Links com IA
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleBatchProcess}
        disabled={processing}
        className="w-full gap-2 bg-primary hover:bg-primary/90"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando artigos...
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            <Sparkles className="h-4 w-4" />
            Gerar Links Internos com IA
          </>
        )}
      </Button>

      {processing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Analisando artigos e inserindo links...
          </p>
        </div>
      )}
    </div>
  );
}
