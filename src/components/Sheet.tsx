import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// Native modal dialog supplies focus trapping, Escape handling and background inertness.
// CSS anchors the dialog to the bottom at every viewport size.
export function Sheet({ title, children, onClose, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useTranslation();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="player-sheet" aria-labelledby={titleId} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="sheet-handle" aria-hidden="true" />
    <div className="sheet-heading"><h2 id={titleId}>{title}</h2>
      <button type="button" className="sheet-close" aria-label={t('players.close')} disabled={busy} onClick={onClose}><span aria-hidden="true">×</span></button>
    </div>
    <div className="sheet-content">{children}</div>
  </dialog>;
}
