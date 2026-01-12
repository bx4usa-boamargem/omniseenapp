import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  Globe, Loader2, Plus, Trash2, ExternalLink, Sparkles, AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';

interface Competitor {
  id: string;
  name: string;
  url: string;
  favicon_url?: string;
  blog_id: string;
  created_at: string;
  monthly_clicks?: number;
  keywords_ranked?: number;
  traffic_value_brl?: number;
}

interface ClientCompetitorsTabProps {
  blogId: string;
}

export function ClientCompetitorsTab({ blogId }: ClientCompetitorsTabProps) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    fetchCompetitors();
  }, [blogId]);

  const fetchCompetitors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('competitors')
        .select('*')
        .eq('blog_id', blogId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompetitors(data || []);
    } catch (error) {
      console.error('Error fetching competitors:', error);
    }
    setLoading(false);
  };

  const extractDomain = (url: string): string => {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const handleAddCompetitor = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (competitors.length >= 5) {
      toast.error('Limite de 5 concorrentes atingido');
      return;
    }

    setSaving(true);
    try {
      const domain = extractDomain(newUrl);
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

      const { data, error } = await supabase
        .from('competitors')
        .insert({
          blog_id: blogId,
          name: newName.trim(),
          url: newUrl.startsWith('http') ? newUrl : `https://${newUrl}`,
          favicon_url: faviconUrl,
        })
        .select()
        .single();

      if (error) throw error;

      setCompetitors(prev => [data, ...prev]);
      setNewName('');
      setNewUrl('');
      setDialogOpen(false);
      toast.success('Concorrente adicionado!');
    } catch (error) {
      console.error('Error adding competitor:', error);
      toast.error('Erro ao adicionar concorrente');
    }
    setSaving(false);
  };

  const handleDeleteCompetitor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('competitors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCompetitors(prev => prev.filter(c => c.id !== id));
      toast.success('Concorrente removido');
    } catch (error) {
      console.error('Error deleting competitor:', error);
      toast.error('Erro ao remover concorrente');
    }
  };

  const handleAnalyzeCompetitors = async () => {
    if (competitors.length === 0) {
      toast.error('Adicione pelo menos um concorrente');
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-competitors', {
        body: { blogId }
      });

      if (error) throw error;

      toast.success('Análise concluída!', {
        description: `${data?.gaps?.length || 0} gaps de conteúdo identificados.`
      });

      // Refresh opportunities tab
    } catch (error) {
      console.error('Error analyzing competitors:', error);
      toast.error('Erro ao analisar concorrentes');
    }
    setAnalyzing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Análise de Concorrentes</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Cadastre até 5 concorrentes para identificar gaps de conteúdo e oportunidades.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleAnalyzeCompetitors}
                disabled={analyzing || competitors.length === 0}
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Analisar Gaps
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={competitors.length >= 5}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Concorrente</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome do Concorrente</Label>
                      <Input
                        placeholder="Ex: Empresa XYZ"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL do Site/Blog</Label>
                      <Input
                        placeholder="Ex: https://empresaxyz.com.br/blog"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddCompetitor} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competitors List */}
      {competitors.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">Nenhum concorrente cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Adicione seus principais concorrentes para identificar oportunidades de conteúdo.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeiro concorrente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {competitors.map((competitor) => (
            <Card key={competitor.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {competitor.favicon_url && (
                      <img 
                        src={competitor.favicon_url} 
                        alt="" 
                        className="w-10 h-10 rounded-lg bg-gray-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <h4 className="font-medium">{competitor.name}</h4>
                      <a 
                        href={competitor.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        {extractDomain(competitor.url)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {competitor.monthly_clicks && (
                      <div className="text-right">
                        <p className="text-sm font-medium">{competitor.monthly_clicks.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">cliques/mês</p>
                      </div>
                    )}
                    {competitor.keywords_ranked && (
                      <div className="text-right">
                        <p className="text-sm font-medium">{competitor.keywords_ranked.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">keywords</p>
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteCompetitor(competitor.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Limit indicator */}
      <p className="text-sm text-muted-foreground text-center">
        {competitors.length}/5 concorrentes cadastrados
      </p>
    </div>
  );
}
