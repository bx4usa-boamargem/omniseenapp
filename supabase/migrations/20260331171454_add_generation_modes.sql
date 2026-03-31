-- Adicionar novas colunas para o motor de geração v4 (Economic vs Premium)
ALTER TABLE "public"."generation_jobs"
  ADD COLUMN IF NOT EXISTS "generation_mode" text DEFAULT 'economic'::text,
  ADD COLUMN IF NOT EXISTS "research_mode" text DEFAULT 'hybrid'::text,
  ADD COLUMN IF NOT EXISTS "rewrite_model" text DEFAULT 'gemini'::text;

-- Comentários descritivos para o esquema
COMMENT ON COLUMN "public"."generation_jobs"."generation_mode" IS 'Mode de geração (economic, premium)';
COMMENT ON COLUMN "public"."generation_jobs"."research_mode" IS 'Motor de pesquisa (google_grounding, hybrid)';
COMMENT ON COLUMN "public"."generation_jobs"."rewrite_model" IS 'Modelo usado no final para QA ou reescrita (gemini, openai, etc)';
