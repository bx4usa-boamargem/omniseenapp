import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, MessageCircle, Phone, Mail, Instagram, Globe, Link, Check, AlertCircle, ExternalLink } from "lucide-react";
import { sanitizeContactValue, getContactDisplayLabel, getContactPlaceholder, validateContactValue, getContactLinkPreview, getContactHref } from "@/lib/contactLinks";
import { cn } from "@/lib/utils";

export interface ContactButton {
  id?: string;
  button_type: 'whatsapp' | 'phone' | 'email' | 'instagram' | 'website' | 'link';
  label: string;
  value: string;
  whatsapp_message?: string;
  email_subject?: string;
}

interface ContactButtonsSectionProps {
  contactButtons: ContactButton[];
  onContactButtonsChange: (buttons: ContactButton[]) => void;
}

const BUTTON_TYPES = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'phone', label: 'Telefone', icon: Phone },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'website', label: 'Site', icon: Globe },
  { value: 'link', label: 'Link', icon: Link },
];

/**
 * Educational instructions for each button type.
 * Helps users understand exactly what to type without technical jargon.
 */
const getFieldInstructions = (type: string) => {
  const instructions: Record<string, { icon: string; text: string; example: string }> = {
    whatsapp: {
      icon: '📱',
      text: 'Digite apenas o número completo com DDI e DDD.',
      example: '5511999999999'
    },
    phone: {
      icon: '☎️',
      text: 'Digite apenas números.',
      example: '5511999999999'
    },
    email: {
      icon: '📧',
      text: 'Digite o e-mail completo.',
      example: 'contato@empresa.com'
    },
    instagram: {
      icon: '📸',
      text: 'Digite apenas o nome do perfil, sem "@".',
      example: 'minhaempresa'
    },
    website: {
      icon: '🌐',
      text: 'Digite o domínio do site.',
      example: 'minhaempresa.com'
    },
    link: {
      icon: '🔗',
      text: 'Digite o domínio ou URL.',
      example: 'meusite.com'
    }
  };
  return instructions[type] || instructions.link;
};

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
    let finalValue = value;
    
    // Sanitize only the 'value' field based on button type
    if (field === 'value') {
      finalValue = sanitizeContactValue(updated[index].button_type, value);
    }
    
    updated[index] = { ...updated[index], [field]: finalValue };
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
      <p className="text-sm text-gray-500">
        Adicione formas de seus clientes entrarem em contato. Os botões aparecerão no rodapé do site.
      </p>

      {contactButtons.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium text-gray-700">Nenhum botão adicionado</p>
          <p className="text-sm text-gray-500">Clique abaixo para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contactButtons.map((button, index) => {
            const validation = validateContactValue(button.button_type, button.value);
            const instructions = getFieldInstructions(button.button_type);
            const hasValue = button.value && button.value.trim().length > 0;

            return (
              <div
                key={index}
                className="p-4 border border-gray-200 rounded-lg bg-white space-y-3"
              >
                {/* Header Row: Reorder + Type + Delete */}
                <div className="flex items-center gap-2">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveButton(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveButton(index, 'down')}
                      disabled={index === contactButtons.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Type selector */}
                  <div className="flex-1">
                    <Select
                      value={button.button_type}
                      onValueChange={(value) => updateButton(index, 'button_type', value)}
                    >
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900">
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

                {/* Educational Hint */}
                <div className="text-xs space-y-0.5">
                  <p className="text-gray-600">
                    <span className="mr-1">{instructions.icon}</span>
                    {instructions.text}
                  </p>
                  <p className="text-gray-400">
                    Exemplo: <code className="bg-gray-100 px-1 rounded text-gray-600">{instructions.example}</code>
                  </p>
                </div>

                {/* Value Input with conditional border */}
                <Input
                  placeholder={getContactPlaceholder(button.button_type)}
                  value={button.value}
                  onChange={(e) => updateButton(index, 'value', e.target.value)}
                  className={cn(
                    "bg-white text-gray-900 placeholder:text-gray-400",
                    hasValue && !validation.isValid 
                      ? "border-red-400 focus:ring-red-400 focus:border-red-400" 
                      : "border-gray-200"
                  )}
                />

                {/* Error Message (only if has value and invalid) */}
                {hasValue && !validation.isValid && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    <span>{validation.error}</span>
                  </div>
                )}

                {/* Conditional: WhatsApp Message */}
                {button.button_type === 'whatsapp' && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400">
                      Mensagem que aparece automaticamente ao abrir o chat (opcional)
                    </p>
                    <Input
                      placeholder="Ex: Olá! Vim pelo seu site e gostaria de falar com você."
                      value={button.whatsapp_message || ''}
                      onChange={(e) => updateButton(index, 'whatsapp_message', e.target.value)}
                      className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                )}

                {/* Conditional: Email Subject */}
                {button.button_type === 'email' && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400">
                      Assunto que aparece automaticamente no email (opcional)
                    </p>
                    <Input
                      placeholder="Ex: Solicitação de orçamento"
                      value={button.email_subject || ''}
                      onChange={(e) => updateButton(index, 'email_subject', e.target.value)}
                      className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                )}

                {/* Link Preview (Admin-only, only if valid) */}
                {hasValue && validation.isValid && (
                  <div className="text-xs space-y-2">
                    {/* Link Preview Row */}
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-2 rounded">
                      <div className="flex items-center gap-2 text-blue-700">
                        <ExternalLink className="h-3 w-3" />
                        <code className="text-blue-600">{getContactLinkPreview(button)}</code>
                      </div>
                      <a 
                        href={getContactHref(button)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Testar ↗
                      </a>
                    </div>
                    
                    {/* WhatsApp-specific warning */}
                    {button.button_type === 'whatsapp' && (
                      <p className="text-gray-400 flex items-center gap-1">
                        <span>💡</span>
                        <span>Teste funciona melhor no celular ou em uma nova aba do navegador.</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Success Preview: shows how button will appear publicly */}
                {hasValue && validation.isValid && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded">
                    <Check className="h-4 w-4" />
                    <span>Botão pronto: <strong>{button.label || getContactDisplayLabel(button.button_type)}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button
        variant="outline"
        onClick={addButton}
        className="w-full gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
      >
        <Plus className="h-4 w-4" />
        Adicionar botão de contato
      </Button>
    </div>
  );
}
