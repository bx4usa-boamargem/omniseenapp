-- Drop da política existente
DROP POLICY IF EXISTS "Owner can manage strategy" ON client_strategy;

-- Nova política com suporte a admins e membros de equipe
CREATE POLICY "Owner or admin can manage strategy"
ON client_strategy
FOR ALL
TO authenticated
USING (
  -- Dono do blog
  blog_id IN (
    SELECT id FROM blogs WHERE user_id = auth.uid()
  )
  OR
  -- Membro da equipe aceito
  blog_id IN (
    SELECT blog_id FROM team_members 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
  OR
  -- Admin ou Platform Admin (usando função SECURITY DEFINER)
  public.has_role(auth.uid(), 'admin')
  OR
  public.has_role(auth.uid(), 'platform_admin')
)
WITH CHECK (
  -- Mesma lógica para INSERT/UPDATE
  blog_id IN (
    SELECT id FROM blogs WHERE user_id = auth.uid()
  )
  OR
  blog_id IN (
    SELECT blog_id FROM team_members 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
  OR
  public.has_role(auth.uid(), 'admin')
  OR
  public.has_role(auth.uid(), 'platform_admin')
);