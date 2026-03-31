-- Drop any existing scoped policies that may conflict
DROP POLICY IF EXISTS "Users can upload to own library folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own library files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own library files" ON storage.objects;

-- Recreate with unique names
CREATE POLICY "user_library_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-library'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "user_library_update_own_files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'user-library'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "user_library_delete_own_files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-library'
  AND (storage.foldername(name))[1] = auth.uid()::text
);