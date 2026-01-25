import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TenantDomain {
  id: string;
  domain: string;
  domain_type: "subdomain" | "custom";
  status: "active" | "pending" | "error" | "suspended" | null;
  is_primary: boolean | null;
  blog_id: string | null;
  tenant_id: string | null;
  verification_token: string | null;
  verified_at: string | null;
  created_at: string | null;
}

interface UseTenantDomainsOptions {
  blogId?: string;
  tenantId?: string;
  onlyActive?: boolean;
}

export function useTenantDomains(options: UseTenantDomainsOptions = {}) {
  const { blogId, tenantId, onlyActive = false } = options;
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    if (!blogId && !tenantId) {
      setDomains([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("tenant_domains")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (blogId) {
        query = query.eq("blog_id", blogId);
      } else if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      if (onlyActive) {
        query = query.eq("status", "active");
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error("[useTenantDomains] Query error:", queryError);
        setError(queryError.message);
        setDomains([]);
      } else {
        setDomains((data || []) as TenantDomain[]);
      }
    } catch (err) {
      console.error("[useTenantDomains] Error:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [blogId, tenantId, onlyActive]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // Get the primary domain (or first active if no primary)
  const getPrimaryDomain = useCallback((): TenantDomain | undefined => {
    const primary = domains.find((d) => d.is_primary && d.status === "active");
    if (primary) return primary;
    return domains.find((d) => d.status === "active");
  }, [domains]);

  // Get active domains only
  const getActiveDomains = useCallback((): TenantDomain[] => {
    return domains.filter((d) => d.status === "active");
  }, [domains]);

  // Get canonical URL for a given article slug
  const getCanonicalUrl = useCallback(
    (articleSlug: string): string | null => {
      const primary = getPrimaryDomain();
      if (!primary) return null;

      // Ensure proper URL construction
      const domain = primary.domain.replace(/\/$/, "");
      const protocol = domain.includes("localhost") ? "http" : "https";
      return `${protocol}://${domain}/${articleSlug}`;
    },
    [getPrimaryDomain]
  );

  return {
    domains,
    loading,
    error,
    refetch: fetchDomains,
    getPrimaryDomain,
    getActiveDomains,
    getCanonicalUrl,
  };
}
