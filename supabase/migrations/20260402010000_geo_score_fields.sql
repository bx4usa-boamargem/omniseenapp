-- Migration: GEO Score fields on articles table
-- Adds 5-criteria programmatic GEO readiness score (no AI cost)
-- score: 0-100 | label: poor/needs_work/good/excellent | breakdown: JSONB with 5 boolean criteria

alter table articles add column if not exists geo_score smallint default null;
alter table articles add column if not exists geo_score_label text default null;
alter table articles add column if not exists geo_score_breakdown jsonb default null;
alter table articles add column if not exists geo_score_passed boolean default null;
alter table articles add column if not exists geo_score_calculated_at timestamptz default null;

-- Esta linha remove e recria a checagem com segurança, sem brigar com o código acima
alter table articles drop constraint if exists geo_score_label_check;
alter table articles add constraint geo_score_label_check check (geo_score_label in ('poor','needs_work','good','excellent'));

-- Index for filtering/ordering by GEO score in dashboards
create index if not exists idx_articles_geo_score
  on articles (geo_score desc);

-- Comment for documentation
comment on column articles.geo_score is
  '0-100. 5 criteria × 20pts each: city_in_title, faq_present (≥3), citation_blocks, entity_density (≥5), word_count_ok (≥800)';
comment on column articles.geo_score_breakdown is
  'JSONB: { city_in_title, faq_present, citation_blocks, entity_density, word_count_ok }';
