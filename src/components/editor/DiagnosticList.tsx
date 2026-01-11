import { AlertCircle, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticIssue } from '@/hooks/usePerformanceOptimizer';

interface DiagnosticListProps {
  issues: DiagnosticIssue[];
  onIssueClick?: (issue: DiagnosticIssue) => void;
}

export function DiagnosticList({ issues, onIssueClick }: DiagnosticListProps) {
  const getSeverityIcon = (severity: DiagnosticIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBg = (severity: DiagnosticIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const getCategoryLabel = (category: DiagnosticIssue['category']) => {
    const labels: Record<DiagnosticIssue['category'], string> = {
      intro: 'Introdução',
      title: 'Título',
      structure: 'Estrutura',
      rhythm: 'Ritmo',
      cta: 'CTA',
      scannability: 'Escaneabilidade'
    };
    return labels[category];
  };

  if (issues.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum problema identificado</p>
      </div>
    );
  }

  // Sort by severity: critical first, then warning, then info
  const sortedIssues = [...issues].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        Diagnóstico ({issues.length} issues)
      </p>
      <div className="space-y-2">
        {sortedIssues.map((issue, index) => (
          <div
            key={issue.id || index}
            className={cn(
              "border rounded-lg p-3 transition-colors",
              getSeverityBg(issue.severity),
              onIssueClick && "cursor-pointer hover:opacity-80"
            )}
            onClick={() => onIssueClick?.(issue)}
          >
            <div className="flex items-start gap-2">
              {getSeverityIcon(issue.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-background/50">
                    {getCategoryLabel(issue.category)}
                  </span>
                  {issue.location && (
                    <span className="text-xs text-muted-foreground">
                      {issue.location}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {issue.message}
                </p>
                {issue.suggestion && (
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 {issue.suggestion}
                  </p>
                )}
              </div>
              {onIssueClick && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
