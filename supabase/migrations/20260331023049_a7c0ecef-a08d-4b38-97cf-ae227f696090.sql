
-- Make ebook-pdfs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'ebook-pdfs';

-- Add SELECT policy for authenticated users (blog owners/team)
CREATE POLICY "Auth users read own ebook PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ebook-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Add SELECT policy for service_role (edge functions) - handled by default bypass

-- Add anon SELECT for public ebook downloads (ebooks are public content shared via landing pages)
-- We use a function to verify the file belongs to a published ebook
CREATE OR REPLACE FUNCTION public.is_published_ebook_file(file_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ebooks e
    WHERE e.status = 'completed'
    AND (
      e.pdf_url LIKE '%' || file_path
      OR e.cover_image_url LIKE '%' || file_path
    )
  );
$$;

CREATE POLICY "Public can read published ebook files"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'ebook-pdfs'
  AND public.is_published_ebook_file(name)
);
