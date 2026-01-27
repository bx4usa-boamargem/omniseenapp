import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ToolCardProps {
  icon: React.ElementType;
  name: string;
  description: string;
  tag?: { emoji: string; text: string };
  onClick: () => void;
  disabled?: boolean;
}

export function ToolCard({ icon: Icon, name, description, tag, onClick, disabled }: ToolCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative w-full text-left p-6 rounded-xl border transition-all duration-200',
        'bg-card hover:bg-accent/50',
        'border-border hover:border-primary/40',
        'hover:shadow-lg hover:shadow-primary/5',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      {/* Tag no canto superior direito */}
      {tag && (
        <Badge
          variant="secondary"
          className="absolute top-4 right-4 bg-primary/10 text-primary border-0 text-xs font-medium"
        >
          {tag.emoji} {tag.text}
        </Badge>
      )}

      {/* Ícone */}
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-6 w-6 text-primary" />
      </div>

      {/* Nome */}
      <h3 className="text-base font-semibold text-foreground mb-2 pr-16">{name}</h3>

      {/* Descrição */}
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </button>
  );
}
