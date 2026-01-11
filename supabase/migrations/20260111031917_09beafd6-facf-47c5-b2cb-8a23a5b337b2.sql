-- Apenas corrigir policies de blog_contact_buttons
-- A função is_team_member_of_blog já existe e está funcionando

DROP POLICY IF EXISTS "Users can delete their own blog buttons" ON blog_contact_buttons;
DROP POLICY IF EXISTS "Users can insert their own blog buttons" ON blog_contact_buttons;
DROP POLICY IF EXISTS "Users can update their own blog buttons" ON blog_contact_buttons;
DROP POLICY IF EXISTS "Users can view their own blog buttons" ON blog_contact_buttons;
DROP POLICY IF EXISTS "Users can manage their own blog buttons" ON blog_contact_buttons;
DROP POLICY IF EXISTS "Blog owners and team can manage contact buttons" ON blog_contact_buttons;
DROP POLICY IF EXISTS "Public can view contact buttons" ON blog_contact_buttons;

-- Policy unificada para donos e equipe (usando função existente)
CREATE POLICY "Blog owners and team can manage contact buttons"
ON blog_contact_buttons
FOR ALL
USING (
  blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid())
  OR is_team_member_of_blog(blog_id, auth.uid())
);

-- Policy para leitura pública
CREATE POLICY "Public can view contact buttons"
ON blog_contact_buttons
FOR SELECT
USING (true);