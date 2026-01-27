import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ArticleStatusFilter = "all" | "published" | "draft" | "archived";

interface StatusCounts {
  published: number;
  draft: number;
  archived: number;
  total: number;
}

interface ArticleFiltersProps {
  statusFilter: ArticleStatusFilter;
  onStatusFilterChange: (status: ArticleStatusFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusCounts: StatusCounts;
}

const statusTabs: { value: ArticleStatusFilter; label: string; shortLabel: string }[] = [
  { value: "all", label: "Todos", shortLabel: "Todos" },
  { value: "published", label: "Publicados", shortLabel: "Pub." },
  { value: "draft", label: "Rascunhos", shortLabel: "Rasc." },
  { value: "archived", label: "Arquivados", shortLabel: "Arq." },
];

export function ArticleFilters({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  statusCounts,
}: ArticleFiltersProps) {
  const getCount = (status: ArticleStatusFilter): number => {
    switch (status) {
      case "all": return statusCounts.total;
      case "published": return statusCounts.published;
      case "draft": return statusCounts.draft;
      case "archived": return statusCounts.archived;
      default: return 0;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg overflow-x-auto w-full sm:w-auto">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            variant="ghost"
            size="sm"
            onClick={() => onStatusFilterChange(tab.value)}
            className={cn(
              "rounded-md px-2 sm:px-3 py-1.5 h-auto text-xs sm:text-sm transition-colors gap-1 whitespace-nowrap",
              statusFilter === tab.value
                ? "bg-background shadow-sm font-medium"
                : "hover:bg-background/50"
            )}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
            <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs">
              {getCount(tab.value)}
            </Badge>
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
export function useArticleFilters<T extends { 
  title: string; 
  status: string | null;
}>(articles: T[]) {
  const [statusFilter, setStatusFilter] = useState<ArticleStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredArticles = useMemo(() => {
    let result = articles;

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((article) => {
        if (statusFilter === "draft") {
          return !article.status || article.status === "draft";
        }
        return article.status === statusFilter;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((article) =>
        article.title.toLowerCase().includes(query)
      );
    }

    return result;
  }, [articles, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    return articles.reduce<StatusCounts>(
      (acc, article) => {
        acc.total++;
        const status = article.status;
        if (status === "published") acc.published++;
        else if (status === "archived") acc.archived++;
        else acc.draft++;
        return acc;
      },
      { published: 0, draft: 0, archived: 0, total: 0 }
    );
  }, [articles]);

  return {
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    filteredArticles,
    statusCounts,
  };
}
