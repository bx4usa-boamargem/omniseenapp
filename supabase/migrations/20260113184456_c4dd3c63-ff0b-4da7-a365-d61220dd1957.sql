-- Adicionar campos de economia do negócio na tabela business_profile
ALTER TABLE business_profile 
  ADD COLUMN IF NOT EXISTS average_ticket NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closing_rate NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_opportunity_value NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS average_margin NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS business_economics_configured BOOLEAN DEFAULT FALSE;

-- Comentários para documentação
COMMENT ON COLUMN business_profile.average_ticket IS 'Ticket médio por venda em BRL';
COMMENT ON COLUMN business_profile.closing_rate IS 'Taxa de fechamento em percentual (0-100)';
COMMENT ON COLUMN business_profile.custom_opportunity_value IS 'Valor manual da oportunidade comercial (sobrescreve cálculo)';
COMMENT ON COLUMN business_profile.average_margin IS 'Margem média do negócio para ROI líquido';
COMMENT ON COLUMN business_profile.business_economics_configured IS 'Flag indicando se o usuário configurou economia do negócio';