import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { hueFromSeed } from '../utils/hue.js';
import Avatar from './Avatar.jsx';
import { BookmarkIcon, CheckCheckIcon, CheckIcon } from './icons.jsx';
import MessageAttachment from './MessageAttachment.jsx';
import AccountStatusBadge from './AccountStatusBadge.jsx';
import MessageReactions from './MessageReactions.jsx';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

export default function MessageBubble({
  message,
  isOwn,
  startsGroup,
  endsGroup,
  onOpenProfile,
  selecting = false,
  selected = false,
  onToggleSelect,
  onOpenMenu,
  onRetry,
  onDiscard,
  read = false,
  onJumpToMessage,
  onSave,
  hideReceipt = false,
  currentUserId,
  onReact,
  reacting = false,
  onShowReaders,
}) {
  const { t, formatTime } = useI18n();
  const author = message.senderName ?? t('chat.deletedUser');
  const seed = message.senderId ?? 'deleted';
  const canOpenProfile = !isOwn && Boolean(message.senderId) && Boolean(onOpenProfile);
  const canUseMenu = !message.pending && !selecting && Boolean(onOpenMenu);
  const openProfile = () => onOpenProfile(message);

  const pressTimer = useRef(null);
  const pressStart = useRef(null);
  // Флаг «было долгое нажатие» сбрасывается при каждом новом касании — иначе следующий клик проглатывается
  const longPressed = useRef(false);

  const cancelPress = () => {
    clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const onTouchStart = (e) => {
    longPressed.current = false;
    if (!canUseMenu) return;
    const touch = e.touches[0];
    pressStart.current = { x: touch.clientX, y: touch.clientY };
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onOpenMenu(touch.clientX, touch.clientY);
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e) => {
    const touch = e.touches[0];
    const start = pressStart.current;
    if (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > MOVE_TOLERANCE_PX) cancelPress();
  };

  const onTouchEnd = (e) => {
    cancelPress();
    if (longPressed.current) e.preventDefault();
  };

  const onContextMenu = (e) => {
    if (!canUseMenu) return;
    e.preventDefault();
    onOpenMenu(e.clientX, e.clientY);
  };

  const onClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (selecting && !message.pending) onToggleSelect?.(message.id);
  };

  const rowClass = [
    'bubble-row',
    isOwn && 'bubble-row--own',
    startsGroup && 'bubble-row--start',
    message.pending && 'bubble-row--pending',
    selecting && 'bubble-row--selecting',
    selected && 'bubble-row--selected',
  ]
    .filter(Boolean)
    .join(' ');
  const bubbleClass = ['bubble', isOwn && 'bubble--own', endsGroup && 'bubble--tail'].filter(Boolean).join(' ');

  const avatar = <Avatar name={author} seed={seed} size={34} src={message.senderAvatarUrl} />;

  return (
    <div className={rowClass} data-message-id={message.id} style={{ '--hue': hueFromSeed(seed) }}>
      {selecting && <span className={`bubble-check${selected ? ' bubble-check--on' : ''}`} aria-hidden="true" />}
      {!isOwn && (
        <div className="bubble-row__avatar">
          {endsGroup &&
            (canOpenProfile ? (
              <button type="button" className="bubble-row__avatar-btn" onClick={openProfile} aria-label={author}>
                {avatar}
              </button>
            ) : (
              avatar
            ))}
        </div>
      )}
      <div
        className={bubbleClass}
        tabIndex={canUseMenu ? 0 : undefined}
        onKeyDown={(e) => {
          if (canUseMenu && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
            e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); onOpenMenu(rect.left + 12, rect.top + 12);
          }
        }}
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelPress}
        onContextMenu={onContextMenu}
      >
        {!isOwn &&
          startsGroup &&
          (canOpenProfile ? (
            <button
              type="button"
              className="bubble__author bubble__author--link"
              onClick={(e) => {
                e.stopPropagation();
                openProfile();
              }}
            >
              {author}<AccountStatusBadge status={message.senderStatus} premiumExpiresAt={message.senderPremiumExpiresAt} compact />
            </button>
          ) : (
            <div className="bubble__author">{author}<AccountStatusBadge status={message.senderStatus} premiumExpiresAt={message.senderPremiumExpiresAt} compact /></div>
          ))}
        {message.savedFrom && <div className="saved-message-source">{t('saved.from', { name: message.savedFrom.senderName || t('chat.deletedUser') })}</div>}
        {message.replyTo && <button type="button" className="bubble__reply" onClick={(e) => {
          e.stopPropagation(); onJumpToMessage?.(message.replyTo.id);
        }} disabled={message.replyTo.unavailable}>
          <strong>{message.replyTo.unavailable ? t('chat.replyUnavailable') : message.replyTo.senderName ?? t('chat.replyMessage')}</strong>
          <span>{message.replyTo.unavailable ? t('chat.originalUnavailable') : message.replyTo.text || message.replyTo.attachmentName || t('chat.replyMessage')}</span>
        </button>}
        {message.attachment && <MessageAttachment attachment={message.attachment} />}
        {message.text && <div className="bubble__text">{message.text}</div>}
        {onReact && !message.pending && !selecting && <MessageReactions message={message} userId={currentUserId} onReact={onReact} disabled={reacting} />}
        <div className="bubble__meta">
          {message.editedAt && <span className="bubble__edited">{t('chat.edited')}</span>}
          <span>{message.pending ? '…' : formatTime(message.createdAt)}</span>
          {isOwn && !message.pending && !hideReceipt && <span className="bubble__receipt" role="img" aria-label={t(read ? 'chat.read' : 'chat.sent')} title={t(read ? 'chat.read' : 'chat.sent')}>
            {read ? <CheckCheckIcon className="bubble__ticks" /> : <CheckIcon className="bubble__ticks" />}
          </span>}
          {onShowReaders && isOwn && !message.pending && !selecting && <button type="button" className="bubble__readers" aria-label={t('readers.title')} title={t('readers.title')}
            onClick={(event) => { event.stopPropagation(); onShowReaders(); }} onTouchStart={(event) => event.stopPropagation()}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
          </button>}
        </div>
        {message.failed && (
          <div className="bubble__failed" role="alert">
            <span>{t('chat.notSent')}</span>
            <button type="button" className="bubble__failed-btn" onClick={onRetry}>
              {t('chat.retry')}
            </button>
            <button type="button" className="bubble__failed-btn" onClick={onDiscard}>
              {t('chat.discard')}
            </button>
          </div>
        )}
      </div>
      {onSave && !message.pending && !selecting && <button type="button" className="bubble-row__save icon-btn" onClick={onSave} aria-label={t('saved.save')} title={t('saved.save')}><BookmarkIcon width={17} height={17} /></button>}
    </div>
  );
}
