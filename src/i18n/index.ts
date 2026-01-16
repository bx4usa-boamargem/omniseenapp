import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

// Clear invalid stored language before init
const validLangs = ['pt-BR', 'pt', 'pt-PT', 'en', 'en-US', 'es'];
const storedLang = localStorage.getItem('i18nextLng');
if (storedLang && !validLangs.includes(storedLang)) {
  console.log('[i18n] Clearing invalid stored language:', storedLang);
  localStorage.removeItem('i18nextLng');
}

// Debug: verify resources loaded
console.log('[i18n] Resources loaded:', {
  'pt-BR': Object.keys(ptBR.landing || {}).length > 0 ? '✓' : '✗',
  'en': Object.keys(en.landing || {}).length > 0 ? '✓' : '✗',
});

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
      'en-US': { translation: en },
      'es': { translation: es },
    },
    lng: 'pt-BR', // Force default language
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'pt', 'pt-PT', 'en', 'en-US', 'es'],
    nonExplicitSupportedLngs: true,
    
    // CRITICAL: Synchronous loading
    initImmediate: false,
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
    },
  });

console.log('[i18n] Initialized with language:', i18n.language);
console.log('[i18n] Test translation:', i18n.t('landing.manifesto.headline'));

export default i18n;
