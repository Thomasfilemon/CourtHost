import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguagePicker } from '../components/LanguagePicker';
import { PlayersPage } from '../features/players/PlayersPage';
export function HostShell({ userId, name, logoutButton, logoutFailed }: {
  userId: string; name: string; logoutButton: ReactNode; logoutFailed: boolean;
}) {
  const { t } = useTranslation();
  return <div className="host-shell">
    <header className="host-appbar">
      <span className="host-brand"><img src="/assets/figma/logo.png" width="36" height="36" alt={t('brand')} /></span>
      <h2 className="host-greeting">{t('auth.welcome', { name })}</h2>
      <LanguagePicker />
      <div className="host-signout">{logoutButton}</div>
    </header>
    {logoutFailed && <p role="alert" className="roster-error">{t('auth.logoutFailed')}</p>}
    <main><PlayersPage key={userId} userId={userId} /></main>
    {/* These two screens are intentionally disabled until their flows are implemented. */}
    <nav className="host-nav" aria-label={t('players.navigation')}>
      <button disabled title={t('players.comingSoon')}><img src="/assets/figma/match.svg" width="24" height="24" alt="" /><span>{t('players.match')}</span><small>{t('players.comingSoon')}</small></button>
      <button disabled title={t('players.comingSoon')}><img src="/assets/figma/history.svg" width="24" height="24" alt="" /><span>{t('players.history')}</span><small>{t('players.comingSoon')}</small></button>
      <a href="#players-title" aria-current="page"><img src="/assets/figma/players.svg" width="24" height="24" alt="" /><span>{t('players.navPlayers')}</span></a>
    </nav>
  </div>;
}
