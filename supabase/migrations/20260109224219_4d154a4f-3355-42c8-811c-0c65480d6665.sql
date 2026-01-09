-- Adicionar coluna google_email à tabela gsc_connections
ALTER TABLE gsc_connections
ADD COLUMN IF NOT EXISTS google_email TEXT;

COMMENT ON COLUMN gsc_connections.google_email IS 'Email da conta Google conectada via OAuth (obtido de userinfo API)';