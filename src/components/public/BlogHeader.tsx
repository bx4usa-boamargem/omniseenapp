import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { getBlogPath } from "@/utils/blogUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, Search, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface BlogHeaderProps {
  blogId?: string;
  blogName: string;
  blogSlug: string;
  logoUrl?: string | null;
  primaryColor?: string;
  customDomain?: string | null;
  domainVerified?: boolean | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaType?: string | null;
  // New props for parity with editor
  showSearch?: boolean;
  headerCtaText?: string | null;
  headerCtaUrl?: string | null;
  // Brand display mode
  brandDisplayMode?: 'text' | 'image';
}

export const BlogHeader = ({ 
  blogId,
  blogName, 
  blogSlug, 
  logoUrl, 
  primaryColor,
  customDomain,
  domainVerified,
  ctaText,
  ctaUrl,
  ctaType,
  showSearch = true,
  headerCtaText,
  headerCtaUrl,
  brandDisplayMode = 'text',
}: BlogHeaderProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const blogPath = getBlogPath({ slug: blogSlug, custom_domain: customDomain, domain_verified: domainVerified });

  useEffect(() => {
    if (blogId) {
      fetchCategories();
    }
  }, [blogId]);

  const fetchCategories = async () => {
    if (!blogId) return;
    
    try {
      const { data, error } = await supabase
        .from("blog_categories")
        .select("id, name, slug")
        .eq("blog_id", blogId)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setCategories(data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  // Use header-specific CTA if available, otherwise fall back to general CTA
  const effectiveCtaText = headerCtaText || ctaText;
  const effectiveCtaUrl = headerCtaUrl || ctaUrl;

  const handleCtaClick = () => {
    if (!effectiveCtaUrl) return;
    
    if (ctaType === "whatsapp") {
      const cleanNumber = effectiveCtaUrl.replace(/\D/g, "");
      window.open(`https://wa.me/${cleanNumber}`, "_blank");
    } else {
      window.open(effectiveCtaUrl, "_blank");
    }
  };

  const getCategoryUrl = (categorySlug: string) => {
    return `${blogPath}?categoria=${categorySlug}`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `${blogPath}?busca=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  // Render brand based on display mode
  const renderHeaderBrand = () => {
    // Mode IMAGE: show logo if available
    if (brandDisplayMode === 'image' && logoUrl) {
      return (
        <img 
          src={logoUrl} 
          alt={blogName} 
          className="h-10 md:h-12 w-auto object-contain"
        />
      );
    }
    
    // Mode TEXT or fallback: show text only
    return (
      <span className="font-heading font-semibold text-lg text-gray-900">
        {blogName}
      </span>
    );
  };

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo and Name */}
        <Link 
          to={blogPath} 
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          {renderHeaderBrand()}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4">
          <Link 
            to={blogPath}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Início
          </Link>

          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Categorias
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px] bg-white border-gray-200">
                {categories.map((category) => (
                  <DropdownMenuItem key={category.id} asChild>
                    <Link to={getCategoryUrl(category.slug)} className="text-gray-700 hover:text-gray-900">
                      {category.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Search field - conditional */}
          {showSearch && (
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-40 pl-9 text-sm bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-300"
              />
            </form>
          )}

          {effectiveCtaText && effectiveCtaUrl && (
            <Button
              size="sm"
              onClick={handleCtaClick}
              style={{ backgroundColor: primaryColor }}
              className={cn(
                "text-white hover:opacity-90",
                !primaryColor && "bg-primary"
              )}
            >
              {effectiveCtaText}
            </Button>
          )}

          <LanguageSwitcher />
        </nav>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center gap-2">
          <LanguageSwitcher />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-900">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-white">
              <nav className="flex flex-col gap-4 mt-8">
                {/* Mobile Search */}
                {showSearch && (
                  <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Buscar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 text-sm bg-white border-gray-200 text-gray-900"
                    />
                  </form>
                )}

                <Link 
                  to={blogPath}
                  className="text-lg font-medium text-gray-900 hover:text-gray-700 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Início
                </Link>

                {categories.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm text-gray-500">Categorias</span>
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        to={getCategoryUrl(category.slug)}
                        className="block pl-4 py-1 text-gray-700 hover:text-gray-900 transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                )}

                {effectiveCtaText && effectiveCtaUrl && (
                  <Button
                    onClick={() => {
                      handleCtaClick();
                      setMobileMenuOpen(false);
                    }}
                    style={{ backgroundColor: primaryColor }}
                    className={cn(
                      "w-full text-white hover:opacity-90 mt-4",
                      !primaryColor && "bg-primary"
                    )}
                  >
                    {effectiveCtaText}
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};