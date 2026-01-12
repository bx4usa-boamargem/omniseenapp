/**
 * Contact Links Helper - Professional Button System
 * 
 * This module centralizes all contact button link generation and sanitization.
 * It ensures:
 * - Raw values are never displayed in the UI
 * - Links use official formats (wa.me, tel:, mailto:, instagram.com)
 * - Values are sanitized before storage
 */

export interface ContactButtonData {
  button_type: 'whatsapp' | 'phone' | 'email' | 'instagram' | 'website' | 'link';
  value: string;
  label?: string | null;
  whatsapp_message?: string | null;
  email_subject?: string | null;
}

/**
 * Sanitizes contact value based on type before saving to database.
 * - WhatsApp/Phone: removes all non-digits
 * - Instagram: removes @ prefix
 * - Email: trims and lowercases
 * - URLs: trims
 */
export function sanitizeContactValue(type: string, value: string): string {
  if (!value) return '';
  
  switch (type) {
    case 'whatsapp':
    case 'phone':
      // Keep only digits (removes +, spaces, dashes, parentheses)
      return value.replace(/\D/g, '');
    case 'instagram':
      // Remove @ prefix and trim
      return value.replace(/^@/, '').trim();
    case 'email':
      // Trim and lowercase
      return value.trim().toLowerCase();
    default:
      return value.trim();
  }
}

/**
 * Generates the official href link for each contact type.
 * NEVER returns raw values - always returns properly formatted links.
 */
export function getContactHref(btn: ContactButtonData): string {
  const cleanValue = sanitizeContactValue(btn.button_type, btn.value);
  
  if (!cleanValue) return '#';
  
  switch (btn.button_type) {
    case 'whatsapp':
      // Official WhatsApp format: wa.me (NEVER api.whatsapp.com)
      const waMessage = btn.whatsapp_message 
        ? `?text=${encodeURIComponent(btn.whatsapp_message)}`
        : '';
      return `https://wa.me/${cleanValue}${waMessage}`;
    
    case 'phone':
      // Tel format with + prefix
      return `tel:+${cleanValue}`;
    
    case 'email':
      // Mailto format with optional subject
      const subject = btn.email_subject 
        ? `?subject=${encodeURIComponent(btn.email_subject)}`
        : '';
      return `mailto:${cleanValue}${subject}`;
    
    case 'instagram':
      // Instagram profile URL
      return `https://instagram.com/${cleanValue}`;
    
    case 'website':
    case 'link':
      // Ensure URL has protocol
      return cleanValue.startsWith('http') ? cleanValue : `https://${cleanValue}`;
    
    default:
      return cleanValue;
  }
}

/**
 * Returns a display label for the button type.
 * NEVER returns the raw value - only the channel name.
 */
export function getContactDisplayLabel(type: string): string {
  const labels: Record<string, string> = {
    whatsapp: 'WhatsApp',
    phone: 'Telefone',
    email: 'E-mail',
    instagram: 'Instagram',
    website: 'Site',
    link: 'Link'
  };
  return labels[type] || 'Link';
}

/**
 * Returns placeholder text for input fields based on button type.
 */
export function getContactPlaceholder(type: string): string {
  const placeholders: Record<string, string> = {
    whatsapp: '5511999999999',
    phone: '551133334444',
    email: 'contato@empresa.com',
    instagram: 'seuusuario',
    website: 'https://seusite.com',
    link: 'https://...'
  };
  return placeholders[type] || '';
}
