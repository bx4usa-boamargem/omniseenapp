-- Função para claim atômico de itens da fila
-- Usa FOR UPDATE SKIP LOCKED para evitar race conditions
CREATE OR REPLACE FUNCTION claim_queue_items(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  blog_id UUID,
  suggested_theme TEXT,
  keywords TEXT[],
  generation_source TEXT,
  funnel_stage TEXT,
  chunk_content TEXT,
  persona_id UUID,
  article_goal TEXT,
  funnel_mode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT aq.id
    FROM article_queue aq
    WHERE aq.status = 'pending'
      AND aq.scheduled_for <= now()
    ORDER BY aq.scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE article_queue aq
  SET 
    status = 'generating',
    updated_at = now()
  FROM claimed c
  WHERE aq.id = c.id
  RETURNING 
    aq.id,
    aq.blog_id,
    aq.suggested_theme,
    aq.keywords,
    aq.generation_source,
    aq.funnel_stage,
    aq.chunk_content,
    aq.persona_id,
    aq.article_goal,
    aq.funnel_mode;
END;
$$;

-- Revogar acesso público e conceder apenas ao service_role
REVOKE ALL ON FUNCTION claim_queue_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_queue_items TO service_role;