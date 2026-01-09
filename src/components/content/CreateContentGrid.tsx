import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Sparkles, 
  Search, 
  Filter, 
  FileText, 
  Youtube, 
  Instagram, 
  Table, 
  FileType,
  MessageCircle,
  Zap,
  BookOpen,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateContentGridProps {
  onSelect: (type: string) => void;
}

interface ContentSource {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  badge?: string;
  wordRange?: string;
}

export function CreateContentGrid({ onSelect }: CreateContentGridProps) {
  const quickSources: ContentSource[] = [
    {
      id: "chat",
      icon: <MessageCircle className="h-6 w-6" />,
      iconBg: "bg-gradient-to-br from-primary/20 to-accent/20 text-primary",
      title: "Chat com IA",
      description: "Converse ou use o microfone 🎤 para criar seu artigo",
      badge: "Recomendado",
      wordRange: "~800 palavras",
    },
    {
      id: "ai-suggestion",
      icon: <Sparkles className="h-6 w-6" />,
      iconBg: "bg-primary/10 text-primary",
      title: "Sugestão da IA",
      description: "Vamos sugerir uma pauta com base nos interesses do seu público",
      wordRange: "800-1500 palavras",
    },
    {
      id: "keywords",
      icon: <Search className="h-6 w-6" />,
      iconBg: "bg-blue-500/10 text-blue-500",
      title: "Palavras-Chave",
      description: "Baseado nos 10 melhores artigos no Google para o tema",
      wordRange: "800-1500 palavras",
    },
    {
      id: "funnel",
      icon: <Filter className="h-6 w-6" />,
      iconBg: "bg-purple-500/10 text-purple-500",
      title: "Funil de Vendas",
      description: "Escolha a persona e o nível de consciência desejado",
      wordRange: "800-1500 palavras",
    },
  ];

  const longFormSources: ContentSource[] = [
    {
      id: "pdf",
      icon: <FileType className="h-6 w-6" />,
      iconBg: "bg-orange-500/10 text-orange-500",
      title: "Arquivo PDF",
      description: "Extraia conteúdos a partir de ebooks, PDFs, etc.",
      wordRange: "1500-3000+ palavras",
    },
    {
      id: "youtube",
      icon: <Youtube className="h-6 w-6" />,
      iconBg: "bg-red-500/10 text-red-500",
      title: "Vídeo do YouTube",
      description: "Cole o link de um vídeo ou shorts do YouTube",
      wordRange: "1500-3000+ palavras",
    },
    {
      id: "article",
      icon: <FileText className="h-6 w-6" />,
      iconBg: "bg-emerald-500/10 text-emerald-500",
      title: "Artigo ou Notícia",
      description: "Cole o texto ou link de uma página com conteúdo",
      wordRange: "1500-3000+ palavras",
    },
    {
      id: "instagram",
      icon: <Instagram className="h-6 w-6" />,
      iconBg: "bg-pink-500/10 text-pink-500",
      title: "Post do Instagram",
      description: "Cole o link de um post, carrossel ou reels",
      wordRange: "800-1500 palavras",
    },
    {
      id: "csv",
      icon: <Table className="h-6 w-6" />,
      iconBg: "bg-cyan-500/10 text-cyan-500",
      title: "Arquivo .csv",
      description: "Importe lista de pautas de uma planilha",
      wordRange: "Variável",
    },
  ];

  const SourceCard = ({ source }: { source: ContentSource }) => (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
      onClick={() => onSelect(source.id)}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className={cn("p-4 rounded-xl", source.iconBg)}>
            {source.icon}
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                {source.title}
              </h3>
              {source.badge && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
                  {source.badge}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {source.description}
            </p>
            {source.wordRange && (
              <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded">
                {source.wordRange}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Tip Banner */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Dica:</strong> Para artigos rápidos, use o <strong>Chat com IA</strong>. 
          Para artigos longos e aprofundados, importe de <strong>PDF, YouTube ou URL</strong>.
        </AlertDescription>
      </Alert>

      {/* Quick Articles Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Artigos Rápidos</h2>
          <Badge variant="outline" className="text-xs">até ~1500 palavras</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickSources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </div>

      {/* Long Form Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Artigos Longos</h2>
          <Badge variant="outline" className="text-xs">1500-3000+ palavras</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {longFormSources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </div>
    </div>
  );
}
