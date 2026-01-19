-- Create a SECURITY DEFINER function to safely check blog ownership
-- This prevents infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.is_blog_owner(p_blog_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blogs
    WHERE id = p_blog_id 
    AND user_id = auth.uid()
  );
$$;

-- Drop existing policies on gsc_connections to recreate them safely
DROP POLICY IF EXISTS "Users can view their own GSC connections" ON gsc_connections;
DROP POLICY IF EXISTS "Users can create GSC connections for their blog" ON gsc_connections;
DROP POLICY IF EXISTS "Users can update their own GSC connections" ON gsc_connections;
DROP POLICY IF EXISTS "Users can delete their own GSC connections" ON gsc_connections;

-- Recreate policies using the safe is_blog_owner function
CREATE POLICY "Users can view their own GSC connections" 
ON gsc_connections FOR SELECT 
USING (is_blog_owner(blog_id) OR is_team_member_of_blog(blog_id));

CREATE POLICY "Users can create GSC connections for their blog" 
ON gsc_connections FOR INSERT 
WITH CHECK (is_blog_owner(blog_id));

CREATE POLICY "Users can update their own GSC connections" 
ON gsc_connections FOR UPDATE 
USING (is_blog_owner(blog_id));

CREATE POLICY "Users can delete their own GSC connections" 
ON gsc_connections FOR DELETE 
USING (is_blog_owner(blog_id));