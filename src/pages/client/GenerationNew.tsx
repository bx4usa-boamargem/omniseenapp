import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantContext } from "@/contexts/TenantContext";
import { useBlog } from "@/hooks/useBlog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { listNiches } from "@/lib/article-engine/niches";

const COUNTRIES = [
  { value: 'BR', label: '🇧🇷 Brasil', lang: 'pt-BR' },
  { value: 'US', label: '🇺🇸 Estados Unidos', lang: 'en-US' },
  { value: 'AR', label: '🇦🇷 Argentina', lang: 'es-AR' },
];

export default function GenerationNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenantContext();
  const { blog } = useBlog();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState({
    keyword: '', city: '', state: '', niche: '',
    intent: 'auto', target_words: '2500',
    tone: 'profissional', person: 'nós',
    business_name: '', phone: '', whatsapp: '', website: '', avoid: '',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Validation
  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    const trimmedKeyword = form.keyword?.trim() || '';
    const trimmedNiche = form.niche?.trim() || '';
    const trimmedCity = form.city?.trim() || '';
    const tw = parseInt(form.target_words);

    if (trimmedKeyword.length < 2) errors.push('Keyword deve ter pelo menos 2 caracteres');
    if (trimmedNiche.length < 2) errors.push('Nicho é obrigatório');
    if (trimmedCity && trimmedCity.length < 2) errors.push('Cidade inválida');
    if (tw && (tw < 1500 || tw > 4000)) errors.push('Palavras alvo: entre 1500 e 4000');

    return errors;
  };

  const validationErrors = getValidationErrors();
  const isValid = validationErrors.length === 0;

  const handleSubmit = async () => {
    if (!isValid) {
      validationErrors.forEach(e => toast.error(e));
      return;
    }
    if (!blog?.id) { toast.error('Blog não encontrado'); return; }

    const trimmedKeyword = form.keyword.trim();
    const blogId = blog.id;

    // Anti-duplication: check for existing pending/running jobs with same keyword
    try {
      const { data: existingJobs } = await supabase
        .from('generation_jobs')
        .select('id, status, input')
        .eq('blog_id', blogId)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false });

      const normalizedKeyword = trimmedKeyword.toLowerCase();
      const duplicate = existingJobs?.find(job => {
        const jobInput = job.input as Record<string, any> | null;
        const jobKeyword = (jobInput?.keyword || '').trim().toLowerCase();
        return jobKeyword === normalizedKeyword;
      });

      if (duplicate) {
        toast.info('Já existe uma geração em andamento para esta keyword.');
        navigate(`/client/articles/engine/${duplicate.id}`);
        return;
      }
    } catch (e) {
      console.warn('[FRONT:ANTI_DUP] Error checking duplicates, proceeding', e);
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        keyword: trimmedKeyword,
        blog_id: blogId,
        city: form.city.trim(),
        state: form.state.trim() || undefined,
        country: 'BR',
        language: 'pt-BR',
        niche: form.niche.trim(),
        job_type: 'article',
        intent: form.intent === 'auto' ? 'informational' : form.intent,
        target_words: parseInt(form.target_words),
        image_count: 4,
        brand_voice: { tone: form.tone, person: form.person, avoid: form.avoid ? form.avoid.split(',').map(s => s.trim()) : [] },
      };
      if (form.business_name) {
        payload.business = { name: form.business_name, phone: form.phone || undefined, whatsapp: form.whatsapp || undefined, website: form.website || undefined };
      }

      const { data, error } = await supabase.functions.invoke('create-generation-job', { body: payload });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('MAX_CONCURRENT_JOBS') || msg.includes('429')) {
          toast.warning('Você já tem artigos em geração. Aguarde a conclusão.');
        } else if (msg.includes('402')) {
          toast.warning('Créditos insuficientes. Atualize seu plano.');
        } else if (msg.includes('400') || msg.includes('VALIDATION')) {
          toast.error(msg || 'Dados inválidos. Verifique os campos.');
        } else {
          toast.error('Erro ao criar artigo. Tente novamente.');
          console.error(`[FRONT:JOB_ERROR]`, error);
        }
        return;
      }

      if (data?.job_id) {
        console.log(`[FRONT:JOB_CREATED] job=${data.job_id} keyword="${trimmedKeyword}"`);
        toast.success('Job criado! Acompanhe o progresso.');
        navigate(`/client/articles/engine/${data.job_id}`);
      } else {
        toast.error(data?.error || 'Erro desconhecido');
      }
    } catch (e: any) {
      toast.error('Erro ao criar artigo. Tente novamente.');
      console.error(`[FRONT:JOB_ERROR]`, e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/client/articles/engine')}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Criar Novo Artigo</h1>
        <p className="text-muted-foreground">Seu artigo será gerado automaticamente pela IA</p>
      </div>

      <div className="border rounded-lg p-6 bg-card space-y-4">
        <div className="space-y-2">
          <Label>Palavra-chave principal *</Label>
          <Input placeholder="ex: como prevenir baratas em apartamento" value={form.keyword} onChange={e => set('keyword', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input placeholder="ex: São Paulo" value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input placeholder="ex: SP" value={form.state} onChange={e => set('state', e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nicho *</Label>
          <Input placeholder="ex: controle de pragas, encanamento, advocacia" value={form.niche} onChange={e => set('niche', e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Intenção</Label>
            <Select value={form.intent} onValueChange={v => set('intent', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="informational">Informacional</SelectItem>
                <SelectItem value="service">Serviço</SelectItem>
                <SelectItem value="transactional">Conversão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Palavras-alvo</Label>
            <Select value={form.target_words} onValueChange={v => set('target_words', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1500">1.500</SelectItem>
                <SelectItem value="2000">2.000</SelectItem>
                <SelectItem value="2500">2.500</SelectItem>
                <SelectItem value="3000">3.000</SelectItem>
                <SelectItem value="4000">4.000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tom</Label>
            <Select value={form.tone} onValueChange={v => set('tone', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="informal">Informal</SelectItem>
                <SelectItem value="técnico">Técnico</SelectItem>
                <SelectItem value="amigável">Amigável</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced */}
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Configurações avançadas
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome da empresa</Label><Input placeholder="ex: DedetPro" value={form.business_name} onChange={e => set('business_name', e.target.value)} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input placeholder="(11) 99999-9999" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>WhatsApp</Label><Input placeholder="5511999999999" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} /></div>
              <div className="space-y-2"><Label>Website</Label><Input placeholder="https://..." value={form.website} onChange={e => set('website', e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Palavras a evitar (separar por vírgula)</Label><Input placeholder="ex: barato, grátis" value={form.avoid} onChange={e => set('avoid', e.target.value)} /></div>
          </div>
        )}

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={loading || !isValid}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando job...</> : '🚀 Gerar Artigo'}
        </Button>

        {validationErrors.length > 0 && form.keyword.length > 0 && (
          <div className="text-sm text-destructive space-y-1">
            {validationErrors.map((e, i) => <p key={i}>• {e}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
