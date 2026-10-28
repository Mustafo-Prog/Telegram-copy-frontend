import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import ChatEmptyState from '../components/ChatEmptyState.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import { SettingsIcon } from '../components/icons.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useIsMobile } from '../utils/useIsMobile.js';
import {
  DEMO_ME_ID,
  clearDemoChat,
  createDemoStore,
  deleteDemoChat,
  editDemoMessage,
  loadDemoMessages,
  removeDemoMessages,
  sendDemoMessage,
  reactDemoMessage,
} from '../demo/demoStore.js';

const minutesAgo = (n) => new Date(Date.now() - n * 60 * 1000).toISOString();

// Вымышленные переписки. Тексты — ключи переводов, поэтому язык интерфейса меняет и демо-тексты.
const SEED = [
  {
    id: 'alex',
    titleKey: 'demo.chats.alex.title',
    subtitleKey: 'demo.chats.alex.status',
    presence: 'offline',
    lastSeenAt: minutesAgo(8),
    messages: [
      { id: 'a1', senderId: 'demo-alex', senderName: 'Alex Morgan', textKey: 'demo.chats.alex.m1', createdAt: minutesAgo(30) },
      { id: 'a2', senderId: DEMO_ME_ID, senderName: '', textKey: 'demo.chats.alex.m2', createdAt: minutesAgo(25), readByPeer: true },
      { id: 'a3', senderId: 'demo-alex', senderName: 'Alex Morgan', textKey: 'demo.chats.alex.m3', createdAt: minutesAgo(20) },
    ],
  },
  {
    id: 'design',
    titleKey: 'demo.chats.design.title',
    subtitleKey: 'demo.chats.design.status',
    messages: [
      { id: 'd1', senderId: 'demo-mia', senderName: 'Mia', textKey: 'demo.chats.design.m1', createdAt: minutesAgo(90) },
      { id: 'd2', senderId: 'demo-sam', senderName: 'Sam', textKey: 'demo.chats.design.m2', createdAt: minutesAgo(60) },
    ],
  },
  {
    id: 'updates',
    titleKey: 'demo.chats.updates.title',
    subtitleKey: 'demo.chats.updates.status',
    messages: [
      { id: 'u1', senderId: 'demo-updates', senderName: 'Project Updates', textKey: 'demo.chats.updates.m1', createdAt: minutesAgo(120) },
    ],
  },
];

// Демоверсия: без входа, без API и без токена. Открывается по кнопке на экране входа.
export default function DemoPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [store] = useState(() => createDemoStore(SEED));
  const [, setVersion] = useState(0);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [activeId, setActiveId] = useState(null);

  const me = useMemo(
    () => ({ id: DEMO_ME_ID, displayName: t('demo.you'), username: null, avatarUrl: null }),
    [t]
  );

  // Тексты разрешаются в момент чтения, поэтому смена языка действует сразу
  const resolve = (m) => ({
    ...m,
    text: m.textKey ? t(m.textKey) : m.text,
    senderName: m.senderId === DEMO_ME_ID ? t('demo.you') : m.senderName,
    replyTo: m.replyTo ? { ...m.replyTo, text: m.replyTo.textKey ? t(m.replyTo.textKey) : m.replyTo.text,
      senderName: m.replyTo.senderId === DEMO_ME_ID ? t('demo.you') : m.replyTo.senderName } : null,
  });

  const chats = store.chats;
  const active = chats.find((c) => c.id === activeId) ?? null;
  const chatOpen = Boolean(active) && (!isMobile || Boolean(activeId));
  const change = (action) => { const result = action(); setVersion((v) => v + 1); return result; };

  const demoChat = active
    ? {
        key: `demo-${sessionId}-${active.id}-${lang}`,
        backgroundKey: `demo-${active.id}`,
        demo: true,
        scope: 'direct',
        title: t(active.titleKey),
        subtitle: t(active.subtitleKey),
        presenceUserId: active.presence ? `demo-${active.id}` : null,
        presence: active.presence,
        lastSeenAt: active.lastSeenAt,
        avatar: { name: t(active.titleKey), seed: active.id },
        load: async () => loadDemoMessages(store, active.id, resolve),
        send: async (text, options) => resolve(change(() => sendDemoMessage(store, active.id, text, me, options))),
        react: async (messageId, emoji, value) => change(() => reactDemoMessage(store, active.id, messageId, me.id, emoji, value)),
        edit: async (id, text) => resolve(change(() => editDemoMessage(store, active.id, id, text, me.id))),
        remove: async (ids) => change(() => removeDemoMessages(store, active.id, ids, me.id)),
        clear: async () => {
          clearDemoChat(store, active.id);
          setVersion((v) => v + 1);
        },
        deleteChat: async () => {
          deleteDemoChat(store, active.id);
          setActiveId(null);
          setVersion((v) => v + 1);
        },
      }
    : null;

  return (
    <div className={`app${isMobile && chatOpen ? ' app--chat-open' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar__header">
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate('/login')}
            aria-label={t('demo.back')}
            title={t('demo.back')}
          >
            ←
          </button>
          <div className="sidebar__who">
            <div className="sidebar__name">
              Telegram Clone <span className="demo-badge">{t('demo.badge')}</span>
            </div>
            <div className="sidebar__email">{t('demo.title')}</div>
          </div>
        </header>
        <div className="demo-cta">
          <button type="button" className="btn-primary" onClick={() => navigate('/login')}>
            {t('demo.createAccount')}
          </button>
          <p className="demo-note">{t('demo.note')}</p>
        </div>
        <ul className="chat-list">
          {chats.map((c) => {
            const last = c.messages[c.messages.length - 1];
            const preview = last ? (last.textKey ? t(last.textKey) : last.text || last.attachment?.name) : t('chat.noMessages');
            const isActive = c.id === activeId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`chat-list__item${isActive ? ' chat-list__item--active' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => setActiveId(c.id)}
                >
                  <Avatar name={t(c.titleKey)} seed={c.id} size={48} />
                  <div className="chat-list__body">
                    <div className="chat-list__top">
                      <span className="chat-list__name">{t(c.titleKey)}</span>
                    </div>
                    <div className="chat-list__preview">{preview}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <footer className="sidebar__footer">
          <button type="button" className="sidebar__settings" onClick={() => setSettingsOpen(true)}><SettingsIcon /><span>{t('settings.title')}</span></button>
          <ThemeToggle />
        </footer>
      </aside>
      <main className="main">
        {demoChat ? (
          <ChatWindow
            key={demoChat.key}
            chat={demoChat}
            currentUser={me}
            visible={!isMobile || chatOpen}
            onBack={() => setActiveId(null)}
          />
        ) : (
          <ChatEmptyState choose demo />
        )}
      </main>
      {settingsOpen && <SettingsModal notifications={false} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
