import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, CreditCard, Globe, LogOut, Users, Plus, Trash2, Loader2, Mail, Moon, Camera, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '@/components/client/ThemeToggle';
import { AvatarUploadDialog } from '@/components/profile/AvatarUploadDialog';
import { CustomDomainSettings } from '@/components/settings/CustomDomainSettings';
import { LinkClickStats } from '@/components/dashboard/LinkClickStats';
import { PublicBlogLink } from '@/components/dashboard/PublicBlogLink';

interface TeamMember {
  id: string;
  user_id: string;
  status: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export default function ClientAccount() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { blog } = useBlog();
  const { i18n } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState('Básico');
  const [planStatus, setPlanStatus] = useState('active');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);

  useEffect(() => {
    if (!blog?.id || !user?.id) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch profile - using user_id column (not id)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
        }

        // Fetch subscription using raw query to avoid type recursion
        const { data: subscription } = await (supabase as any)
          .from('subscriptions')
          .select('is_internal_account, status')
          .eq('blog_id', blog.id)
          .maybeSingle();

        if (subscription) {
          setPlanName(subscription.is_internal_account ? 'Interno' : 'Profissional');
          setPlanStatus(subscription.status || 'active');
        }

        // Fetch team members
        const { data: members } = await (supabase as any)
          .from('team_members')
          .select('id, user_id, status')
          .eq('blog_id', blog.id);

        setTeamMembers(members ?? []);
      } catch (error) {
        console.error('Error fetching account data:', error);
      }

      setLoading(false);
    };

    fetchData();
  }, [blog?.id, user?.id]);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Force navigation after sign out
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      // Force navigation even on error
      window.location.href = '/auth';
    }
  };

  const handleInvite = async () => {
    if (!newEmail.trim() || !blog?.id || !user?.id) return;
    
    if (!newEmail.includes('@')) {
      toast.error('Digite um e-mail válido');
      return;
    }

    setInviting(true);

    try {
      // For now, just show a message - actual invite logic would need edge function
      toast.info('Funcionalidade de convite em desenvolvimento');
      setNewEmail('');
    } catch (error) {
      console.error('Error inviting:', error);
      toast.error('Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setTeamMembers(teamMembers.filter(m => m.id !== memberId));
      toast.success('Membro removido');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erro ao remover membro');
    }
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    toast.success('Idioma alterado!');
  };

  const handleAvatarSave = (newUrl: string | null) => {
    setProfile(prev => prev ? { ...prev, avatar_url: newUrl } : null);
    setShowAvatarDialog(false);
  };

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
          <User className="h-8 w-8 text-primary" />
          Minha Conta
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gerencie sua conta, perfil e configurações
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Meu Perfil
          </CardTitle>
          <CardDescription>
            Personalize sua foto de perfil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <button 
                onClick={() => setShowAvatarDialog(true)}
                className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 shadow-md hover:bg-primary/90 transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1">
              <div className="font-medium text-lg text-gray-800 dark:text-white">
                {profile?.full_name || user?.email?.split('@')[0] || 'Usuário'}
              </div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setShowAvatarDialog(true)}
              >
                Alterar foto
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link Público de Aquisição */}
      {blog && (
        <PublicBlogLink blog={{
          id: blog.id,
          slug: blog.slug,
          name: blog.name,
          custom_domain: blog.custom_domain,
          domain_verified: blog.domain_verified,
          platform_subdomain: blog.platform_subdomain
        }} />
      )}

      {/* Link Stats */}
      {blog?.id && <LinkClickStats blogId={blog.id} />}

      {/* Custom Domain */}
      {blog?.id && <CustomDomainSettings blogId={blog.id} />}

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Seu Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{planName}</div>
              <Badge variant={planStatus === 'active' ? 'default' : 'secondary'} className="mt-1">
                {planStatus === 'active' ? 'Ativo' : planStatus}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Aparência
          </CardTitle>
          <CardDescription>
            Escolha o tema da interface
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tema da Interface</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Equipe
          </CardTitle>
          <CardDescription>
            Convide pessoas para ajudar a gerenciar seu blog
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current user */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-100 dark:bg-white/5 rounded-lg">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20">
                  <User className="h-5 w-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-gray-800 dark:text-white">{user?.email}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Proprietário</div>
              </div>
            </div>
          </div>

          {/* Team members */}
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-3 px-4 border border-slate-200 dark:border-white/10 rounded-lg">
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-800 dark:text-white">{member.user_id.substring(0, 8)}...</div>
                  <Badge variant={member.status === 'accepted' ? 'default' : 'secondary'} className="text-xs">
                    {member.status === 'accepted' ? 'Ativo' : 'Pendente'}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveMember(member.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Invite */}
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="email@exemplo.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <Button onClick={handleInvite} disabled={inviting} className="gap-2">
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Convidar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Idioma
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card className="border-destructive/20 dark:border-destructive/30">
        <CardContent className="pt-6">
          <Button 
            variant="destructive" 
            onClick={handleSignOut}
            className="w-full gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </CardContent>
      </Card>

      {/* Avatar Upload Dialog */}
      <AvatarUploadDialog
        open={showAvatarDialog}
        onOpenChange={setShowAvatarDialog}
        currentAvatar={profile?.avatar_url || null}
        onSave={handleAvatarSave}
      />
    </div>
  );
}
