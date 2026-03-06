import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, Eye, Edit, CheckCircle, XCircle, Loader2, Clock, AlertTriangle, RefreshCw, Search, FileText, Image, Brain } from "lucide-react";
import { toast } from "sonner";
import { useIsSubAccount } from "@/hooks/useIsSubAccount";
import { cn } from "@/lib/utils";

// ============================================================
// SAFE PROJECTIONS — subaccounts get ONLY public fields
// ============================================================
const JOB_SELECT_FULL = '*';
const JOB_SELECT_SAFE = 'id, status, seo_score, started_at, completed_at, article_id, input, blog_id, needs_review, created_at, public_stage, public_progress, public_message, public_updated_at';
const STEPS_SELECT_FULL = 'step_name, status, latency_ms, cost_usd, started_at, completed_at, output';

// ============================================================
// INTERNAL PIPELINE (admin only) — these identifiers NEVER reach client
// ============================================================
const STEP_LABELS: Record<string, string> = {
  'INPUT_VALIDATION': '✅ Validando entrada',
  'SERP_ANALYSIS': '🔍 Analisando SERP',
  'SERP_SUMMARY': '🔍 Analisando mercado',
  'SERP_GAP_ANALYSIS': '🔍 Lacunas semânticas',
  'OUTLINE_GEN': '📐 Estrutura',
  'AUTO_SECTION_EXPANSION': '📐 Expandindo seções',
  'ENTITY_EXTRACTION': '🏷️ Entidades',
  'ENTITY_COVERAGE': '🏷️ Cobertura',
  'CONTENT_GEN': '📝 Gerando conteúdo',
  'ARTICLE_GEN_SINGLE_PASS': '📝 Gerando artigo completo',
  'SAVE_ARTICLE': '💾 Salvando artigo',
  'IMAGE_GEN': '🖼️ Imagens (hero + seções)',
  'IMAGE_GEN_ASYNC': '🖼️ Gerando imagem contextual',
  'SEO_SCORE': '📊 Score SEO',
  'QUALITY_GATE': '✅ Quality gate',
};
const ORDERED_STEPS = ['INPUT_VALIDATION','SERP_ANALYSIS','SERP_GAP_ANALYSIS','OUTLINE_GEN','AUTO_SECTION_EXPANSION','ENTITY_EXTRACTION','ENTITY_COVERAGE','CONTENT_GEN','SAVE_ARTICLE','IMAGE_GEN','SEO_SCORE','QUALITY_GATE'] as const;

const SEO_METRICS = ['topic_coverage','entity_coverage','intent_match','depth_score','eeat_signals','structure','readability'];
const SEO_LABELS: Record<string,string> = { topic_coverage:'Cobertura', entity_coverage:'Entidades', intent_match:'Intenção', depth_score:'Profundidade', eeat_signals:'E-E-A-T', structure:'Estrutura', readability:'Legibilidade' };

// ============================================================
// CLIENT PIPELINE — 4 stages driven ENTIRELY by public_stage field
// ============================================================
const CLIENT_STAGES = [
  { key: 'ANALYZING_MARKET', label: 'Analisando mercado', icon: Search },
  { key: 'WRITING_CONTENT', label: 'Criando conteúdo', icon: FileText },
  { key: 'FINALIZING', label: 'Finalizando artigo', icon: Brain },
] as const;

const CLIENT_STAGE_ORDER: Record<string, number> = {
  'ANALYZING_MARKET': 0,
  'WRITING_CONTENT': 1,
  'FINALIZING': 2,
};

// ============================================================
// CLIENT-FRIENDLY STATUS MESSAGES
// ============================================================
const CLIENT_STATUS_MSG: Record<string, { label: string; sub: string }> = {
  pending: { label: 'Iniciando geração do artigo...', sub: 'Aguarde um momento.' },
  running: { label: 'A IA está criando seu conteúdo.', sub: 'Acompanhe o progresso abaixo.' },
  completed: { label: 'Artigo pronto!', sub: 'Seu conteúdo foi gerado com sucesso.' },
  failed: { label: 'Ocorreu um problema.', sub: 'Tente novamente.' },
};

const ZOMBIE_THRESHOLD_MS = 10 * 60 * 1000;

