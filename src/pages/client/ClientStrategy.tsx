import { useState, useEffect } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Compass, Loader2, Save, CheckCircle2, Building2, Users, Target, 
  Lightbulb, TrendingUp, Sparkles, X, Plus, Globe, Radar
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ClientCompetitorsTab } from '@/components/client/strategy/ClientCompetitorsTab';
import { ClientOpportunitiesTab } from '@/components/client/strategy/ClientOpportunitiesTab';
import { MarketRadarTab } from '@/components/client/strategy/MarketRadarTab';
import { ContentCalendar } from '@/components/content/ContentCalendar';

// Business type options
const TIPO_NEGOCIO_OPTIONS = [
  { value: 'local', label: 'Negócio Local' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'saas', label: 'SaaS / Software' },
  { value: 'servicos', label: 'Prestador de Serviços' },
  { value: 'infoproduto', label: 'Infoproduto / Curso' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'agencia', label: 'Agência' },
];

// Audience type options
const TIPO_PUBLICO_OPTIONS = [
  { value: 'b2b', label: 'B2B - Empresas' },
  { value: 'b2c', label: 'B2C - Consumidor Final' },
  { value: 'misto', label: 'Misto (B2B e B2C)' },
];

// Awareness level options
const NIVEL_CONSCIENCIA_OPTIONS = [
  { value: 'inconsciente', label: 'Inconsciente do Problema' },
  { value: 'consciente_problema', label: 'Consciente do Problema - Sabe que tem um problema' },
  { value: 'consciente_solucao', label: 'Consciente da Solução - Busca soluções' },
  { value: 'consciente_produto', label: 'Consciente do Produto - Conhece sua oferta' },
];

// Knowledge level options
const NIVEL_CONHECIMENTO_OPTIONS = [
  { value: 'iniciante', label: 'Iniciante - Pouco conhecimento técnico' },
  { value: 'intermediario', label: 'Intermediário - Conhece o básico' },
  { value: 'avancado', label: 'Avançado - Conhecimento técnico profundo' },
];

// CTA channel options
const CANAL_CTA_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'formulario', label: 'Formulário de Contato' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'agendamento', label: 'Agendamento Online' },
];

interface ClientStrategy {
  id?: string;
  blog_id: string;
  empresa_nome: string;
  tipo_negocio: string;
  regiao_atuacao: string;
  tipo_publico: string;
  nivel_consciencia: string;
  nivel_conhecimento: string;
  dor_principal: string;
  desejo_principal: string;
  o_que_oferece: string;
  principais_beneficios: string[];
  diferenciais: string[];
  acao_desejada: string;
  canal_cta: string;
}

