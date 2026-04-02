-- Migration: research_failed tracking on generation_jobs
-- Quando pesquisa (SERP/GEO) falha, registra motivo e política aplicada
-- Usado para: filtrar no dashboard, bloquear auto-publish em premium

alter table generation_jobs
  add column if not exists research_failed        boolean   default false,
  add column if not exists research_failed_reason text      default null,
  add column if not exists research_failed_policy text      default null;

-- Index para filtrar jobs com pesquisa falha no dashboard
create index if not exists idx_generation_jobs_research_failed
  on generation_jobs (research_failed)
  where research_failed = true;

comment on column generation_jobs.research_failed is
  'true quando SERP/GEO research falhou durante pipeline. Em modo premium, artigo fica como draft.';
comment on column generation_jobs.research_failed_policy is
  'Política aplicada: serp_only_normal | serp_only_premium_review | serp_only_auto | serp_only_preview';
