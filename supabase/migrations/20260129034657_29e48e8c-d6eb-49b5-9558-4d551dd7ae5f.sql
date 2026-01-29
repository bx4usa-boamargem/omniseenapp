-- Drop the old constraint
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_article_structure_type_check;

-- Add new constraint with correct Article Engine template values
ALTER TABLE public.articles ADD CONSTRAINT articles_article_structure_type_check 
  CHECK (article_structure_type IS NULL OR article_structure_type = ANY (ARRAY[
    'complete_guide'::text, 
    'qa_format'::text, 
    'comparative'::text, 
    'problem_solution'::text, 
    'educational_steps'::text
  ]));