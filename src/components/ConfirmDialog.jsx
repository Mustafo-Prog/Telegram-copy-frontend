import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';

// Окно подтверждения. options — варианты (например, «у меня» / «у всех»), первый выбран по умолчанию.
export default function ConfirmDialog({ title, text, options = [], confirmLabel, danger = false, onConfirm, onCancel }) {
  const { t } = useI18n();
  const [choice, setChoice] = useState(options[0]?.value ?? null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal confirm" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="confirm__title">{title}</h2>
        {text && <p className="confirm__text">{text}</p>}
        {options.length > 0 && (
          <div className="confirm__options" role="radiogroup">
            {options.map((opt) => (
              <label key={opt.value} className={`confirm__option${choice === opt.value ? ' confirm__option--on' : ''}`}>
                <input
                  type="radio"
                  name="confirm-option"
                  value={opt.value}
                  checked={choice === opt.value}
                  onChange={() => setChoice(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        )}
        <div className="confirm__actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => onConfirm(choice)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
