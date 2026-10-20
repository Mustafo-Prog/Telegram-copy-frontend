import { useAuth } from '../auth/AuthProvider.jsx';
import Avatar from '../components/Avatar.jsx';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { LogoutIcon } from '../components/icons.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar__header">
          <Avatar name={user.displayName} seed={user.id} size={40} />
          <div className="sidebar__who">
            <div className="sidebar__name">{user.displayName}</div>
            <div className="sidebar__email">{user.email}</div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={logout}
            aria-label={t('sidebar.logout')}
            title={t('sidebar.logout')}
          >
            <LogoutIcon />
          </button>
        </header>
        <ChatList />
        <footer className="sidebar__footer">
          <LanguageSwitcher />
          <ThemeToggle />
        </footer>
      </aside>
      <main className="main">
        <ChatWindow currentUser={user} />
      </main>
    </div>
  );
}
