import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { REACTION_EMOJIS, hasReaction } from '../utils/reactions.js';

export default function MessageReactions({ message, userId, onReact, disabled }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const choose = (emoji) => { setOpen(false); onReact(emoji, !hasReaction(message, emoji, userId)); };
  return <div ref={ref} className="message-reactions" onClick={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}
    onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
    <div className="message-reactions__chips">
      {(message.reactions ?? []).map((reaction) => <button key={reaction.emoji} type="button"
        className={`reaction-chip${hasReaction(message, reaction.emoji, userId) ? ' reaction-chip--own' : ''}`}
        disabled={disabled} aria-pressed={hasReaction(message, reaction.emoji, userId)}
        aria-label={t('reactions.count', { emoji: reaction.emoji, count: reaction.count })} onClick={() => choose(reaction.emoji)}>
        <span>{reaction.emoji}</span><span>{reaction.count}</span>
      </button>)}
      <button type="button" className="reaction-add" disabled={disabled} aria-label={t('reactions.add')} title={t('reactions.add')}
        aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><circle cx="11" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M7 14q4 5 8 0M8 9h.01M14 9h.01M20 2v6M17 5h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
    </div>
    {open && <div className="reaction-picker" role="group" aria-label={t('reactions.add')}>
      {REACTION_EMOJIS.map((emoji) => <button key={emoji} type="button" className="reaction-picker__emoji" disabled={disabled}
        aria-label={emoji} aria-pressed={hasReaction(message, emoji, userId)} onClick={() => choose(emoji)}>{emoji}</button>)}
    </div>}
  </div>;
}
