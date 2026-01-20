-- ============================================
-- PARTE 1: Corrigir policies da tabela subscriptions
-- Trocar de 'public' para 'authenticated' + permitir admins
-- ============================================

-- Remover policies atuais
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

-- Recriar com role 'authenticated' e permitir admins
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert their own subscription"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Users can update their own subscription"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============================================
-- PARTE 2: Adicionar política de admin para profiles
-- Manter policies atuais, adicionar permissão para admins visualizarem
-- ============================================

-- Remover política atual de SELECT
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recriar com permissão para admins
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );