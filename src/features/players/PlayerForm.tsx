import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { normalizeSkillInput, playerInputSchema } from './player-model';
import type { Player, PlayerInput } from './player-model';

export function PlayerForm({ player, busy, errorKey, onSave, onCancel }: {
  player?: Player; busy: boolean; errorKey: string;
  onSave: (values: PlayerInput) => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<PlayerInput>({
    defaultValues: { name: player?.name ?? '', skill: player?.default_skill_rating ?? 1 },
  });
  const skillInput = register('skill', { valueAsNumber: true });
  const submit = handleSubmit(values => {
    if (busy) return;
    const parsed = playerInputSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as 'name' | 'skill';
        setError(field, { message: field === 'name' ? 'players.nameError' : 'players.skillError' }, { shouldFocus: true });
      }
      return;
    }
    onSave(parsed.data);
  });
  return <form className="player-form" onSubmit={submit} noValidate>
    <div className="sheet-body">
      <div className="player-fields">
        <div><label htmlFor="player-name">{t('players.name')}</label>
          <input id="player-name" autoFocus maxLength={100} autoComplete="off" disabled={busy}
            aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} {...register('name')} />
          {errors.name && <p id="name-error" className="field-error">{t(errors.name.message!)}</p>}
        </div>
        <div><label htmlFor="player-skill">{t('players.skill')}</label>
          <input id="player-skill" type="number" inputMode="numeric" min={1} max={10} step={1} disabled={busy}
            aria-invalid={Boolean(errors.skill)} aria-describedby={errors.skill ? 'skill-error' : 'skill-note'} {...skillInput}
            onChange={event => { event.currentTarget.value = normalizeSkillInput(event.currentTarget.value); skillInput.onChange(event); }}
            onBlur={event => { event.currentTarget.value = normalizeSkillInput(event.currentTarget.value, '1'); skillInput.onBlur(event); }} />
          {errors.skill && <p id="skill-error" className="field-error">{t(errors.skill.message!)}</p>}
        </div>
      </div>
      <p id="skill-note" className="player-note">{t('players.snapshotNote')}</p>
      {errorKey && <p role="alert" className="roster-error">{t(errorKey)}</p>}
    </div>
    <div className="sheet-actions">
      <button type="button" className="roster-text-button" disabled={busy} onClick={onCancel}>{t('players.cancel')}</button>
      <button type="submit" className="roster-primary" disabled={busy}>{t(busy ? 'players.saving' : player ? 'players.save' : 'players.add')}</button>
    </div>
  </form>;
}
