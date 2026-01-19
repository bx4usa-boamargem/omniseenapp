import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      'pt': { translation: ptBR },
      'en': { translation: en },
      'es': { translation: es },
    },
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'pt', 'en', 'es'],
    detection: {
      order: ['localStorage', 'querystring', 'navigator'],
      lookupQuerystring: 'lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    debug: import.meta.env.DEV,
  });

// Forçar pt-BR no primeiro carregamento se nenhum idioma estiver configurado
if (!localStorage.getItem('i18nextLng')) {
  console.log('[i18n] Nenhum idioma salvo - forçando pt-BR');
  i18n.changeLanguage('pt-BR');
}

export default i18n;
