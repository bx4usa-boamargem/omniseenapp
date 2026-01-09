import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, DollarSign, Users, Cpu, ImageIcon, FileText, Loader2, Shield, BarChart3, Settings2, Save, Plus, Trash2, Sparkles, Database, Bell, TrendingUp, Download, Gift, LayoutDashboard, UserPlus, Users2, Stethoscope, Building2, Target, LineChart } from "lucide-react";
import { SectionHelper } from "@/components/blog-editor/SectionHelper";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConsumptionCharts } from "@/components/admin/ConsumptionCharts";
import { ClientsTab } from "@/components/admin/ClientsTab";
import { TenantsTab } from "@/components/admin/TenantsTab";
import { AICostsTab } from "@/components/admin/AICostsTab";
import { CacheStatsTab } from "@/components/admin/CacheStatsTab";
import { CostAlertManager } from "@/components/admin/CostAlertManager";
import { CostAlertBanner } from "@/components/admin/CostAlertBanner";
import { FinancialReportsTab } from "@/components/admin/FinancialReportsTab";
import { GrowthMetricsTab } from "@/components/admin/GrowthMetricsTab";
import { DataExportManager } from "@/components/admin/DataExportManager";
import { ReferralsTab } from "@/components/admin/ReferralsTab";
import { SaaSOverviewTab } from "@/components/admin/SaaSOverviewTab";
import { CustomerAccountsTab } from "@/components/admin/CustomerAccountsTab";
import { InternalStaffTab } from "@/components/admin/InternalStaffTab";
import { SessionDiagnosticsTab } from "@/components/admin/SessionDiagnosticsTab";
import { GoalsManagementTab } from "@/components/admin/GoalsManagementTab";
import { LandingConversionTab } from "@/components/admin/LandingConversionTab";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ModelPricing {
  id: string;
  model_provider: string;
  model_name: string;
  cost_per_1k_input_tokens: number;
  cost_per_1k_output_tokens: number;
  cost_per_image: number;
  is_active: boolean;
}
interface ConsumptionLog {
  id: string;
  user_id: string;
  blog_id: string | null;
  action_type: string;
  action_description: string | null;
  model_used: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  images_generated: number | null;
  estimated_cost_usd: number;
  created_at: string;
  metadata: unknown;
}

interface CustomerSummary {
  user_id: string;
  user_email: string;
  total_cost: number;
  total_articles: number;
  total_images: number;
  total_tokens: number;
}

