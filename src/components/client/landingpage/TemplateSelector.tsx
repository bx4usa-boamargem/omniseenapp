import { Building2, Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type LandingPageTemplate = 
  | 'service_authority_v1' 
  | 'institutional_v1' 
  | 'specialist_authority_v1';

interface TemplateSelectorProps {
  value: LandingPageTemplate;
  onChange: (template: LandingPageTemplate) => void;
  disabled?: boolean;
}

const TEMPLATE_OPTIONS: Array<{
  id: LandingPageTemplate;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    id: 'service_authority_v1',
    name: 'Serviços Locais',
    description: 'Para prestadores de serviço, profissionais autônomos e empresas locais',
    icon: Briefcase,
    color: '#2563eb', // blue
  },
  {
    id: 'institutional_v1',
    name: 'Institucional',
    description: 'Para escritórios, empresas B2B, consultórias e corporações',
    icon: Building2,
    color: '#475569', // slate
  },
  {
    id: 'specialist_authority_v1',
    name: 'Autoridade Pessoal',
    description: 'Para coaches, mentores, especialistas e profissionais liberais',
    icon: User,
    color: '#d97706', // amber
  },
];

export function TemplateSelector({ value, onChange, disabled }: TemplateSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-900">
        Tipo de Página
      </label>
      <div className="grid gap-3">
        {TEMPLATE_OPTIONS.map((template) => {
          const Icon = template.icon;
          const isSelected = value === template.id;
          
          return (
            <button
              key={template.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(template.id)}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-left transition-all",
                "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2",
                isSelected 
                  ? "border-primary bg-primary/5 shadow-sm" 
                  : "border-slate-200 bg-white hover:border-slate-300",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              style={isSelected ? { borderColor: template.color, backgroundColor: `${template.color}08` } : undefined}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ 
                    backgroundColor: isSelected ? `${template.color}20` : '#f1f5f9',
                    color: isSelected ? template.color : '#64748b'
                  }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                      "font-semibold transition-colors",
                      isSelected ? "text-slate-900" : "text-slate-700"
                    )}>
                      {template.name}
                    </h4>
                    {isSelected && (
                      <span 
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: template.color, color: 'white' }}
                      >
                        Selecionado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                    {template.description}
                  </p>
                </div>

                {/* Radio indicator */}
                <div 
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    isSelected ? "border-current" : "border-slate-300"
                  )}
                  style={isSelected ? { borderColor: template.color } : undefined}
                >
                  {isSelected && (
                    <div 
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: template.color }}
                    />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
