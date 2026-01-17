import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, X, UserX, TrendingDown, Clock, ExternalLink } from "lucide-react";
import { differenceInDays } from "date-fns";

interface TenantHealth {
  id: string;
  name: string;
  owner_email: string;
  last_login: string | null;
  articles_count: number;
  last_article_at: string | null;
  total_cost: number;
  total_revenue: number;
  margin: number;
  risk_type: "churn_risk" | "low_margin" | "inactivity";
  risk_value: number;
}

interface HealthAlert {
  alert_type: "churn_risk" | "low_margin" | "inactivity";
  threshold_value: number;
  is_active: boolean;
}

export function HealthAlertBanner() {
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [tenants, setTenants] = useState<TenantHealth[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch active health alerts
    const { data: alertsData } = await supabase
      .from("admin_health_alerts")
      .select("alert_type, threshold_value, is_active")
      .eq("is_active", true);

    setAlerts((alertsData || []) as HealthAlert[]);

    if (!alertsData || alertsData.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch tenants with profiles
    const { data: tenantsData } = await supabase
      .from("tenants")
      .select(`
        id,
        name,
        owner_user_id,
        created_at,
        billing_email
      `)
      .eq("status", "active");

    if (!tenantsData || tenantsData.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch profiles for user info
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, full_name, updated_at");

    // Fetch blogs with article counts
    const { data: blogsData } = await supabase
      .from("blogs")
      .select(`
        id,
        tenant_id,
        articles(id, created_at)
      `);

    // Fetch consumption for cost calculation
    const { data: consumptionData } = await supabase
      .from("consumption_logs")
      .select("blog_id, estimated_cost_usd");

    // Process tenant health
    const tenantsHealth: TenantHealth[] = [];

    for (const tenant of tenantsData) {
      const profile = profilesData?.find(p => p.user_id === tenant.owner_user_id);
      const tenantBlogs = blogsData?.filter(b => b.tenant_id === tenant.id) || [];
      const blogIds = tenantBlogs.map(b => b.id);
      
      // Calculate articles count and last article
      let articlesCount = 0;
      let lastArticleAt: string | null = null;
      
      for (const blog of tenantBlogs) {
        const articles = blog.articles as { id: string; created_at: string }[] || [];
        articlesCount += articles.length;
        for (const article of articles) {
          if (!lastArticleAt || article.created_at > lastArticleAt) {
            lastArticleAt = article.created_at;
          }
        }
      }

      // Calculate costs
      const tenantCosts = consumptionData?.filter(c => blogIds.includes(c.blog_id || "")) || [];
      const totalCost = tenantCosts.reduce((sum, c) => sum + (c.estimated_cost_usd || 0), 0);
      
      // Simple revenue estimate based on plan (placeholder)
      const totalRevenue = 97; // Default Pro plan price
      const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

      // Check for each risk type
      for (const alert of alertsData as HealthAlert[]) {
        let riskValue = 0;
        let isAtRisk = false;

        if (alert.alert_type === "churn_risk" && profile?.updated_at) {
          // Use updated_at as proxy for activity
          riskValue = differenceInDays(new Date(), new Date(profile.updated_at));
          isAtRisk = riskValue >= alert.threshold_value;
        } else if (alert.alert_type === "low_margin") {
          riskValue = Math.round(margin);
          isAtRisk = margin < alert.threshold_value;
        } else if (alert.alert_type === "inactivity") {
          if (lastArticleAt) {
            riskValue = differenceInDays(new Date(), new Date(lastArticleAt));
            isAtRisk = riskValue >= alert.threshold_value;
          } else {
            riskValue = differenceInDays(new Date(), new Date(tenant.created_at));
            isAtRisk = riskValue >= alert.threshold_value;
          }
        }

        if (isAtRisk) {
          tenantsHealth.push({
            id: tenant.id,
            name: tenant.name,
            owner_email: tenant.billing_email || profile?.full_name || "—",
            last_login: profile?.updated_at || null,
            articles_count: articlesCount,
            last_article_at: lastArticleAt,
            total_cost: totalCost,
            total_revenue: totalRevenue,
            margin: margin,
            risk_type: alert.alert_type as "churn_risk" | "low_margin" | "inactivity",
            risk_value: riskValue,
          });
        }
      }
    }

    // Remove duplicates (same tenant with multiple risk types - keep the worst)
    const uniqueTenants = tenantsHealth.reduce((acc, tenant) => {
      const existing = acc.find(t => t.id === tenant.id);
      if (!existing) {
        acc.push(tenant);
      }
      return acc;
    }, [] as TenantHealth[]);

    setTenants(uniqueTenants);
    setLoading(false);
  };

  const visibleTenants = useMemo(() => {
    return tenants.filter(t => !dismissed.includes(t.id));
  }, [tenants, dismissed]);

  const dismissTenant = (id: string) => {
    setDismissed(prev => [...prev, id]);
  };

  const getRiskIcon = (type: string) => {
    switch (type) {
      case "churn_risk":
        return UserX;
      case "low_margin":
        return TrendingDown;
      case "inactivity":
        return Clock;
      default:
        return AlertTriangle;
    }
  };

  const getRiskLabel = (type: string) => {
    switch (type) {
      case "churn_risk":
        return "Risco de Churn";
      case "low_margin":
        return "Margem Baixa";
      case "inactivity":
        return "Inativo";
      default:
        return "Alerta";
    }
  };

  const getRiskDescription = (tenant: TenantHealth) => {
    switch (tenant.risk_type) {
      case "churn_risk":
        return `${tenant.risk_value} dias sem login`;
      case "low_margin":
        return `Margem de ${tenant.risk_value}%`;
      case "inactivity":
        return `${tenant.risk_value} dias sem criar artigos`;
      default:
        return "";
    }
  };

  if (loading || visibleTenants.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                {visibleTenants.length} cliente{visibleTenants.length > 1 ? "s" : ""} em risco detectado{visibleTenants.length > 1 ? "s" : ""}
              </p>
            </div>
            
            <div className="space-y-2">
              {visibleTenants.slice(0, 5).map((tenant) => {
                const RiskIcon = getRiskIcon(tenant.risk_type);
                return (
                  <div
                    key={`${tenant.id}-${tenant.risk_type}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-background/80 border"
                  >
                    <div className="flex items-center gap-3">
                      <RiskIcon className="h-4 w-4 text-amber-600" />
                      <div>
                        <p className="font-medium text-sm">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tenant.owner_email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        {getRiskLabel(tenant.risk_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getRiskDescription(tenant)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => dismissTenant(tenant.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleTenants.length > 5 && (
              <p className="text-xs text-muted-foreground">
                +{visibleTenants.length - 5} outros clientes em risco
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
