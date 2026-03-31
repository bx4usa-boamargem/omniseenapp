import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { StatusCardsRow } from "@/components/dashboard/StatusCardsRow";
import { ValueProofSection } from "@/components/dashboard/ValueProofSection";
import { ToolsGrid } from "@/components/dashboard/ToolsGrid";
import { RecentDocuments } from "@/components/dashboard/RecentDocuments";

export default function ClientDashboardMvp() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { blog } = useBlog();

  // Extrair primeiro nome do usuário
  const firstName = user?.user_metadata?.name?.split(' ')[0] || 
                    user?.email?.split('@')[0] || 
                    'Usuário';

  // Subdomínio ou slug do blog
  const subdomain = blog?.platform_subdomain || blog?.slug || 'minha-conta';

  return (
    <div className="space-y-6">
      {/* BLOCO 1: BOAS-VINDAS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {t('client.dashboard.welcome', 'Bem-vindo de volta')}, {firstName}!
          </h1>
          <p className="text-muted-foreground mt-1">{subdomain}.omniseen.com</p>
        </div>
        <Button
          onClick={() => navigate("/client/articles/engine/new")}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/25"
        >
          <Sparkles className="h-4 w-4" />
          {t('client.dashboard.generateArticle', 'Gerar Artigo')}
        </Button>
      </div>

      {/* BLOCO 2: STATUS RÁPIDO */}
      <StatusCardsRow blogId={blog?.id} />

      {/* BLOCO 3: PROVA DE VALOR */}
      <ValueProofSection blogId={blog?.id} />

      {/* BLOCO 4: FERRAMENTAS */}
      <ToolsGrid />

      {/* BLOCO 5: ÚLTIMOS DOCUMENTOS */}
      <RecentDocuments blogId={blog?.id} />
    </div>
  );
}
