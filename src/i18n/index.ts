import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      // Portuguese (Brazil) + aliases (some browsers detect just "pt" or "pt-PT")
      'pt-BR': { translation: ptBR },
      'pt': { translation: ptBR },
      'pt-PT': { translation: ptBR },

      'en': { translation: en },
      'es': { translation: es },
    },
    fallbackLng: {
      'pt': ['pt-BR'],
      'pt-PT': ['pt-BR'],
      default: ['pt-BR'],
    },
    supportedLngs: ['pt-BR', 'pt', 'pt-PT', 'en', 'es'],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
