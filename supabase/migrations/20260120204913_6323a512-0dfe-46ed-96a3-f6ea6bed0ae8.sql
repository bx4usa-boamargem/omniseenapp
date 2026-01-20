-- Remove unique constraint on user_id to allow multi-tenant (one user can own multiple blogs)
ALTER TABLE public.blogs DROP CONSTRAINT IF EXISTS blogs_user_id_key;