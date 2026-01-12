import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ExternalLink, Flame } from 'lucide-react';

interface TrendCardProps {
  topic: string;
  why_trending: string;
  growth_signal: string;
  sources: string[];
}

export function TrendCard({ topic, why_trending, growth_signal, sources }: TrendCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <Flame className="h-4 w-4 text-orange-600" />
            </div>
            <h4 className="font-semibold text-sm">{topic}</h4>
          </div>
          {growth_signal && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
              <TrendingUp className="h-3 w-3 mr-1" />
              {growth_signal}
            </Badge>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
          {why_trending}
        </p>
        
        {sources && sources.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Fontes:</span>
            <div className="flex gap-1">
              {sources.slice(0, 3).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title={url}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                </a>
              ))}
              {sources.length > 3 && (
                <span className="text-xs text-muted-foreground">+{sources.length - 3}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
