import { useRef } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { hueFromSeed } from '../utils/hue.js';
import Avatar from './Avatar.jsx';
import { CheckCheckIcon } from './icons.jsx';

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
    <div className={rowClass} style={{ '--hue': hueFromSeed(seed) }}>
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
              {author}
            </button>
          ) : (
            <div className="bubble__author">{author}</div>
          ))}
        <div className="bubble__text">{message.text}</div>
        <div className="bubble__meta">
          {message.editedAt && <span className="bubble__edited">{t('chat.edited')}</span>}
          <span>{message.pending ? '…' : formatTime(message.createdAt)}</span>
          {isOwn && !message.pending && <CheckCheckIcon className="bubble__ticks" />}
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
    </div>
  );
}
