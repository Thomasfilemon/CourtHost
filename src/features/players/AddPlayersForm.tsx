import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { normalizeSkillInput, playerInputSchema } from './player-model';
import type { PlayerInput } from './player-model';

type FormValues = { players: PlayerInput[] };

export function AddPlayersForm({ busy, errorKey, onSave, onCancel }: {
  busy: boolean; errorKey: string;
  onSave: (players: PlayerInput[]) => Promise<number>; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { control, register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { players: [{ name: '', skill: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'players' });
  const skillInput = (index: number) => register(`players.${index}.skill`, { valueAsNumber: true });
  const disabled = busy || isSubmitting;
  const submit = handleSubmit(async values => {
    if (disabled) return;
    const players: PlayerInput[] = [];
    let firstInvalid: `players.${number}.${'name' | 'skill'}` | undefined;
    values.players.forEach((value, index) => {
      const parsed = playerInputSchema.safeParse(value);
      if (parsed.success) players.push(parsed.data);
      else for (const issue of parsed.error.issues) {
        const field = issue.path[0] === 'name' ? 'name' : 'skill';
        const path = `players.${index}.${field}` as const;
        firstInvalid ??= path;
        setError(path, { message: field === 'name' ? 'players.nameError' : 'players.skillError' });
      }
    });
    if (firstInvalid) { setFocus(firstInvalid); return; }
    const saved = await onSave(players);
    // A stopped batch keeps only unconfirmed entries, preserving their input.
    if (saved < players.length) {
      if (saved > 0) remove(Array.from({ length: saved }, (_, index) => index));
      setFocus('players.0.name');
    }
  });

  return <form className="player-form" onSubmit={submit} noValidate>
    <div className="sheet-body batch-body">
      <p className="batch-intro">{t('players.addHelp')}</p>
      <div className="batch-players">
        {fields.map((field, index) => <fieldset key={field.id} className="batch-player" disabled={disabled}>
          <legend>{t('players.entryNumber', { number: index + 1 })}</legend>
          <div className="player-fields">
            <div><label htmlFor={`${field.id}-name`}>{t('players.name')}</label>
              <input id={`${field.id}-name`} autoFocus={index === 0} maxLength={100} autoComplete="off"
                aria-invalid={Boolean(errors.players?.[index]?.name)}
                aria-describedby={errors.players?.[index]?.name ? `${field.id}-name-error` : undefined}
                {...register(`players.${index}.name`)} />
              {errors.players?.[index]?.name && <p id={`${field.id}-name-error`} className="field-error">{t('players.nameError')}</p>}
            </div>
            <div><label htmlFor={`${field.id}-skill`}>{t('players.skill')}</label>
              <input id={`${field.id}-skill`} type="number" inputMode="numeric" min={1} max={10} step={1}
                aria-invalid={Boolean(errors.players?.[index]?.skill)}
                aria-describedby={errors.players?.[index]?.skill ? `${field.id}-skill-error` : undefined}
                {...skillInput(index)}
                onChange={event => { event.currentTarget.value = normalizeSkillInput(event.currentTarget.value); skillInput(index).onChange(event); }}
                onBlur={event => { event.currentTarget.value = normalizeSkillInput(event.currentTarget.value, '1'); skillInput(index).onBlur(event); }} />
              {errors.players?.[index]?.skill && <p id={`${field.id}-skill-error`} className="field-error">{t('players.skillError')}</p>}
            </div>
          </div>
          {fields.length > 1 && <button type="button" className="batch-remove"
            aria-label={t('players.removeEntry', { number: index + 1 })}
            onClick={() => { remove(index); setFocus(`players.${Math.max(0, index - 1)}.name`); }}>{t('players.remove')}</button>}
        </fieldset>)}
      </div>
      <button type="button" className="batch-add" disabled={disabled}
        onClick={() => append({ name: '', skill: 1 }, { focusName: `players.${fields.length}.name` })}>
        <span aria-hidden="true">+</span> {t('players.addAnother')}
      </button>
      {errorKey && <p role="alert" className="roster-error">{t(errorKey)}</p>}
    </div>
    <div className="sheet-actions">
      <button type="button" className="roster-text-button" disabled={disabled} onClick={onCancel}>{t('players.cancel')}</button>
      <button type="submit" className="roster-primary" disabled={disabled}>{t(disabled ? 'players.saving' : 'players.addCount', { count: fields.length })}</button>
    </div>
  </form>;
}