// ============================================================
// CLIENT PIPELINE VIEW — uses ONLY public_stage from DB, zero internal leaks
// ============================================================
function ClientPipelineView({ publicStage, publicProgress, publicMessage, jobStatus }: {
  publicStage: string | null;
  publicProgress: number;
  publicMessage: string | null;
  jobStatus: string;
}) {
  const currentIdx = publicStage ? (CLIENT_STAGE_ORDER[publicStage] ?? -1) : -1;

  const getStageStatus = (stageKey: string) => {
    const stageIdx = CLIENT_STAGE_ORDER[stageKey] ?? -1;
    if (jobStatus === 'completed') return 'completed';
    if (jobStatus === 'failed') {
      if (stageIdx <= currentIdx) return stageIdx === currentIdx ? 'failed' : 'completed';
      return 'pending';
    }
    if (stageIdx < currentIdx) return 'completed';
    if (stageIdx === currentIdx) return 'running';
    return 'pending';
  };

  return (
    <div className="border rounded-lg p-4 bg-card space-y-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">Progresso</span>
        <span className="text-sm text-muted-foreground">{Math.round(publicProgress)}%</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full transition-all duration-700 ease-out"
          style={{ width: `${publicProgress}%` }}
        />
      </div>

      {publicMessage && (
        <p className="text-sm text-muted-foreground italic">{publicMessage}</p>
      )}

      <div className="space-y-2 pt-2">
        {CLIENT_STAGES.map((stage, idx) => {
          const status = getStageStatus(stage.key);
          const Icon = stage.icon;
          return (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                status === 'completed' && "bg-green-500/10",
                status === 'running' && "bg-primary/10 border border-primary/30",
                status === 'failed' && "bg-destructive/10",
                status === 'pending' && "opacity-50"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center",
                status === 'completed' && "bg-green-500 text-white",
                status === 'running' && "bg-primary text-primary-foreground",
                status === 'failed' && "bg-destructive text-destructive-foreground",
                status === 'pending' && "bg-muted text-muted-foreground"
              )}>
                {status === 'completed' ? <CheckCircle className="h-4 w-4" /> :
                 status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                 status === 'failed' ? <XCircle className="h-4 w-4" /> :
                 <Icon className="h-4 w-4" />}
              </div>
              <span className={cn(
                "text-sm font-medium",
                status === 'completed' && "text-green-600 dark:text-green-400",
                status === 'running' && "text-foreground",
                status === 'failed' && "text-destructive",
                status === 'pending' && "text-muted-foreground"
              )}>
                {stage.label}
              </span>
              <div className="ml-auto text-xs font-medium">
                {status === 'completed' && <span className="text-green-600 dark:text-green-400">✓ Concluído</span>}
                {status === 'running' && <span className="text-primary animate-pulse">Em andamento...</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// INTERNAL PIPELINE VIEW (admin/owner)
// ============================================================
function InternalPipelineView({ steps, job }: { steps: any[]; job: any }) {
  const completedStepNames = new Set(steps.filter(s => s.status === 'completed').map(s => s.step_name));
  const failedStepNames = new Set(steps.filter(s => s.status === 'failed').map(s => s.step_name));

  return (
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
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function GenerationDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { isSubAccount, loading: roleLoading } = useIsSubAccount();
  const [job, setJob] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isZombie, setIsZombie] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Perceived progress for clients (smooth animation driven by public_progress)
  const [perceivedProgress, setPerceivedProgress] = useState(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isClient = isSubAccount;
  const jobSelect = isClient ? JOB_SELECT_SAFE : JOB_SELECT_FULL;

  // Data loading + realtime
  useEffect(() => {
    if (!jobId || roleLoading) return;

    const load = async () => {
      // Client: query ONLY generation_jobs with safe projection. NO generation_steps query.
      // Admin: query both generation_jobs (full) and generation_steps (full).
      if (isClient) {
        const jobRes = await supabase.from('generation_jobs').select(jobSelect).eq('id', jobId).single();
        setJob(jobRes.data);
      } else {
        const [jobRes, stepsRes] = await Promise.all([
          supabase.from('generation_jobs').select(jobSelect).eq('id', jobId).single(),
          supabase.from('generation_steps').select(STEPS_SELECT_FULL).eq('job_id', jobId).order('started_at', { ascending: true }),
        ]);
        setJob(jobRes.data);
        setSteps(stepsRes.data || []);
      }
      setLoading(false);
    };
    load();

    // Realtime: client subscribes ONLY to generation_jobs (safe fields via public_*)
    // Admin subscribes to both generation_jobs + generation_steps
    const channel = supabase.channel(`gen-job-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generation_jobs', filter: `id=eq.${jobId}` }, (p) => {
        const newJob = p.new as any;
        if (isClient) {
          // Strip any internal fields that might leak via realtime payload
          const safeJob = {
            id: newJob.id, status: newJob.status, seo_score: newJob.seo_score,
            started_at: newJob.started_at, completed_at: newJob.completed_at,
            article_id: newJob.article_id, input: newJob.input, blog_id: newJob.blog_id,
            needs_review: newJob.needs_review, created_at: newJob.created_at,
            public_stage: newJob.public_stage, public_progress: newJob.public_progress,
            public_message: newJob.public_message, public_updated_at: newJob.public_updated_at,
          };
          setJob(safeJob);
        } else {
          setJob(newJob);
        }
      });

    // Admin only: subscribe to generation_steps for internal pipeline view
    if (!isClient) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'generation_steps', filter: `job_id=eq.${jobId}` }, () => {
        supabase.from('generation_steps').select(STEPS_SELECT_FULL).eq('job_id', jobId).order('started_at', { ascending: true }).then(r => setSteps(r.data || []));
      });
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId, roleLoading, isClient, jobSelect]);

  // Zombie detection
  useEffect(() => {
    if (!job || job.status !== 'running') { setIsZombie(false); return; }
    const createdAt = new Date(job.created_at).getTime();
    if (Date.now() - createdAt > ZOMBIE_THRESHOLD_MS) {
      setIsZombie(true);
    } else {
      const timeout = setTimeout(() => setIsZombie(true), ZOMBIE_THRESHOLD_MS - (Date.now() - createdAt));
      return () => clearTimeout(timeout);
    }
  }, [job?.status, job?.created_at]);

  // Real progress calculation (admin only, from steps)
  const realProgress = useMemo(() => {
    if (!steps || steps.length === 0) return 0;
    const completed = steps.filter(s => s.status === 'completed').length;
    const total = Math.max(steps.length, ORDERED_STEPS.length);
    return Math.round((completed / total) * 100);
  }, [steps]);

  // Perceived progress for clients: driven by public_progress from DB + smooth animation
  useEffect(() => {
    if (!job) return;

    if (job.status === 'completed') {
      setPerceivedProgress(100);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }
    if (job.status === 'failed') {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }

    // For clients: use public_progress from DB as the target
    const dbProgress = job.public_progress || 0;
    if (dbProgress > perceivedProgress) {
      setPerceivedProgress(dbProgress);
    }

    // Auto-advance perceived progress slowly when running (cap at 95%)
    if (job.status === 'running' || job.status === 'pending') {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = setInterval(() => {
        setPerceivedProgress(prev => {
          const target = isClient ? Math.max(dbProgress + 5, 10) : Math.max(realProgress + 15, 30);
          const cap = Math.min(target, 95);
          if (prev >= cap) return prev;
          return prev + 0.5;
        });
      }, 1000);
    }

    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); };
  }, [job?.status, job?.public_progress, realProgress, isClient]);

  // Auto-redirect to editor when job completes
  useEffect(() => {
    if (!job) return;
    if (job.status === 'completed' && job.article_id) {
      const timer = setTimeout(() => {
        navigate(`/client/articles/${job.article_id}/edit`, { replace: true });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [job?.status, job?.article_id, navigate]);

  // Auto-recovery for stalled pending jobs
  useEffect(() => {
    if (!job || !jobId) return;
    if (job.status !== 'pending') return;

    const timer = setTimeout(() => {
      if (job.status === 'pending') {
        console.log('[ENGINE:RECOVERY_TRIGGERED] job still pending after 30s');
        handleRetry();
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [job?.status, jobId]);

  const handleRetry = async () => {
    if (!job?.input || !jobId) return;
    setRetrying(true);
    try {
      const input = job.input as Record<string, any>;
      const { data, error } = await supabase.functions.invoke('create-generation-job', {
        body: {
          keyword: input.keyword, blog_id: job.blog_id,
          city: input.city || '', niche: input.niche || '',
          country: input.country || 'BR', language: input.language || 'pt-BR',
          job_type: input.job_type || 'article', intent: input.intent || 'informational',
          target_words: input.target_words || 2500, image_count: input.image_count || 4,
          brand_voice: input.brand_voice, business: input.business,
        },
      });
      if (error) throw error;
      if (data?.job_id) {
        toast.success(isClient ? 'Gerando novamente...' : 'Novo job criado!');
        navigate(`/client/articles/engine/${data.job_id}`, { replace: true });
      }
    } catch (e: any) {
      toast.error(isClient ? 'Não foi possível iniciar. Tente novamente.' : (e.message || 'Erro ao recriar job'));
    } finally {
      setRetrying(false);
    }
  };

  if (loading || roleLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!job) return <div className="text-center py-12 text-muted-foreground">Job não encontrado</div>;

  const input = job.input as Record<string, any> || {};
  const statusMsg = CLIENT_STATUS_MSG[job.status] || CLIENT_STATUS_MSG.running;

  // ============================================================
  // CLIENT RENDER — zero internal pipeline, zero cost, zero tech
  // ============================================================
  if (isClient) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/client/articles/engine')}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>

        {/* Header — client safe */}
        <div className="border rounded-lg p-6 bg-card">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">"{input.keyword || '—'}"</h1>
              <p className="text-sm text-muted-foreground">{input.city || ''} {input.niche ? `• ${input.niche}` : ''}</p>
            </div>
            <Badge className={job.status === 'completed' ? 'bg-green-500/20 text-green-700' : job.status === 'failed' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}>
              {(job.status === 'running' || job.status === 'pending') && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {statusMsg.label}
            </Badge>
          </div>

          {/* Client sees only SEO score (when available) */}
          {job.status === 'completed' && job.seo_score && (
            <div className="mt-4">
              <span className="text-sm text-muted-foreground">Score SEO</span>
              <p className="font-bold text-lg">{job.seo_score}/100</p>
            </div>
          )}

          {/* Status message */}
          <p className="text-sm text-muted-foreground mt-3">{job.public_message || statusMsg.sub}</p>
        </div>

        {/* Client pipeline — driven entirely by public_stage from DB */}
        {(job.status === 'running' || job.status === 'pending') && (
          <ClientPipelineView
            publicStage={job.public_stage}
            publicProgress={perceivedProgress}
            publicMessage={job.public_message}
            jobStatus={job.status}
          />
        )}

        {/* Zombie — simplified */}
        {isZombie && job.status === 'running' && (
          <div className="border rounded-lg p-4 bg-yellow-500/10 border-yellow-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
              <span className="text-sm text-yellow-700">Processando artigo... isso pode levar alguns minutos.</span>
            </div>
          </div>
        )}

        {/* Failed — generic message, no technical details */}
        {job.status === 'failed' && (
          <div className="border rounded-lg p-4 bg-destructive/10 border-destructive/30 text-center space-y-3">
            <XCircle className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive font-medium">Ocorreu um problema ao gerar o artigo.</p>
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Completion state — redirecting */}
        {job.status === 'completed' && job.article_id && (
          <div className="border rounded-lg p-4 bg-green-500/10 border-green-500/30 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
            <p className="text-sm font-medium text-green-700">Artigo pronto! Redirecionando para o editor...</p>
            <Loader2 className="w-4 h-4 animate-spin mx-auto text-green-600" />
          </div>
        )}

        {/* Actions — client */}
        <div className="flex gap-2 flex-wrap">
          {job.status === 'completed' && (
            <>
              {job.article_id && <Button onClick={() => navigate(`/client/articles/${job.article_id}/preview`)}><Eye className="w-4 h-4 mr-1" />Ver Artigo</Button>}
              {job.article_id && <Button variant="outline" onClick={() => navigate(`/client/articles/${job.article_id}/edit`)}><Edit className="w-4 h-4 mr-1" />Editar</Button>}
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // INTERNAL/ADMIN RENDER
  // ============================================================
  const seoBreakdown = (job.seo_breakdown as Record<string, any>) || {};
  const elapsed = job.completed_at && job.started_at ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000) : null;
  const completedCount = steps.filter(s => s.status === 'completed').length;

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

      {/* Header — full */}
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
          <div><span className="text-muted-foreground">API Calls</span><p className="font-bold">{job.total_api_calls || 0}/5</p></div>
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
            <span className="text-sm text-muted-foreground">{completedCount}/{ORDERED_STEPS.length} steps • {realProgress}%</span>
          </div>
          <Progress value={realProgress} className="h-2" />
          {job.status === 'pending' && <p className="text-xs text-muted-foreground mt-2">Iniciando pipeline...</p>}
        </div>
      )}

      {/* Internal Pipeline */}
      <InternalPipelineView steps={steps} job={job} />

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

      {/* Error message — full technical */}
      {job.status === 'failed' && job.error_message && (
        <div className="border rounded-lg p-4 bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-700">Erro na geração</span>
          </div>
          <p className="text-sm text-red-600">{job.error_message}</p>
        </div>
      )}

      {/* Completion state — admin redirecting */}
      {job.status === 'completed' && job.article_id && (
        <div className="border rounded-lg p-4 bg-green-500/10 border-green-500/30 text-center space-y-2">
          <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
          <p className="text-sm font-medium text-green-700">Artigo pronto! Redirecionando para o editor...</p>
          <Loader2 className="w-4 h-4 animate-spin mx-auto text-green-600" />
        </div>
      )}

      {/* Actions — full */}
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
