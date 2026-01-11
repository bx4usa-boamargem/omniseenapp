-- Adicionar suporte a background_color na tabela blogs
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS hero_background_color TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS logo_background_color TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS logo_negative_background_color TEXT;

-- Comentários para documentação
COMMENT ON COLUMN blogs.hero_background_color IS 'Cor de fundo alternativa para o hero quando não há imagem';
COMMENT ON COLUMN blogs.logo_background_color IS 'Cor de fundo alternativa para logo clara quando não há imagem';
COMMENT ON COLUMN blogs.logo_negative_background_color IS 'Cor de fundo alternativa para logo escura quando não há imagem';