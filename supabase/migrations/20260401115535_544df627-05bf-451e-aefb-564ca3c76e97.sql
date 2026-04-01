-- Feature 2: Adicionar coluna seo_score_breakdown na tabela articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_score_breakdown JSONB;

-- Feature 4: Criar tabela para o calendário de conteúdo
CREATE TABLE IF NOT EXISTS content_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    niche TEXT NOT NULL,
    theme TEXT,
    frequency TEXT NOT NULL,
    ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE content_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog owners manage content_calendars"
ON content_calendars FOR ALL
TO authenticated
USING (is_blog_owner(blog_id))
WITH CHECK (is_blog_owner(blog_id));

CREATE POLICY "Team members view content_calendars"
ON content_calendars FOR SELECT
TO authenticated
USING (is_team_member_of_blog(blog_id));