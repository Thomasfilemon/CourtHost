import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listSessionLeaderboard, listSessions } from './session-api';
import type { SessionLeaderboardRow } from './session-api';
import './sessions.css';

type HistoryFilter = 'all' | 'completed' | 'cancelled';
type HistorySession = {
  id: string; name: string; start_time: string; game_mode: string; status: string;
};

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Leaderboard({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['session-leaderboard', sessionId], queryFn: ({ signal }) => listSessionLeaderboard(sessionId, signal), retry: false });
  if (query.isPending) return <p role="status" className="history-message">{t('sessions.historyLoadingStats')}</p>;
  if (query.isError) return <p role="alert" className="history-message">{t('sessions.historyStatsError')}</p>;
  if (query.data.length === 0) return <p className="history-message">{t('sessions.historyNoStats')}</p>;
  return <div className="history-table-wrap"><table className="history-table">
    <caption className="sr-only">{t('sessions.historyLeaderboard')}</caption>
    <thead><tr><th scope="col">{t('sessions.historyRank')}</th><th scope="col">{t('sessions.historyPlayer')}</th><th scope="col">{t('sessions.historyPlayed')}</th><th scope="col">{t('sessions.historyWins')}</th><th scope="col">{t('sessions.historyDraws')}</th><th scope="col">{t('sessions.historyLosses')}</th><th scope="col">{t('sessions.historyPoints')}</th><th scope="col">{t('sessions.historyDifference')}</th></tr></thead>
    <tbody>{query.data.map((row: SessionLeaderboardRow) => <tr key={row.session_player_id}>
      <td>{row.ranking ?? '-'}</td><th scope="row">{row.player_name}</th><td>{row.matches_played ?? 0}</td><td>{row.wins ?? 0}</td><td>{row.draws ?? 0}</td><td>{row.losses ?? 0}</td><td><strong>{row.points ?? 0}</strong></td><td>{row.game_difference ?? 0}</td>
    </tr>)}</tbody>
  </table></div>;
}

function SessionStats({ session, language }: { session: HistorySession; language: string }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['session-history-stats', session.id], queryFn: ({ signal }) => listSessionLeaderboard(session.id, signal), retry: false });
  const rows = query.data ?? [];
  const played = rows.reduce((sum, row) => sum + (row.matches_played ?? 0), 0);
  const points = rows.reduce((sum, row) => sum + (row.points ?? 0), 0);
  return <article className="history-card">
    <button className="history-card-toggle" aria-expanded="true">
      <span className="history-card-main"><strong>{session.name}</strong><small>{formatDate(session.start_time, language)}</small></span>
      <span className={`session-status session-status-${session.status}`}>{t(`sessions.status.${session.status}`, { defaultValue: session.status })}</span>
    </button>
    <div className="history-summary"><span>{t(session.game_mode === 'singles' ? 'sessions.singles' : 'sessions.doubles')}</span><span>{t('sessions.historyMatchesPlayed', { count: Math.round(played / 2) })}</span><span>{t('sessions.historyPointsTotal', { count: points })}</span></div>
    <div className="history-leaderboard"><h2>{t('sessions.historyLeaderboard')}</h2><Leaderboard sessionId={session.id} /></div>
  </article>;
}

export function HistoryPage({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['session-history', userId], queryFn: ({ signal }) => listSessions(userId, 0, signal), retry: false });
  const sessions = (query.data?.sessions ?? []).filter(session => session.status === 'completed' || session.status === 'cancelled')
    .filter(session => filter === 'all' || session.status === filter)
    .filter(session => session.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section className="history-page" aria-labelledby="history-title">
    <div className="history-heading"><div><h1 id="history-title">{t('sessions.historyTitle')}</h1><p>{t('sessions.historySubtitle')}</p></div></div>
    <div className="history-toolbar"><label className="history-search"><span className="sr-only">{t('sessions.historySearch')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('sessions.historySearch')} /></label>
      <label className="history-filter"><span className="sr-only">{t('sessions.historyFilter')}</span><select value={filter} onChange={event => setFilter(event.target.value as HistoryFilter)}><option value="all">{t('sessions.historyAll')}</option><option value="completed">{t('sessions.status.completed')}</option><option value="cancelled">{t('sessions.status.cancelled')}</option></select></label></div>
    {query.isPending ? <p role="status" className="history-message">{t('sessions.historyLoading')}</p> : query.isError ? <p role="alert" className="history-message">{t('sessions.historyError')}</p> : sessions.length === 0 ? <div className="history-empty"><h2>{t('sessions.historyEmptyTitle')}</h2><p>{t('sessions.historyEmptyBody')}</p></div> : <div className="history-list">{sessions.map(session => <SessionStats key={session.id} session={session} language={i18n.language} />)}</div>}
  </section>;
}