import { useTranslation } from 'react-i18next';
export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return <div className="language-picker" role="group" aria-label={t('language')}>
    {(['en', 'id'] as const).map(language => <button key={language} type="button"
      aria-pressed={i18n.resolvedLanguage === language} onClick={() => void i18n.changeLanguage(language)}>{language.toUpperCase()}</button>)}
  </div>;
}
