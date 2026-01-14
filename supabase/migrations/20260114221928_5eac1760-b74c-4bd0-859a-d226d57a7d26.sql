-- Permitir leitura pública da configuração do agente habilitado
CREATE POLICY "Public can view enabled agent configs" 
ON brand_agent_config
FOR SELECT 
TO public
USING (is_enabled = true);

-- Permitir leitura pública do perfil de negócio
CREATE POLICY "Public can view business profile" 
ON business_profile
FOR SELECT 
TO public
USING (true);