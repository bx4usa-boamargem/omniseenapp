import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTenantDomains, TenantDomain } from "@/hooks/useTenantDomains";
import { Button } from "@/components/ui/button";

interface DomainPublishingSelectorProps {
  blogId: string;
  selectedDomain: string | null;
  onSelect: (domain: string, domainInfo: TenantDomain) => void;
}

export function DomainPublishingSelector({
  blogId,
  selectedDomain,
  onSelect,
}: DomainPublishingSelectorProps) {
  const { domains, loading, error, getActiveDomains } = useTenantDomains({
    blogId,
    onlyActive: true,
  });

  const activeDomains = getActiveDomains();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Carregando domínios...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar domínios: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (activeDomains.length === 0) {
    return (
      <Alert>
        <Globe className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <p>Nenhum domínio ativo configurado para este blog.</p>
          <p className="text-xs text-muted-foreground">
            Acesse <strong>Configurações → Domínios</strong> para adicionar um
            subdomínio OmniSeen ou conectar seu domínio próprio.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const handleDomainSelect = (domainValue: string) => {
    const domainInfo = activeDomains.find((d) => d.domain === domainValue);
    if (domainInfo) {
      onSelect(domainValue, domainInfo);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Selecione o domínio onde o artigo será publicado:
      </div>

      <RadioGroup
        value={selectedDomain || undefined}
        onValueChange={handleDomainSelect}
        className="space-y-3"
      >
        {activeDomains.map((domain) => (
          <div
            key={domain.id}
            className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <RadioGroupItem value={domain.domain} id={domain.id} />
            <Label
              htmlFor={domain.id}
              className="flex-1 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{domain.domain}</span>
                {domain.is_primary && (
                  <Badge variant="secondary" className="text-xs">
                    Primário
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs capitalize"
                >
                  {domain.domain_type === "subdomain"
                    ? "Subdomínio"
                    : "Personalizado"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(`https://${domain.domain}`, "_blank");
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>

      {selectedDomain && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <Globe className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            O artigo será publicado em{" "}
            <strong>https://{selectedDomain}</strong>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
