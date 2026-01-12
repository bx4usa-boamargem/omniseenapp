-- Add optional fields for WhatsApp message and Email subject
ALTER TABLE public.blog_contact_buttons
ADD COLUMN IF NOT EXISTS whatsapp_message TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_subject TEXT DEFAULT NULL;