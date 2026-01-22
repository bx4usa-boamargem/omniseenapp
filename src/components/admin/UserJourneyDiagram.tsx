import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Brain, 
  FileText, 
  Globe, 
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface JourneyPhase {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "healthy" | "warning" | "critical";
  metric: string;
  value: number | string;
  details: string[];
}

interface UserJourneyDiagramProps {
  phases?: {
    phase: string;
    status: "healthy" | "warning" | "critical";
    metric: string;
    value: number;
  }[];
}

const defaultPhases: JourneyPhase[] = [
  {
    id: "config",
    title: "Configuração",
    description: "Setup inicial do blog",
    icon: <Settings className="h-5 w-5" />,
    status: "healthy",
    metric: "Blogs configurados",
    value: 0,
    details: [
      "Perfil do Negócio",
      "Estratégia & Persona",
      "Territórios",
      "Automação",
    ],
  },
  {
    id: "intel",
    title: "Inteligência",
    description: "Radar de mercado",
    icon: <Brain className="h-5 w-5" />,
    status: "healthy",
    metric: "Oportunidades/semana",
    value: 0,
    details: [
      "Perplexity/Gemini",
      "Análise de Tendências",
      "Gaps de Concorrentes",
      "Score de Relevância",
    ],
  },
  {
    id: "generation",
    title: "Geração",
    description: "Criação automática",
    icon: <FileText className="h-5 w-5" />,
    status: "healthy",
    metric: "Taxa de conversão",
    value: "0%",
    details: [
      "Funnel Autopilot",
      "OmniCore GEO Writer",
      "Quality Gate",
      "Auto-Fix",
    ],
  },
  {
    id: "publish",
    title: "Publicação",
    description: "Deploy automático",
    icon: <Globe className="h-5 w-5" />,
    status: "healthy",
    metric: "Aprovação QG",
    value: "0%",
    details: [
      "Auto-publish",
      "IndexNow",
      "Portal Público",
      "SEO Otimizado",
    ],
  },
  {
    id: "conversion",
    title: "Conversão",
    description: "Captura de leads",
    icon: <TrendingUp className="h-5 w-5" />,
    status: "healthy",
    metric: "Leads capturados",
    value: 0,
    details: [
      "Analytics",
      "Brand Sales Agent",
      "CTA Tracking",
      "ROI Dashboard",
    ],
  },
];

const statusColors = {
  healthy: "bg-success/10 border-success text-success",
  warning: "bg-warning/10 border-warning text-warning",
  critical: "bg-destructive/10 border-destructive text-destructive",
};

const statusIcons = {
  healthy: <CheckCircle2 className="h-4 w-4 text-success" />,
  warning: <AlertCircle className="h-4 w-4 text-warning" />,
  critical: <XCircle className="h-4 w-4 text-destructive" />,
};

export function UserJourneyDiagram({ phases }: UserJourneyDiagramProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  // Merge API data with default phases
  const mergedPhases = defaultPhases.map((phase, index) => {
    const apiPhase = phases?.[index];
    if (apiPhase) {
      return {
        ...phase,
        status: apiPhase.status,
        value: apiPhase.metric.includes("%") ? `${apiPhase.value}%` : apiPhase.value,
      };
    }
    return phase;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Jornada do Usuário - Fluxo Completo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Flow Diagram */}
        <div className="flex flex-col lg:flex-row items-stretch gap-2 lg:gap-0">
          {mergedPhases.map((phase, index) => (
            <div key={phase.id} className="flex flex-col lg:flex-row items-stretch flex-1">
              {/* Phase Card */}
              <div
                className={cn(
                  "relative flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
                  statusColors[phase.status],
                  expandedPhase === phase.id && "ring-2 ring-primary ring-offset-2"
                )}
                onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
              >
                {/* Status Icon */}
                <div className="absolute top-2 right-2">
                  {statusIcons[phase.status]}
                </div>

                {/* Phase Content */}
                <div className="flex flex-col items-center text-center gap-2">
                  <div className={cn(
                    "p-3 rounded-full",
                    phase.status === "healthy" && "bg-success/20",
                    phase.status === "warning" && "bg-warning/20",
                    phase.status === "critical" && "bg-destructive/20"
                  )}>
                    {phase.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{phase.title}</h4>
                    <p className="text-xs text-muted-foreground">{phase.description}</p>
                  </div>
                  
                  {/* Metric Badge */}
                  <Badge variant="secondary" className="text-xs">
                    {phase.metric}: {phase.value}
                  </Badge>
                </div>

                {/* Expanded Details */}
                {expandedPhase === phase.id && (
                  <div className="mt-4 pt-4 border-t border-current/20">
                    <p className="text-xs font-medium mb-2">Componentes:</p>
                    <ul className="text-xs space-y-1">
                      {phase.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <div className="h-1 w-1 rounded-full bg-current" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Arrow Connector */}
              {index < mergedPhases.length - 1 && (
                <div className="hidden lg:flex items-center justify-center px-2">
                  <ChevronRight className="h-6 w-6 text-muted-foreground animate-pulse" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 justify-center">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Saudável</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-warning" />
            <span>Atenção</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>Crítico</span>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Clique em cada fase para ver os componentes envolvidos
        </p>
      </CardContent>
    </Card>
  );
}
