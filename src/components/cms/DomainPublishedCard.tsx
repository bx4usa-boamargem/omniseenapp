import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Globe, ExternalLink, Pencil, Unplug, Loader2, CheckCircle } from "lucide-react";

interface DomainPublishedCardProps {
  publicationUrl: string;
  onEdit: () => void;
  onDisconnect: () => Promise<void>;
  isEditing?: boolean;
}

export function DomainPublishedCard({
  publicationUrl,
  onEdit,
  onDisconnect,
  isEditing = false,
}: DomainPublishedCardProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
      setShowConfirmDialog(false);
    }
  };

  // Extract domain from URL for display
  const getDomainFromUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  return (
    <>
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">
                Publicado em Domínio
              </CardTitle>
            </div>
            <Badge 
              variant="default" 
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Publicado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Published URL */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800">
            <Globe className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate flex-1">
              {getDomainFromUrl(publicationUrl)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => window.open(publicationUrl, "_blank")}
              title="Abrir no navegador"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          {/* URL completa */}
          <p className="text-xs text-muted-foreground break-all">
            {publicationUrl}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={isEditing}
              className="flex-1 gap-2"
            >
              <Pencil className="h-3 w-3" />
              Trocar Domínio
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmDialog(true)}
              disabled={disconnecting}
              className="flex-1 gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 dark:border-orange-800 dark:hover:bg-orange-950/50"
            >
              {disconnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Unplug className="h-3 w-3" />
              )}
              Desconectar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar do Domínio?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                O artigo será removido do domínio <strong>{getDomainFromUrl(publicationUrl)}</strong> e 
                voltará para rascunho.
              </p>
              <p className="text-sm text-muted-foreground">
                Você poderá republicá-lo posteriormente no mesmo ou em outro domínio.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : (
                "Desconectar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
