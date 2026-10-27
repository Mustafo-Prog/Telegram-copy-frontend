import { useI18n } from '../i18n/I18nProvider.jsx';
import { useTheme } from '../theme/ThemeProvider.jsx';
import ModalFrame from './ModalFrame.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import NotificationSettings from './NotificationSettings.jsx';
import '../styles/settings.css';

export default function SettingsModal({ onClose, notifications = true }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  return <ModalFrame title={t('settings.title')} onClose={onClose}>
    <div className="settings-panel">
      <section className="settings-section" aria-labelledby="settings-language-title">
        <div className="settings-row">
          <h3 id="settings-language-title">{t('settings.language')}</h3>
          <LanguageSwitcher />
        </div>
      </section>
      <section className="settings-section" aria-labelledby="settings-appearance-title">
        <h3 id="settings-appearance-title">{t('settings.appearance')}</h3>
        <div className="settings-row">
          <div><span>{t('settings.theme')}</span><small>{t(theme === 'dark' ? 'settings.dark' : 'settings.light')}</small></div>
          <ThemeToggle />
        </div>
      </section>
      {notifications && <section className="settings-section" aria-labelledby="settings-notifications-title">
        <h3 id="settings-notifications-title">{t('notifications.title')}</h3>
        <NotificationSettings embedded />
      </section>}
    </div>
  </ModalFrame>;
}
