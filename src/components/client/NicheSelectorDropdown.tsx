/**
 * Niche Selector Dropdown
 * 
 * Dropdown com os 13 nichos suportados pelo Article Engine.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { NICHE_RULESETS, listNiches } from '@/lib/article-engine/niches';
import type { NicheType } from '@/lib/article-engine/types';

interface NicheSelectorDropdownProps {
  value: NicheType;
  onChange: (value: NicheType) => void;
  disabled?: boolean;
}

export function NicheSelectorDropdown({
  value,
  onChange,
  disabled = false
}: NicheSelectorDropdownProps) {
  const niches = listNiches();
  
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as NicheType)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione o nicho" />
      </SelectTrigger>
      <SelectContent>
        {niches.map((niche) => (
          <SelectItem key={niche.id} value={niche.id}>
            {niche.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
