import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listSessionLeaderboard } from './session-api';
import { listHistory } from './history-api';
import type { HistoryFilters } from './history-api';
import { SESSION_PAGE_SIZE } from './session-model';
import { LeaderboardTable } from './LeaderboardTable';
import './register-translations';
import './sessions.css';

const emptyFilters: HistoryFilters = { status: 'all', search: '', from: '', to: '' };

type HistorySession = {
  id: string; name: string; start_time: string; game_mode: string; status: string;
};

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function SessionStats({ session, language, userId }: { session: HistorySession; language: string; userId: string }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['session-history-stats', userId, session.id], queryFn: ({ signal }) => listSessionLeaderboard(session.id, signal), retry: false });
  const [expanded, setExpanded] = useState(false);
  const rows = query.data ?? [];
  const played = rows.reduce((sum, row) => sum + (row.matches_played ?? 0), 0);
  const points = rows.reduce((sum, row) => sum + (row.points ?? 0), 0);
  return <article className="history-card">
    <button className="history-card-toggle" aria-expanded={expanded} aria-controls={`history-${session.id}`} onClick={() => setExpanded(value => !value)}>
      <span className="history-card-main"><strong>{session.name}</strong><small>{formatDate(session.start_time, language)}</small><small className="session-toggle-hint">{t(expanded ? 'sessions.hideLeaderboard' : 'sessions.viewLeaderboard')}</small></span>
      <span className={`session-status session-status-${session.status}`}>{t(`sessions.status.${session.status}`, { defaultValue: session.status })}</span>
    </button>
    {query.isPending ? <p role="status">{t('sessions.historyLoadingStats')}</p> : query.isError ? <p role="alert">{t('sessions.historyStatsError')} <button className="session-secondary" onClick={() => void query.refetch()}>{t('sessions.retry')}</button></p> : <><div className="history-summary"><span>{t(session.game_mode === 'singles' ? 'sessions.singles' : 'sessions.doubles')}</span><span>{t('sessions.historyMatchesPlayed', { count: played / (session.game_mode === 'doubles' ? 4 : 2) })}</span><span>{t('sessions.historyPointsTotal', { count: points })}</span></div>
    <div id={`history-${session.id}`} hidden={!expanded} className="history-leaderboard"><h2>{t('sessions.historyLeaderboard')}</h2><LeaderboardTable rows={rows} /></div></>}
  </article>;
}

export function HistoryPage({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState<HistoryFilters>(emptyFilters);
  const [page, setPage] = useState(0);
  function changeFilters(patch: Partial<HistoryFilters>) { setFilters(value => ({ ...value, ...patch })); setPage(0); }
  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to);
  const filtered = Boolean(filters.search.trim() || filters.from || filters.to || filters.status !== 'all');
  const query = useQuery({ enabled: !invalidDates, queryKey: ['session-history', userId, page, filters], queryFn: ({ signal }) => listHistory(userId, page, filters, signal), retry: false });
  const sessions = query.data?.sessions ?? [];
  return <section className="history-page" aria-labelledby="history-title">
    <div className="history-heading"><div><h1 id="history-title">{t('sessions.historyTitle')}</h1><p>{t('sessions.historySubtitle')}</p></div></div>
    <div className="history-toolbar"><label className="history-search"><span>{t('sessions.historySearch')}</span><input value={filters.search} onChange={event => changeFilters({ search: event.target.value })} placeholder={t('sessions.historySearch')} /></label>
      <label className="history-filter"><span>{t('sessions.historyFilter')}</span><select value={filters.status} onChange={event => changeFilters({ status: event.target.value as HistoryFilters['status'] })}><option value="all">{t('sessions.historyAll')}</option><option value="completed">{t('sessions.status.completed')}</option><option value="cancelled">{t('sessions.status.cancelled')}</option></select></label></div>
    <div className="history-toolbar history-dates">{(['from', 'to'] as const).map(key => <label key={key}>{t(`sessions.historyDate_${key}`)}<input type="date" min={key === 'to' ? filters.from : undefined} max={key === 'from' ? filters.to : undefined} value={filters[key]} onChange={event => changeFilters({ [key]: event.target.value })} /></label>)}</div>
    {filtered && <button className="session-secondary history-reset" onClick={() => { setFilters(emptyFilters); setPage(0); }}>{t('sessions.clearFilters')}</button>}
    {invalidDates ? <p role="alert" className="session-field-error">{t('sessions.invalidDateRange')}</p> : query.isPending ? <p role="status" className="history-message">{t('sessions.historyLoading')}</p> : query.isError ? <div className="history-message"><p role="alert">{t('sessions.historyError')}</p><button className="session-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('sessions.retry')}</button></div> : sessions.length === 0 ? <div className="history-empty"><h2>{t(filtered ? 'sessions.historyNoResultsTitle' : 'sessions.historyEmptyTitle')}</h2><p>{t(filtered ? 'sessions.historyNoResultsBody' : 'sessions.historyEmptyBody')}</p></div> : <div className="history-list">{sessions.map(session => <SessionStats userId={userId} key={session.id} session={session} language={i18n.language} />)}</div>}
    {!invalidDates && !query.isError && (query.data?.count ?? 0) > SESSION_PAGE_SIZE && <div className="session-pager"><button className="session-secondary" disabled={page === 0 || query.isFetching} onClick={() => setPage(value => value - 1)}>{t('sessions.previous')}</button><span>{t('sessions.page', { page: page + 1 })}</span><button className="session-secondary" disabled={(page + 1) * SESSION_PAGE_SIZE >= (query.data?.count ?? 0) || query.isFetching} onClick={() => setPage(value => value + 1)}>{t('sessions.next')}</button></div>}
  </section>;
}
