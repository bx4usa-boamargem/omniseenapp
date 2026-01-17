import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Bell, Clock, TrendingDown, UserX, Plus, Trash2, Loader2, Activity } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SectionHelper } from "@/components/blog-editor/SectionHelper";

interface HealthAlert {
  id: string;
  alert_type: string;
  threshold_value: number;
  threshold_unit: string;
  notification_email: string | null;
  is_active: boolean;
  created_at: string;
}

interface AlertHistory {
  id: string;
  alert_id: string;
  tenant_id: string;
  triggered_at: string;
  current_value: number;
  message: string | null;
  resolved_at: string | null;
  tenant?: { name: string };
}

const ALERT_TYPES = [
  { 
    value: "churn_risk", 
    label: "Risco de Churn", 
    description: "Dias sem login do cliente",
    icon: UserX,
    unit: "dias",
    defaultThreshold: 14
  },
  { 
    value: "low_margin", 
    label: "Margem Baixa", 
    description: "Margem de lucro mínima aceitável",
    icon: TrendingDown,
    unit: "percentual",
    defaultThreshold: 20
  },
  { 
    value: "inactivity", 
    label: "Inatividade Editorial", 
    description: "Dias sem criar artigos",
    icon: Clock,
    unit: "dias",
    defaultThreshold: 30
  },
];

export function HealthAlertManager() {
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newAlert, setNewAlert] = useState({
    alert_type: "churn_risk",
    threshold_value: 14,
    notification_email: "",
  });

  useEffect(() => {
    fetchAlerts();
    fetchHistory();
  }, []);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from("admin_health_alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching health alerts:", error);
      return;
    }

    setAlerts(data || []);
    setLoading(false);
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("admin_health_alert_history")
      .select(`
        *,
        tenant:tenants(name)
      `)
      .order("triggered_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching alert history:", error);
      return;
    }

    setHistory((data || []).map(h => ({
      ...h,
      tenant: h.tenant as { name: string } | undefined
    })));
  };

  const addAlert = async () => {
    if (!newAlert.threshold_value) {
      toast.error("Defina um valor limite");
      return;
    }

    setSaving(true);

    const alertConfig = ALERT_TYPES.find(t => t.value === newAlert.alert_type);

    const { error } = await supabase.from("admin_health_alerts").insert({
      alert_type: newAlert.alert_type,
      threshold_value: newAlert.threshold_value,
      threshold_unit: alertConfig?.unit || "dias",
      notification_email: newAlert.notification_email || null,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      toast.error("Erro ao criar alerta");
      console.error("Error creating health alert:", error);
      return;
    }

    toast.success("Alerta de saúde criado!");
    setShowNewAlert(false);
    setNewAlert({ alert_type: "churn_risk", threshold_value: 14, notification_email: "" });
    fetchAlerts();
  };

  const toggleAlert = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from("admin_health_alerts")
      .update({ is_active })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar alerta");
      return;
    }

    setAlerts(alerts.map(a => a.id === id ? { ...a, is_active } : a));
    toast.success(is_active ? "Alerta ativado" : "Alerta desativado");
  };

  const deleteAlert = async (id: string) => {
    const { error } = await supabase
      .from("admin_health_alerts")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao remover alerta");
      return;
    }

    setAlerts(alerts.filter(a => a.id !== id));
    toast.success("Alerta removido");
  };

  const getAlertTypeInfo = (type: string) => {
    return ALERT_TYPES.find(t => t.value === type) || ALERT_TYPES[0];
  };

  const handleAlertTypeChange = (value: string) => {
    const alertConfig = ALERT_TYPES.find(t => t.value === value);
    setNewAlert({
      ...newAlert,
      alert_type: value as typeof newAlert.alert_type,
      threshold_value: alertConfig?.defaultThreshold || 14
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-orange-500" />
              <div>
                <CardTitle>Alertas de Saúde do Cliente</CardTitle>
                <CardDescription>
                  Configure alertas proativos para identificar clientes em risco
                </CardDescription>
              </div>
            </div>
            <Dialog open={showNewAlert} onOpenChange={setShowNewAlert}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Alerta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Alerta de Saúde</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tipo de Alerta</Label>
                    <Select 
                      value={newAlert.alert_type} 
                      onValueChange={handleAlertTypeChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {getAlertTypeInfo(newAlert.alert_type).description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Limite ({getAlertTypeInfo(newAlert.alert_type).unit})
                    </Label>
                    <Input
                      type="number"
                      value={newAlert.threshold_value}
                      onChange={(e) => setNewAlert({
                        ...newAlert, 
                        threshold_value: Number(e.target.value)
                      })}
                      min={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      {getAlertTypeInfo(newAlert.alert_type).unit === "percentual"
                        ? "Alertar quando margem for menor que este valor"
                        : "Alertar após este número de dias"
                      }
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Email para Notificação (opcional)</Label>
                    <Input
                      type="email"
                      placeholder="admin@empresa.com"
                      value={newAlert.notification_email}
                      onChange={(e) => setNewAlert({
                        ...newAlert, 
                        notification_email: e.target.value
                      })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewAlert(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={addAlert} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Alerta
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <SectionHelper
            title=""
            description="Defina thresholds para identificar automaticamente clientes em risco de churn, baixa margem ou inatividade editorial."
          />
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alertas Configurados</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum alerta configurado</p>
              <p className="text-sm">Crie alertas para monitorar a saúde dos clientes</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Notificação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => {
                  const typeInfo = getAlertTypeInfo(alert.alert_type);
                  const TypeIcon = typeInfo.icon;
                  return (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">{typeInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {alert.threshold_value} {alert.threshold_unit}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {alert.notification_email || "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={alert.is_active}
                          onCheckedChange={(checked) => toggleAlert(alert.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAlert(alert.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Histórico de Alertas Disparados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum alerta disparado ainda</p>
              <p className="text-sm">Os alertas aparecerão aqui quando forem acionados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Alerta</TableHead>
                  <TableHead>Valor Atual</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">
                      {h.tenant?.name || "Cliente Desconhecido"}
                    </TableCell>
                    <TableCell>
                      {h.message || "Alerta disparado"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {h.current_value}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(h.triggered_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {h.resolved_at ? (
                        <Badge variant="outline" className="text-green-600">
                          Resolvido
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}