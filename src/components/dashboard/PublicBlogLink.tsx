import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode,
  Zap,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { getBlogUrl } from '@/utils/blogUrl';
import { QRCodeModal } from './QRCodeModal';

interface PublicBlogLinkProps {
  blog: {
    slug: string;
    name: string;
    custom_domain?: string | null;
    domain_verified?: boolean | null;
    platform_subdomain?: string | null;
  };
}

export function PublicBlogLink({ blog }: PublicBlogLinkProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  const publicUrl = getBlogUrl(blog);
  const hasCustomDomain = blog.custom_domain && blog.domain_verified;
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Link copiado! Pronto para compartilhar.');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleOpenBlog = () => {
    window.open(publicUrl, '_blank');
  };
  
  return (
    <>
      <Card className="client-card border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-primary/10">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              Seu link público de aquisição
            </CardTitle>
            {hasCustomDomain && (
              <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 gap-1">
                <Check className="h-3 w-3" />
                Domínio próprio
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Display Box */}
          <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <code className="flex-1 text-sm sm:text-base font-mono text-primary break-all font-medium">
                {publicUrl}
              </code>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                onClick={handleCopy}
                className="gap-2 client-btn-primary"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado!' : 'Copiar link'}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleOpenBlog}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir blog
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowQR(true)}
                className="gap-2"
              >
                <QrCode className="h-4 w-4" />
                QR Code
              </Button>
            </div>
          </div>
          
          {/* Commercial Helper Text */}
          <div className="space-y-2">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <span>
                Este é o <strong className="text-foreground">endereço oficial da sua máquina de tráfego orgânico</strong>. 
                Use em botões do site, WhatsApp, bio do Instagram, anúncios, QR Codes e campanhas.
              </span>
            </p>
            
            {!hasCustomDomain && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span>
                  Quer usar seu próprio domínio?{' '}
                  <Link to="/client/settings" className="text-primary hover:underline font-medium">
                    Configure aqui →
                  </Link>
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* QR Code Modal */}
      <QRCodeModal 
        open={showQR} 
        onClose={() => setShowQR(false)} 
        url={publicUrl}
        blogName={blog.name}
      />
    </>
  );
}
