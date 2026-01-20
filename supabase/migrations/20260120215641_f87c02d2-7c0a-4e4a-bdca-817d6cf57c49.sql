-- Atualizar trigger auto_set_subdomain para novo padrão {slug}.app.omniseen.app
-- Esta função é chamada antes de INSERT em blogs para definir o platform_subdomain automaticamente

CREATE OR REPLACE FUNCTION public.auto_set_subdomain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se platform_subdomain não foi definido, criar a partir do slug
  -- NOVO PADRÃO: {slug}.app.omniseen.app
  IF NEW.platform_subdomain IS NULL AND NEW.slug IS NOT NULL THEN
    NEW.platform_subdomain := NEW.slug || '.app.omniseen.app';
  END IF;
  RETURN NEW;
END;
$$;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION public.auto_set_subdomain() IS 'Auto-gera platform_subdomain no formato {slug}.app.omniseen.app para novos blogs';

-- Garantir que o trigger existe (criar se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_auto_set_subdomain' 
    AND tgrelid = 'public.blogs'::regclass
  ) THEN
    CREATE TRIGGER trigger_auto_set_subdomain
      BEFORE INSERT ON public.blogs
      FOR EACH ROW
      EXECUTE FUNCTION public.auto_set_subdomain();
  END IF;
END $$;