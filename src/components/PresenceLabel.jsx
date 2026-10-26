import { useI18n } from '../i18n/I18nProvider.jsx';
import { useEffect, useState } from 'react';
import { usePresence, useLastSeen } from '../realtime/presence.js';
import { lastSeenDescription } from '../utils/lastSeen.js';

// Статус собеседника: online / offline / hidden. «Скрыт» не равно «офлайн».
export default function PresenceLabel({ userId, fallback, lastSeenAt }) {
  const { t, lang, formatTime } = useI18n();
  const status = usePresence(userId) ?? fallback;
  const timestamp = useLastSeen(userId);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (status !== 'offline') return undefined;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [status, timestamp, lastSeenAt]);
  if (!status) return null;
  if (status === 'online') {
    return (
      <span className="presence presence--online">
        <span className="presence-dot" aria-hidden="true" />
        {t('presence.online')}
      </span>
    );
  }
  if (status === 'offline') {
    const description = lastSeenDescription(timestamp === undefined ? lastSeenAt : timestamp, now);
    const label = description ? t(description.key, {
      count: description.count,
      time: description.date ? formatTime(description.date) : '',
      date: description.date ? new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: description.date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }).format(description.date) : '',
    }) : t('presence.offline');
    return <span className="presence" title={description ? new Date(timestamp ?? lastSeenAt).toLocaleString(lang) : undefined}>{label}</span>;
  }
  return <span className="presence presence--hidden">{t('presence.hidden')}</span>;
}
