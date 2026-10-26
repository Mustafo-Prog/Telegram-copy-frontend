import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider.jsx';
import Avatar from '../components/Avatar.jsx';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import ProfileModal from '../components/ProfileModal.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import UserSearch from '../components/UserSearch.jsx';
import { LogoutIcon } from '../components/icons.jsx';
import {
  bulkDeleteConversationMessages,
  clearConversation,
  deleteConversation,
  editConversationMessage,
  getConversationMessages,
  openConversation,
  sendConversationMessage,
} from '../api/conversationsApi.js';
import { bulkDeleteGeneralMessages, editGeneralMessage, getMessagesPage, sendMessage } from '../api/messagesApi.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import {
  applyConversationPreview,
  applyFlatDelete,
  applyFlatNew,
  applyFlatUpdate,
  applyPagedDelete,
  applyPagedNew,
  applyPagedUpdate,
} from '../realtime/events.js';
import { setPresence, setPresenceMany } from '../realtime/presence.js';
import {
  connectRealtime,
  disconnectRealtime,
  getRealtimeStatus,
  subscribeRealtimeStatus,
  unwatchPresence,
  watchPresence,
} from '../realtime/socket.js';
import { useIsMobile } from '../utils/useIsMobile.js';
import { useSwipeBack } from '../utils/useSwipeBack.js';

const GENERAL_KEY = ['chat', 'general', 'messages'];
const PREVIEW_KEY = ['messages'];
const CONVERSATIONS_KEY = ['conversations'];
const dmKey = (conversationId) => ['chat', `dm-${conversationId}`, 'messages'];

// Из сообщения берём то, что он содержит; полный профиль догрузит окно по нику
function profileFromMessage(message) {
  return {
    id: message.senderId,
    displayName: message.senderName,
    username: message.senderUsername,
    avatarUrl: message.senderAvatarUrl,
    bio: '',
  };
}

