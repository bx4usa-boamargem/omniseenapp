import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, Globe, BarChart3, Zap, Settings, LogOut, FileText, Plus, Home, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

interface MobileNavProps {
  blogSlug: string;
  onSignOut: () => void;
}

export function MobileNav({ blogSlug, onSignOut }: MobileNavProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleViewBlog = () => {
    window.open(`/blog/${blogSlug}`, '_blank');
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 bg-background">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Menu</SheetTitle>
        </SheetHeader>
        
        <nav className="mt-6 flex flex-col gap-1">
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigate("/dashboard")}
          >
            <Home className="h-4 w-4 mr-3" />
            Dashboard
          </Button>
          
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigate("/quick-access")}
          >
            <LayoutGrid className="h-4 w-4 mr-3" />
            Acesso Fácil
          </Button>

          <Separator className="my-2" />

          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigate("/articles/new")}
          >
            <Plus className="h-4 w-4 mr-3" />
            Novo Artigo
          </Button>
          
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigate("/articles")}
          >
            <FileText className="h-4 w-4 mr-3" />
            Artigos
          </Button>

          <Separator className="my-2" />

          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={handleViewBlog}
          >
            <Globe className="h-4 w-4 mr-3" />
            Ver Blog
          </Button>
          
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigate("/analytics")}
          >
            <BarChart3 className="h-4 w-4 mr-3" />
            Analytics
          </Button>
          
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigate("/pricing")}
          >
            <Zap className="h-4 w-4 mr-3" />
            Planos
          </Button>
          
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigate("/settings")}
          >
            <Settings className="h-4 w-4 mr-3" />
            Configurações
          </Button>

          <Separator className="my-2" />
          
          <Button 
            variant="ghost" 
            className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10" 
            onClick={() => {
              onSignOut();
              setOpen(false);
            }}
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sair
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
