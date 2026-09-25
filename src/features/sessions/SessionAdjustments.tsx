import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../../components/Sheet';
import { runSessionAction } from './session-api';
import { finalScoreSchema, sessionErrorKey } from './session-model';
import type { Match, Session, SessionDetail } from './session-model';

type Adjustment = { kind: 'correct_result'; match: Match } | { kind: 'withdraw_player'; playerId: string } | { kind: 'cancel_match'; match: Match };
type Score = { a: number; b: number };
function CorrectionForm({ match, busy, onConfirm }: { match: Match; busy: boolean; onConfirm: (score: Score) => void }) {
  const { t } = useTranslation();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Score>({ defaultValues: { a: match.team1_score ?? 0, b: match.team2_score ?? 0 } });
  function submit(score: Score) {
    if (!finalScoreSchema.safeParse(score).success) { setError('a', { message: 'sessions.finalScoreError' }); return; }
    onConfirm(score);
  }
  return <form onSubmit={handleSubmit(submit)} noValidate>
    <div className="session-score-fields">
      <label>{t('sessions.teamOneScore')}<input type="number" min="0" max="4" step="1" inputMode="numeric" disabled={busy} {...register('a', { valueAsNumber: true })} /></label>
      <label>{t('sessions.teamTwoScore')}<input type="number" min="0" max="4" step="1" inputMode="numeric" disabled={busy} {...register('b', { valueAsNumber: true })} /></label>
    </div>
    {errors.a && <p role="alert" className="session-field-error">{t(errors.a.message!)}</p>}
    <div className="session-action-row"><button className="roster-primary" disabled={busy}>{t('sessions.confirmCorrection')}</button></div>
  </form>;
}

export function SessionAdjustments({ session, detail, busy }: { session: Session; detail: SessionDetail; busy: boolean }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [selected, setSelected] = useState<Adjustment | null>(null);
  const [matchId, setMatchId] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const mutation = useMutation({ mutationFn: ({ kind, data }: { kind: Adjustment['kind']; data: Parameters<typeof runSessionAction>[1] }) => runSessionAction(kind, data), retry: false });
  const disabled = busy || mutation.isPending;
  const current = detail.matches.find(match => match.status === 'in_progress');
  const completed = detail.matches.filter(match => match.status === 'completed');
  const correction = completed.find(match => match.id === matchId) ?? completed[0];
  const player = selected?.kind === 'withdraw_player' ? detail.participants.find(item => item.id === selected.playerId) : undefined;
  const affected = player ? detail.matches.filter(match => match.status === 'scheduled' && detail.assignments.some(item => item.match_id === match.id && item.session_player_id === player.id)).length : 0;
  function open(value: Adjustment) { mutation.reset(); setNotice(''); setSelected(value); }
  async function confirm(score?: Score) {
    if (!selected || disabled || lock.current) return;
    lock.current = true;
    const data = selected.kind === 'withdraw_player' ? { session_id: session.id, session_player_id: selected.playerId }
      : selected.kind === 'correct_result' ? { match_id: selected.match.id, team1_score: score?.a, team2_score: score?.b }
      : { match_id: selected.match.id };
    try {
      await mutation.mutateAsync({ kind: selected.kind, data });
      setNotice(`sessions.${selected.kind}Success`); setSelected(null);
      // Refresh host data even if Broadcast is unavailable. Public readers use the database signal.
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['sessions', session.host_id] }),
        cache.invalidateQueries({ queryKey: ['session-detail', session.id] }),
        cache.invalidateQueries({ queryKey: ['session-leaderboard', session.host_id, session.id] }),
        cache.invalidateQueries({ queryKey: ['session-history', session.host_id] }),
        cache.invalidateQueries({ queryKey: ['session-history-stats', session.host_id, session.id] }),
      ]);
    } catch { /* Mutation error stays in the open dialog; never claim a failed write succeeded. */ }
    finally { lock.current = false; }
  }
  // The database enforces this too, including state changes while a dialog was open.
  if (session.status !== 'active') return null;
  return <details className="session-adjustments"><summary>{t('sessions.adjustmentsTitle')}</summary>
    {notice && <p role="status" className="roster-success">{t(notice)}</p>}
    {completed.length > 0 && <section className="session-adjustment-section"><h3>{t('sessions.correctResult')}</h3>
      <label>{t('sessions.selectCompletedMatch')}<select value={correction?.id ?? ''} disabled={disabled} onChange={event => setMatchId(event.target.value)}>{completed.map(match => <option key={match.id} value={match.id}>{t('sessions.matchNumber', { number: match.match_number })} · {match.team1_score} : {match.team2_score}</option>)}</select></label>
      <button className="roster-text-button" disabled={disabled || !correction} onClick={() => correction && open({ kind: 'correct_result', match: correction })}>{t('sessions.correctResult')}</button>
    </section>}
    {current && <section className="session-adjustment-section"><h3>{t('sessions.cancelPlayingMatch')}</h3><p>{t('sessions.cancelPlayingHelp')}</p><button className="roster-danger-text" disabled={disabled} onClick={() => open({ kind: 'cancel_match', match: current })}>{t('sessions.cancelPlayingMatch')}</button></section>}
    <section className="session-adjustment-section"><h3>{t('sessions.withdrawPlayer')}</h3><p>{t('sessions.withdrawHelp')}</p>
      <ul className="session-withdraw-list">{detail.participants.map(item => {
        const playing = Boolean(current && detail.assignments.some(assignment => assignment.match_id === current.id && assignment.session_player_id === item.id));
        return <li key={item.id}><span>{item.name_snapshot}{item.is_retired && <small> · {t('sessions.withdrawn')}</small>}{playing && <small> · {t('sessions.withdrawPlaying')}</small>}</span>
          {!item.is_retired && <button className="roster-danger-text" disabled={disabled || playing} onClick={() => open({ kind: 'withdraw_player', playerId: item.id })} aria-label={t('sessions.withdrawNamed', { name: item.name_snapshot })}>{t('sessions.withdrawPlayer')}</button>}</li>;
      })}</ul>
    </section>
    {selected && <Sheet title={t(`sessions.${selected.kind}Title`)} busy={disabled} onClose={() => setSelected(null)}>
      <div className="sheet-body">
        {selected.kind === 'correct_result' ? <>
          <p>{t('sessions.correctionWarning', { number: selected.match.match_number, a: selected.match.team1_score, b: selected.match.team2_score })}</p>
          <CorrectionForm match={selected.match} busy={disabled} onConfirm={score => void confirm(score)} />
        </> : <><p>{selected.kind === 'withdraw_player' ? t('sessions.withdrawWarning', { name: player?.name_snapshot, count: affected }) : t('sessions.cancelMatchWarning', { number: selected.match.match_number })}</p>
          <div className="session-action-row"><button className="roster-danger" disabled={disabled} onClick={() => void confirm()}>{t('sessions.confirmAdjustment')}</button></div></>}
        {mutation.isError && <p role="alert" className="session-field-error">{t(sessionErrorKey(mutation.error))}</p>}
      </div>
      <div className="sheet-actions"><button className="roster-text-button" disabled={disabled} onClick={() => setSelected(null)}>{t('sessions.cancel')}</button></div>
    </Sheet>}
  </details>;
}
