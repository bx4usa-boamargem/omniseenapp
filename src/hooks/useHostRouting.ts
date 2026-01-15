import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type RoutingMode = 'landing' | 'platform' | 'blog';

interface UseHostRoutingResult {
  mode: RoutingMode;
  loading: boolean;
  blogId: string | null;
  blogSlug: string | null;
}

/**
 * Hook that determines if the current hostname should serve:
 * - 'landing': Public marketing site (omniseen.app, www.omniseen.app, blogs.omniseen.app)
 * - 'platform': Authenticated app (app.omniseen.app or localhost)
 * - 'blog': Platform subdomain blogs ({slug}.omniseen.app) or verified custom domain blogs
 */
export function useHostRouting(): UseHostRoutingResult {
  const [mode, setMode] = useState<RoutingMode>('platform');
  const [loading, setLoading] = useState(true);
  const [blogId, setBlogId] = useState<string | null>(null);
  const [blogSlug, setBlogSlug] = useState<string | null>(null);

  // Safety timeout - if loading takes more than 5 seconds, fallback to platform mode
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[useHostRouting] Timeout after 5s - fallback to platform mode');
        setMode('platform');
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    const checkHostname = async () => {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      
      console.log('[useHostRouting] Checking hostname:', hostname);
      
      // 1. Development hosts → platform mode
      const devHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
      if (devHosts.some(h => hostname.includes(h))) {
        console.log('[useHostRouting] Development host detected -> platform mode');
        setMode('platform');
        setLoading(false);
        return;
      }
      
      // 2. Lovable preview → platform mode
      if (hostname.includes('lovable.app') || hostname.includes('lovableproject.com')) {
        console.log('[useHostRouting] Lovable preview detected -> platform mode');
        setMode('platform');
        setLoading(false);
        return;
      }
      
      // 3. Root domain (omniseen.app, www.omniseen.app) → landing mode
      if (hostname === 'omniseen.app' || hostname === 'www.omniseen.app') {
        console.log('[useHostRouting] Root domain detected -> landing mode');
        setMode('landing');
        setLoading(false);
        return;
      }
      
      // 4. App subdomain (app.omniseen.app) → platform mode
      if (hostname === 'app.omniseen.app') {
        console.log('[useHostRouting] App subdomain detected -> platform mode');
        setMode('platform');
        setLoading(false);
        return;
      }
      
      // 5. Blogs host (blogs.omniseen.app) → landing mode (technical redirect)
      if (hostname === 'blogs.omniseen.app') {
        console.log('[useHostRouting] Blogs host detected -> landing mode (redirect)');
        setMode('landing');
        setLoading(false);
        return;
      }
      
      // 6. Platform subdomain ({slug}.omniseen.app) → blog mode
      const platformSubdomainMatch = hostname.match(/^([a-z0-9-]+)\.omniseen\.app$/i);
      if (platformSubdomainMatch) {
        const slug = platformSubdomainMatch[1];
        console.log('[useHostRouting] Platform subdomain detected:', slug);
        
        // Buscar blog onde platform_subdomain = slug OU slug = slug
        try {
          const { data, error } = await supabase
            .from('blogs')
            .select('id, slug')
            .or(`slug.eq.${slug},platform_subdomain.eq.${slug}`)
            .maybeSingle();
          
          if (error) {
            console.error('[useHostRouting] Error checking blog:', error);
            setMode('blog');
            setBlogId(null);
            setBlogSlug(null);
          } else if (data) {
            console.log('[useHostRouting] Blog found for subdomain:', data.id);
            setMode('blog');
            setBlogId(data.id);
            setBlogSlug(data.slug);
          } else {
            console.log('[useHostRouting] No blog found for subdomain:', slug);
            setMode('blog');
            setBlogId(null);
            setBlogSlug(null);
          }
        } catch (err) {
          console.error('[useHostRouting] Error in subdomain check:', err);
          setMode('blog');
          setBlogId(null);
          setBlogSlug(null);
        }
        
        setLoading(false);
        return;
      }
      
      // 7. Custom domain → blog mode (if verified)
      try {
        console.log('[useHostRouting] Checking custom domain:', hostname);
        const { data, error } = await supabase
          .from('blogs')
          .select('id, slug')
          .eq('custom_domain', hostname)
          .eq('domain_verified', true)
          .maybeSingle();
        
        if (error) {
          console.error('[useHostRouting] Error checking blog domain:', error);
          setMode('landing');
        } else if (data) {
          console.log('[useHostRouting] Custom domain blog found:', data.id);
          setMode('blog');
          setBlogId(data.id);
          setBlogSlug(data.slug);
        } else {
          console.log('[useHostRouting] Unknown domain, fallback to landing');
          setMode('landing');
        }
      } catch (err) {
        console.error('[useHostRouting] Error in hostname routing check:', err);
        setMode('landing');
      }
      
      setLoading(false);
    };
    
    checkHostname();
  }, []);
  
  return { mode, loading, blogId, blogSlug };
}