interface ModelSummary {
  model_name: string;
  total_cost: number;
  total_calls: number;
  total_tokens: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [customerSummaries, setCustomerSummaries] = useState<CustomerSummary[]>([]);
  const [modelSummaries, setModelSummaries] = useState<ModelSummary[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [period, setPeriod] = useState("30");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  // Model Pricing state
  const [modelPricing, setModelPricing] = useState<ModelPricing[]>([]);
  const [editingPricing, setEditingPricing] = useState<Record<string, ModelPricing>>({});
  const [savingPricing, setSavingPricing] = useState<string | null>(null);
  const [newModel, setNewModel] = useState<Partial<ModelPricing>>({
    model_provider: "",
    model_name: "",
    cost_per_1k_input_tokens: 0,
    cost_per_1k_output_tokens: 0,
    cost_per_image: 0,
    is_active: true,
  });
  const [showNewModelForm, setShowNewModelForm] = useState(false);
  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchConsumptionData();
      fetchModelPricing();
    }
  }, [isAdmin, startDate, endDate]);

  const fetchModelPricing = async () => {
    const { data, error } = await supabase
      .from("model_pricing")
      .select("*")
      .order("model_provider", { ascending: true });

    if (error) {
      console.error("Error fetching model pricing:", error);
      return;
    }

    setModelPricing(data || []);
  };

  const startEditingPricing = (pricing: ModelPricing) => {
    setEditingPricing((prev) => ({ ...prev, [pricing.id]: { ...pricing } }));
  };

  const updateEditingPricing = (id: string, field: keyof ModelPricing, value: string | number | boolean) => {
    setEditingPricing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const savePricing = async (id: string) => {
    const pricing = editingPricing[id];
    if (!pricing) return;

    setSavingPricing(id);

    const { error } = await supabase
      .from("model_pricing")
      .update({
        model_provider: pricing.model_provider,
        model_name: pricing.model_name,
        cost_per_1k_input_tokens: pricing.cost_per_1k_input_tokens,
        cost_per_1k_output_tokens: pricing.cost_per_1k_output_tokens,
        cost_per_image: pricing.cost_per_image,
        is_active: pricing.is_active,
      })
      .eq("id", id);

    setSavingPricing(null);

    if (error) {
      toast.error("Erro ao salvar preço");
      console.error("Error saving pricing:", error);
      return;
    }

    toast.success("Preço atualizado");
    setEditingPricing((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    fetchModelPricing();
  };

  const cancelEditingPricing = (id: string) => {
    setEditingPricing((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const toggleModelActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from("model_pricing")
      .update({ is_active })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    fetchModelPricing();
  };

  const addNewModel = async () => {
    if (!newModel.model_provider || !newModel.model_name) {
      toast.error("Preencha o provedor e nome do modelo");
      return;
    }

    const { error } = await supabase.from("model_pricing").insert({
      model_provider: newModel.model_provider,
      model_name: newModel.model_name,
      cost_per_1k_input_tokens: newModel.cost_per_1k_input_tokens || 0,
      cost_per_1k_output_tokens: newModel.cost_per_1k_output_tokens || 0,
      cost_per_image: newModel.cost_per_image || 0,
      is_active: newModel.is_active ?? true,
    });

    if (error) {
      toast.error("Erro ao adicionar modelo");
      console.error("Error adding model:", error);
      return;
    }

    toast.success("Modelo adicionado");
    setNewModel({
      model_provider: "",
      model_name: "",
      cost_per_1k_input_tokens: 0,
      cost_per_1k_output_tokens: 0,
      cost_per_image: 0,
      is_active: true,
    });
    setShowNewModelForm(false);
    fetchModelPricing();
  };

  const deleteModel = async (id: string) => {
    const { error } = await supabase.from("model_pricing").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao remover modelo");
      return;
    }

    toast.success("Modelo removido");
    fetchModelPricing();
  };

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const adminRoles = ['admin', 'platform_admin'];
    const hasAdminRole = roles?.some(r => adminRoles.includes(r.role as string)) ?? false;

    if (!hasAdminRole) {
      navigate("/app/dashboard");
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  const fetchConsumptionData = async () => {
    setLoading(true);

    // Fetch all consumption logs within date range
    const { data: logsData, error: logsError } = await supabase
      .from("consumption_logs")
      .select("*")
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`)
      .order("created_at", { ascending: false });

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      setLoading(false);
      return;
    }

    setLogs(logsData || []);

    // Calculate summaries
    const customerMap = new Map<string, CustomerSummary>();
    const modelMap = new Map<string, ModelSummary>();
    let totalCostSum = 0;
    let totalArticlesSum = 0;
    let totalImagesSum = 0;

    for (const log of logsData || []) {
      totalCostSum += log.estimated_cost_usd || 0;
      totalImagesSum += log.images_generated || 0;
      if (log.action_type === "article_generation") totalArticlesSum++;

      // Customer summary
      const existingCustomer = customerMap.get(log.user_id);
      if (existingCustomer) {
        existingCustomer.total_cost += log.estimated_cost_usd || 0;
        existingCustomer.total_tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
        existingCustomer.total_images += log.images_generated || 0;
        if (log.action_type === "article_generation") existingCustomer.total_articles++;
      } else {
        customerMap.set(log.user_id, {
          user_id: log.user_id,
          user_email: log.user_id.substring(0, 8) + "...",
          total_cost: log.estimated_cost_usd || 0,
          total_articles: log.action_type === "article_generation" ? 1 : 0,
          total_images: log.images_generated || 0,
          total_tokens: (log.input_tokens || 0) + (log.output_tokens || 0),
        });
      }

      // Model summary
      const modelName = log.model_used || "unknown";
      const existingModel = modelMap.get(modelName);
      if (existingModel) {
        existingModel.total_cost += log.estimated_cost_usd || 0;
        existingModel.total_calls++;
        existingModel.total_tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      } else {
        modelMap.set(modelName, {
          model_name: modelName,
          total_cost: log.estimated_cost_usd || 0,
          total_calls: 1,
          total_tokens: (log.input_tokens || 0) + (log.output_tokens || 0),
        });
      }
    }

    setTotalCost(totalCostSum);
    setTotalArticles(totalArticlesSum);
    setTotalImages(totalImagesSum);
    setCustomerSummaries(Array.from(customerMap.values()).sort((a, b) => b.total_cost - a.total_cost));
    setModelSummaries(Array.from(modelMap.values()).sort((a, b) => b.total_cost - a.total_cost));
    setLoading(false);
  };

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    const today = new Date();
    
    switch (value) {
      case "7":
        setStartDate(format(subDays(today, 7), "yyyy-MM-dd"));
        setEndDate(format(today, "yyyy-MM-dd"));
        break;
      case "30":
        setStartDate(format(subDays(today, 30), "yyyy-MM-dd"));
        setEndDate(format(today, "yyyy-MM-dd"));
        break;
      case "month":
        setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
        break;
      case "custom":
        break;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-display font-bold">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground">Gestão de consumo e custos</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Filtros de Período</CardTitle>
            <SectionHelper title="" description="Período para visualização de dados." />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="month">Este mês</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period === "custom" && (
                <>
                  <div className="space-y-2">
                    <Label>Data inicial</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data final</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
              <Button onClick={fetchConsumptionData}>Atualizar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Cost Alert Banner */}
        <CostAlertBanner 
          totalCost={totalCost} 
          startDate={startDate} 
          endDate={endDate} 
        />

        {/* Summary Cards - Resumo de Custos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totalCost)}</div>
              <p className="text-xs text-muted-foreground">No período selecionado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Artigos Gerados</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totalArticles)}</div>
              <p className="text-xs text-muted-foreground">Total de artigos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Imagens Geradas</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totalImages)}</div>
              <p className="text-xs text-muted-foreground">Total de imagens</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerSummaries.length}</div>
              <p className="text-xs text-muted-foreground">Com consumo no período</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={initialTab} className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="tenants" className="gap-2">
              <Building2 className="h-4 w-4" />
              Tenants
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2">
              <Users className="h-4 w-4" />
              Clientes (Legado)
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="growth" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Crescimento
            </TabsTrigger>
            <TabsTrigger value="ai-costs" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Custos IA
            </TabsTrigger>
            <TabsTrigger value="charts" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Gráficos
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </TabsTrigger>
            <TabsTrigger value="cache" className="gap-2">
              <Database className="h-4 w-4" />
              Cache
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Preços
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2">
              <Gift className="h-4 w-4" />
              Indicações
            </TabsTrigger>
            <TabsTrigger value="customer-accounts" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Subcontas
            </TabsTrigger>
            <TabsTrigger value="internal-staff" className="gap-2">
              <Users2 className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Diagnóstico
            </TabsTrigger>
            <TabsTrigger value="goals" className="gap-2">
              <Target className="h-4 w-4" />
              Metas
            </TabsTrigger>
            <TabsTrigger value="landing" className="gap-2">
              <LineChart className="h-4 w-4" />
              Landing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <SaaSOverviewTab />
          </TabsContent>

          <TabsContent value="tenants">
            <TenantsTab />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsTab />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialReportsTab />
          </TabsContent>

          <TabsContent value="growth">
            <GrowthMetricsTab />
          </TabsContent>

          <TabsContent value="export">
            <DataExportManager />
          </TabsContent>

          <TabsContent value="ai-costs">
            <AICostsTab 
              logs={logs.map(log => ({
                ...log,
                input_tokens: log.input_tokens || 0,
                output_tokens: log.output_tokens || 0,
                images_generated: log.images_generated || 0,
                metadata: (log.metadata as Record<string, unknown>) || {},
              }))} 
              startDate={new Date(startDate)}
              endDate={new Date(endDate)}
              modelPricing={modelPricing}
            />
          </TabsContent>

          <TabsContent value="charts">
            <ConsumptionCharts 
              logs={logs} 
              modelSummaries={modelSummaries}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Consumo por Cliente</CardTitle>
                <CardDescription>Ranking de clientes por custo no período</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente (ID)</TableHead>
                      <TableHead className="text-right">Artigos</TableHead>
                      <TableHead className="text-right">Imagens</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhum consumo registrado no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      customerSummaries.map((customer) => (
                        <TableRow key={customer.user_id}>
                          <TableCell className="font-mono text-sm">{customer.user_id.substring(0, 16)}...</TableCell>
                          <TableCell className="text-right">{customer.total_articles}</TableCell>
                          <TableCell className="text-right">{customer.total_images}</TableCell>
                          <TableCell className="text-right">{formatNumber(customer.total_tokens)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(customer.total_cost)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models">
            <Card>
              <CardHeader>
                <CardTitle>Consumo por Modelo de IA</CardTitle>
                <CardDescription>Distribuição de custos por modelo utilizado</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-right">Chamadas</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">% do Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhum consumo registrado no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      modelSummaries.map((model) => (
                        <TableRow key={model.model_name}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{model.model_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(model.total_calls)}</TableCell>
                          <TableCell className="text-right">{formatNumber(model.total_tokens)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(model.total_cost)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {totalCost > 0 ? ((model.total_cost / totalCost) * 100).toFixed(1) : 0}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Histórico Detalhado</CardTitle>
                <CardDescription>Últimas operações registradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Imagens</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhum registro encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.slice(0, 100).map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {log.action_type.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.model_used || "-"}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatNumber((log.input_tokens || 0) + (log.output_tokens || 0))}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {log.images_generated || 0}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatCurrency(log.estimated_cost_usd)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cache">
            <CacheStatsTab />
          </TabsContent>

          <TabsContent value="pricing">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Tabela de Preços de Modelos de IA</CardTitle>
                  <CardDescription>Configure os custos por token e imagem para cada modelo</CardDescription>
                </div>
                <Button onClick={() => setShowNewModelForm(!showNewModelForm)} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Modelo
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {showNewModelForm && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>Provedor</Label>
                          <Input
                            placeholder="ex: openai"
                            value={newModel.model_provider || ""}
                            onChange={(e) => setNewModel({ ...newModel, model_provider: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome do Modelo</Label>
                          <Input
                            placeholder="ex: gpt-4o"
                            value={newModel.model_name || ""}
                            onChange={(e) => setNewModel({ ...newModel, model_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>$/1k Input</Label>
                          <Input
                            type="number"
                            step="0.0001"
                            value={newModel.cost_per_1k_input_tokens || 0}
                            onChange={(e) => setNewModel({ ...newModel, cost_per_1k_input_tokens: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>$/1k Output</Label>
                          <Input
                            type="number"
                            step="0.0001"
                            value={newModel.cost_per_1k_output_tokens || 0}
                            onChange={(e) => setNewModel({ ...newModel, cost_per_1k_output_tokens: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>$/Imagem</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={newModel.cost_per_image || 0}
                            onChange={(e) => setNewModel({ ...newModel, cost_per_image: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={addNewModel} size="sm">
                            <Save className="h-4 w-4 mr-1" />
                            Salvar
                          </Button>
                          <Button onClick={() => setShowNewModelForm(false)} variant="ghost" size="sm">
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-right">$/1k Input Tokens</TableHead>
                      <TableHead className="text-right">$/1k Output Tokens</TableHead>
                      <TableHead className="text-right">$/Imagem</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelPricing.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Nenhum modelo configurado
                        </TableCell>
                      </TableRow>
                    ) : (
                      modelPricing.map((pricing) => {
                        const isEditing = !!editingPricing[pricing.id];
                        const current = isEditing ? editingPricing[pricing.id] : pricing;

                        return (
                          <TableRow key={pricing.id}>
                            <TableCell>
                              <Switch
                                checked={pricing.is_active}
                                onCheckedChange={(checked) => toggleModelActive(pricing.id, checked)}
                              />
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={current.model_provider}
                                  onChange={(e) => updateEditingPricing(pricing.id, "model_provider", e.target.value)}
                                  className="h-8 w-24"
                                />
                              ) : (
                                <Badge variant="outline">{pricing.model_provider}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={current.model_name}
                                  onChange={(e) => updateEditingPricing(pricing.id, "model_name", e.target.value)}
                                  className="h-8"
                                />
                              ) : (
                                <span className="font-medium">{pricing.model_name}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.0001"
                                  value={current.cost_per_1k_input_tokens}
                                  onChange={(e) => updateEditingPricing(pricing.id, "cost_per_1k_input_tokens", parseFloat(e.target.value))}
                                  className="h-8 w-24 ml-auto text-right"
                                />
                              ) : (
                                <span className="font-mono">${pricing.cost_per_1k_input_tokens.toFixed(4)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.0001"
                                  value={current.cost_per_1k_output_tokens}
                                  onChange={(e) => updateEditingPricing(pricing.id, "cost_per_1k_output_tokens", parseFloat(e.target.value))}
                                  className="h-8 w-24 ml-auto text-right"
                                />
                              ) : (
                                <span className="font-mono">${pricing.cost_per_1k_output_tokens.toFixed(4)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={current.cost_per_image}
                                  onChange={(e) => updateEditingPricing(pricing.id, "cost_per_image", parseFloat(e.target.value))}
                                  className="h-8 w-24 ml-auto text-right"
                                />
                              ) : (
                                <span className="font-mono">${pricing.cost_per_image.toFixed(3)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    onClick={() => savePricing(pricing.id)}
                                    disabled={savingPricing === pricing.id}
                                  >
                                    {savingPricing === pricing.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => cancelEditingPricing(pricing.id)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEditingPricing(pricing)}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => deleteModel(pricing.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <CostAlertManager />
          </TabsContent>

          <TabsContent value="referrals">
            <ReferralsTab />
          </TabsContent>

          <TabsContent value="customer-accounts">
            <CustomerAccountsTab />
          </TabsContent>

          <TabsContent value="internal-staff">
            <InternalStaffTab />
          </TabsContent>

          <TabsContent value="diagnostics">
            <SessionDiagnosticsTab />
          </TabsContent>

          <TabsContent value="goals">
            <GoalsManagementTab />
          </TabsContent>

          <TabsContent value="landing">
            <LandingConversionTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
