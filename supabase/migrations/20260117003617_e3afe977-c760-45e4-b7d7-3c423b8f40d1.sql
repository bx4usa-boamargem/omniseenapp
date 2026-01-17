-- Add currency column to business_profile
ALTER TABLE business_profile 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL' 
CHECK (currency IN ('BRL', 'USD'));

COMMENT ON COLUMN business_profile.currency IS 'Moeda usada nos valores econômicos (BRL ou USD)';