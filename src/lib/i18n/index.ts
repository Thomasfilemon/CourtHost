import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import id from './id.json';

// All visible copy lives in translation files, not scattered through components.
// We only save the language preference. No player or session data is stored here.
let savedLanguage = 'en';
try {
  savedLanguage = localStorage.getItem('courthost.language') === 'id' ? 'id' : 'en';
} catch {
  // The page still works if the browser blocks localStorage.
}
document.documentElement.lang = savedLanguage;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, id: { translation: id } },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes rendered text.
  initAsync: false,
});

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
  try { localStorage.setItem('courthost.language', language); } catch { /* Optional preference. */ }
});
