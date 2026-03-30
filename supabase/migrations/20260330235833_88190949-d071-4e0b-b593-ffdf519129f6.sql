-- Clean up orphaned placeholder articles that were never completed
DELETE FROM articles 
WHERE status = 'generating' 
  AND generation_stage IN ('validating', 'failed')
  AND title LIKE 'Gerando:%';

-- Also clean the one without "Gerando:" prefix that is stuck
UPDATE articles 
SET status = 'draft', generation_stage = 'failed'
WHERE status = 'generating' 
  AND generation_stage IS NULL;