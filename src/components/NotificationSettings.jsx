import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { setNotificationPreferences, useNotificationPreferences } from '../notifications/preferences.js';
import { requestNotificationPermission, unlockNotificationAudio } from '../notifications/manager.js';
import ModalFrame from './ModalFrame.jsx';
import { BellIcon } from './icons.jsx';

export default function NotificationSettings({ embedded = false }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const preferences = useNotificationPreferences(user.id);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const controls = <>
      <p className="field__hint">{t('notifications.hint')}</p>
      <label className="toggle-row"><span>{t('notifications.enable')}</span><input type="checkbox" checked={preferences.enabled} disabled={pending} onChange={async () => {
        setError(null);
        if (preferences.enabled) { setNotificationPreferences(user.id, { enabled: false }); return; }
        setPending(true);
        try {
          const permission = await requestNotificationPermission();
          if (permission === 'granted') setNotificationPreferences(user.id, { enabled: true });
          else setError(t(permission === 'unsupported' ? 'notifications.unsupported' : 'notifications.denied'));
        } catch { setError(t('notifications.denied')); }
        finally { setPending(false); }
      }} /></label>
      <label className="toggle-row"><span>{t('notifications.sound')}</span><input type="checkbox" checked={preferences.sound} disabled={!preferences.enabled} onChange={() => { unlockNotificationAudio(); setNotificationPreferences(user.id, { sound: !preferences.sound }); }} /></label>
      <label className="toggle-row"><span>{t('notifications.preview')}</span><input type="checkbox" checked={preferences.preview} disabled={!preferences.enabled} onChange={() => setNotificationPreferences(user.id, { preview: !preferences.preview })} /></label>
      {pending && <p role="status">{t('common.loading')}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
  </>;
  if (embedded) return <div className="settings-notifications">{controls}</div>;
  return <>
    <button type="button" className={`icon-btn${preferences.enabled ? ' notification-settings--on' : ''}`} onClick={() => { setOpen(true); unlockNotificationAudio(); }} aria-label={t('notifications.title')} title={t('notifications.title')}><BellIcon /></button>
    {open && <ModalFrame title={t('notifications.title')} onClose={() => setOpen(false)}>{controls}</ModalFrame>}
  </>;
}
