import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  primaryColor?: string;
}

// Generate slug from text
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Extract headings from content
export const extractHeadings = (content: string): TOCItem[] => {
  const lines = content.split("\n");
  const headings: TOCItem[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      const text = trimmed.replace("## ", "");
      headings.push({
        id: slugify(text),
        text,
        level: 2,
      });
    }
  });

  return headings;
};

export const TableOfContents = ({ content, primaryColor }: TableOfContentsProps) => {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Extract headings on mount
  useEffect(() => {
    setHeadings(extractHeadings(content));
  }, [content]);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Scroll spy - detect which section is currently visible
  const handleScroll = useCallback(() => {
    const headingElements = headings.map((h) => document.getElementById(h.id));
    const scrollPosition = window.scrollY + 150;

    for (let i = headingElements.length - 1; i >= 0; i--) {
      const element = headingElements[i];
      if (element && element.offsetTop <= scrollPosition) {
        setActiveId(headings[i].id);
        return;
      }
    }

    if (headings.length > 0) {
      setActiveId(headings[0].id);
    }
  }, [headings]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Smooth scroll to heading
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
      setIsExpanded(false);
    }
  };

  if (headings.length === 0) return null;

  // Mobile: Collapsible dropdown
  if (isMobile) {
    return (
      <div className="mb-8 border border-border/50 rounded-xl bg-card overflow-hidden">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between px-4 py-3 h-auto font-medium"
        >
          <span className="flex items-center gap-2">
            <List className="h-4 w-4" style={{ color: primaryColor }} />
            Neste artigo ({headings.length} seções)
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {isExpanded && (
          <div className="border-t border-border/50 p-2">
            <nav className="space-y-1">
              {headings.map((heading, index) => (
                <button
                  key={heading.id}
                  onClick={() => scrollToHeading(heading.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                    activeId === heading.id
                      ? "bg-primary/10 font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  style={{
                    color: activeId === heading.id ? primaryColor : undefined,
                  }}
                >
                  <span className="text-xs text-muted-foreground min-w-[3rem]">
                    {index + 1} de {headings.length}
                  </span>
                  {heading.text}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <div className="hidden lg:block fixed top-32 right-8 w-64 max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="border border-border/50 rounded-xl bg-card/50 backdrop-blur-sm p-4">
        <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <List className="h-4 w-4" style={{ color: primaryColor }} />
          Neste artigo
        </h4>
        <nav className="space-y-1">
          {headings.map((heading, index) => (
            <button
              key={heading.id}
              onClick={() => scrollToHeading(heading.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2",
                activeId === heading.id
                  ? "bg-primary/10 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={{
                color: activeId === heading.id ? primaryColor : undefined,
              }}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  activeId === heading.id ? "bg-primary scale-125" : "bg-muted-foreground/30"
                )}
                style={{
                  backgroundColor: activeId === heading.id ? primaryColor : undefined,
                }}
              />
              <span className="line-clamp-2">{heading.text}</span>
            </button>
          ))}
        </nav>

        {/* Progress indicator */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-2">
            {headings.findIndex((h) => h.id === activeId) + 1} de {headings.length}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${((headings.findIndex((h) => h.id === activeId) + 1) / headings.length) * 100}%`,
                backgroundColor: primaryColor || "hsl(var(--primary))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
