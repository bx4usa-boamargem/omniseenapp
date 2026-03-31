import { useTranslation } from 'react-i18next';
import { format, formatDistance, formatRelative, Locale } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';

const locales: Record<string, Locale> = {
  'pt-BR': ptBR,
  'pt': ptBR,
  'en': enUS,
  'en-US': enUS,
  'es': es,
  'es-AR': es,
};

export const useLocaleFormat = () => {
  const { i18n } = useTranslation();
  const currentLocale = locales[i18n.language] || ptBR;

  const formatDate = (date: Date | string, formatStr: string = 'PPP'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, formatStr, { locale: currentLocale });
  };

  const formatDateShort = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'd MMM yyyy', { locale: currentLocale });
  };

  const formatDateLong = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "d 'de' MMMM 'de' yyyy", { locale: currentLocale });
  };

  const formatRelativeDate = (date: Date | string, baseDate: Date = new Date()): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatRelative(dateObj, baseDate, { locale: currentLocale });
  };

  const formatDistanceFromNow = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistance(dateObj, new Date(), { 
      addSuffix: true, 
      locale: currentLocale 
    });
  };

  const formatNumber = (num: number, options?: Intl.NumberFormatOptions): string => {
    return new Intl.NumberFormat(i18n.language, options).format(num);
  };

  const formatCurrency = (value: number, currency: string = 'BRL'): string => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency
    }).format(value);
  };

  return {
    formatDate,
    formatDateShort,
    formatDateLong,
    formatRelativeDate,
    formatDistanceFromNow,
    formatNumber,
    formatCurrency,
    locale: currentLocale
  };
};
