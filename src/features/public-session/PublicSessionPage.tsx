import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LanguagePicker } from '../../components/LanguagePicker';
import { LeaderboardTable } from '../sessions/LeaderboardTable';
import { getPublicSession } from './public-session-api';
import { useSessionLive } from './use-session-live';
import '../sessions/register-translations';
import '../sessions/sessions.css';
import './public-session.css';
export function PublicSessionPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const [playerId, setPlayerId] = useState('');
  const query = useQuery({ queryKey: ['public-session', token], queryFn: ({ signal }) => getPublicSession(token, signal), retry: false, gcTime: 0,
    refetchInterval: query => query.state.status === 'error' || !query.state.data ? 15000 : false, refetchOnReconnect: 'always' });
  // Stop displaying cached results on any failed authorization/read, including revocation.
  const data = query.isError ? undefined : query.data;
  const connection = useSessionLive(data?.realtime_topic, () => { void query.refetch(); });
  if (!data) return <main className="public-session"><LanguagePicker /><h1>CourtHost</h1><p role={query.isError ? 'alert' : 'status'}>{t(query.isError ? 'sessions.publicUnavailable' : 'sessions.historyLoading')}</p>{query.isError && <button onClick={() => void query.refetch()}>{t('sessions.retry')}</button>}</main>;
  const next = data.matches.find(match => match.status === 'scheduled');
  const myNext = playerId && next?.participants.some(player => player.session_player_id === playerId);
  return <main className="public-session">
    <header className="public-header"><strong>CourtHost</strong><LanguagePicker /></header>
    <h1>{data.session.name}</h1><p>{new Intl.DateTimeFormat(i18n.language === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.session.start_time))} · {t(`sessions.status.${data.session.status}`)}</p>
    <p role="status">{t(`sessions.connection_${connection}`)}</p>
    <label className="public-player">{t('sessions.publicChoosePlayer')}<select value={playerId} onChange={event => setPlayerId(event.target.value)}><option value="">{t('sessions.publicEveryone')}</option>{data.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
    {myNext && next && <p role="status" className="public-next">{t('sessions.publicNext', { number: next.number })}</p>}
    <section aria-labelledby="public-matches"><h2 id="public-matches">{t('sessions.publicSchedule')}</h2>
      {!data.matches.length && <p>{t('sessions.publicNoMatches')}</p>}
      <ol className="public-matches">{data.matches.map(match => <li key={match.id} className={`session-match ${match.participants.some(player => player.session_player_id === playerId) ? 'public-my-match' : ''}`}>
        <div className="session-match-top"><strong>{t('sessions.matchNumber', { number: match.number })}</strong><span>{t(`sessions.status.${match.status}`)}</span></div>
        <div className="session-teams"><span>{match.participants.filter(p => p.team === 1).map(p => data.players.find(player => player.id === p.session_player_id)?.name ?? '—').join(' + ')}</span><strong>{match.team1_score ?? '—'} : {match.team2_score ?? '—'}</strong><span>{match.participants.filter(p => p.team === 2).map(p => data.players.find(player => player.id === p.session_player_id)?.name ?? '—').join(' + ')}</span></div>
      </li>)}</ol>
    </section>
    <section className="history-card"><h2>{t('sessions.historyLeaderboard')}</h2><LeaderboardTable rows={data.leaderboard} /></section>
    <p className="public-note">{t('sessions.publicReadOnly')}</p>
  </main>;
}
