-- Corrigir funções sem search_path definido (com cast correto para app_role)
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = role_name::app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_member_of_blog(p_blog_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE blog_id = p_blog_id
      AND user_id = auth.uid()
      AND status = 'accepted'
  );
$$;