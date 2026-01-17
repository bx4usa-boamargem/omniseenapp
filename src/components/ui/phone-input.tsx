import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Country {
  code: string;
  name: string;
  ddi: string;
  flag: string;
  placeholder: string;
}

const COUNTRIES: Country[] = [
  { code: "BR", name: "Brasil", ddi: "55", flag: "🇧🇷", placeholder: "11 99999-9999" },
  { code: "US", name: "Estados Unidos", ddi: "1", flag: "🇺🇸", placeholder: "212 555-1234" },
  { code: "PT", name: "Portugal", ddi: "351", flag: "🇵🇹", placeholder: "912 345 678" },
  { code: "MX", name: "México", ddi: "52", flag: "🇲🇽", placeholder: "55 1234 5678" },
  { code: "AR", name: "Argentina", ddi: "54", flag: "🇦🇷", placeholder: "11 1234-5678" },
  { code: "ES", name: "Espanha", ddi: "34", flag: "🇪🇸", placeholder: "612 345 678" },
  { code: "GB", name: "Reino Unido", ddi: "44", flag: "🇬🇧", placeholder: "7911 123456" },
  { code: "CA", name: "Canadá", ddi: "1", flag: "🇨🇦", placeholder: "416 555-1234" },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
}

// Detect country from existing phone number
function detectCountryFromNumber(number: string): string {
  const cleanNumber = number.replace(/\D/g, "");
  
  if (!cleanNumber) return "BR"; // Default to Brazil
  
  // Check for specific DDI patterns (longer DDIs first)
  if (cleanNumber.startsWith("351")) return "PT";
  if (cleanNumber.startsWith("54")) return "AR";
  if (cleanNumber.startsWith("52")) return "MX";
  if (cleanNumber.startsWith("55")) return "BR";
  if (cleanNumber.startsWith("44")) return "GB";
  if (cleanNumber.startsWith("34")) return "ES";
  // US and Canada both use 1, default to US for display
  if (cleanNumber.startsWith("1")) return "US";
  
  return "BR"; // Default
}

// Extract local number without DDI
function extractLocalNumber(fullNumber: string, ddi: string): string {
  const cleanNumber = fullNumber.replace(/\D/g, "");
  if (cleanNumber.startsWith(ddi)) {
    return cleanNumber.slice(ddi.length);
  }
  return cleanNumber;
}

// Format local number for display (Brazil example)
function formatLocalNumber(number: string, countryCode: string): string {
  const digits = number.replace(/\D/g, "");
  
  if (countryCode === "BR") {
    // Brazilian format: (XX) XXXXX-XXXX
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  
  // Generic formatting for other countries - just add spaces
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
}

export function PhoneInput({
  value,
  onChange,
  className,
  disabled,
  id,
}: PhoneInputProps) {
  // Detect initial country from value
  const [countryCode, setCountryCode] = React.useState(() => 
    detectCountryFromNumber(value)
  );
  
  const country = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];
  
  // Local number without DDI
  const localNumber = React.useMemo(() => {
    return extractLocalNumber(value, country.ddi);
  }, [value, country.ddi]);

  // Handle country change
  const handleCountryChange = (newCountryCode: string) => {
    setCountryCode(newCountryCode);
    const newCountry = COUNTRIES.find(c => c.code === newCountryCode);
    if (newCountry && localNumber) {
      // Reconstruct full number with new DDI
      onChange(newCountry.ddi + localNumber.replace(/\D/g, ""));
    }
  };

  // Handle local number change
  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const digitsOnly = inputValue.replace(/\D/g, "");
    
    // Limit to reasonable phone number length
    const limited = digitsOnly.slice(0, 15);
    
    // Persist as DDI + digits only
    if (limited) {
      onChange(country.ddi + limited);
    } else {
      onChange("");
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {/* Country Selector */}
      <Select value={countryCode} onValueChange={handleCountryChange} disabled={disabled}>
        <SelectTrigger className="w-[110px] shrink-0">
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className="text-lg">{country.flag}</span>
              <span className="text-sm font-mono">+{country.ddi}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="flex items-center gap-2">
                <span className="text-lg">{c.flag}</span>
                <span className="font-mono text-sm">+{c.ddi}</span>
                <span className="text-muted-foreground text-sm">{c.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Phone Number Input */}
      <Input
        id={id}
        type="tel"
        placeholder={country.placeholder}
        value={formatLocalNumber(localNumber, countryCode)}
        onChange={handleLocalNumberChange}
        disabled={disabled}
        className="flex-1 font-mono"
      />
    </div>
  );
}
