import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  blogName: string;
}

export function QRCodeModal({ open, onClose, url, blogName }: QRCodeModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  
  // Generate QR Code using free API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=10`;
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qrcode-${blogName.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
    toast.success('QR Code baixado!');
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">QR Code do seu Blog</DialogTitle>
          <DialogDescription>
            Escaneie para acessar <span className="font-medium text-foreground">{blogName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-6">
          {/* QR Code with white background */}
          <div className="bg-white p-4 rounded-xl shadow-sm border" ref={qrRef}>
            <img 
              src={qrCodeUrl} 
              alt="QR Code do blog" 
              className="w-56 h-56 sm:w-64 sm:h-64"
            />
          </div>
          
          {/* Commercial copy - targeted at physical businesses */}
          <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Printer className="h-4 w-4" />
              <span className="font-medium text-sm">Dica para negócios físicos</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Imprima este QR Code em cartões, uniformes, vitrines e veículos.
              <br />
              <span className="font-medium text-foreground">Ele leva clientes direto para o seu conteúdo.</span>
            </p>
          </div>
          
          {/* URL for verification */}
          <code className="text-xs text-muted-foreground text-center break-all max-w-full bg-muted px-3 py-1.5 rounded">
            {url}
          </code>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button onClick={handleDownload} className="gap-2 w-full sm:w-auto">
            <Download className="h-4 w-4" />
            Baixar QR Code
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
