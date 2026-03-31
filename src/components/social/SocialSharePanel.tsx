import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, ExternalLink, Instagram, Linkedin, Share2, Loader2, Send } from "lucide-react";
import { InstagramPreview } from "./InstagramPreview";
import { LinkedInPreview } from "./LinkedInPreview";
import { supabase } from "@/integrations/supabase/client";

interface SocialSharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  excerpt: string;
  featuredImage: string | null;
  articleUrl?: string;
  keywords?: string[];
  articleId?: string;
  blogId?: string;
}

export function SocialSharePanel({
  open,
  onOpenChange,
  title,
  excerpt,
  featuredImage,
  articleUrl,
  keywords = [],
  articleId,
  blogId,
}: SocialSharePanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("linkedin");
  const [publishing, setPublishing] = useState<string | null>(null);

  const hashtags = keywords.slice(0, 5).map(k => `#${k.replace(/\s+/g, '')}`).join(' ');

  const instagramCaption = `📚 ${title}\n\n${excerpt}\n\n${hashtags}\n\n🔗 Link na bio`;
  const linkedInCaption = `${title}\n\n${excerpt}\n\n${hashtags}\n\n${articleUrl || ''}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const downloadImage = async () => {
    if (!featuredImage) {
      toast({ title: "Nenhuma imagem disponível", variant: "destructive" });
      return;
    }
    
    try {
      const response = await fetch(featuredImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.slice(0, 30).replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Imagem baixada!" });
    } catch (error) {
      toast({ title: "Erro ao baixar imagem", variant: "destructive" });
    }
  };

  const openLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl || '')}`;
    window.open(url, '_blank', 'width=600,height=600');
  };

  const publishDirect = async (platform: "linkedin" | "instagram") => {
    if (!articleId || !blogId) {
      toast({ title: "Artigo não disponível para publicação direta", variant: "destructive" });
      return;
    }
    setPublishing(platform);
    try {
      const { data, error } = await supabase.functions.invoke("publish-to-social", {
        body: { article_id: articleId, blog_id: blogId, platforms: [platform] },
      });
      if (error) throw error;
      const result = data?.results?.[platform];
      if (result?.success) {
        toast({ title: `Publicado no ${platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} com sucesso!` });
      } else {
        toast({ title: result?.error || "Conta não conectada. Configure em Configurações > Integrações.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: err.message || "Erro ao publicar", variant: "destructive" });
    } finally {
      setPublishing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Divulgar nas Redes Sociais
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="instagram" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Instagram
              <Badge variant="outline" className="text-xs">Em Breve</Badge>
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="flex items-center gap-2">
              <Linkedin className="h-4 w-4" />
              LinkedIn
              <Badge variant="secondary" className="text-xs">Novo</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instagram" className="space-y-4 mt-4">
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center">
              <Instagram className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-2">Publicação Automática no Instagram</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Em breve você poderá publicar diretamente no Instagram. Por enquanto, use a opção de copiar legenda e baixar imagem.
              </p>
            </div>
            
            <InstagramPreview
              imageUrl={featuredImage}
              title={title}
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Legenda para Instagram</label>
              <Textarea
                value={instagramCaption}
                readOnly
                className="min-h-[120px] text-sm opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                {instagramCaption.length}/2200 caracteres
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => copyToClipboard(instagramCaption, "Legenda")}
                disabled
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar Legenda
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={downloadImage}
                disabled
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Imagem 1:1
              </Button>
            </div>

            {articleId && blogId && featuredImage && (
              <Button
                className="w-full"
                onClick={() => publishDirect("instagram")}
                disabled={publishing === "instagram"}
              >
                {publishing === "instagram" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publicar Direto no Instagram
              </Button>
            )}
          </TabsContent>

          <TabsContent value="linkedin" className="space-y-4 mt-4">
            <LinkedInPreview
              imageUrl={featuredImage}
              title={title}
              excerpt={excerpt}
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Texto para LinkedIn</label>
              <Textarea
                value={linkedInCaption}
                readOnly
                className="min-h-[120px] text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {linkedInCaption.length}/3000 caracteres
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => copyToClipboard(linkedInCaption, "Texto")}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar Texto
              </Button>
              <Button
                className="flex-1"
                onClick={openLinkedIn}
                disabled={!articleUrl}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Compartilhar no LinkedIn
              </Button>
            </div>

            {articleId && blogId && (
              <Button
                className="w-full"
                onClick={() => publishDirect("linkedin")}
                disabled={publishing === "linkedin"}
              >
                {publishing === "linkedin" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publicar Direto no LinkedIn
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