const isChatEntry = () => Boolean(window.history.state?.tgChat);
const REALTIME_TEXT = {
  connecting: 'realtime.connecting',
  reconnecting: 'realtime.reconnecting',
  offline: 'realtime.offline',
  unauthorized: 'realtime.unauthorized',
};

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const mainRef = useRef(null);
  const realtimeStatus = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus);

  // { type: 'general' } или { type: 'direct', conv }
  const [active, setActive] = useState({ type: 'general' });
  const [modal, setModal] = useState(null);
  // На телефоне: открыт ли чат на весь экран (иначе видим список)
  const [chatOpen, setChatOpen] = useState(false);
  const closeModal = useCallback(() => setModal(null), []);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Открыть чат: на телефоне запоминаем шаг в истории, чтобы «назад» Android закрывал чат
  const openChat = useCallback(() => {
    setChatOpen(true);
    if (window.matchMedia('(max-width: 760px)').matches) {
      window.history.pushState({ ...window.history.state, tgChat: true }, '');
    }
  }, []);

  // Назад: если есть шаг истории чата — возвращаемся по нему, иначе просто закрываем
  const goBack = useCallback(() => {
    if (isChatEntry()) window.history.back();
    else setChatOpen(false);
  }, []);

  useEffect(() => {
    const onPop = () => setChatOpen(isChatEntry());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useSwipeBack(mainRef, goBack, isMobile && chatOpen);

  // --- Реальное время -----------------------------------------------------
  // Событие меняет только уже загруженные данные: пустой кэш не заполняем одним сообщением,
  // иначе скроется остальная история. Для списка диалогов без данных — перезагрузка.
  const handleEvent = useCallback(
    (event, payload) => {
      if (event === 'presence:update') {
        setPresence(payload.userId, payload.status);
        return;
      }

      if (event === 'message:new') {
        if (payload.scope === 'general') {
          queryClient.setQueryData(GENERAL_KEY, (old) => (old ? applyPagedNew(old, payload.message) : old));
          queryClient.setQueryData(PREVIEW_KEY, (list) => (list ? applyFlatNew(list, payload.message) : list));
          return;
        }
        queryClient.setQueryData(dmKey(payload.conversationId), (old) =>
          old ? applyPagedNew(old, payload.message) : old
        );
        const list = queryClient.getQueryData(CONVERSATIONS_KEY);
        const next = applyConversationPreview(list, payload.conversationId, payload.message);
        if (next === null) queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        else if (Array.isArray(next)) queryClient.setQueryData(CONVERSATIONS_KEY, next);
        return;
      }

      if (event === 'message:updated') {
        if (payload.scope === 'general') {
          queryClient.setQueryData(GENERAL_KEY, (old) => (old ? applyPagedUpdate(old, payload.message) : old));
          queryClient.setQueryData(PREVIEW_KEY, (list) => (list ? applyFlatUpdate(list, payload.message) : list));
        } else {
          queryClient.setQueryData(dmKey(payload.conversationId), (old) =>
            old ? applyPagedUpdate(old, payload.message) : old
          );
          queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        }
        return;
      }

      if (event === 'message:deleted') {
        if (payload.scope === 'general') {
          queryClient.setQueryData(GENERAL_KEY, (old) => (old ? applyPagedDelete(old, payload.ids) : old));
          queryClient.setQueryData(PREVIEW_KEY, (list) => (list ? applyFlatDelete(list, payload.ids) : list));
        } else {
          queryClient.setQueryData(dmKey(payload.conversationId), (old) =>
            old ? applyPagedDelete(old, payload.ids) : old
          );
          queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        }
        return;
      }

      if (event === 'chat:changed') {
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        if (payload.reason === 'cleared') {
          queryClient.resetQueries({ queryKey: dmKey(payload.conversationId) });
        }
        if (payload.reason === 'deleted') {
          queryClient.removeQueries({ queryKey: dmKey(payload.conversationId) });
          const current = activeRef.current;
          if (current.type === 'direct' && current.conv.id === payload.conversationId) {
            setActive({ type: 'general' });
          }
        }
      }
    },
    [queryClient]
  );

  // Обработчики держим в ref: соединение создаётся один раз, а актуальная логика — всегда свежая
  const eventRef = useRef(handleEvent);
  eventRef.current = handleEvent;

  // После разрыва связи: догружаем пропущенное обычными запросами (дубликаты отсекаются по id)
  const onReconnect = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat'] });
    queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    queryClient.invalidateQueries({ queryKey: PREVIEW_KEY });
    const current = activeRef.current;
    if (current.type === 'direct' && current.conv.peer?.id) {
      watchPresence([current.conv.peer.id], setPresenceMany);
    }
  }, [queryClient]);

  useEffect(() => {
    connectRealtime({
      onReconnect,
      onEvent: (event, payload) => eventRef.current(event, payload),
    });
    return () => disconnectRealtime();
  }, [user.id, onReconnect]);

  // Статус собеседника открытого диалога
  const peerId = active.type === 'direct' ? active.conv.peer?.id : null;
  useEffect(() => {
    if (!peerId) return undefined;
    watchPresence([peerId], setPresenceMany);
    return () => unwatchPresence([peerId]);
  }, [peerId]);

  // --- Чаты ----------------------------------------------------------------
  const generalChat = useMemo(
    () => ({
      key: 'general',
      load: (before) => getMessagesPage(before),
      scope: 'general',
      send: sendMessage,
      edit: (id, text) => editGeneralMessage(id, text),
      remove: (ids) => bulkDeleteGeneralMessages(ids),
      title: t('chat.groupName'),
      avatar: { name: t('chat.groupName'), seed: 'group' },
    }),
    [t]
  );

  const directChat = (conv) => ({
    key: `dm-${conv.id}`,
    load: (before) => getConversationMessages(conv.id, before),
    scope: 'direct',
    send: (text) => sendConversationMessage(conv.id, text),
    edit: (id, text) => editConversationMessage(conv.id, id, text),
    remove: (ids, mode) => bulkDeleteConversationMessages(conv.id, ids, mode),
    clear: (mode) => clearConversation(conv.id, mode),
    deleteChat: async (mode) => {
      await deleteConversation(conv.id, mode);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      setActive({ type: 'general' });
      goBack();
    },
    title: conv.peer?.displayName ?? t('chat.deletedUser'),
    subtitle: conv.peer?.username ? `@${conv.peer.username}` : null,
    presenceUserId: conv.peer?.id,
    avatar: { name: conv.peer?.displayName, seed: conv.peer?.id, src: conv.peer?.avatarUrl },
    onHeaderClick: conv.peer ? () => setModal({ mode: 'other', profile: conv.peer }) : undefined,
  });

  // Открывает (или создаёт) личный диалог с человеком из профиля
  const openDirect = async (peer) => {
    const conv = await openConversation(peer.id);
    queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    setActive({ type: 'direct', conv });
    setModal(null);
    openChat();
  };

  const chat = active.type === 'direct' ? directChat(active.conv) : generalChat;
  const activeKey = active.type === 'direct' ? active.conv.id : 'general';
  const statusText = REALTIME_TEXT[realtimeStatus] ? t(REALTIME_TEXT[realtimeStatus]) : null;

  return (
    <div className={`app${isMobile && chatOpen ? ' app--chat-open' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar__header">
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setModal({ mode: 'own' })}
            aria-label={t('profile.edit')}
            title={t('profile.edit')}
          >
            <Avatar name={user.displayName} seed={user.id} size={40} src={user.avatarUrl} />
          </button>
          <div className="sidebar__who">
            <div className="sidebar__name">{user.displayName}</div>
            <div className="sidebar__email">{user.username ? `@${user.username}` : user.email}</div>
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
        {statusText && (
          <div className={`realtime-status realtime-status--${realtimeStatus}`} role="status">
            {statusText}
          </div>
        )}
        <UserSearch onSelect={(profile) => setModal({ mode: 'other', profile })} />
        <ChatList
          activeKey={activeKey}
          onSelectGeneral={() => {
            setActive({ type: 'general' });
            openChat();
          }}
          onSelectConversation={(conv) => {
            setActive({ type: 'direct', conv });
            openChat();
          }}
        />
        <footer className="sidebar__footer">
          <LanguageSwitcher />
          <ThemeToggle />
        </footer>
      </aside>
      <main className="main" ref={mainRef}>
        <ChatWindow
          key={chat.key}
          chat={chat}
          currentUser={user}
          visible={!isMobile || chatOpen}
          onBack={goBack}
          onOpenProfile={(message) => setModal({ mode: 'other', profile: profileFromMessage(message) })}
        />
      </main>
      {modal?.mode === 'own' && <ProfileModal onClose={closeModal} />}
      {modal?.mode === 'other' && (
        <ProfileModal profile={modal.profile} readOnly onMessage={openDirect} onClose={closeModal} />
      )}
    </div>
  );
}
