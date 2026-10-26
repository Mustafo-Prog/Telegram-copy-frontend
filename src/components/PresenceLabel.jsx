import { useI18n } from '../i18n/I18nProvider.jsx';
import { usePresence } from '../realtime/presence.js';

// Статус собеседника: online / offline / hidden. «Скрыт» не равно «офлайн».
export default function PresenceLabel({ userId, fallback }) {
  const { t } = useI18n();
  const status = usePresence(userId) ?? fallback;
  if (!status) return null;
  if (status === 'online') {
    return (
      <span className="presence presence--online">
        <span className="presence-dot" aria-hidden="true" />
        {t('presence.online')}
      </span>
    );
  }
  if (status === 'offline') return <span className="presence">{t('presence.offline')}</span>;
  return <span className="presence presence--hidden">{t('presence.hidden')}</span>;
}
