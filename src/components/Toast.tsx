import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function Toast({ children, onDismiss }: { children: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [children, onDismiss, hovered, focused]);
  return <div className="roster-toast" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <span className="toast-check" aria-hidden="true">✓</span>
    <p role="status" aria-atomic="true">{children}</p>
    <button type="button" onClick={onDismiss} aria-label={t('players.dismissNotification')}><span aria-hidden="true">×</span></button>
  </div>;
}
