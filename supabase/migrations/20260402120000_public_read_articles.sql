-- Migration: Liberar leitura pública de artigos publicados
-- Necessário para o blog público do Astro funcionar sem autenticação

-- 1. Permite que qualquer visitante leia artigos com status = 'published'
CREATE POLICY "public_read_published_articles"
  ON public.articles
  FOR SELECT
  TO anon
  USING (status = 'published');

-- 2. (Opcional) Permite leitura do blog pai para contexto
-- CREATE POLICY "public_read_blogs"
--   ON public.blogs
--   FOR SELECT
--   TO anon
--   USING (true);
