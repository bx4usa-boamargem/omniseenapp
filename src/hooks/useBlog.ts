import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TeamRole } from "./useTeam";

interface Blog {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  logo_negative_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  onboarding_completed: boolean | null;
  user_id: string;
  custom_domain: string | null;
  domain_verified: boolean | null;
  domain_verification_token: string | null;
  platform_subdomain: string | null;
  cta_type: string | null;
  cta_text: string | null;
  cta_url: string | null;
  banner_title: string | null;
  banner_description: string | null;
  banner_enabled: boolean | null;
  banner_image_url: string | null;
  banner_mobile_image_url: string | null;
  banner_link_url: string | null;
  script_head: string | null;
  script_body: string | null;
  script_footer: string | null;
  tracking_config: Record<string, unknown> | null;
  color_palette: Record<string, string> | null;
  brand_description: string | null;
  footer_text: string | null;
  show_powered_by: boolean | null;
}

interface UseBlogResult {
  blog: Blog | null;
  loading: boolean;
  isOwner: boolean;
  role: TeamRole | null;
  isPlatformAdmin: boolean;
  refetch: () => Promise<void>;
}

const FETCH_TIMEOUT_MS = 8000; // 8 seconds timeout

export function useBlog(): UseBlogResult {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [role, setRole] = useState<TeamRole | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const fetchBlog = async () => {
    console.log('useBlog: Iniciando fetch');
    setLoading(true);
    
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('useBlog: Timeout atingido após', FETCH_TIMEOUT_MS, 'ms');
      setLoading(false);
    }, FETCH_TIMEOUT_MS);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      console.log('useBlog: Usuário autenticado', { 
        userId: user?.id, 
        email: user?.email,
        error: userError ? userError.message : null
      });
      
      if (!user) {
        console.warn('useBlog: Sem usuário autenticado');
        setLoading(false);
        return;
      }

      // 1. Check if user is platform admin
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      console.log('useBlog: Roles do usuário', { 
        roles, 
        error: rolesError ? rolesError.message : null 
      });

      const adminRoles = ['admin', 'platform_admin'];
      const hasAdminRole = roles?.some(r => adminRoles.includes(r.role as string)) ?? false;
      if (hasAdminRole) {
        setIsPlatformAdmin(true);
      }

      // 2. Check if user owns a blog (pick the first one if multiple exist)
      const { data: ownedBlogs, error: blogError } = await supabase
        .from("blogs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const ownedBlog = ownedBlogs?.[0] ?? null;

      console.log('useBlog: Blog próprio', { 
        blogId: ownedBlog?.id, 
        blogName: ownedBlog?.name,
        exists: !!ownedBlog,
        error: blogError ? blogError.message : null
      });

      if (ownedBlog) {
        setBlog(ownedBlog as Blog);
        setIsOwner(true);
        setRole("owner");
        console.log('useBlog: Blog carregado como owner', { blogId: ownedBlog.id });
        setLoading(false);
        return;
      }

      // 3. Check if user is a team member
      const { data: membership, error: memberError } = await supabase
        .from("team_members")
        .select(`
          blog_id,
          role,
          blogs (
            id,
            name,
            slug,
            description,
            logo_url,
            primary_color,
            secondary_color,
            onboarding_completed,
            user_id
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      console.log('useBlog: Membership de equipe', { 
        membership,
        error: memberError ? memberError.message : null
      });

      if (membership && membership.blogs) {
        const blogData = membership.blogs as unknown as Blog;
        setBlog(blogData);
        setRole(membership.role as TeamRole);
        setIsOwner(false);
        console.log('useBlog: Blog carregado como membro', { 
          blogId: blogData.id, 
          role: membership.role 
        });
        setLoading(false);
        return;
      }

      // 4. If platform admin but no blog, get first available blog
      if (hasAdminRole) {
        const { data: anyBlog, error: anyBlogError } = await supabase
          .from("blogs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('useBlog: Blog admin fallback', { 
          blogId: anyBlog?.id,
          error: anyBlogError ? anyBlogError.message : null
        });

        if (anyBlog) {
          setBlog(anyBlog as Blog);
          setRole("owner"); // Admin has owner-level access
          setIsOwner(false);
        }
      }

      console.log('useBlog: Fetch finalizado', { 
        hasBlog: !!ownedBlog || !!membership?.blogs,
        isAdmin: hasAdminRole
      });
    } catch (error) {
      console.error("useBlog: Erro crítico", {
        error,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlog();
  }, []);

  return { blog, loading, isOwner, role, isPlatformAdmin, refetch: fetchBlog };
}