export default function ClientStrategy() {
  const { blog } = useBlog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeTab, setActiveTab] = useState('strategy');
  
  const [strategy, setStrategy] = useState<ClientStrategy>({
    blog_id: '',
    empresa_nome: '',
    tipo_negocio: '',
    regiao_atuacao: '',
    tipo_publico: '',
    nivel_consciencia: '',
    nivel_conhecimento: '',
    dor_principal: '',
    desejo_principal: '',
    o_que_oferece: '',
    principais_beneficios: [],
    diferenciais: [],
    acao_desejada: '',
    canal_cta: '',
  });

  // Temp inputs for array fields
  const [newBeneficio, setNewBeneficio] = useState('');
  const [newDiferencial, setNewDiferencial] = useState('');

  useEffect(() => {
    if (!blog?.id) return;

    const fetchStrategy = async () => {
      setLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('client_strategy')
          .select('*')
          .eq('blog_id', blog.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setStrategy({
            id: data.id,
            blog_id: data.blog_id || blog.id,
            empresa_nome: data.empresa_nome || '',
            tipo_negocio: data.tipo_negocio || '',
            regiao_atuacao: data.regiao_atuacao || '',
            tipo_publico: data.tipo_publico || '',
            nivel_consciencia: data.nivel_consciencia || '',
            nivel_conhecimento: data.nivel_conhecimento || '',
            dor_principal: data.dor_principal || '',
            desejo_principal: data.desejo_principal || '',
            o_que_oferece: data.o_que_oferece || '',
            principais_beneficios: data.principais_beneficios || [],
            diferenciais: data.diferenciais || [],
            acao_desejada: data.acao_desejada || '',
            canal_cta: data.canal_cta || '',
          });
          setIsConfigured(!!data.empresa_nome);
        } else {
          // Initialize with blog name if available
          setStrategy(prev => ({
            ...prev,
            blog_id: blog.id,
            empresa_nome: blog.name || '',
          }));
        }
      } catch (error) {
        console.error('Error fetching strategy:', error);
      }
      
      setLoading(false);
    };

    fetchStrategy();
  }, [blog?.id, blog?.name]);

  const handleSave = async () => {
    if (!blog?.id) return;
    setSaving(true);

    try {
      const dataToSave = {
        ...strategy,
        blog_id: blog.id,
      };

      if (strategy.id) {
        const { error } = await supabase
          .from('client_strategy')
          .update(dataToSave)
          .eq('id', strategy.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('client_strategy')
          .insert(dataToSave)
          .select()
          .single();
        if (error) throw error;
        setStrategy(prev => ({ ...prev, id: data.id }));
      }

      setIsConfigured(true);
      toast.success('Estratégia salva!', {
        description: 'A IA usará essas informações para criar conteúdo personalizado.',
      });
    } catch (error) {
      console.error('Error saving strategy:', error);
      toast.error('Erro ao salvar estratégia');
    } finally {
      setSaving(false);
    }
  };

  const addBeneficio = () => {
    if (!newBeneficio.trim()) return;
    setStrategy(prev => ({
      ...prev,
      principais_beneficios: [...prev.principais_beneficios, newBeneficio.trim()],
    }));
    setNewBeneficio('');
  };

  const removeBeneficio = (index: number) => {
    setStrategy(prev => ({
      ...prev,
      principais_beneficios: prev.principais_beneficios.filter((_, i) => i !== index),
    }));
  };

  const addDiferencial = () => {
    if (!newDiferencial.trim()) return;
    setStrategy(prev => ({
      ...prev,
      diferenciais: [...prev.diferenciais, newDiferencial.trim()],
    }));
    setNewDiferencial('');
  };

  const removeDiferencial = (index: number) => {
    setStrategy(prev => ({
      ...prev,
      diferenciais: prev.diferenciais.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
            <Compass className="h-8 w-8 text-primary" />
            Estratégia
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Informações do seu negócio para personalizar artigos gerados pela IA
          </p>
        </div>

        <Button
          className="gap-2"
          onClick={() => navigate('/client/landing-pages/new')}
        >
          <Sparkles className="h-4 w-4" />
          Criar Super Página
        </Button>
      </div>

      {/* Status Alert */}
      {isConfigured && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            Blog configurado! Você pode gerar artigos ilimitados.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="strategy" className="gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Estratégia</span>
          </TabsTrigger>
          <TabsTrigger value="radar" className="gap-2">
            <Radar className="h-4 w-4" />
            <span className="hidden sm:inline">Radar</span>
          </TabsTrigger>
          <TabsTrigger value="competitors" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Concorrentes</span>
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Oportunidades</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Calendário</span>
          </TabsTrigger>
        </TabsList>

        {/* Strategy Tab */}
        <TabsContent value="strategy" className="space-y-6">
          {/* Universal Strategy Header */}
          <Card className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-violet-500/20">
                  <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Estratégia Universal de Conteúdo</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure sua estratégia para que a IA gere conteúdo personalizado e de alta qualidade.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identity Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Identidade do Negócio
                    <Badge variant="secondary">Essencial</Badge>
                  </CardTitle>
                  <CardDescription>
                    Informações básicas para personalizar tom e contexto dos artigos
                  </CardDescription>
                </div>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                Preencha apenas o nome da empresa para começar. O resto pode ficar para depois.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Empresa</Label>
                  <Input
                    placeholder="Ex: Truly Nolen Teresina"
                    value={strategy.empresa_nome}
                    onChange={(e) => setStrategy(prev => ({ ...prev, empresa_nome: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Negócio</Label>
                  <Select 
                    value={strategy.tipo_negocio} 
                    onValueChange={(v) => setStrategy(prev => ({ ...prev, tipo_negocio: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_NEGOCIO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Região de Atuação</Label>
                <Input
                  placeholder="Ex: Teresina - Piauí - Brasil"
                  value={strategy.regiao_atuacao}
                  onChange={(e) => setStrategy(prev => ({ ...prev, regiao_atuacao: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Audience Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Público-Alvo
                    <Badge variant="outline">Opcional</Badge>
                  </CardTitle>
                  <CardDescription>
                    Cliente ideal. A IA usa para criar conteúdo relevante.
                  </CardDescription>
                </div>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                Se você não souber, deixe em branco. A IA usará um público genérico.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Público</Label>
                  <Select 
                    value={strategy.tipo_publico} 
                    onValueChange={(v) => setStrategy(prev => ({ ...prev, tipo_publico: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_PUBLICO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nível de Consciência</Label>
                  <Select 
                    value={strategy.nivel_consciencia} 
                    onValueChange={(v) => setStrategy(prev => ({ ...prev, nivel_consciencia: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {NIVEL_CONSCIENCIA_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nível de Conhecimento</Label>
                  <Select 
                    value={strategy.nivel_conhecimento} 
                    onValueChange={(v) => setStrategy(prev => ({ ...prev, nivel_conhecimento: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {NIVEL_CONHECIMENTO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dor Principal</Label>
                <Textarea
                  placeholder="Ex: Infestação de pragas dentro de casa ou no negócio, trazendo risco à saúde..."
                  value={strategy.dor_principal}
                  onChange={(e) => setStrategy(prev => ({ ...prev, dor_principal: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Desejo Principal</Label>
                <Textarea
                  placeholder="Ex: Eliminar as pragas de forma definitiva, segura e profissional..."
                  value={strategy.desejo_principal}
                  onChange={(e) => setStrategy(prev => ({ ...prev, desejo_principal: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Offer Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Oferta
                    <Badge variant="outline">Opcional</Badge>
                  </CardTitle>
                  <CardDescription>
                    O que você vende e por que é a melhor escolha.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>O que você oferece</Label>
                <Textarea
                  placeholder="Ex: Serviços de controle de pragas residencial e comercial..."
                  value={strategy.o_que_oferece}
                  onChange={(e) => setStrategy(prev => ({ ...prev, o_que_oferece: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                <Label>Principais Benefícios</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Garantia de 90 dias"
                    value={newBeneficio}
                    onChange={(e) => setNewBeneficio(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBeneficio())}
                  />
                  <Button type="button" onClick={addBeneficio} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {strategy.principais_beneficios.map((b, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 py-1">
                      {b}
                      <button onClick={() => removeBeneficio(i)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Differentiators */}
              <div className="space-y-2">
                <Label>Diferenciais</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: 50 anos de experiência"
                    value={newDiferencial}
                    onChange={(e) => setNewDiferencial(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDiferencial())}
                  />
                  <Button type="button" onClick={addDiferencial} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {strategy.diferenciais.map((d, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 py-1">
                      {d}
                      <button onClick={() => removeDiferencial(i)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conversion Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Conversão
                    <Badge variant="outline">Opcional</Badge>
                  </CardTitle>
                  <CardDescription>
                    Qual ação você quer que o leitor tome após ler o artigo.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Ação Desejada</Label>
                <Input
                  placeholder="Ex: Solicitar orçamento gratuito"
                  value={strategy.acao_desejada}
                  onChange={(e) => setStrategy(prev => ({ ...prev, acao_desejada: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Canal de CTA</Label>
                <Select 
                  value={strategy.canal_cta} 
                  onValueChange={(v) => setStrategy(prev => ({ ...prev, canal_cta: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAL_CTA_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Estratégia
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Radar Tab */}
        <TabsContent value="radar">
          {blog?.id && <MarketRadarTab blogId={blog.id} />}
        </TabsContent>

        {/* Competitors Tab */}
        <TabsContent value="competitors">
          {blog?.id && <ClientCompetitorsTab blogId={blog.id} />}
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities">
          {blog?.id && <ClientOpportunitiesTab blogId={blog.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}