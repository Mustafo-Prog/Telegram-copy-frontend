import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { SendIcon } from './icons.jsx';

const MAX_FIELD_HEIGHT = 140;

// editing — { id, text }: поле превращается в редактирование сообщения
export default function MessageInput({ onSend, disabled, editing = null, onCancelEdit }) {
  const { t } = useI18n();
  const [text, setText] = useState(editing?.text ?? '');
  const fieldRef = useRef(null);
  const canSend = text.trim().length > 0 && !disabled;

  useEffect(() => {
    setText(editing?.text ?? '');
    if (editing) fieldRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, MAX_FIELD_HEIGHT)}px`;
  }, [text]);

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && editing) {
      e.preventDefault();
      onCancelEdit?.();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="input-wrap">
      {editing && (
        <div className="edit-banner" role="status">
          <span className="edit-banner__label">{t('actions.editing')}</span>
          <button type="button" className="icon-btn" onClick={onCancelEdit} aria-label={t('actions.cancel')}>
            ×
          </button>
        </div>
      )}
      <form className="input-bar" onSubmit={handleSubmit}>
        <textarea
          ref={fieldRef}
          className="input-bar__field"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          enterKeyHint="send"
          maxLength={2000}
        />
        <button
          className="input-bar__send"
          type="submit"
          disabled={!canSend}
          aria-label={editing ? t('actions.save') : t('chat.send')}
          title={editing ? t('actions.save') : t('chat.send')}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
