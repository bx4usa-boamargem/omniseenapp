import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Users, Phone } from "lucide-react";

interface ProfileStepProps {
  phone: string;
  referralSource: string;
  onPhoneChange: (value: string) => void;
  onReferralSourceChange: (value: string) => void;
}

const REFERRAL_OPTIONS = [
  { value: "google", label: "Pesquisa no Google" },
  { value: "indicacao", label: "Indicação de amigo/colega" },
  { value: "redes_sociais", label: "Redes sociais (Instagram, LinkedIn, etc.)" },
  { value: "youtube", label: "YouTube" },
  { value: "podcast", label: "Podcast" },
  { value: "evento", label: "Evento ou conferência" },
  { value: "outro", label: "Outro" },
];

export function ProfileStep({
  phone,
  referralSource,
  onPhoneChange,
  onReferralSourceChange,
}: ProfileStepProps) {
  // Debug: Log component mount and props
  useEffect(() => {
    console.log('[ProfileStep] Component mounted');
    console.log('[ProfileStep] Props received:', { phone, referralSource });
    
    return () => {
      console.log('[ProfileStep] Component unmounted');
    };
  }, []);

  // Debug: Log prop changes
  useEffect(() => {
    console.log('[ProfileStep] Props changed:', { phone, referralSource });
  }, [phone, referralSource]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-display font-bold mb-2">
          Perfil básico
        </h2>
        <p className="text-muted-foreground">
          Informações opcionais para melhorar sua experiência.
        </p>
      </div>

      {/* Telefone - SIMPLIFICADO */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="phone" className="text-base font-medium">
            WhatsApp (opcional)
          </Label>
        </div>
        <div className="max-w-sm">
          <Input
            id="phone"
            type="tel"
            placeholder="(11) 99999-9999"
            value={phone || ""}
            onChange={(e) => {
              console.log('[ProfileStep] Phone input changed:', e.target.value);
              onPhoneChange(e.target.value);
            }}
            className="font-mono"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Para suporte prioritário e novidades exclusivas
        </p>
      </div>

      {/* Como conheceu - SELECT NATIVO (sem Portal - evita crash removeChild) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="referral" className="text-base font-medium">
            Como conheceu o OMNISEEN?
          </Label>
        </div>
        <select
          id="referral"
          value={referralSource || ""}
          onChange={(e) => {
            console.log('[ProfileStep] Referral source changed:', e.target.value);
            onReferralSourceChange(e.target.value);
          }}
          className="flex h-10 w-full max-w-sm items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Selecione uma opção</option>
          {REFERRAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Dica de valor */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">💡 Dica:</span> Seu blog será 
          criado automaticamente na próxima etapa. Você poderá personalizar cores, 
          logo e domínio depois no painel.
        </p>
      </div>
    </div>
  );
}
