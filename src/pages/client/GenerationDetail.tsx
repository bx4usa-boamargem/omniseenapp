import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, Eye, Edit, CheckCircle, XCircle, Loader2, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useIsSubAccount } from "@/hooks/useIsSubAccount";

// Safe projections - subaccounts get minimal fields only
const JOB_SELECT_FULL = '*';
const JOB_SELECT_SAFE = 'id, status, seo_score, started_at, completed_at, current_step, article_id, input, blog_id, needs_review, error_message, created_at';
const STEPS_SELECT_FULL = 'step_name, status, latency_ms, cost_usd, started_at, completed_at, output';
const STEPS_SELECT_SAFE = 'step_name, status';

const STEP_LABELS: Record<string, string> = {
  'INPUT_VALIDATION': '✅ Validando entrada',
  'SERP_ANALYSIS': '🔍 Analisando SERP',
  'NLP_KEYWORDS': '📊 Extraindo keywords',
  'TITLE_GEN': '✏️ Gerando título',
  'OUTLINE_GEN': '📋 Criando outline',
  'CONTENT_GEN': '📝 Escrevendo conteúdo',
  'IMAGE_GEN': '🖼️ Gerando imagens',
  'SEO_SCORE': '📈 Pontuando SEO',
  'META_GEN': '🏷️ Gerando meta tags',
  'OUTPUT': '📦 Montando HTML',
};

const ORDERED_STEPS = ['INPUT_VALIDATION','SERP_ANALYSIS','NLP_KEYWORDS','TITLE_GEN','OUTLINE_GEN','CONTENT_GEN','IMAGE_GEN','SEO_SCORE','META_GEN','OUTPUT'] as const;

const SEO_METRICS = ['topic_coverage','entity_coverage','intent_match','depth_score','eeat_signals','structure','readability'];
const SEO_LABELS: Record<string,string> = { topic_coverage:'Cobertura', entity_coverage:'Entidades', intent_match:'Intenção', depth_score:'Profundidade', eeat_signals:'E-E-A-T', structure:'Estrutura', readability:'Legibilidade' };

