-- Fase 1: Criar função SECURITY DEFINER segura para evitar recursão em team_members
CREATE OR REPLACE FUNCTION public.is_team_member_safe(p_blog_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE blog_id = p_blog_id
      AND user_id = p_user_id
      AND status = 'accepted'
  );
$$;

-- Fase 2: Adicionar coluna is_active à tabela blogs (se não existir)
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Comentário para documentação
COMMENT ON FUNCTION public.is_team_member_safe IS 'Função segura para verificar membros de equipe sem causar recursão RLS';