import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../../components/Sheet';
import { CreateSessionForm } from './CreateSessionForm';
import { SessionDetail } from './SessionDetail';
import { createSession, getHostSession, listSessions, runSessionAction } from './session-api';
import { SESSION_PAGE_SIZE, sessionErrorKey } from './session-model';
import type { Session, SessionFormValues } from './session-model';
import './register-translations';
import './sessions.css';

export function SessionsPage({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [errorKey, setErrorKey] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const query = useQuery({ queryKey: ['sessions', userId, page], queryFn: ({ signal }) => listSessions(userId, page, signal), retry: false, gcTime: 0 });
  const create = useMutation({ mutationFn: createSession, retry: false });
  const action = useMutation({ mutationFn: ({ kind, data }: { kind: Parameters<typeof runSessionAction>[0]; data: Parameters<typeof runSessionAction>[1] }) => runSessionAction(kind, data), retry: false });
  async function submit(values: SessionFormValues) {
    if (lock.current) return;
    lock.current = true; setErrorKey('');
    try {
      const session = await create.mutateAsync(values);
      setCreateOpen(false); setSelected(session.id); setNewSession(session); setNotice('sessions.created'); setPage(0);
      await cache.invalidateQueries({ queryKey: ['sessions', userId] });
    } catch (error) { setErrorKey(sessionErrorKey(error)); }
    finally { lock.current = false; }
  }
  async function run(kind: Parameters<typeof runSessionAction>[0], data: Parameters<typeof runSessionAction>[1]) {
    if (lock.current) return;
    lock.current = true; setErrorKey(''); setNotice('');
    try {
      await action.mutateAsync({ kind, data });
      setNotice(kind === 'generate_batch' ? 'sessions.generated' : kind === 'start_match' ? 'sessions.started' : kind === 'end_session' ? 'sessions.ended' : kind === 'cancel_session' ? 'sessions.cancelled' : kind === 'delete_session' ? 'sessions.deleted' : 'sessions.saved');
      if (kind === 'delete_session') { setSelected(null); setNewSession(null); }
      else if (newSession?.id === selected) setNewSession(await getHostSession(userId, selected!));
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['sessions', userId] }),
        cache.invalidateQueries({ queryKey: ['session-detail', selected] }),
      ]);
    } catch (error) { setErrorKey(sessionErrorKey(error)); }
    finally { lock.current = false; }
  }
  const busy = create.isPending || action.isPending;
  const sessions = query.data?.sessions ?? [];
  // The selected session remains in the paged list after create (the page is reset to 0).
  const current = sessions.find(item => item.id === selected);
  const selectedNewSession = !current && newSession?.id === selected ? newSession : null;
  return <section className="sessions-page" aria-labelledby="sessions-title">
    <div className="session-heading"><div><h1 id="sessions-title">{t('sessions.title')}</h1><p>{t('sessions.subtitle')}</p></div>
      <button className="roster-primary" disabled={busy} onClick={() => { setErrorKey(''); setNotice(''); setCreateOpen(true); }}>{t('sessions.create')}</button></div>
    {notice && <p role="status" className="roster-success">{t(notice)}</p>}
    {query.isPending ? <p role="status" className="session-message">{t('sessions.loading')}</p> : query.isError ?
      <div role="alert" className="session-message"><p>{t('sessions.loadError')}</p><button className="roster-text-button" onClick={() => void query.refetch()}>{t('sessions.retry')}</button></div> :
      sessions.length === 0 && !selectedNewSession ? <div className="session-empty"><h2>{t('sessions.emptyTitle')}</h2><p>{t('sessions.emptyBody')}</p><button className="roster-primary" onClick={() => setCreateOpen(true)}>{t('sessions.create')}</button></div> :
      <div className="session-list">{sessions.map(session => <article key={session.id} className="session-card">
        <button className="session-card-toggle" aria-expanded={selected === session.id} onClick={() => { setErrorKey(''); setSelected(selected === session.id ? null : session.id); }}>
          <span className="session-card-main"><strong>{session.name}</strong><small>{new Intl.DateTimeFormat(i18n.language === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.start_time))}</small></span>
          <span className={`session-status session-status-${session.status}`}>{t(`sessions.status.${session.status}`, { defaultValue: session.status })}</span>
        </button>
        <div className="session-summary"><span>{t(session.game_mode === 'singles' ? 'sessions.singles' : 'sessions.doubles')}</span>
          <span>{t('sessions.minutes', { count: session.duration_minutes })}</span>
          <span>{t(session.matchmaking_mode === 'skill_based' ? 'sessions.skill' : 'sessions.random')}</span></div>
        {selected === session.id && <SessionDetail session={session as Session} busy={busy} errorKey={errorKey} onAction={(kind, data) => void run(kind, data)} />}
      </article>)}
      {(query.data?.count ?? 0) > SESSION_PAGE_SIZE && <div className="session-pager"><button className="roster-text-button" disabled={page === 0 || query.isFetching} onClick={() => { setSelected(null); setPage(p => p - 1); }}>{t('sessions.previous')}</button>
        <span>{t('sessions.page', { page: page + 1 })}</span><button className="roster-text-button" disabled={(page + 1) * SESSION_PAGE_SIZE >= (query.data?.count ?? 0) || query.isFetching} onClick={() => { setSelected(null); setPage(p => p + 1); }}>{t('sessions.next')}</button></div>}
      </div>}
    {selectedNewSession && <article className="session-card"><h2>{selectedNewSession.name}</h2><SessionDetail session={selectedNewSession} busy={busy} errorKey={errorKey} onAction={(kind, data) => void run(kind, data)} /></article>}
    {createOpen && <Sheet title={t('sessions.createTitle')} busy={busy} onClose={() => setCreateOpen(false)}>
      <CreateSessionForm busy={busy} errorKey={errorKey} onCancel={() => setCreateOpen(false)} onCreate={values => void submit(values)} />
    </Sheet>}
  </section>;
}
