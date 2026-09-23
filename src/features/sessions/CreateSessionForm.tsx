import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { listActiveRoster } from './session-api';
import { sessionFormSchema } from './session-model';
import type { SessionFormValues } from './session-model';

function normalizePositiveInteger(value: string, emptyFallback = '') {
  if (value.trim() === '') return emptyFallback;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || !Number.isInteger(numericValue) || numericValue < 1) return '1';
  return String(Math.min(numericValue, 1440));
}

function localDateTime(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
export function CreateSessionForm({ busy, errorKey, onCancel, onCreate }: {
  busy: boolean; errorKey: string; onCancel: () => void; onCreate: (values: SessionFormValues) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { register, handleSubmit, setValue, setError, clearErrors, watch, formState: { errors } } = useForm<SessionFormValues>({
    defaultValues: {
      name: '', startTime: localDateTime(new Date(Date.now() + 3600000)),
      durationMinutes: 120, estimatedMatchMinutes: 20,
      gameMode: 'singles', matchmakingMode: 'random', playerIds: [],
    },
  });
  const roster = useQuery({ queryKey: ['session-roster'], queryFn: ({ signal }) => listActiveRoster(signal), retry: false });
  const playerIds = watch('playerIds');
  const gameMode = watch('gameMode');
  const matches = roster.data?.filter(p => p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  const submit = handleSubmit(values => {
    if (busy || roster.isPending || roster.isError) return;
    const result = sessionFormSchema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof SessionFormValues;
        const key = field === 'playerIds' ? issue.message : field === 'estimatedMatchMinutes' && issue.message === 'estimateTooLong' ? issue.message : `${field}Invalid`;
        setError(field, { message: key }, { shouldFocus: true });
      }
      return;
    }
    onCreate(result.data);
  });
  function toggle(id: string, checked: boolean) {
    setValue('playerIds', checked ? [...playerIds, id] : playerIds.filter(existing => existing !== id), { shouldValidate: true });
    clearErrors('playerIds');
  }
  const estimateInput = register('estimatedMatchMinutes', { valueAsNumber: true });
  return <form className="session-form" onSubmit={submit} noValidate>
    <div className="sheet-body session-form-content">
      <p className="session-subtitle">{t('sessions.createSubtitle')}</p>
      <div className="session-field"><label htmlFor="session-name">{t('sessions.name')}</label>
        <input id="session-name" autoFocus maxLength={120} autoComplete="off" disabled={busy} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'session-name-error' : undefined} {...register('name')} />
        {errors.name && <p id="session-name-error" role="alert" className="session-field-error">{t('sessions.nameInvalid')}</p>}
      </div>
      <div className="session-field"><label htmlFor="session-start">{t('sessions.date')}</label>
        <input id="session-start" type="datetime-local" disabled={busy} aria-invalid={Boolean(errors.startTime)} aria-describedby={errors.startTime ? 'session-start-error' : undefined} {...register('startTime')} />
        {errors.startTime && <p id="session-start-error" role="alert" className="session-field-error">{t('sessions.startTimeInvalid')}</p>}
      </div>
      <div className="session-field"><label htmlFor="session-duration">{t('sessions.duration')}</label>
      <select id="session-duration" disabled={busy} aria-invalid={Boolean(errors.durationMinutes)} aria-describedby={errors.durationMinutes ? 'session-duration-error' : undefined} {...register('durationMinutes', { valueAsNumber: true })}>
        {[60, 120, 180, 240].map(minutes => <option key={minutes} value={minutes}>{t('sessions.minutes', { count: minutes })}</option>)}
      </select>
      {errors.durationMinutes && <p id="session-duration-error" role="alert" className="session-field-error">{t('sessions.durationMinutesInvalid')}</p>}
      </div>
      <div className="session-field"><label htmlFor="session-estimate">{t('sessions.matchEstimate')}</label>
      <input id="session-estimate" type="number" min="1" max="1440" step="1" inputMode="numeric" disabled={busy} aria-invalid={Boolean(errors.estimatedMatchMinutes)} aria-describedby={errors.estimatedMatchMinutes ? 'session-estimate-error' : undefined} {...estimateInput}
        onChange={event => { event.currentTarget.value = normalizePositiveInteger(event.currentTarget.value); estimateInput.onChange(event); }}
        onBlur={event => { event.currentTarget.value = normalizePositiveInteger(event.currentTarget.value, '1'); estimateInput.onBlur(event); }} />
      {errors.estimatedMatchMinutes && <p id="session-estimate-error" role="alert" className="session-field-error">{t(errors.estimatedMatchMinutes.message === 'estimateTooLong' ? 'sessions.estimateTooLong' : 'sessions.estimatedMatchMinutesInvalid')}</p>}
      </div>
      <fieldset className="session-options"><legend>{t('sessions.format')}</legend>
        <label><input type="radio" value="singles" disabled={busy} {...register('gameMode')} />{t('sessions.singles')}</label>
        <label><input type="radio" value="doubles" disabled={busy} {...register('gameMode')} />{t('sessions.doubles')}</label>
      </fieldset>
      <fieldset className="session-options"><legend>{t('sessions.generator')}</legend>
        <label><input type="radio" value="random" disabled={busy} {...register('matchmakingMode')} />{t('sessions.random')}</label>
        <label><input type="radio" value="skill_based" disabled={busy} {...register('matchmakingMode')} />{t('sessions.skill')}</label>
      </fieldset>
      <fieldset className="session-roster"><legend>{t('sessions.selectPlayers', { count: playerIds.length, min: gameMode === 'singles' ? 2 : 4 })}</legend>
        <input aria-label={t('sessions.searchPlayers')} placeholder={t('sessions.searchPlayers')} value={search} onChange={event => setSearch(event.target.value)} />
        {roster.isPending && <p role="status">{t('sessions.loadingRoster')}</p>}
        {roster.isError && <div role="alert"><p>{t('sessions.rosterError')}</p><button type="button" className="roster-text-button" onClick={() => void roster.refetch()}>{t('sessions.retry')}</button></div>}
        {roster.isSuccess && roster.data.length === 0 && <p>{t('sessions.noPlayers')}</p>}
        {roster.isSuccess && roster.data.length > 0 && matches.length === 0 && <p>{t('sessions.noSearchResults')}</p>}
        <div className="session-roster-list">{matches.map(player => <label key={player.id} className="session-roster-row">
          <input type="checkbox" aria-label={player.name} checked={playerIds.includes(player.id)} onChange={event => toggle(player.id, event.target.checked)} disabled={busy} />
          <span className="session-skill">{player.default_skill_rating}</span><span>{player.name}</span>
        </label>)}</div>
      </fieldset>
      {errors.playerIds && <p id="session-players-error" role="alert" className="session-field-error">{t('sessions.playersRequired', { count: gameMode === 'singles' ? 2 : 4 })}</p>}
      {errorKey && <p role="alert" className="session-field-error">{t(errorKey)}</p>}
      <p className="session-hint">{t('sessions.draftHint')}</p>
    </div>
    <div className="sheet-actions"><button className="roster-text-button" type="button" disabled={busy} onClick={onCancel}>{t('sessions.cancel')}</button>
      <button type="submit" className="roster-primary" disabled={busy || roster.isPending || roster.isError}>{t(busy ? 'sessions.saving' : 'sessions.saveDraft')}</button></div>
  </form>;
}
