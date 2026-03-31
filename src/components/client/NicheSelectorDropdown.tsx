/**
 * Niche Selector Dropdown with Custom Input
 * 
 * Allows users to pick from predefined niches OR type a custom niche.
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { listNiches } from '@/lib/article-engine/niches';
import { cn } from '@/lib/utils';

interface NicheSelectorDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function NicheSelectorDropdown({
  value,
  onChange,
  disabled = false
}: NicheSelectorDropdownProps) {
  const niches = listNiches();
  const [open, setOpen] = useState(false);
  const [customNiche, setCustomNiche] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Find display name for current value
  const selectedNiche = niches.find(n => n.id === value);
  const displayValue = selectedNiche?.displayName || value || 'Selecione o nicho';

  const handleSelect = (nicheId: string) => {
    onChange(nicheId);
    setOpen(false);
    setShowCustomInput(false);
  };

  const handleAddCustom = () => {
    if (customNiche.trim().length >= 2) {
      onChange(customNiche.trim());
      setCustomNiche('');
      setShowCustomInput(false);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className={cn(!selectedNiche && value ? 'text-foreground' : !value ? 'text-muted-foreground' : '')}>
            {displayValue}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-[300px] overflow-y-auto p-1">
          {niches.map((niche) => (
            <button
              key={niche.id}
              onClick={() => handleSelect(niche.id)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-left",
                value === niche.id && "bg-accent"
              )}
            >
              {value === niche.id && <Check className="h-4 w-4 text-primary shrink-0" />}
              <span className={cn(value !== niche.id && "ml-6")}>
                {niche.displayName}
              </span>
            </button>
          ))}
        </div>
        
        <div className="border-t p-2">
          {showCustomInput ? (
            <div className="flex gap-2">
              <Input
                placeholder="Digite seu nicho..."
                value={customNiche}
                onChange={(e) => setCustomNiche(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                className="h-8 text-sm"
                autoFocus
              />
              <Button
                size="sm"
                className="h-8 px-3"
                onClick={handleAddCustom}
                disabled={customNiche.trim().length < 2}
              >
                OK
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
              Adicionar nicho personalizado
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
