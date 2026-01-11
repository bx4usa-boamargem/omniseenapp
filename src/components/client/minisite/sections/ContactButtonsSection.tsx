import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, MessageCircle, Phone, Mail, Instagram, Globe, Link } from "lucide-react";

export interface ContactButton {
  id?: string;
  button_type: 'whatsapp' | 'phone' | 'email' | 'instagram' | 'website' | 'link';
  label: string;
  value: string;
}

interface ContactButtonsSectionProps {
  contactButtons: ContactButton[];
  onContactButtonsChange: (buttons: ContactButton[]) => void;
}

const BUTTON_TYPES = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, placeholder: '11999999999' },
  { value: 'phone', label: 'Telefone', icon: Phone, placeholder: '1133334444' },
  { value: 'email', label: 'Email', icon: Mail, placeholder: 'contato@empresa.com' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, placeholder: '@seuusuario' },
  { value: 'website', label: 'Site', icon: Globe, placeholder: 'https://seusite.com' },
  { value: 'link', label: 'Link', icon: Link, placeholder: 'https://...' },
];

export function ContactButtonsSection({
  contactButtons,
  onContactButtonsChange,
}: ContactButtonsSectionProps) {
  const addButton = () => {
    onContactButtonsChange([
      ...contactButtons,
      { button_type: 'whatsapp', label: '', value: '' }
    ]);
  };

  const removeButton = (index: number) => {
    onContactButtonsChange(contactButtons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: keyof ContactButton, value: string) => {
    const updated = [...contactButtons];
    updated[index] = { ...updated[index], [field]: value };
    onContactButtonsChange(updated);
  };

  const moveButton = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === contactButtons.length - 1)
    ) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...contactButtons];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onContactButtonsChange(updated);
  };

  const getButtonIcon = (type: string) => {
    const buttonType = BUTTON_TYPES.find(t => t.value === type);
    const Icon = buttonType?.icon || Link;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Adicione formas de seus clientes entrarem em contato. Os botões aparecerão no rodapé do site.
      </p>

      {contactButtons.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed rounded-lg text-muted-foreground">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Nenhum botão adicionado</p>
          <p className="text-sm">Clique abaixo para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contactButtons.map((button, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-4 border rounded-lg bg-card"
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveButton(index, 'up')}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveButton(index, 'down')}
                  disabled={index === contactButtons.length - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* Type selector */}
              <div className="w-32">
                <Select
                  value={button.button_type}
                  onValueChange={(value) => updateButton(index, 'button_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTON_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          {getButtonIcon(type.value)}
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Value */}
              <Input
                placeholder={BUTTON_TYPES.find(t => t.value === button.button_type)?.placeholder}
                value={button.value}
                onChange={(e) => updateButton(index, 'value', e.target.value)}
                className="flex-1"
              />

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeButton(index)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        onClick={addButton}
        className="w-full gap-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar botão de contato
      </Button>
    </div>
  );
}
