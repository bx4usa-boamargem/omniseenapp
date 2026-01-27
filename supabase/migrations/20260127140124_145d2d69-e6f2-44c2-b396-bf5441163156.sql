-- =============================================================
-- REMOÇÃO DE POLÍTICAS RLS PÚBLICAS OBSOLETAS
-- Justificativa: O portal agora consome exclusivamente via content-api
-- que usa service_role, tornando estas políticas desnecessárias
-- =============================================================

-- 1. articles: remover acesso anônimo a artigos publicados
DROP POLICY IF EXISTS "Anyone can view published articles" ON public.articles;

-- 2. blogs: remover acesso anônimo a blogs por slug
DROP POLICY IF EXISTS "Anyone can view published blogs by slug" ON public.blogs;

-- 3. blog_categories: remover acesso público às categorias
DROP POLICY IF EXISTS "Public can view categories" ON public.blog_categories;

-- 4. brand_agent_config: remover acesso público à config do agente
DROP POLICY IF EXISTS "Public can view enabled agent configs" ON public.brand_agent_config;

-- 5. business_profile: remover acesso público ao perfil de negócio
DROP POLICY IF EXISTS "Public can view business profile" ON public.business_profile;

-- 6. landing_pages: remover acesso público às landing pages
DROP POLICY IF EXISTS "Anyone can view published landing pages" ON public.landing_pages;

-- =============================================================
-- COMENTÁRIO DE AUDITORIA
-- =============================================================
-- Políticas removidas: 6
-- Tabelas afetadas: articles, blogs, blog_categories, 
--                   brand_agent_config, business_profile, landing_pages
-- Data: 2026-01-27
-- Motivo: Migração para content-api gateway (service_role)
-- =============================================================