-- DROP das políticas atuais
DROP POLICY IF EXISTS "Users can create their own chat drafts" ON chat_article_drafts;
DROP POLICY IF EXISTS "Users can view their own chat drafts" ON chat_article_drafts;
DROP POLICY IF EXISTS "Users can update their own chat drafts" ON chat_article_drafts;
DROP POLICY IF EXISTS "Users can delete their own chat drafts" ON chat_article_drafts;

-- SELECT: Usuário pode ver seus próprios drafts OU é admin
CREATE POLICY "Users can view chat drafts"
ON chat_article_drafts
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'platform_admin')
);

-- INSERT: Usuário pode criar draft se user_id = seu ID E (blog pertence a ele OU é membro OU é admin)
CREATE POLICY "Users can create chat drafts"
ON chat_article_drafts
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid())
    OR public.is_team_member_of_blog(auth.uid(), blog_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  )
);

-- UPDATE: Usuário pode atualizar seus próprios drafts
CREATE POLICY "Users can update chat drafts"
ON chat_article_drafts
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'platform_admin')
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'platform_admin')
);

-- DELETE: Usuário pode deletar seus próprios drafts
CREATE POLICY "Users can delete chat drafts"
ON chat_article_drafts
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'platform_admin')
);