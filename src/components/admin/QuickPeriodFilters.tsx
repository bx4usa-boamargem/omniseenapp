import { Button } from "@/components/ui/button";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

interface QuickPeriodFiltersProps {
  onPeriodChange: (startDate: string, endDate: string, periodLabel: string) => void;
  activePeriod?: string;
}

export function QuickPeriodFilters({ onPeriodChange, activePeriod }: QuickPeriodFiltersProps) {
  const today = new Date();

  const periods = [
    {
      label: "Hoje",
      value: "today",
      icon: Calendar,
      getRange: () => ({
        start: format(today, "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      }),
    },
    {
      label: "Esta Semana",
      value: "week",
      icon: CalendarDays,
      getRange: () => ({
        start: format(startOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"),
        end: format(endOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"),
      }),
    },
    {
      label: "Este Mês",
      value: "month",
      icon: CalendarRange,
      getRange: () => ({
        start: format(startOfMonth(today), "yyyy-MM-dd"),
        end: format(endOfMonth(today), "yyyy-MM-dd"),
      }),
    },
    {
      label: "Este Ano",
      value: "year",
      icon: CalendarRange,
      getRange: () => ({
        start: format(startOfYear(today), "yyyy-MM-dd"),
        end: format(endOfYear(today), "yyyy-MM-dd"),
      }),
    },
    {
      label: "7 dias",
      value: "7d",
      icon: Calendar,
      getRange: () => ({
        start: format(subDays(today, 7), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      }),
    },
    {
      label: "30 dias",
      value: "30d",
      icon: CalendarDays,
      getRange: () => ({
        start: format(subDays(today, 30), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      }),
    },
    {
      label: "90 dias",
      value: "90d",
      icon: CalendarRange,
      getRange: () => ({
        start: format(subDays(today, 90), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      }),
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {periods.map((period) => {
        const Icon = period.icon;
        const isActive = activePeriod === period.value;
        
        return (
          <Button
            key={period.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => {
              const range = period.getRange();
              onPeriodChange(range.start, range.end, period.value);
            }}
            className="gap-1"
          >
            <Icon className="h-3 w-3" />
            {period.label}
          </Button>
        );
      })}
    </div>
  );
}
