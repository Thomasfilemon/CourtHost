import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguagePicker } from '../components/LanguagePicker';
import { PlayersPage } from '../features/players/PlayersPage';
import { SessionsPage } from '../features/sessions/SessionsPage';

function selectedTab(): 'match' | 'players' {
  return window.location.hash === '#match' ? 'match' : 'players';
}
export function SessionHostShell({ userId, name, logoutButton, logoutFailed }: {
  userId: string; name: string; logoutButton: ReactNode; logoutFailed: boolean;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(selectedTab);
  useEffect(() => {
    const onHashChange = () => setTab(selectedTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return <div className="host-shell">
    <header className="host-appbar">
      <div className="host-signout">{logoutButton}</div>
      <span className="host-brand"><img src="/assets/figma/logo.png" width="36" height="36" alt={t('brand')} /></span>
      <h2 className="host-greeting">{t('auth.welcome', { name })}</h2>
      <LanguagePicker />
    </header>
    {logoutFailed && <p role="alert" className="roster-error">{t('auth.logoutFailed')}</p>}
    <main>{tab === 'match' ? <SessionsPage key={userId} userId={userId} /> : <PlayersPage key={userId} userId={userId} />}</main>
    <nav className="host-nav" aria-label={t('players.navigation')}>
      <a className={tab === 'match' ? 'is-active' : undefined} href="#match" aria-current={tab === 'match' ? 'page' : undefined} onClick={() => setTab('match')}><img src="/assets/figma/match.svg" width="24" height="24" alt="" /><span>{t('players.match')}</span></a>
      <button disabled title={t('players.comingSoon')}><img src="/assets/figma/history.svg" width="24" height="24" alt="" /><span>{t('players.history')}</span><small>{t('players.comingSoon')}</small></button>
      <a className={tab === 'players' ? 'is-active' : undefined} href="#players" aria-current={tab === 'players' ? 'page' : undefined} onClick={() => setTab('players')}><img src="/assets/figma/players.svg" width="24" height="24" alt="" /><span>{t('players.navPlayers')}</span></a>
    </nav>
  </div>;
}
