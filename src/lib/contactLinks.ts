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

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates contact value based on type.
 * Returns isValid boolean and error message if invalid.
 */
export function validateContactValue(type: string, value: string): ValidationResult {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'Campo obrigatório' };
  }

  const cleanValue = sanitizeContactValue(type, value);

  switch (type) {
    case 'whatsapp':
      if (cleanValue.length < 10) {
        return { isValid: false, error: 'Número muito curto (mínimo 10 dígitos)' };
      }
      if (cleanValue.length > 15) {
        return { isValid: false, error: 'Número muito longo (máximo 15 dígitos)' };
      }
      return { isValid: true };

    case 'phone':
      if (cleanValue.length < 8) {
        return { isValid: false, error: 'Número muito curto (mínimo 8 dígitos)' };
      }
      if (cleanValue.length > 15) {
        return { isValid: false, error: 'Número muito longo (máximo 15 dígitos)' };
      }
      return { isValid: true };

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanValue)) {
        return { isValid: false, error: 'E-mail inválido (ex: nome@empresa.com)' };
      }
      return { isValid: true };

    case 'instagram':
      if (cleanValue.length < 1) {
        return { isValid: false, error: 'Digite o nome do perfil' };
      }
      if (cleanValue.length > 30) {
        return { isValid: false, error: 'Nome muito longo (máximo 30 caracteres)' };
      }
      if (!/^[a-zA-Z0-9._]+$/.test(cleanValue)) {
        return { isValid: false, error: 'Apenas letras, números, pontos e underscores' };
      }
      return { isValid: true };

    case 'website':
    case 'link':
      if (cleanValue.length < 4) {
        return { isValid: false, error: 'URL muito curta' };
      }
      return { isValid: true };

    default:
      return { isValid: true };
  }
}

/**
 * Returns a preview of the generated link for display in the editor.
 * This is admin-only and should never be shown publicly.
 */
export function getContactLinkPreview(btn: ContactButtonData): string {
  const cleanValue = sanitizeContactValue(btn.button_type, btn.value);
  
  if (!cleanValue) return '';
  
  switch (btn.button_type) {
    case 'whatsapp':
      const previewText = btn.whatsapp_message ? `&text=...` : '';
      return `api.whatsapp.com/send?phone=${cleanValue}${previewText}`;
    case 'phone':
      return `tel:+${cleanValue}`;
    case 'email':
      return cleanValue;
    case 'instagram':
      return `instagram.com/${cleanValue}`;
    case 'website':
    case 'link':
      return cleanValue.replace(/^https?:\/\//, '');
    default:
      return cleanValue;
  }
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
  
  const trimmed = value.trim();
  
  switch (type) {
    case 'whatsapp':
    case 'phone':
      // Extract number from wa.me or api.whatsapp.com URLs
      // Handles: https://wa.me/5511999999999, https://api.whatsapp.com/send?phone=5511999999999
      const waUrlRegex = /(?:wa\.me\/|whatsapp\.com\/send\?phone=)(\d+)/i;
      const waMatch = trimmed.match(waUrlRegex);
      if (waMatch && waMatch[1]) {
        return waMatch[1];
      }
      // Fallback: keep only digits
      return trimmed.replace(/\D/g, '');

    case 'instagram':
      // Extract username from Instagram URLs
      // Handles: https://www.instagram.com/username, @username, username
      const instagramUrlRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/i;
      const igMatch = trimmed.match(instagramUrlRegex);
      if (igMatch && igMatch[1]) {
        return igMatch[1];
      }
      // Fallback: remove @ prefix
      return trimmed.replace(/^@/, '');

    case 'email':
      // Extract email from mailto: links
      // Handles: mailto:email@example.com?subject=...
      const mailtoRegex = /^mailto:([^\s?]+)/i;
      const mailtoMatch = trimmed.match(mailtoRegex);
      if (mailtoMatch && mailtoMatch[1]) {
        return mailtoMatch[1].toLowerCase();
      }
      // Fallback: trim and lowercase
      return trimmed.toLowerCase();

    case 'website':
    case 'link':
      // Normalize URLs - remove duplicate protocols, spaces
      // Handles: https://https://site.com, http://site.com, site.com
      let url = trimmed;
      // Remove duplicate protocols
      url = url.replace(/^(https?:\/\/)+/gi, '');
      // Remove duplicate www.
      url = url.replace(/^(www\.)+/gi, 'www.');
      return url;

    default:
      return trimmed;
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
      // Official WhatsApp API format: api.whatsapp.com/send
      const waText = btn.whatsapp_message 
        ? `&text=${encodeURIComponent(btn.whatsapp_message)}`
        : '';
      return `https://api.whatsapp.com/send?phone=${cleanValue}${waText}`;
    
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
