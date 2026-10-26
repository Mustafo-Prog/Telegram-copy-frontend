import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { PaperclipIcon, SendIcon } from './icons.jsx';
import { MAX_ATTACHMENT_BYTES, fileSize } from '../utils/messageContent.js';
import VoiceRecorder from './VoiceRecorder.jsx';
import { voiceTime } from '../utils/voiceCapture.js';

const MAX_FIELD_HEIGHT = 140;

// editing — { id, text }: поле превращается в редактирование сообщения
export default function MessageInput({ onSend, onTyping, disabled, editing = null, onCancelEdit, replying = null, onCancelReply }) {
  const { t } = useI18n();
  const [text, setText] = useState(editing?.text ?? '');
  const fieldRef = useRef(null);
  const fileRef = useRef(null);
  const draftRef = useRef('');
  const editingRef = useRef(editing);
  const submittingRef = useRef(false);
  const [file, setFile] = useState(null);
  const [voiceDurationMs, setVoiceDurationMs] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [recording, setRecording] = useState(false);
  const typingTimer = useRef(null);
  const typingCallback = useRef(onTyping);
  typingCallback.current = onTyping;
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const canSend = (text.trim().length > 0 || (!editing && file) || (editing && editing.attachment)) && !disabled && !submitting && !recording;
  useEffect(() => () => { clearTimeout(typingTimer.current); typingCallback.current?.(false); }, []);
  useEffect(() => {
    if (!file || !voiceDurationMs) { setVoiceUrl(null); return undefined; }
    const url = URL.createObjectURL(file); setVoiceUrl(url); return () => URL.revokeObjectURL(url);
  }, [file, voiceDurationMs]);

  useEffect(() => {
    if (editing) {
      if (!editingRef.current) draftRef.current = text;
      setText(editing.text ?? '');
      fieldRef.current?.focus();
    } else if (editingRef.current) setText(draftRef.current);
    editingRef.current = editing;
  }, [editing?.id]);

  useEffect(() => { if (replying) fieldRef.current?.focus(); }, [replying?.id]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    const height = field.scrollHeight + 2;
    field.style.height = `${Math.min(height, MAX_FIELD_HEIGHT)}px`;
    field.style.overflowY = height > MAX_FIELD_HEIGHT ? 'auto' : 'hidden';
  }, [text]);

  const submit = async () => {
    if (!canSend || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const submitted = text;
    try {
      typingCallback.current?.(false); clearTimeout(typingTimer.current);
      const accepted = await onSend(text.trim(), editing ? null : file, editing ? null : voiceDurationMs);
      if (accepted !== false && !editing) {
        setText((current) => current === submitted ? '' : current);
        setFile(null);
        setVoiceDurationMs(null);
        draftRef.current = '';
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && (editing || replying) && !disabled) {
      e.preventDefault();
      onCancelEdit?.();
      onCancelReply?.();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="input-wrap">
      {replying && !editing && (
        <div className="compose-context" role="status">
          <span><strong>{t('actions.replying', { name: replying.senderName ?? t('chat.deletedUser') })}</strong><small>{replying.text || replying.attachment?.name || t('chat.replyMessage')}</small></span>
          <button type="button" className="icon-btn" onClick={onCancelReply} aria-label={t('actions.cancel')}>×</button>
        </div>
      )}
      {editing && (
        <div className="edit-banner" role="status">
          <span className="edit-banner__label">{t('actions.editing')}</span>
          <button type="button" className="icon-btn" disabled={disabled} onClick={onCancelEdit} aria-label={t('actions.cancel')}>
            ×
          </button>
        </div>
      )}
      {file && !editing && (
        <div className="compose-context compose-context--file">
          <PaperclipIcon /><span><strong>{voiceDurationMs ? t('voice.message') : file.name}</strong><small>{voiceDurationMs ? `${voiceTime(voiceDurationMs)} · ` : ''}{fileSize(file.size)}</small></span>
          <button type="button" className="icon-btn" onClick={() => { setFile(null); setVoiceDurationMs(null); }} aria-label={t('chat.removeAttachment')}>×</button>
        </div>
      )}
      {voiceUrl && !editing && <audio className="voice-preview" controls src={voiceUrl} aria-label={t('voice.preview')} />}
      {error && <div className="chat__notice" role="alert">{error}</div>}
      <form className="input-bar" onSubmit={handleSubmit}>
        {!editing && <>
          <input ref={fileRef} type="file" hidden onChange={(e) => {
            const chosen = e.target.files?.[0];
            e.target.value = '';
            if (!chosen) return;
            if (chosen.size > MAX_ATTACHMENT_BYTES) { setError(t('errors.attachment_too_large')); return; }
            setFile(chosen); setVoiceDurationMs(null); setError(null); fieldRef.current?.focus();
          }} />
          <button type="button" disabled={recording} className="icon-btn input-bar__attach" onClick={() => fileRef.current?.click()} aria-label={t('chat.attach')} title={t('chat.fileLimit')}><PaperclipIcon /></button>
        </>}
        <textarea
          ref={fieldRef}
          className="input-bar__field"
          rows={1}
          value={text}
          disabled={disabled || recording}
          onChange={(e) => {
            const value = e.target.value; setText(value); clearTimeout(typingTimer.current);
            typingCallback.current?.(Boolean(value.trim()));
            if (value.trim()) typingTimer.current = setTimeout(() => typingCallback.current?.(false), 3000);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          enterKeyHint="send"
          maxLength={2000}
        />
        {!editing && !file && <VoiceRecorder disabled={disabled || submitting} onRecordingChange={setRecording} onReady={(value, duration) => { setFile(value); setVoiceDurationMs(duration); setError(null); }} />}
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
