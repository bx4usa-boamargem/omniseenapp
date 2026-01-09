import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { useTeamPermissions, Permission, PERMISSION_LABELS } from "@/hooks/useTeamPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Loader2, 
  User, 
  Mail, 
  Calendar, 
  Building2, 
  Check, 
  X, 
  Pencil,
  Save,
  ExternalLink,
  Camera
} from "lucide-react";
import { AvatarUploadDialog } from "@/components/profile/AvatarUploadDialog";
import { ChangePasswordCard } from "@/components/profile/ChangePasswordCard";
import { TeamRole } from "@/hooks/useTeam";

interface BlogAccess {
  id: string;
  name: string;
  slug: string;
  role: TeamRole;
  isOwner: boolean;
}

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
};

const ROLE_COLORS: Record<TeamRole, string> = {
  owner: "bg-primary/20 text-primary",
  admin: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  editor: "bg-green-500/20 text-green-600 dark:text-green-400",
  viewer: "bg-muted text-muted-foreground",
};

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { blog, role, isOwner, loading: blogLoading } = useBlog();
  const { hasPermission, getAllPermissions } = useTeamPermissions(role);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    avatar_url: "",
  });
  const [editedName, setEditedName] = useState("");
  const [blogAccesses, setBlogAccesses] = useState<BlogAccess[]>([]);
  const [memberSince, setMemberSince] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || "",
          avatar_url: profileData.avatar_url || "",
        });
        setEditedName(profileData.full_name || "");
        setMemberSince(profileData.created_at);
      }

      // Fetch all blog accesses (owned + team member)
      const accesses: BlogAccess[] = [];

      // Check owned blogs
      const { data: ownedBlogs } = await supabase
        .from("blogs")
        .select("id, name, slug")
        .eq("user_id", user.id);

      if (ownedBlogs) {
        ownedBlogs.forEach((blog) => {
          accesses.push({
            id: blog.id,
            name: blog.name,
            slug: blog.slug,
            role: "owner",
            isOwner: true,
          });
        });
      }

      // Check team memberships
      const { data: memberships } = await supabase
        .from("team_members")
        .select(`
          role,
          blogs (id, name, slug)
        `)
        .eq("user_id", user.id)
        .eq("status", "active");

      if (memberships) {
        memberships.forEach((membership) => {
          if (membership.blogs) {
            const blogData = membership.blogs as unknown as { id: string; name: string; slug: string };
            // Avoid duplicates
            if (!accesses.find((a) => a.id === blogData.id)) {
              accesses.push({
                id: blogData.id,
                name: blogData.name,
                slug: blogData.slug,
                role: membership.role as TeamRole,
                isOwner: false,
              });
            }
          }
        });
      }

      setBlogAccesses(accesses);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editedName })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfile((prev) => ({ ...prev, full_name: editedName }));
      setEditing(false);
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const allPermissions = getAllPermissions();

  if (loading || blogLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-display font-bold">Meu Perfil</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Personal Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>Seus dados de perfil na plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <div 
                className="relative cursor-pointer group" 
                onClick={() => setShowAvatarUpload(true)}
              >
                <Avatar className="h-24 w-24 shrink-0">
                  <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-medium">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </div>

              <div className="flex-1 space-y-4">
                {editing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome Completo</Label>
                      <Input
                        id="name"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Seu nome completo"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(false);
                          setEditedName(profile.full_name);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{profile.full_name || "Nome não definido"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{user?.email}</span>
                      </div>
                      {memberSince && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Membro desde {new Date(memberSince).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar Perfil
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blog Access Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Acesso a Blogs
            </CardTitle>
            <CardDescription>Blogs aos quais você tem acesso</CardDescription>
          </CardHeader>
          <CardContent>
            {blogAccesses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Você ainda não tem acesso a nenhum blog.</p>
                <Button variant="link" onClick={() => navigate("/onboarding")}>
                  Criar seu primeiro blog
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {blogAccesses.map((access) => (
                  <div
                    key={access.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{access.name}</p>
                        <Badge
                          variant="secondary"
                          className={ROLE_COLORS[access.role]}
                        >
                          {ROLE_LABELS[access.role]}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                      Acessar
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Permissions Card */}
        {role && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                Permissões Atuais
              </CardTitle>
              <CardDescription>
                Suas permissões como{" "}
                <Badge variant="secondary" className={ROLE_COLORS[role]}>
                  {ROLE_LABELS[role]}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {allPermissions.map((permission) => {
                  const allowed = hasPermission(permission);
                  return (
                    <div
                      key={permission}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        allowed ? "bg-success/10" : "bg-muted/50"
                      }`}
                    >
                      {allowed ? (
                        <Check className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={`text-sm ${
                          allowed ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {PERMISSION_LABELS[permission]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Password Card */}
        <ChangePasswordCard />

        <AvatarUploadDialog
          open={showAvatarUpload}
          onOpenChange={setShowAvatarUpload}
          currentAvatar={profile.avatar_url || null}
          onSave={(newUrl) => {
            setProfile((prev) => ({ ...prev, avatar_url: newUrl || "" }));
          }}
        />
      </main>
    </div>
  );
}
