-- ============================================
-- PARTE 1: Atualizar função existente para cobrir ambos os status
-- ============================================
CREATE OR REPLACE FUNCTION public.is_team_member_of_blog(p_blog_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE blog_id = p_blog_id
      AND user_id = auth.uid()
      AND status IN ('accepted', 'active')
  );
$$;

-- ============================================
-- PARTE 2: Criar função auxiliar para verificar admin de blog
-- ============================================
CREATE OR REPLACE FUNCTION public.is_blog_team_admin(p_blog_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE blog_id = p_blog_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status IN ('accepted', 'active')
  );
$$;

-- ============================================
-- PARTE 3: Remover políticas recursivas
-- ============================================
DROP POLICY IF EXISTS "Team admins can manage members" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view their team" ON public.team_members;

-- ============================================
-- PARTE 4: Recriar políticas SEM RECURSÃO
-- ============================================

-- Usuários podem ver membros do mesmo blog (via funções SECURITY DEFINER)
CREATE POLICY "Team members can view their team"
  ON public.team_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_team_member_of_blog(blog_id)
    OR public.is_blog_owner(blog_id)
  );

-- Admins e owners podem gerenciar membros (não podem transferir ownership)
CREATE POLICY "Team admins can manage members"
  ON public.team_members
  FOR ALL
  USING (
    public.is_blog_owner(blog_id)
    OR public.is_blog_team_admin(blog_id)
  )
  WITH CHECK (
    (public.is_blog_owner(blog_id) OR public.is_blog_team_admin(blog_id))
    AND role <> 'owner'
  );