const ZOMBIE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export default function GenerationDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { isSubAccount, loading: roleLoading } = useIsSubAccount();
  const [job, setJob] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isZombie, setIsZombie] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Determine safe projections based on role
  const isClient = isSubAccount;
  const jobSelect = isClient ? JOB_SELECT_SAFE : JOB_SELECT_FULL;
  const stepsSelect = isClient ? STEPS_SELECT_SAFE : STEPS_SELECT_FULL;

  useEffect(() => {
    if (!jobId || roleLoading) return;

    console.log(`[FRONT:DETAIL_LOADED] job=${jobId} mode=${isClient ? 'client' : 'internal'}`);

    const load = async () => {
      const [jobRes, stepsRes] = await Promise.all([
        supabase.from('generation_jobs').select(jobSelect).eq('id', jobId).single(),
        supabase.from('generation_steps').select(stepsSelect).eq('job_id', jobId).order('started_at', { ascending: true }),
      ]);
      setJob(jobRes.data);
      setSteps(stepsRes.data || []);
      setLoading(false);
    };
    load();

    const channel = supabase.channel(`gen-job-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generation_jobs', filter: `id=eq.${jobId}` }, (p) => {
        const newJob = p.new as any;
        // For subaccounts, strip sensitive fields from realtime payloads
        if (isClient) {
          delete newJob?.cost_usd;
          delete newJob?.total_api_calls;
          delete newJob?.seo_breakdown;
          delete newJob?.output;
        }
        setJob(newJob);
        console.log(`[FRONT:JOB_UPDATE] job=${jobId} status=${newJob?.status} step=${newJob?.current_step}`);

        if (newJob?.status === 'completed') {
          console.log(`[FRONT:JOB_COMPLETED] job=${jobId} article=${newJob?.article_id} seo=${newJob?.seo_score}`);
        } else if (newJob?.status === 'failed') {
          if (!isClient) {
            console.error(`[FRONT:JOB_FAILED] job=${jobId} error="${newJob?.error_message}"`);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generation_steps', filter: `job_id=eq.${jobId}` }, () => {
        supabase.from('generation_steps').select(stepsSelect).eq('job_id', jobId).order('started_at', { ascending: true }).then(r => setSteps(r.data || []));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId, roleLoading, isClient, jobSelect, stepsSelect]);

  // Zombie detection
  useEffect(() => {
    if (!job || job.status !== 'running') {
      setIsZombie(false);
      return;
    }
    const createdAt = new Date(job.created_at).getTime();
    if (Date.now() - createdAt > ZOMBIE_THRESHOLD_MS) {
      setIsZombie(true);
    } else {
      const timeout = setTimeout(() => setIsZombie(true), ZOMBIE_THRESHOLD_MS - (Date.now() - createdAt));
      return () => clearTimeout(timeout);
    }
  }, [job?.status, job?.created_at]);

  // Dynamic progress calculation
  const { progress, completedCount, totalCount } = useMemo(() => {
    if (!steps || steps.length === 0) return { progress: 0, completedCount: 0, totalCount: ORDERED_STEPS.length };
    const completed = steps.filter(s => s.status === 'completed').length;
    const total = Math.max(steps.length, ORDERED_STEPS.length);
    return { progress: Math.round((completed / total) * 100), completedCount: completed, totalCount: total };
  }, [steps]);

  const handleRetry = async () => {
    if (!job?.input || !jobId) return;
    setRetrying(true);
    try {
      const input = job.input as Record<string, any>;
      const { data, error } = await supabase.functions.invoke('create-generation-job', {
        body: {
          keyword: input.keyword,
          blog_id: job.blog_id,
          city: input.city || '',
          niche: input.niche || '',
          country: input.country || 'BR',
          language: input.language || 'pt-BR',
          job_type: input.job_type || 'article',
          intent: input.intent || 'informational',
          target_words: input.target_words || 2500,
          image_count: input.image_count || 4,
          brand_voice: input.brand_voice,
          business: input.business,
        },
      });
      if (error) throw error;
      if (data?.job_id) {
        console.log(`[FRONT:JOB_RETRY] old=${jobId} new=${data.job_id}`);
        toast.success('Novo job criado!');
        navigate(`/client/articles/engine/${data.job_id}`, { replace: true });
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao recriar job');
    } finally {
      setRetrying(false);
    }
  };

  if (loading || roleLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!job) return <div className="text-center py-12 text-muted-foreground">Job não encontrado</div>;

  const input = job.input as Record<string, any> || {};
  const completedStepNames = new Set(steps.filter(s => s.status === 'completed').map(s => s.step_name));
  const failedStepNames = new Set(steps.filter(s => s.status === 'failed').map(s => s.step_name));
  const seoBreakdown = (job.seo_breakdown as Record<string, any>) || {};
  const elapsed = job.completed_at && job.started_at ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000) : null;

  const downloadHtml = () => {
    const output = job.output as Record<string, any>;
    const outputStep = output?.OUTPUT as Record<string, any>;
    const html = output?.html_structured || outputStep?.html_structured || '<p>HTML não disponível</p>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${input.keyword || 'artigo'}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/client/articles/engine')}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>

      {/* Header */}
      <div className="border rounded-lg p-6 bg-card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground mb-1">"{input.keyword || '—'}"</h1>
            <p className="text-sm text-muted-foreground">{input.city || ''} {input.niche ? `• ${input.niche}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {job.needs_review && <Badge className="bg-yellow-500/20 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" />Revisão</Badge>}
            <Badge className={job.status === 'completed' ? 'bg-green-500/20 text-green-700' : job.status === 'failed' ? 'bg-red-500/20 text-red-700' : job.status === 'pending' ? 'bg-muted text-muted-foreground' : 'bg-blue-500/20 text-blue-700'}>
              {job.status === 'running' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              {job.status}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
          <div><span className="text-muted-foreground">SEO Score</span><p className="font-bold text-lg">{job.seo_score ?? '—'}/100</p></div>
          <div><span className="text-muted-foreground">Tempo</span><p className="font-bold">{elapsed ? `${Math.floor(elapsed/60)}m ${elapsed%60}s` : '—'}</p></div>
          <div><span className="text-muted-foreground">API Calls</span><p className="font-bold">{job.total_api_calls || 0}/15</p></div>
          <div><span className="text-muted-foreground">Custo</span><p className="font-bold">${(job.cost_usd || 0).toFixed(4)}</p></div>
        </div>
      </div>

      {/* Zombie warning */}
      {isZombie && job.status === 'running' && (
        <div className="border rounded-lg p-4 bg-yellow-500/10 border-yellow-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-yellow-700">Esta geração está demorando mais que o esperado.</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
            {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Progress bar */}
      {(job.status === 'running' || job.status === 'pending') && (
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progresso</span>
            <span className="text-sm text-muted-foreground">{completedCount}/{totalCount} steps • {progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {job.status === 'pending' && <p className="text-xs text-muted-foreground mt-2">Iniciando pipeline...</p>}
        </div>
      )}

      {/* Pipeline Steps */}
      <div className="border rounded-lg p-4 bg-card">
        <h3 className="font-semibold mb-3 text-foreground">Pipeline</h3>
        <div className="space-y-1">
          {ORDERED_STEPS.map(s => {
            const stepData = steps.find(st => st.step_name === s);
            const done = completedStepNames.has(s);
            const failed = failedStepNames.has(s);
            const running = job.current_step === s && job.status === 'running';
            const modelUsed = stepData?.output?.model_used || stepData?.output?.model;
            const duration = stepData?.latency_ms ? `${(stepData.latency_ms / 1000).toFixed(1)}s` : null;

            return (
              <div key={s} className={`flex items-center justify-between px-3 py-2 rounded text-sm ${done ? 'bg-green-100 text-green-700' : failed ? 'bg-red-100 text-red-700' : running ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                <div className="flex items-center gap-2">
                  {done ? <CheckCircle className="w-4 h-4" /> : failed ? <XCircle className="w-4 h-4" /> : running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  <span className="font-medium">{STEP_LABELS[s] || s}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {modelUsed && <span className="opacity-70">{modelUsed}</span>}
                  {duration && <span className="opacity-70">{duration}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEO Breakdown */}
      {Object.keys(seoBreakdown).length > 0 && (
        <div className="border rounded-lg p-4 bg-card">
          <h3 className="font-semibold mb-3 text-foreground">SEO Breakdown</h3>
          <div className="space-y-2">
            {SEO_METRICS.map(m => {
              const data = seoBreakdown[m] as Record<string, any> || {};
              const score = data.score ?? 0;
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className="text-sm w-28 text-muted-foreground">{SEO_LABELS[m]}</span>
                  <Progress value={score} className="flex-1 h-2" />
                  <span className={`text-sm font-semibold w-10 text-right ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{score}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error message */}
      {job.status === 'failed' && job.error_message && (
        <div className="border rounded-lg p-4 bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-700">Erro na geração</span>
          </div>
          <p className="text-sm text-red-600">{job.error_message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {job.status === 'completed' && (
          <>
            {job.article_id && <Button onClick={() => navigate(`/client/articles/${job.article_id}/preview`)}><Eye className="w-4 h-4 mr-1" />Abrir Artigo</Button>}
            {job.article_id && <Button variant="outline" onClick={() => navigate(`/client/articles/${job.article_id}/edit`)}><Edit className="w-4 h-4 mr-1" />Editar</Button>}
            <Button variant="outline" onClick={downloadHtml}><Download className="w-4 h-4 mr-1" />Download HTML</Button>
          </>
        )}
        {(job.status === 'failed' || (job.needs_review && job.status === 'completed')) && (
          <Button variant="outline" onClick={handleRetry} disabled={retrying}>
            {retrying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Tentar Novamente
          </Button>
        )}
        {job.needs_review && job.article_id && (
          <Button variant="outline" onClick={() => navigate(`/client/articles/${job.article_id}/edit`)}><Edit className="w-4 h-4 mr-1" />Revisar Artigo</Button>
        )}
      </div>
    </div>
  );
}
