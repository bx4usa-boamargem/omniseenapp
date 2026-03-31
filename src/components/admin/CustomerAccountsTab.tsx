import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Search, Copy, Eye, RefreshCw, Loader2, Users, Building2, TestTube2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CustomerAccount {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  is_internal_account: boolean;
  internal_notes: string | null;
  created_at: string;
  current_period_end: string | null;
  profile?: {
    full_name: string | null;
    email?: string;
    phone: string | null;
  };
  blogs?: Array<{ id: string; name: string; slug: string }>;
}

const PLAN_OPTIONS = [
  { value: "essential", label: "Lite" },
  { value: "plus", label: "Pro" },
  { value: "scale", label: "Business" },
  { value: "internal", label: "Interno (Ilimitado)" },
];

const ACCOUNT_TYPES = [
  { value: "cliente_manual", label: "Cliente Manual", icon: Building2 },
  { value: "teste_interno", label: "Teste Interno", icon: TestTube2 },
  { value: "demo", label: "Demo", icon: Eye },
];

export function CustomerAccountsTab() {
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    phone: "",
    plan: "essential",
    accountType: "cliente_manual",
    notes: "",
    createBlog: true,
    blogName: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select(`
          id,
          user_id,
          plan,
          status,
          is_internal_account,
          internal_notes,
          created_at,
          current_period_end
        `)
        .eq("is_internal_account", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const subs = subscriptions || [];
      const userIds = subs.map((s) => s.user_id);

      const [profilesRes, blogsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name, phone").in("user_id", userIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from("blogs").select("id, name, slug, user_id").in("user_id", userIds)
          : { data: [] },
      ]);

      const profilesByUser = new Map(
        (profilesRes.data || []).map((p: any) => [p.user_id, p])
      );
      const blogsByUser = new Map<string, any[]>();
      for (const blog of blogsRes.data || []) {
        const existing = blogsByUser.get(blog.user_id) || [];
        existing.push(blog);
        blogsByUser.set(blog.user_id, existing);
      }

      const accountsWithDetails = subs.map((sub) => ({
        ...sub,
        profile: profilesByUser.get(sub.user_id) || undefined,
        blogs: blogsByUser.get(sub.user_id) || [],
      }));

      setAccounts(accountsWithDetails);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Erro ao carregar subcontas");
    } finally {
      setLoading(false);
    }
  };

  // Email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleCreateAccount = async () => {
    if (!formData.email || !formData.fullName || !formData.plan || !formData.accountType) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!isValidEmail(formData.email)) {
      toast.error("Por favor, insira um email válido (ex: cliente@email.com)");
      return;
    }

    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Sessão expirada");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-customer-account", {
        body: {
          email: formData.email,
          fullName: formData.fullName,
          phone: formData.phone || undefined,
          plan: formData.plan,
          accountType: formData.accountType,
          notes: formData.notes || undefined,
          createBlog: formData.createBlog,
          blogName: formData.blogName || undefined,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setShowCreateDialog(false);

      if (data.isExistingUser) {
        toast.success(data.message || "Usuário existente atualizado com sucesso!");
      } else {
        toast.success("Subconta criada com sucesso!");
        setCredentials(data.credentials);
        setShowCredentialsDialog(true);
      }
      
      // Reset form
      setFormData({
        email: "",
        fullName: "",
        phone: "",
        plan: "essential",
        accountType: "cliente_manual",
        notes: "",
        createBlog: true,
        blogName: "",
      });

      fetchAccounts();
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast.error(error.message || "Erro ao criar subconta");
    } finally {
      setCreating(false);
    }
  };

  const copyCredentials = () => {
    if (credentials) {
      const text = `Email: ${credentials.email}\nSenha: ${credentials.password}`;
      navigator.clipboard.writeText(text);
      toast.success("Credenciais copiadas!");
    }
  };

  const getAccountTypeBadge = (notes: string | null) => {
    if (!notes) return <Badge variant="secondary">Desconhecido</Badge>;
    
    if (notes.includes("[cliente_manual]")) {
      return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Cliente</Badge>;
    }
    if (notes.includes("[teste_interno]")) {
      return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">Teste</Badge>;
    }
    if (notes.includes("[demo]")) {
      return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Demo</Badge>;
    }
    return <Badge variant="secondary">Manual</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const planConfig: Record<string, { label: string; className: string }> = {
      essential: { label: "Lite", className: "bg-slate-500/20 text-slate-700 border-slate-500/30" },
      plus: { label: "Pro", className: "bg-purple-500/20 text-purple-700 border-purple-500/30" },
      scale: { label: "Business", className: "bg-amber-500/20 text-amber-700 border-amber-500/30" },
      internal: { label: "Interno", className: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" },
    };
    const config = planConfig[plan] || { label: plan, className: "" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = 
      account.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.internal_notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = filterPlan === "all" || account.plan === filterPlan;
    
    const matchesType = filterType === "all" || account.internal_notes?.includes(`[${filterType}]`);

    return matchesSearch && matchesPlan && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Subcontas</CardDescription>
            <CardTitle className="text-2xl">{accounts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clientes Manuais</CardDescription>
            <CardTitle className="text-2xl">
              {accounts.filter(a => a.internal_notes?.includes("[cliente_manual]")).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Testes Internos</CardDescription>
            <CardTitle className="text-2xl">
              {accounts.filter(a => a.internal_notes?.includes("[teste_interno]")).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Demos</CardDescription>
            <CardTitle className="text-2xl">
              {accounts.filter(a => a.internal_notes?.includes("[demo]")).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Actions and filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Subcontas de Clientes
              </CardTitle>
              <CardDescription>
                Gerencie contas criadas manualmente (sem Stripe)
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Criar Subconta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Nova Subconta</DialogTitle>
                  <DialogDescription>
                    Crie uma conta de cliente manualmente, sem Stripe.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="cliente@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo *</Label>
                    <Input
                      id="fullName"
                      placeholder="Nome do Cliente"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="+55 11 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Plano *</Label>
                      <Select
                        value={formData.plan}
                        onValueChange={(value) => setFormData({ ...formData, plan: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLAN_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo *</Label>
                      <Select
                        value={formData.accountType}
                        onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas Internas</Label>
                    <Textarea
                      id="notes"
                      placeholder="Observações sobre esta conta..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="createBlog"
                      checked={formData.createBlog}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, createBlog: checked as boolean })
                      }
                    />
                    <Label htmlFor="createBlog" className="text-sm">
                      Criar blog automaticamente
                    </Label>
                  </div>
                  {formData.createBlog && (
                    <div className="space-y-2">
                      <Label htmlFor="blogName">Nome do Blog</Label>
                      <Input
                        id="blogName"
                        placeholder="Deixe vazio para usar o nome do cliente"
                        value={formData.blogName}
                        onChange={(e) => setFormData({ ...formData, blogName: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateAccount} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar Subconta"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou notas..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Planos</SelectItem>
                {PLAN_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {ACCOUNT_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchAccounts}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {accounts.length === 0 
                ? "Nenhuma subconta criada ainda"
                : "Nenhuma subconta encontrada com os filtros atuais"
              }
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Blogs</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{account.profile?.full_name || "Sem nome"}</p>
                        <p className="text-sm text-muted-foreground">{account.profile?.phone || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getAccountTypeBadge(account.internal_notes)}</TableCell>
                    <TableCell>{getPlanBadge(account.plan)}</TableCell>
                    <TableCell>
                      <Badge variant={account.status === "active" ? "default" : "secondary"}>
                        {account.status === "active" ? "Ativo" : account.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.blogs?.length || 0} blog(s)
                    </TableCell>
                    <TableCell>
                      {format(new Date(account.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciais da Nova Conta</DialogTitle>
            <DialogDescription>
              Salve estas credenciais agora. A senha não poderá ser recuperada depois.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="font-mono">{credentials.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Senha:</span>
                  <span className="font-mono">{credentials.password}</span>
                </div>
              </div>
              <Button onClick={copyCredentials} className="w-full gap-2">
                <Copy className="h-4 w-4" />
                Copiar Credenciais
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowCredentialsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
