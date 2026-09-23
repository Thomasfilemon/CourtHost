import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Sheet } from '../../components/Sheet';
import { getSessionDetail } from './session-api';
import type { Match, Session, SessionDetail as Detail } from './session-model';

type Action = 'generate_batch' | 'start_match' | 'save_score' | 'finish_match' | 'end_session' | 'cancel_session' | 'delete_session';
type ActionData = { session_id?: string; match_id?: string; team1_score?: number; team2_score?: number; allow_overtime?: boolean };
function ScoreEditor({ match, busy, onAction }: { match: Match; busy: boolean; onAction: (action: Action, data: ActionData) => void }) {
  const { t } = useTranslation();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<{ a: number; b: number }>({
    defaultValues: { a: match.team1_score ?? 0, b: match.team2_score ?? 0 },
  });
  function submit(action: 'save_score' | 'finish_match') {
    return handleSubmit(values => {
      const result = z.object({ a: z.number().int().min(0).max(4), b: z.number().int().min(0).max(4) }).safeParse(values);
      if (!result.success || (values.a + values.b > 4) || (action === 'finish_match' && values.a + values.b !== 4)) {
        setError('a', { message: action === 'finish_match' ? 'sessions.finalScoreError' : 'sessions.scoreError' });
        return;
      }
      onAction(action, { match_id: match.id, team1_score: values.a, team2_score: values.b });
    });
  }
  return <div className="session-score"><div className="session-score-fields">
    <label>{t('sessions.teamOneScore')}<input type="number" min="0" max="4" step="1" inputMode="numeric" disabled={busy} {...register('a', { valueAsNumber: true })} /></label>
    <label>{t('sessions.teamTwoScore')}<input type="number" min="0" max="4" step="1" inputMode="numeric" disabled={busy} {...register('b', { valueAsNumber: true })} /></label>
  </div>{errors.a && <p role="alert" className="session-field-error">{t(errors.a.message!)}</p>}
  <div className="session-action-row"><button type="button" className="roster-text-button" disabled={busy} onClick={() => void submit('save_score')()}>{t('sessions.saveScore')}</button>
    <button type="button" className="roster-primary" disabled={busy} onClick={() => void submit('finish_match')()}>{t('sessions.finishMatch')}</button></div>
  </div>;
}
function MatchCard({ match, detail, busy, onAction, canStart }: {
  match: Match; detail: Detail; busy: boolean; canStart: boolean;
  onAction: (action: Action, data: ActionData) => void;
}) {
  const { t } = useTranslation();
  const members = new Map(detail.participants.map(p => [p.id, p.name_snapshot]));
  const teams = [1, 2].map(team => detail.assignments.filter(p => p.match_id === match.id && p.team === team)
    .map(p => members.get(p.session_player_id) ?? t('sessions.unknownPlayer')).join(' + '));
  return <li className="session-match"><div className="session-match-top"><strong>{t('sessions.matchNumber', { number: match.match_number })}</strong>
    <span className={`session-status session-status-${match.status}`}>{t(`sessions.status.${match.status}`, { defaultValue: match.status })}</span></div>
    <div className="session-teams"><span>{teams[0] || '—'}</span><strong>{match.team1_score ?? '—'} : {match.team2_score ?? '—'}</strong><span>{teams[1] || '—'}</span></div>
    {match.status === 'scheduled' && canStart && <button type="button" className="roster-primary" disabled={busy} onClick={() => onAction('start_match', { match_id: match.id })}>{t('sessions.startMatch')}</button>}
    {match.status === 'in_progress' && <ScoreEditor key={`${match.id}-${match.team1_score}-${match.team2_score}`} match={match} busy={busy} onAction={onAction} />}
  </li>;
}
export function SessionDetail({ session, busy, errorKey, onAction }: {
  session: Session; busy: boolean; errorKey: string;
  onAction: (action: Action, data: ActionData) => void;
}) {
  const { t } = useTranslation();
  const [overtime, setOvertime] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'end_session' | 'cancel_session' | 'delete_session' | null>(null);
  const detail = useQuery({ queryKey: ['session-detail', session.id], queryFn: ({ signal }) => getSessionDetail(session.id, signal), retry: false, gcTime: 0 });
  if (detail.isPending) return <p role="status" className="session-message">{t('sessions.loadingDetail')}</p>;
  if (detail.isError) return <div role="alert" className="session-message"><p>{t('sessions.detailError')}</p><button className="roster-text-button" onClick={() => void detail.refetch()}>{t('sessions.retry')}</button></div>;
  const current = detail.data.matches.find(m => m.status === 'in_progress');
  const firstUpcoming = detail.data.matches.find(m => m.status === 'scheduled');
  return <div className="session-detail">
    <p className="session-meta">{t('sessions.participantSummary', { count: detail.data.participants.length })} · {t('sessions.matchesSummary', { count: detail.data.matches.length })}</p>
    {(session.status === 'draft' || ((session.status === 'scheduled' || session.status === 'active') && !current)) && <div className="session-callout"><p>{t(session.status === 'draft' ? 'sessions.draftExplanation' : 'sessions.nextBatchExplanation')}</p>
      <label className="session-overtime"><input type="checkbox" checked={overtime} onChange={e => setOvertime(e.target.checked)} />{t('sessions.allowOvertime')}</label>
      <button className="roster-primary" disabled={busy} onClick={() => onAction('generate_batch', { session_id: session.id, allow_overtime: overtime })}>{t(session.status === 'draft' ? 'sessions.generate' : 'sessions.generateNext')}</button></div>}
    {detail.data.matches.length > 0 && <ol className="session-match-list">{detail.data.matches.map(match => <MatchCard key={match.id} match={match} detail={detail.data} busy={busy}
      canStart={!current && match.id === firstUpcoming?.id && (session.status === 'scheduled' || session.status === 'active')} onAction={onAction} />)}</ol>}
    {session.status === 'active' && !current && <button className="roster-text-button" disabled={busy} onClick={() => setConfirmAction('end_session')}>{t('sessions.endSession')}</button>}
    {(session.status === 'draft' || session.status === 'scheduled') && <button className="roster-danger-text" disabled={busy} onClick={() => setConfirmAction('cancel_session')}>{t('sessions.cancelSession')}</button>}
    {(session.status === 'completed' || session.status === 'cancelled') && <button className="roster-danger-text" disabled={busy} onClick={() => setConfirmAction('delete_session')}>{t('sessions.deleteSession')}</button>}
    {errorKey && <p role="alert" className="session-field-error">{t(errorKey)}</p>}
    {confirmAction && <Sheet title={t(`sessions.${confirmAction}Title`)} busy={busy} onClose={() => setConfirmAction(null)}>
      <div className="sheet-body"><p>{t(`sessions.${confirmAction}Warning`)}</p>{errorKey && <p role="alert" className="session-field-error">{t(errorKey)}</p>}</div>
      <div className="sheet-actions"><button className="roster-text-button" disabled={busy} onClick={() => setConfirmAction(null)}>{t('sessions.cancel')}</button>
        <button className={confirmAction === 'end_session' ? 'roster-primary' : 'roster-danger'} disabled={busy} onClick={() => { onAction(confirmAction, { session_id: session.id }); setConfirmAction(null); }}>{t(`sessions.${confirmAction}Button`)}</button></div>
    </Sheet>}
  </div>;
}
