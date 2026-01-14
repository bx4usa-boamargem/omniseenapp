import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin } from 'lucide-react';

interface AddTerritoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (country: string, state?: string, city?: string) => Promise<boolean>;
}

// Common countries for quick selection
const COMMON_COUNTRIES = [
  { code: 'Brasil', label: '🇧🇷 Brasil' },
  { code: 'Portugal', label: '🇵🇹 Portugal' },
  { code: 'Estados Unidos', label: '🇺🇸 Estados Unidos' },
  { code: 'Argentina', label: '🇦🇷 Argentina' },
  { code: 'México', label: '🇲🇽 México' },
  { code: 'Espanha', label: '🇪🇸 Espanha' },
];

export function AddTerritoryModal({ open, onOpenChange, onAdd }: AddTerritoryModalProps) {
  const [country, setCountry] = useState('Brasil');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!country.trim()) return;

    setSaving(true);
    const success = await onAdd(
      country.trim(),
      state.trim() || undefined,
      city.trim() || undefined
    );
    setSaving(false);

    if (success) {
      // Reset form
      setCountry('Brasil');
      setState('');
      setCity('');
      onOpenChange(false);
    }
  };

  const getScopeLabel = (): string => {
    if (city && state && country) {
      return `🏙️ Cidade: ${city}, ${state}, ${country}`;
    }
    if (state && country) {
      return `📍 Estado: ${state}, ${country}`;
    }
    if (country) {
      return `🌍 País: ${country}`;
    }
    return 'Selecione um território';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Adicionar Território
          </DialogTitle>
          <DialogDescription>
            Defina a área geográfica que deseja cobrir. O nível mais específico define o escopo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="country">País *</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_COUNTRIES.map((c) => (
                <Button
                  key={c.code}
                  type="button"
                  variant={country === c.code ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCountry(c.code)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            <Input
              id="country"
              placeholder="Ou digite outro país..."
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label htmlFor="state">Estado (opcional)</Label>
            <Input
              id="state"
              placeholder="Ex: São Paulo, Minas Gerais"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para cobrir o país inteiro
            </p>
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city">Cidade (opcional)</Label>
            <Input
              id="city"
              placeholder="Ex: São Paulo, Belo Horizonte"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!state}
            />
            {!state && (
              <p className="text-xs text-muted-foreground">
                Preencha o estado primeiro para especificar uma cidade
              </p>
            )}
          </div>

          {/* Scope Preview */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm font-medium text-primary">{getScopeLabel()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              O Radar de Oportunidades vai analisar este território semanalmente
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!country.trim() || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adicionando...
              </>
            ) : (
              'Adicionar Território'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
