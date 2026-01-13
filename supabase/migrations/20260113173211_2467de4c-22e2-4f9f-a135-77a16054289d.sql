-- Corrigir search_path nas funções de incremento

CREATE OR REPLACE FUNCTION increment_visibility_count(p_article_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.articles 
  SET conversion_visibility_count = COALESCE(conversion_visibility_count, 0) + 1
  WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_intent_count(p_article_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.articles 
  SET conversion_intent_count = COALESCE(conversion_intent_count, 0) + 1
  WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;