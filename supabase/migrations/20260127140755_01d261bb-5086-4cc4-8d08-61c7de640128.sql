-- =============================================================
-- FASE 0.1: AUDITORIA E HARDENING DE RLS - PROFILES
-- Objetivo: Consolidar políticas duplicadas
-- =============================================================

-- =============================================
-- 1. REMOVER POLÍTICAS DUPLICADAS/INCORRETAS
-- =============================================

-- INSERT: Remover política que usa 'id' (incorreto - deve usar user_id)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- SELECT: Remover política que usa 'id' (incorreto)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- UPDATE: Remover políticas antigas
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- =============================================
-- 2. MANTER/RECRIAR POLÍTICAS CONSOLIDADAS
-- =============================================

-- INSERT: Manter "Users can insert their own profile" (já usa user_id)
-- Não precisa recriar - já existe e está correta

-- SELECT: Manter "Users can view their own profile" (já usa user_id + admin)
-- Não precisa recriar - já existe e está correta

-- UPDATE: Recriar política consolidada com user_id
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- RESUMO DA CONSOLIDAÇÃO
-- =============================================
-- REMOVIDAS:
--   - "Users can insert own profile" (usava id, incorreto)
--   - "Users can view own profile" (usava id, incorreto)
--   - "Users can update own profile" (usava id, incorreto)
--   - "Users can update their own profile" (recriada)
--
-- MANTIDAS/CONSOLIDADAS:
--   - "Users can insert their own profile" (user_id) ✓
--   - "Users can view their own profile" (user_id + admin) ✓
--   - "Users can update their own profile" (user_id) ✓
-- =============================================================