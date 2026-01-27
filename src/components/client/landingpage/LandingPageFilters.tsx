import { useState, useMemo, useCallback } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "published" | "draft" | "archived";

interface LandingPageFiltersProps {
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "published", label: "Publicadas" },
  { value: "draft", label: "Rascunho" },
  { value: "archived", label: "Arquivadas" },
];

export function LandingPageFilters({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
}: LandingPageFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            variant="ghost"
            size="sm"
            onClick={() => onStatusFilterChange(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 h-auto text-sm transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-muted/80",
              statusFilter === tab.value && "bg-background text-foreground shadow-sm font-medium hover:bg-background"
            )}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative flex-1 w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );
}

// Hook to manage filter state and filtering logic
export function useLandingPageFilters<T extends { title: string; status: string }>(
  pages: T[]
) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPages = useMemo(() => {
    let result = pages;

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((page) => page.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((page) =>
        page.title.toLowerCase().includes(query)
      );
    }

    return result;
  }, [pages, statusFilter, searchQuery]);

  return {
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    filteredPages,
  };
}

export type { StatusFilter };
