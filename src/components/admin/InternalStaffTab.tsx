import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, MoreHorizontal, Shield, Loader2, Users2, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

const STAFF_ROLES = [
  { value: "platform_admin", label: "Platform Admin", description: "Controle total da plataforma" },
  { value: "admin", label: "Admin", description: "Gerencia clientes e operações" },
  { value: "staff_finance", label: "Financeiro", description: "Acesso a relatórios financeiros" },
  { value: "staff_content", label: "Conteúdo", description: "Cria conteúdo de demonstração" },
  { value: "staff_support", label: "Suporte", description: "Atendimento ao cliente" },
];

export function InternalStaffTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff_support");

  useEffect(() => {
    fetchCurrentUser();
    fetchStaff();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const staffRoles = ["platform_admin", "admin", "staff_finance", "staff_content", "staff_support"] as const;
      
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .in("role", staffRoles)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const roles = userRoles || [];
      const userIds = roles.map((r) => r.user_id);

      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
        : { data: [] };

      const profilesByUser = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      const staffWithProfiles = roles.map((ur) => ({
        ...ur,
        profile: profilesByUser.get(ur.user_id) || undefined,
      }));

      setStaff(staffWithProfiles);
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error("Erro ao carregar equipe");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteStaff = async () => {
    if (!inviteEmail) {
      toast.error("Digite o email do membro");
      return;
    }

    setInviting(true);
    try {
      // First, check if user exists
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("full_name", inviteEmail) // This won't work, we need email
        .maybeSingle();

      // For now, we'll create the user and add the role
      // In production, you'd want to send an invite email
      
      toast.info("Funcionalidade de convite será implementada em breve. Por enquanto, o usuário precisa criar uma conta e você pode alterar o role manualmente.");
      
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("staff_support");
    } catch (error: any) {
      console.error("Error inviting staff:", error);
      toast.error(error.message || "Erro ao convidar membro");
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, userId: string, newRole: "admin" | "platform_admin" | "staff_finance" | "staff_content" | "staff_support" | "user") => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Role atualizado com sucesso");
      fetchStaff();
    } catch (error: any) {
      console.error("Error changing role:", error);
      toast.error("Erro ao atualizar role");
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    try {
      // Instead of removing, we'll change to 'user' role
      const { error } = await supabase
        .from("user_roles")
        .update({ role: "user" })
        .eq("id", selectedMember.id);

      if (error) throw error;

      toast.success("Membro removido da equipe");
      setShowRemoveDialog(false);
      setSelectedMember(null);
      fetchStaff();
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast.error("Erro ao remover membro");
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; className: string }> = {
      platform_admin: { label: "Platform Admin", className: "bg-red-500/20 text-red-700 border-red-500/30" },
      admin: { label: "Admin", className: "bg-purple-500/20 text-purple-700 border-purple-500/30" },
      staff_finance: { label: "Financeiro", className: "bg-green-500/20 text-green-700 border-green-500/30" },
      staff_content: { label: "Conteúdo", className: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
      staff_support: { label: "Suporte", className: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
    };
    const config = roleConfig[role] || { label: role, className: "" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getRoleDescription = (role: string) => {
    const roleInfo = STAFF_ROLES.find(r => r.value === role);
    return roleInfo?.description || "";
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {STAFF_ROLES.map((role) => (
          <Card key={role.value}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{role.label}</CardDescription>
              <CardTitle className="text-2xl">
                {staff.filter(s => s.role === role.value).length}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users2 className="h-5 w-5" />
                Equipe Interna
              </CardTitle>
              <CardDescription>
                Membros da equipe com acesso ao painel administrativo
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={fetchStaff}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Adicionar Membro
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
                    <DialogDescription>
                      Adicione um novo membro à equipe interna.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="inviteEmail">Email</Label>
                      <Input
                        id="inviteEmail"
                        type="email"
                        placeholder="membro@omniseen.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              <div className="flex flex-col">
                                <span>{role.label}</span>
                                <span className="text-xs text-muted-foreground">{role.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleInviteStaff} disabled={inviting}>
                      {inviting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adicionando...
                        </>
                      ) : (
                        "Adicionar"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum membro na equipe interna
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Shield className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">
                          {member.profile?.full_name || "Usuário"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {getRoleDescription(member.role)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(member.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {member.user_id !== currentUserId && member.role !== "platform_admin" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STAFF_ROLES.filter(r => r.value !== member.role && r.value !== "platform_admin").map((role) => (
                              <DropdownMenuItem
                                key={role.value}
                                onClick={() => handleChangeRole(member.id, member.user_id, role.value as "admin" | "staff_finance" | "staff_content" | "staff_support")}
                              >
                                Mudar para {role.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedMember(member);
                                setShowRemoveDialog(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remover da Equipe
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da Equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember?.profile?.full_name || "Este membro"} será removido da equipe interna
              e perderá acesso ao painel administrativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
