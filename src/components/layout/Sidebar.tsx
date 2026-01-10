import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home,
  FileText,
  Target,
  BarChart3,
  Zap,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Globe,
  LogOut,
  BookOpen,
  HelpCircle,
  Shield,
  Users,
  Palette,
  Gift,
  LayoutGrid,
  Megaphone,
  Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { UserProfileCard } from "./UserProfileCard";
import { TeamRole } from "@/hooks/useTeam";
import { OmniseenLogo } from "@/components/ui/OmniseenLogo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

interface SidebarProps {
  blogSlug?: string;
  onSignOut?: () => void;
  userRole?: TeamRole | null;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
  external?: boolean;
}

export function Sidebar({ blogSlug, onSignOut, userRole }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const { hasPermission } = useCurrentUserRole();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const effectiveRole = userRole || null;

  useEffect(() => {
    checkPlatformAdmin();
  }, []);

  const checkPlatformAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const adminRoles = ['admin', 'platform_admin'];
    const hasAdminRole = roles?.some(r => adminRoles.includes(r.role as string)) ?? false;
    setIsPlatformAdmin(hasAdminRole);
  };

  // Build nav items based on permissions - using /app/* paths
  const navItems: NavItem[] = [
    { icon: Home, label: t('sidebar.home'), path: "/app/dashboard" },
    { icon: FileText, label: t('sidebar.content'), path: "/app/articles" },
    { icon: BookOpen, label: t('sidebar.ebooks'), path: "/app/ebooks", badge: t('sidebar.new') },
    ...(hasPermission("blog.settings") ? [{ icon: Target, label: t('sidebar.strategy'), path: "/app/strategy" }] : []),
    { icon: BarChart3, label: t('sidebar.seoAnalysis'), path: "/app/performance" },
    ...(hasPermission("blog.settings") ? [{ icon: Zap, label: t('sidebar.automations'), path: "/app/automation" }] : []),
    { icon: Gift, label: t('sidebar.referrals'), path: "/app/referrals" },
    ...(isPlatformAdmin ? [{ icon: Megaphone, label: t('sidebar.landingPage'), path: "/app/landing" }] : []),
  ];

  const bottomNavItems: NavItem[] = [
    { icon: Plug, label: t('sidebar.integrations'), path: "/app/integrations" },
    { icon: HelpCircle, label: t('sidebar.help'), path: "/help" },
    { icon: Palette, label: t('sidebar.blogEditor'), path: "/app/my-blog" },
    ...(blogSlug ? [{ icon: Globe, label: t('sidebar.viewBlog'), path: `/blog/${blogSlug}`, external: true }] : []),
    ...(hasPermission("team.manage") ? [{ icon: Users, label: t('sidebar.account'), path: "/app/account" }] : []),
    ...(hasPermission("blog.settings") ? [{ icon: Settings, label: t('sidebar.settings'), path: "/app/settings" }] : []),
    ...(isPlatformAdmin ? [{ icon: Shield, label: t('sidebar.adminPanel'), path: "/admin" }] : []),
    { icon: LayoutGrid, label: t('sidebar.quickAccess'), path: "/app/quick-access" },
  ];

  const isActive = (path: string) => {
    // Handle query params for SEO tab
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

  const handleNavigation = (item: NavItem) => {
    if (item.external) {
      window.open(item.path, "_blank");
    } else {
      navigate(item.path);
    }
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const button = (
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all",
          isActive(item.path) && "bg-sidebar-accent text-sidebar-foreground font-medium",
          collapsed && "justify-center px-2"
        )}
        onClick={() => handleNavigation(item)}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white/90 text-gray-900 font-semibold">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </Button>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {item.badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {item.badge}
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 sticky top-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header - FIXED */}
      <div className="shrink-0 p-4 border-b border-sidebar-border">
        <div className={cn("flex items-center justify-center", collapsed && "justify-center")}>
          <OmniseenLogo size={collapsed ? "sm" : "md"} />
        </div>
      </div>

      {/* Single Scrollable Container */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {/* User Profile */}
        <UserProfileCard collapsed={collapsed} role={effectiveRole} />

        {/* Create Button */}
        <div className="p-4">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button className="w-full gradient-primary" size="icon" onClick={() => navigate("/app/articles/new")}>
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.createContent')}</TooltipContent>
            </Tooltip>
          ) : (
            <Button className="w-full gradient-primary gap-2" onClick={() => navigate("/app/articles/new")}>
              <Plus className="h-5 w-5" />
              {t('sidebar.createContent')}
            </Button>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="px-3 space-y-1 pb-4">
          {navItems.map((item) => (
            <NavButton key={item.path} item={item} />
          ))}
        </nav>

        {/* Bottom Navigation */}
        <div className="px-3 pb-4 space-y-1 border-t border-sidebar-border pt-4">
          {bottomNavItems.map((item) => (
            <NavButton key={item.path} item={item} />
          ))}
          {onSignOut && (
            collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-center px-2 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                    onClick={onSignOut}
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('sidebar.signOut')}</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all font-medium"
                onClick={onSignOut}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>{t('sidebar.signOut')}</span>
              </Button>
            )
          )}
        </div>

        {/* Language Switcher */}
        <div className="px-3 py-2 border-t border-sidebar-border">
          <LanguageSwitcher 
            showName={!collapsed} 
            variant="ghost" 
            size="sm" 
            className="text-sidebar-foreground w-full justify-start"
          />
        </div>
      </div>

      {/* Collapse Toggle - FIXED at bottom */}
      <div className="shrink-0 p-3 border-t border-sidebar-border bg-sidebar">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-sidebar-foreground/50 hover:text-sidebar-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
