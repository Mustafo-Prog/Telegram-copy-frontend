import { useSyncExternalStore } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { getRealtimeStatus, retryRealtimeConnection, subscribeRealtimeStatus } from '../realtime/socket.js';
import '../styles/reliability.css';

const LABELS = {
  connecting: 'realtime.connecting',
  reconnecting: 'realtime.reconnecting',
  offline: 'realtime.offline',
  unauthorized: 'realtime.unauthorized',
};

export default function RealtimeBanner() {
  const status = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus);
  const { t } = useI18n();
  if (!LABELS[status]) return null;
  const canRetry = status === 'offline' || status === 'reconnecting';
  return <div className={`connection-banner connection-banner--${status}`} role="status" aria-live="polite">
    <span className="connection-banner__indicator" aria-hidden="true" />
    <span className="connection-banner__text">{t(LABELS[status])}</span>
    {canRetry && <button type="button" className="connection-banner__retry" onClick={retryRealtimeConnection}>{t('reliability.retryConnection')}</button>}
  </div>;
}
