import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved';
}

export function SaveIndicator({ status }: SaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
        status === 'saving' && "bg-muted text-muted-foreground",
        status === 'saved' && "bg-green-500/10 text-green-600 dark:text-green-400"
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Salvando...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>Salvo</span>
        </>
      )}
    </div>
  );
}
