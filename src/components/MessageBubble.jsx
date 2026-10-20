import { useI18n } from '../i18n/I18nProvider.jsx';
import { hueFromSeed } from '../utils/hue.js';
import Avatar from './Avatar.jsx';
import { CheckCheckIcon } from './icons.jsx';

export default function MessageBubble({ message, isOwn, startsGroup, endsGroup }) {
  const { t, formatTime } = useI18n();
  const author = message.senderName ?? t('chat.deletedUser');
  const seed = message.senderId ?? 'deleted';

  const rowClass = ['bubble-row', isOwn && 'bubble-row--own', startsGroup && 'bubble-row--start']
    .filter(Boolean)
    .join(' ');
  const bubbleClass = ['bubble', isOwn && 'bubble--own', endsGroup && 'bubble--tail']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass} style={{ '--hue': hueFromSeed(seed) }}>
      {!isOwn && (
        <div className="bubble-row__avatar">
          {endsGroup && <Avatar name={author} seed={seed} size={34} />}
        </div>
      )}
      <div className={bubbleClass}>
        {!isOwn && startsGroup && <div className="bubble__author">{author}</div>}
        <div className="bubble__text">{message.text}</div>
        <div className="bubble__meta">
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && <CheckCheckIcon className="bubble__ticks" />}
        </div>
      </div>
    </div>
  );
}
