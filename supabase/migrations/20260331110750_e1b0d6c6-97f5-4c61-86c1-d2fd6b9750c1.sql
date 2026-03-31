-- Remove overly permissive ebook-pdfs policy
DROP POLICY IF EXISTS "Anyone can view ebook pdfs" ON storage.objects;