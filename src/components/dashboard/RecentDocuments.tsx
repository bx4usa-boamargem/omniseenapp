import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, LayoutTemplate, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRecentDocuments, RecentDocument } from '@/hooks/useRecentDocuments';
import { cn } from '@/lib/utils';

interface RecentDocumentsProps {
  blogId: string | undefined;
}

export function RecentDocuments({ blogId }: RecentDocumentsProps) {
  const navigate = useNavigate();
  const { documents, loading, error } = useRecentDocuments(blogId, 5);

  const handleDocumentClick = (doc: RecentDocument) => {
    navigate(doc.path);
  };

  const formatWordCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimos Documentos</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimos Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimos Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum documento criado ainda. Comece criando seu primeiro artigo!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Últimos Documentos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleDocumentClick(doc)}
              className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors text-left"
            >
              {/* Icon */}
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  doc.type === 'article' ? 'bg-blue-500/10' : 'bg-purple-500/10'
                )}
              >
                {doc.type === 'article' ? (
                  <FileText className="h-5 w-5 text-blue-500" />
                ) : (
                  <LayoutTemplate className="h-5 w-5 text-purple-500" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground truncate">{doc.title}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 text-xs',
                      doc.type === 'article'
                        ? 'border-blue-500/30 text-blue-600 dark:text-blue-400'
                        : 'border-purple-500/30 text-purple-600 dark:text-purple-400'
                    )}
                  >
                    {doc.typeLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatWordCount(doc.wordCount)} palavras</span>
                  <span>{format(doc.createdAt, "d MMM", { locale: ptBR })}</span>
                </div>
              </div>

              {/* Score */}
              <div className="shrink-0 w-16 text-right">
                <div className="text-sm font-medium text-foreground mb-1">{doc.score}%</div>
                <Progress value={doc.score} className="h-1.5" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
