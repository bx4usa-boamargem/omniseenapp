import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MissingCostsAlertProps {
  onMigrationComplete?: () => void;
}

export function MissingCostsAlert({ onMigrationComplete }: MissingCostsAlertProps) {
  const [missingData, setMissingData] = useState<{
    articlesWithoutLogs: number;
    imagesWithoutLogs: number;
    estimatedMissingCost: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);

  useEffect(() => {
    checkMissingCosts();
  }, []);

  const checkMissingCosts = async () => {
    try {
      // Get total articles count
      const { count: totalArticles } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true });

      // Get articles with logged costs
      const { data: loggedArticles } = await supabase
        .from("consumption_logs")
        .select("id")
        .eq("action_type", "article_generation");

      // Get total images (featured + content images approximation)
      const { data: articlesWithImages } = await supabase
        .from("articles")
        .select("id, featured_image_url, content_images")
        .not("featured_image_url", "is", null);

      // Get logged image costs
      const { data: loggedImages } = await supabase
        .from("consumption_logs")
        .select("images_generated")
        .eq("action_type", "image_generation");

      const totalLoggedImages = loggedImages?.reduce((sum, l) => sum + (l.images_generated || 0), 0) || 0;
      
      // Estimate actual images (1 cover + ~2 content images per article with images)
      let estimatedTotalImages = 0;
      articlesWithImages?.forEach(article => {
        estimatedTotalImages += 1; // Cover image
        if (article.content_images && Array.isArray(article.content_images)) {
          estimatedTotalImages += (article.content_images as unknown[]).length;
        }
      });

      const articlesWithoutLogs = Math.max(0, (totalArticles || 0) - (loggedArticles?.length || 0));
      const imagesWithoutLogs = Math.max(0, estimatedTotalImages - totalLoggedImages);
      
      // Estimate missing cost: $0.002 per article + $0.03 per image
      const estimatedMissingCost = (articlesWithoutLogs * 0.002) + (imagesWithoutLogs * 0.03);

      setMissingData({
        articlesWithoutLogs,
        imagesWithoutLogs,
        estimatedMissingCost,
      });
    } catch (error) {
      console.error("Error checking missing costs:", error);
    } finally {
      setLoading(false);
    }
  };

  const runRetroactiveMigration = async () => {
    setMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-retroactive-costs", {
        body: { action: "migrate" },
      });

      if (error) throw error;

      toast.success(`Migração concluída: ${data.articlesInserted} artigos, ${data.imagesInserted} imagens`);
      setMigrationDone(true);
      onMigrationComplete?.();
      
      // Recheck after migration
      await checkMissingCosts();
    } catch (error) {
      console.error("Migration error:", error);
      toast.error("Erro na migração retroativa");
    } finally {
      setMigrating(false);
    }
  };

  if (loading) return null;

  // No missing data
  if (!missingData || (missingData.articlesWithoutLogs === 0 && missingData.imagesWithoutLogs === 0)) {
    return null;
  }

  // Migration done
  if (migrationDone) {
    return (
      <Card className="border-green-500 bg-green-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-green-600 dark:text-green-400">
                Migração Retroativa Concluída
              </p>
              <p className="text-sm text-muted-foreground">
                Os custos históricos foram inseridos com sucesso. Atualize a página para ver os novos dados.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500 bg-yellow-500/10">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-yellow-600 dark:text-yellow-400">
              Custos Históricos Não Registrados
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Detectados <strong>{missingData.articlesWithoutLogs} artigos</strong> e{" "}
              <strong>~{missingData.imagesWithoutLogs} imagens</strong> sem custos registrados.
            </p>
            <p className="text-sm text-muted-foreground">
              Custo estimado não contabilizado:{" "}
              <strong className="text-yellow-600 dark:text-yellow-400">
                ${missingData.estimatedMissingCost.toFixed(2)}
              </strong>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={runRetroactiveMigration}
              disabled={migrating}
            >
              {migrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Migrando...
                </>
              ) : (
                "Executar Migração Retroativa"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
