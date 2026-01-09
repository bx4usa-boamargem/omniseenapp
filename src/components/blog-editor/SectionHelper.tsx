import { AlertTriangle } from "lucide-react";

interface SectionHelperProps {
  title: string;
  description: string;
  action?: string;
  warning?: string;
}

export function SectionHelper({ title, description, action, warning }: SectionHelperProps) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      {action && (
        <p className="text-sm text-primary/80 font-medium">{action}</p>
      )}
      {warning && (
        <div className="flex items-start gap-2 p-3 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">{warning}</p>
        </div>
      )}
    </div>
  );
}
