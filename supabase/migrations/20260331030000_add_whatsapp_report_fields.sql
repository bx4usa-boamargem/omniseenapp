-- Add WhatsApp report fields to weekly_report_settings
ALTER TABLE weekly_report_settings
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_last_sent_at timestamptz;
