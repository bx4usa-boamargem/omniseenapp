import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Eye, ExternalLink, AlertTriangle } from 'lucide-react';

interface CTAPreviewProps {
  companyName: string;
  city?: string;
  whatsapp?: string;
}

export function CTAPreview({ companyName, city, whatsapp }: CTAPreviewProps) {
  const locationText = city ? ` em ${city}` : '';
  const ctaText = `Fale com a ${companyName} agora`;
  const whatsappLink = whatsapp ? `https://wa.me/${whatsapp}` : null;

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Preview do CTA Final
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Preview do CTA como aparecerá no artigo */}
        <div className="p-4 rounded-lg bg-background border text-sm">
          <h4 className="font-bold text-base mb-3">Próximo passo</h4>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Você não precisa continuar perdendo clientes por falta de resposta, 
            organização ou tempo.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Hoje já existem ferramentas simples que fazem o trabalho pesado por 
            você — mesmo enquanto você está atendendo clientes ou trabalhando no campo.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Se você quer transformar seu site, seu WhatsApp e seus leads em uma 
            máquina de vendas automática, o próximo passo é conversar com a{' '}
            <strong className="text-foreground">{companyName}</strong>{locationText}.
          </p>
          
          {whatsappLink ? (
            <a 
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              {ctaText}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium">
              👉 {ctaText}
            </span>
          )}
        </div>

        {/* Status do WhatsApp */}
        {!whatsapp && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Configure o WhatsApp em "Minha Empresa" para ativar o link clicável
          </p>
        )}
      </CardContent>
    </Card>
  );
}
