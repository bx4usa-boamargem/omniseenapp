-- Adicionar colunas mode e content_type em blog_automation (se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blog_automation' AND column_name = 'mode') THEN
    ALTER TABLE blog_automation ADD COLUMN mode TEXT DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blog_automation' AND column_name = 'content_type') THEN
    ALTER TABLE blog_automation ADD COLUMN content_type TEXT DEFAULT 'mixed';
  END IF;
END $$;

-- Criar RPC recalculate_queue_dates
CREATE OR REPLACE FUNCTION recalculate_queue_dates(p_blog_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_automation RECORD;
  v_count INTEGER := 0;
  v_slot_time TIMESTAMP WITH TIME ZONE;
  v_item RECORD;
  v_interval INTERVAL;
BEGIN
  -- Buscar configurações de automação
  SELECT preferred_time, articles_per_period, frequency
  INTO v_automation
  FROM blog_automation
  WHERE blog_id = p_blog_id;
  
  IF NOT FOUND THEN 
    RETURN 0; 
  END IF;
  
  -- Determinar intervalo entre artigos baseado na frequência
  IF v_automation.frequency = 'daily' THEN
    v_interval := '1 day'::INTERVAL;
  ELSIF v_automation.frequency = '3_per_week' THEN
    v_interval := '2 days 8 hours'::INTERVAL;
  ELSIF v_automation.frequency = '2_per_week' THEN
    v_interval := '3 days 12 hours'::INTERVAL;
  ELSIF v_automation.frequency = 'weekly' THEN
    v_interval := '7 days'::INTERVAL;
  ELSE
    -- Fallback: usar articles_per_period
    v_interval := '7 days'::INTERVAL / GREATEST(COALESCE(v_automation.articles_per_period, 1), 1);
  END IF;
  
  -- Próximo slot válido (hoje ou amanhã no horário preferido)
  v_slot_time := DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Sao_Paulo') + COALESCE(v_automation.preferred_time, '09:00')::TIME;
  
  -- Se o slot de hoje já passou, começar amanhã
  IF v_slot_time < (NOW() AT TIME ZONE 'America/Sao_Paulo') THEN
    v_slot_time := v_slot_time + '1 day'::INTERVAL;
  END IF;
  
  -- Converter de volta para UTC para armazenar
  v_slot_time := v_slot_time AT TIME ZONE 'America/Sao_Paulo';
  
  -- Atualizar cada item pending com novas datas sequenciais
  FOR v_item IN
    SELECT id FROM article_queue
    WHERE blog_id = p_blog_id AND status = 'pending'
    ORDER BY created_at ASC
  LOOP
    UPDATE article_queue
    SET scheduled_for = v_slot_time, updated_at = NOW()
    WHERE id = v_item.id;
    
    v_slot_time := v_slot_time + v_interval;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;