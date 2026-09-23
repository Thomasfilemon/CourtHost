import i18n from 'i18next';
import en from './locales/en.json';
import id from './locales/id.json';

// Register this feature separately so a Match update never replaces a host's
// locally customized Players translation files.
i18n.addResourceBundle('en', 'translation', { sessions: en }, true, true);
i18n.addResourceBundle('id', 'translation', { sessions: id }, true, true);
