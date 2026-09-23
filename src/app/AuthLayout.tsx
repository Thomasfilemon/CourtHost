import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguagePicker } from '../components/LanguagePicker';
// Preserve the working login screen while host screens use the Figma shell.
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <div className="page-shell"><header className="site-header">
    <a href="#" className="wordmark" aria-label={t('brand')}><span className="brand-mark" aria-hidden="true">c<span>.</span></span>{t('brand')}</a>
    <LanguagePicker />
  </header><main className="auth-layout"><div className="auth-intro"><p className="eyebrow">{t('eyebrow')}</p><h2>{t('title')}</h2><p>{t('intro')}</p></div>{children}</main>
    <footer><p>{t('footer')}</p><p>{t('prototype')}</p></footer></div>;
}
