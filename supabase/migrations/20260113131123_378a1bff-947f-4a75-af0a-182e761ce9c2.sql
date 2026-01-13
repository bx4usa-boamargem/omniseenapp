-- Inserir modelos de texto do Lovable AI Gateway
INSERT INTO model_pricing (model_provider, model_name, cost_per_1k_input_tokens, cost_per_1k_output_tokens, cost_per_image, is_active) VALUES
-- Google Gemini - Texto
('Google', 'google/gemini-2.5-pro', 0.00125, 0.00500, 0, true),
('Google', 'google/gemini-2.5-flash', 0.00015, 0.00060, 0, true),
('Google', 'google/gemini-2.5-flash-lite', 0.00003, 0.00015, 0, true),
('Google', 'google/gemini-3-pro-preview', 0.00125, 0.00500, 0, true),
('Google', 'google/gemini-3-flash-preview', 0.00015, 0.00060, 0, true),
-- OpenAI GPT-5 - Texto
('OpenAI', 'openai/gpt-5', 0.00500, 0.01500, 0, true),
('OpenAI', 'openai/gpt-5-mini', 0.00015, 0.00060, 0, true),
('OpenAI', 'openai/gpt-5-nano', 0.00010, 0.00040, 0, true),
('OpenAI', 'openai/gpt-5.2', 0.00250, 0.01000, 0, true),
-- Google Gemini - Imagens
('Google', 'google/gemini-2.5-flash-image-preview', 0, 0, 0.04, true),
('Google', 'google/gemini-3-pro-image-preview', 0, 0, 0.08, true)
ON CONFLICT (model_name) DO UPDATE SET
  model_provider = EXCLUDED.model_provider,
  cost_per_1k_input_tokens = EXCLUDED.cost_per_1k_input_tokens,
  cost_per_1k_output_tokens = EXCLUDED.cost_per_1k_output_tokens,
  cost_per_image = EXCLUDED.cost_per_image,
  is_active = EXCLUDED.is_active;