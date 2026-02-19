import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsSubAccount } from "@/hooks/useIsSubAccount";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

// ============================================================
// SAFE PROJECTIONS — subaccounts get ONLY public fields
// ============================================================
const JOB_SELECT_FULL = '*';
const JOB_SELECT_SAFE = 'id, status, seo_score, started_at, completed_at, article_id, input, blog_id, needs_review, created_at, public_stage, public_progress, public_message';

// ============================================================
// CLIENT-FRIENDLY STAGE LABELS (no internal identifiers)
// ============================================================
const PUBLIC_STAGE_LABELS: Record<string, string> = {
  'ANALYZING_MARKET': '🔍 Analisando mercado...',
  'WRITING_CONTENT': '📝 Criando conteúdo...',
  'PREPARING_IMAGES': '🖼️ Preparando imagens...',
  'FINALIZING': '📦 Finalizando artigo...',
};

// ============================================================
// ADMIN-ONLY STEP LABELS (never shown to subaccounts)
// ============================================================
const ADMIN_STEP_LABELS: Record<string, string> = {
  'PENDING': '⏳ Aguardando...',
  'INPUT_VALIDATION': '✅ Validando...',
  'SERP_ANALYSIS': '🔍 Analisando SERP...',
  'NLP_KEYWORDS': '📊 Keywords NLP...',
  'TITLE_GEN': '✍️ Gerando título...',
  'OUTLINE_GEN': '📋 Criando outline...',
  'CONTENT_GEN': '📝 Escrevendo conteúdo...',
  'IMAGE_GEN': '🖼️ Gerando imagens...',
  'SEO_SCORE': '📈 Pontuando SEO...',
  'META_GEN': '🏷️ Meta tags...',
  'OUTPUT': '📦 Montando HTML...',
};

function statusBadge(status: string, needsReview?: boolean) {
  if (needsReview) return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">⚠️ Revisão</Badge>;
  switch (status) {
    case 'pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    case 'running': return <Badge className="bg-blue-500/20 text-blue-700 border-blue-300 animate-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Gerando</Badge>;
    case 'completed': return <Badge className="bg-green-500/20 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Concluído</Badge>;
    case 'failed': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function GenerationDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSubAccount, loading: roleLoading } = useIsSubAccount();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isClient = isSubAccount;
  const jobSelect = isClient ? JOB_SELECT_SAFE : JOB_SELECT_FULL;

  const fetchJobs = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('generation_jobs')
      .select(jobSelect)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setJobs(data || []);
    setLoading(false);
  };

  useEffect(() => { if (!roleLoading) fetchJobs(); }, [user, roleLoading]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('gen-jobs-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generation_jobs', filter: `user_id=eq.${user.id}` }, (payload) => {
        setJobs(prev => {
          const raw = payload.new as any;
          // For clients: strip internal fields from realtime payload
          const updated = isClient ? {
            id: raw.id, status: raw.status, seo_score: raw.seo_score,
            started_at: raw.started_at, completed_at: raw.completed_at,
            article_id: raw.article_id, input: raw.input, blog_id: raw.blog_id,
            needs_review: raw.needs_review, created_at: raw.created_at,
            public_stage: raw.public_stage, public_progress: raw.public_progress,
            public_message: raw.public_message,
          } : raw;

          const idx = prev.findIndex(j => j.id === updated.id);
          if (idx >= 0) { const copy = [...prev]; copy[idx] = updated; return copy; }
          return [updated, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isClient]);

  // Page title based on role
  const pageTitle = isClient ? 'Meus Artigos' : 'Article Engine v1';
  const pageSubtitle = isClient
    ? 'Acompanhe a geração dos seus artigos'
    : 'Pipeline completo de geração com SEO Score e Quality Gates';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchJobs}><RefreshCw className="w-4 h-4 mr-1" />Atualizar</Button>
          <Button onClick={() => navigate('/client/articles/engine/new')}><Plus className="w-4 h-4 mr-1" />Novo Artigo</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground mb-4">Nenhum artigo gerado ainda</p>
          <Button onClick={() => navigate('/client/articles/engine/new')}><Plus className="w-4 h-4 mr-1" />Criar Primeiro Artigo</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{isClient ? 'Etapa' : 'Etapa Atual'}</TableHead>
              <TableHead>SEO</TableHead>
              {!isClient && <TableHead>Engine</TableHead>}
              <TableHead>Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map(job => {
              const input = job.input as Record<string, any> || {};

              // Client: show public_stage label. Admin: show internal current_step.
              const currentStepLabel = isClient
                ? (job.status === 'running' ? (PUBLIC_STAGE_LABELS[job.public_stage] || job.public_message || 'Processando...') : '—')
                : (job.status === 'running' ? (ADMIN_STEP_LABELS[job.current_step] || job.current_step) : '—');

              return (
                <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/client/articles/engine/${job.id}`)}>
                  <TableCell className="font-medium">{input.keyword || '—'}</TableCell>
                  <TableCell>{statusBadge(job.status, job.needs_review)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{currentStepLabel}</TableCell>
                  <TableCell>{job.seo_score ? <span className={`font-semibold ${job.seo_score >= 80 ? 'text-green-600' : job.seo_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{job.seo_score}/100</span> : '—'}</TableCell>
                  {!isClient && <TableCell><Badge variant="outline" className="text-xs">{job.engine_version || 'v1'}</Badge></TableCell>}
                  <TableCell className="text-sm text-muted-foreground">{new Date(job.created_at).toLocaleDateString('pt-BR')}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
