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
import { getCanonicalBlogUrl } from '@/utils/blogUrl';
import { QRCodeModal } from './QRCodeModal';
import { supabase } from '@/integrations/supabase/client';

interface PublicBlogLinkProps {
  blog: {
    id: string;
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
  
  // Always use canonical URL for display and sharing
  const publicUrl = getCanonicalBlogUrl(blog);
  const hasCustomDomain = blog.custom_domain && blog.domain_verified;
  
  // Track link events
  const trackEvent = async (eventType: 'link_copy' | 'link_open' | 'qr_download') => {
    try {
      const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent);
      await supabase.functions.invoke('track-link-click', {
        body: {
          blogId: blog.id,
          eventType,
          source: 'dashboard',
          device: isMobile ? 'mobile' : 'desktop',
          browser: navigator.userAgent.substring(0, 100),
        }
      });
    } catch (e) {
      console.error('Track event error:', e);
    }
  };
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      trackEvent('link_copy');
      toast.success('Link copiado! Pronto para compartilhar.');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleOpenBlog = () => {
    trackEvent('link_open');
    window.open(publicUrl, '_blank');
  };

  const handleOpenQR = () => {
    setShowQR(true);
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
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                size="sm" 
                onClick={handleCopy}
                className="gap-2 client-btn-primary flex-1 sm:flex-none"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado!' : 'Copiar link'}
              </Button>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleOpenBlog}
                  className="gap-2 flex-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden xs:inline">Abrir blog</span>
                  <span className="xs:hidden">Abrir</span>
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleOpenQR}
                  className="gap-2 flex-1"
                >
                  <QrCode className="h-4 w-4" />
                  <span className="hidden xs:inline">QR Code</span>
                  <span className="xs:hidden">QR</span>
                </Button>
              </div>
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
                  <Link to="/client/account" className="text-primary hover:underline font-medium">
                    Configure em Minha Conta →
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
        blogId={blog.id}
      />
    </>
  );
}
