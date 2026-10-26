import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function ModalFrame({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const { t } = useI18n();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('input, button')?.focus();
    const onKey = (event) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((el) => el.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div ref={ref} className={`modal feature-modal${wide ? ' feature-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal__header"><h2>{title}</h2><button type="button" className="icon-btn" aria-label={t('profile.close')} onClick={onClose}>×</button></header>
      {children}
    </div>
  </div>;
}
