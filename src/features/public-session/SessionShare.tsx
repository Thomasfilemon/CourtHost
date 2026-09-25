import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listSessionLeaderboard } from '../sessions/session-api';
import { LeaderboardTable } from '../sessions/LeaderboardTable';
import { Sheet } from '../../components/Sheet';
import { changeShare, getShareDetails } from './share-api';
import { useSessionLive } from './use-session-live';
import './public-session.css';
export function SessionShare({ hostId, sessionId }: { hostId: string; sessionId: string }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [confirm, setConfirm] = useState<'rotate_share' | 'revoke_share' | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const query = useQuery({ queryKey: ['session-share', hostId, sessionId], queryFn: ({ signal }) => getShareDetails(hostId, sessionId, signal), retry: false, gcTime: 0 });
  const leaderboard = useQuery({ queryKey: ['session-leaderboard', hostId, sessionId], queryFn: ({ signal }) => listSessionLeaderboard(sessionId, signal), retry: false, gcTime: 0 });
  async function refresh() {
    await Promise.all([cache.invalidateQueries({ queryKey: ['session-share', hostId, sessionId] }), cache.invalidateQueries({ queryKey: ['sessions', hostId] }), cache.invalidateQueries({ queryKey: ['session-detail', sessionId] }), cache.invalidateQueries({ queryKey: ['session-history', hostId] }), cache.invalidateQueries({ queryKey: ['session-leaderboard', hostId, sessionId] })]);
  }
  const connection = useSessionLive(query.data && !query.isError ? `courthost:${query.data.realtime_token}` : undefined, () => { void refresh(); });
  const mutation = useMutation({ mutationFn: (action: 'rotate_share' | 'revoke_share') => changeShare(sessionId, action), retry: false,
    onSuccess: async () => { setConfirm(null); setCopyMessage(''); await refresh(); } });
  const data = query.isError ? undefined : query.data;
  const url = data && !data.share_revoked_at && data.status !== 'draft' ? `${window.location.origin}/s/${data.public_code}` : '';
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopyMessage('sessions.shareCopied'); }
    catch { setCopyMessage('sessions.shareCopyManual'); }
  }
  return <section className="session-share"><h3>{t('sessions.shareTitle')}</h3>
    {query.isPending ? <p role="status">{t('sessions.historyLoading')}</p> : !data ? <p role="alert">{t('sessions.shareError')} <button onClick={() => void query.refetch()}>{t('sessions.retry')}</button></p> : <>
      <p role="status">{t(`sessions.connection_${connection}`)}</p>
      {data.status === 'draft' ? <p>{t('sessions.shareDraft')}</p> : <>
        <p>{t('sessions.shareExplanation')}</p>
        {url ? <><label>{t('sessions.shareTitle')}<input readOnly value={url} onFocus={event => event.target.select()} /></label><div className="session-share-actions"><button onClick={() => void copy()}>{t('sessions.shareCopy')}</button><a href={url} target="_blank" rel="noreferrer">{t('sessions.shareOpen')}</a></div></> : <p>{t('sessions.shareRevoked')}</p>}
        <div className="session-share-actions"><button disabled={mutation.isPending} onClick={() => { mutation.reset(); setConfirm('rotate_share'); }}>{t('sessions.shareRotate')}</button>{url && <button disabled={mutation.isPending} onClick={() => { mutation.reset(); setConfirm('revoke_share'); }}>{t('sessions.shareRevoke')}</button>}</div>
      </>}
    </>}
    <details><summary>{t('sessions.historyLeaderboard')}</summary>{leaderboard.isPending ? <p role="status">{t('sessions.historyLoadingStats')}</p> : leaderboard.isError ? <p role="alert">{t('sessions.historyStatsError')}</p> : <LeaderboardTable rows={leaderboard.data} />}</details>
    {copyMessage && <p role="status">{t(copyMessage)}</p>}
    {confirm && <Sheet title={t(confirm === 'rotate_share' ? 'sessions.shareRotate' : 'sessions.shareRevoke')} busy={mutation.isPending} onClose={() => setConfirm(null)}><div className="sheet-body"><p>{t('sessions.shareConfirm')}</p>{mutation.isError && <p role="alert">{t('sessions.shareError')}</p>}</div><div className="sheet-actions"><button disabled={mutation.isPending} onClick={() => setConfirm(null)}>{t('sessions.cancel')}</button><button disabled={mutation.isPending} onClick={() => mutation.mutate(confirm)}>{t('sessions.shareConfirmButton')}</button></div></Sheet>}
  </section>;
}
