import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Sparkles } from "lucide-react";
import { validateTitle, sanitizeTitle } from "@/utils/titleValidator";

interface TitleInputProps {
  value: string;
  onChange: (value: string) => void;
  onAutoCorrect?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TitleInput({ 
  value, 
  onChange, 
  onAutoCorrect,
  placeholder = "Título do artigo (sem prefixos como 'Artigo:', 'Post:', etc.)",
  disabled = false,
  className = ""
}: TitleInputProps) {
  const [validation, setValidation] = useState(() => validateTitle(value));
  
  useEffect(() => {
    setValidation(validateTitle(value));
  }, [value]);
  
  const handleAutoCorrect = () => {
    const sanitized = sanitizeTitle(value);
    onChange(sanitized);
    onAutoCorrect?.();
  };
  
  const hasPrefix = validation.prefixFound;
  const isTooLong = value.length > 60 && validation.isValid;
  const showError = hasPrefix || (!validation.isValid && value.length > 0);
  
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`${className} ${showError ? 'border-destructive focus-visible:ring-destructive' : ''} ${isTooLong ? 'border-yellow-500' : ''}`}
        />
        {validation.isValid && value.length > 0 && !isTooLong && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
      </div>
      
      {/* Contador de caracteres para SEO */}
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>
          {value.length}/60 caracteres
          {value.length > 60 && <span className="text-yellow-600 ml-1">(muito longo para SEO)</span>}
        </span>
      </div>
      
      {/* Alerta de prefixo proibido com botão de correção */}
      {hasPrefix && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2 ml-2">
            <span className="text-sm flex-1">{validation.error}</span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleAutoCorrect}
              className="shrink-0 gap-1"
            >
              <Sparkles className="h-3 w-3" />
              Corrigir
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Preview da correção */}
      {hasPrefix && validation.sanitized && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border">
          <span className="font-medium">Título corrigido:</span>{" "}
          <span className="text-foreground">{validation.sanitized}</span>
        </div>
      )}
      
      {/* Erro de título muito curto */}
      {!hasPrefix && !validation.isValid && value.length > 0 && (
        <p className="text-xs text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
