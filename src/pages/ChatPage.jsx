import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import Avatar from '../components/Avatar.jsx';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import ChatEmptyState from '../components/ChatEmptyState.jsx';
import ProfileModal from '../components/ProfileModal.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import UserSearch from '../components/UserSearch.jsx';
import CreateGroupModal from '../components/CreateGroupModal.jsx';
import GroupInfoModal from '../components/GroupInfoModal.jsx';
import JoinGroupModal from '../components/JoinGroupModal.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import { BookmarkIcon, LogoutIcon, SettingsIcon } from '../components/icons.jsx';
import {
  bulkDeleteConversationMessages,
  clearConversation,
  deleteConversation,
  editConversationMessage,
  getConversationMessages,
  openConversation,
  markConversationRead,
  sendConversationMessage,
  listConversations,
  getConversation,
  searchConversationMessages,
  openSavedConversation,
  saveMessage,
} from '../api/conversationsApi.js';
import { bulkDeleteGeneralMessages, editGeneralMessage, getMessagesPage, sendMessage, markGeneralRead, searchGeneralMessages } from '../api/messagesApi.js';
import { applyGeneralReadCursors, mergeGeneralReadCursors } from '../utils/generalReads.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import {
  applyConversationPreview,
  applyFlatDelete,
  applyFlatNew,
  applyFlatUpdate,
  applyPagedDelete,
  applyPagedNew,
  applyPagedUpdate,
  applyReadReceipt,
  applyGeneralReadReceipt,
  applyConversationRead,
} from '../realtime/events.js';
import { setPresence, setPresenceMany } from '../realtime/presence.js';
import {
  connectRealtime,
  disconnectRealtime,
  getRealtimeStatus,
  subscribeRealtimeStatus,
  unwatchPresence,
  watchPresence,
  sendTyping,
} from '../realtime/socket.js';
import { useIsMobile } from '../utils/useIsMobile.js';
import { useSwipeBack } from '../utils/useSwipeBack.js';
import { setTypingEvent } from '../realtime/typing.js';
import { notifyIncoming, subscribeNotificationClicks, clearUserNotifications } from '../notifications/manager.js';
import { validChatId } from '../utils/notifications.js';
import { getMessageReaders, setMessageReaction } from '../api/messageInteractionsApi.js';
import { applyReactionEvent } from '../realtime/events.js';

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
  const { user, logout, updateUser } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const mainRef = useRef(null);
  const realtimeStatus = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus);
  const conversationsQuery = useQuery({ queryKey: CONVERSATIONS_KEY, queryFn: listConversations, staleTime: 15000,
    refetchInterval: realtimeStatus === 'connected' ? false : 5000 });
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice, setNotice] = useState(null);
  const [openingSaved, setOpeningSaved] = useState(false);
  const savedRequestRef = useRef(null);

  // type: general, direct or none after closing the current chat.
  const [active, setActive] = useState({ type: 'general' });
  const [modal, setModal] = useState(null);
  // На телефоне: открыт ли чат на весь экран (иначе видим список)
  const [chatOpen, setChatOpen] = useState(false);
  const closeModal = useCallback(() => setModal(null), []);
  const activeRef = useRef(active);
  const generalReadCursorsRef = useRef([]);
  const openByIdRef = useRef(null);
  const viewRef = useRef(null);
  viewRef.current = { isMobile, chatOpen };
  activeRef.current = active;

  // Открыть чат: на телефоне запоминаем шаг в истории, чтобы «назад» Android закрывал чат
  const openChat = useCallback(() => {
    setChatOpen(true);
    if (window.matchMedia('(max-width: 760px)').matches && !isChatEntry()) {
      window.history.pushState({ ...window.history.state, tgChat: true }, '');
    }
  }, []);

  // Назад: если есть шаг истории чата — возвращаемся по нему, иначе просто закрываем
  const goBack = useCallback(() => {
    setChatOpen(false); setActive({ type: 'none' });
    if (isChatEntry()) window.history.back();
  }, []);

  const openConversationData = useCallback((conv) => {
    queryClient.setQueryData(CONVERSATIONS_KEY, (list = []) => [conv, ...list.filter((entry) => entry.id !== conv.id)]);
    setActive({ type: 'direct', conv }); setModal(null); openChat();
  }, [queryClient, openChat]);
  openByIdRef.current = async (id) => {
    if (!validChatId(id)) return;
    try {
      if (id === 'general') { setActive({ type: 'general' }); openChat(); }
      else openConversationData(queryClient.getQueryData(CONVERSATIONS_KEY)?.find((conv) => conv.id === id) ?? await getConversation(id));
    } catch { setNotice(t('notifications.chatUnavailable')); }
  };
  useEffect(() => {
    const unsubscribe = subscribeNotificationClicks((id) => openByIdRef.current?.(id));
    return () => { unsubscribe(); clearUserNotifications(user.id); };
  }, [user.id]);
  const closeJoin = useCallback(() => setSearchParams((params) => { const next = new URLSearchParams(params); next.delete('join'); return next; }, { replace: true }), [setSearchParams]);
  const openingParam = useRef(null);
  useEffect(() => {
    const id = searchParams.get('chat');
    if (!id) { openingParam.current = null; return; }
    if (openingParam.current === id) return;
    openingParam.current = id;
    Promise.resolve(openByIdRef.current?.(id)).finally(() => setSearchParams((params) => { const next = new URLSearchParams(params); next.delete('chat'); return next; }, { replace: true }));
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const onPop = () => setChatOpen(isChatEntry() && activeRef.current.type !== 'none');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useSwipeBack(mainRef, goBack, isMobile && chatOpen);

  // --- Реальное время -----------------------------------------------------
  // Событие меняет только уже загруженные данные: пустой кэш не заполняем одним сообщением,
  // иначе скроется остальная история. Для списка диалогов без данных — перезагрузка.
  const handleEvent = useCallback(
    (event, payload) => {
      if (event === 'typing:update') { if (payload.userId !== user.id) setTypingEvent(payload); return; }
      if (event === 'preferences:changed') { updateUser((current) => ({ ...current, ...payload })); return; }
      if (event === 'presence:update') {
        setPresence(payload.userId, payload.status, payload.lastSeenAt);
        return;
      }

      if (event === 'conversation:read') {
        queryClient.invalidateQueries({ queryKey: ['message-readers', `dm-${payload.conversationId}`] });
        if (payload.userId !== user.id) {
          queryClient.setQueryData(dmKey(payload.conversationId), (old) => applyReadReceipt(old, payload.messageId));
        }
        queryClient.setQueryData(CONVERSATIONS_KEY, (list) => applyConversationRead(list, payload.conversationId, {
          userId: payload.userId, currentUserId: user.id, messageId: payload.messageId,
        }));
        return;
      }

      if (event === 'general:read') {
        queryClient.invalidateQueries({ queryKey: ['message-readers', 'general'] });
        generalReadCursorsRef.current = mergeGeneralReadCursors(generalReadCursorsRef.current, payload);
        queryClient.setQueryData(GENERAL_KEY, (old) => applyGeneralReadReceipt(old, payload));
        queryClient.setQueryData(PREVIEW_KEY, (old) => old ? applyGeneralReadCursors(old, [payload]) : old);
        return;
      }

      if (event === 'message:reactions') {
        queryClient.setQueryData(payload.scope === 'general' ? GENERAL_KEY : dmKey(payload.conversationId), (old) => applyReactionEvent(old, payload));
        return;
      }

      if (event === 'message:new') {
        const chatId = payload.scope === 'general' ? 'general' : payload.conversationId;
        const currentId = activeRef.current.type === 'general' ? 'general' : activeRef.current.conv?.id ?? null;
        const conversation = queryClient.getQueryData(CONVERSATIONS_KEY)?.find((conv) => conv.id === chatId);
        notifyIncoming({ message: payload.message, userId: user.id, chatId, activeChatId: currentId,
          chatVisible: !viewRef.current.isMobile || viewRef.current.chatOpen,
          title: chatId === 'general' ? t('chat.groupName') : conversation?.kind === 'group' ? conversation.title : payload.conversationTitle || payload.message.senderName || t('chat.deletedUser'),
          labels: { newMessage: t('notifications.newMessage'), voice: t('voice.message') }, onOpen: (id) => openByIdRef.current?.(id) });
        if (payload.scope === 'general') {
          const message = applyGeneralReadCursors([payload.message], generalReadCursorsRef.current)[0];
          queryClient.setQueryData(GENERAL_KEY, (old) => (old ? applyPagedNew(old, message) : old));
          queryClient.setQueryData(PREVIEW_KEY, (list) => (list ? applyFlatNew(list, message) : list));
          if (payload.message.replyTo) queryClient.invalidateQueries({ queryKey: GENERAL_KEY });
          return;
        }
        queryClient.setQueryData(dmKey(payload.conversationId), (old) =>
          old ? applyPagedNew(old, payload.message) : old
        );
        const list = queryClient.getQueryData(CONVERSATIONS_KEY);
        const previous = list?.find((entry) => entry.id === payload.conversationId);
        const outOfOrder = payload.message.senderId !== user.id && previous?.lastMessageId && payload.message.id < previous.lastMessageId;
        const next = applyConversationPreview(list, payload.conversationId, payload.message, user.id);
        if (next === null || !list || outOfOrder) queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        else if (Array.isArray(next)) queryClient.setQueryData(CONVERSATIONS_KEY, next);
        if (payload.message.replyTo) queryClient.invalidateQueries({ queryKey: dmKey(payload.conversationId) });
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
        if (payload.message.replyTo) queryClient.invalidateQueries({ queryKey: payload.scope === 'general' ? GENERAL_KEY : dmKey(payload.conversationId) });
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
        if (payload.reason === 'pin' && Object.hasOwn(payload, 'pinnedAt')) {
          queryClient.setQueryData(CONVERSATIONS_KEY, (list) => list?.map((entry) => entry.id === payload.conversationId ? { ...entry, pinnedAt: payload.pinnedAt } : entry));
          return;
        }
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        queryClient.invalidateQueries({ queryKey: ['group', payload.conversationId] });
        if (payload.reason === 'cleared') {
          queryClient.resetQueries({ queryKey: dmKey(payload.conversationId) });
        }
        if (payload.reason === 'deleted' || payload.reason === 'removed') {
          setModal((current) => current?.mode === 'group' && current.groupId === payload.conversationId ? null : current);
          queryClient.removeQueries({ queryKey: dmKey(payload.conversationId) });
          const current = activeRef.current;
          if (current.type === 'direct' && current.conv.id === payload.conversationId) {
            setActive({ type: 'general' });
          }
        }
      }
    },
    [queryClient, user.id, updateUser, t]
  );

  // Обработчики держим в ref: соединение создаётся один раз, а актуальная логика — всегда свежая
  const eventRef = useRef(handleEvent);
  eventRef.current = handleEvent;

  // После разрыва связи: догружаем пропущенное обычными запросами (дубликаты отсекаются по id)
  const onReconnect = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['message-readers'] });
    queryClient.invalidateQueries({ queryKey: ['chat'] });
    queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    queryClient.invalidateQueries({ queryKey: PREVIEW_KEY });
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
      load: async (before) => {
        const page = await getMessagesPage(before);
        return { ...page, messages: applyGeneralReadCursors(page.messages, generalReadCursorsRef.current) };
      },
      scope: 'general',
      typingKey: 'general',
      onTyping: (active) => sendTyping({ scope: 'general' }, active),
      search: searchGeneralMessages,
      send: async (text, options) => {
        const message = await sendMessage(text, options);
        return applyGeneralReadCursors([message], generalReadCursorsRef.current)[0];
      },
      markRead: markGeneralRead,
      readers: getMessageReaders,
      react: setMessageReaction,
      edit: (id, text) => editGeneralMessage(id, text),
      remove: (ids) => bulkDeleteGeneralMessages(ids),
      title: t('chat.groupName'),
      avatar: { name: t('chat.groupName'), seed: 'general' },
    }),
    [t]
  );

  const directChat = (conv) => ({
    key: `dm-${conv.id}`,
    load: (before) => getConversationMessages(conv.id, before),
    scope: conv.kind === 'saved' ? 'saved' : conv.kind === 'group' ? 'group' : 'direct',
    typingKey: conv.id,
    onTyping: conv.kind === 'saved' ? undefined : (active) => sendTyping({ scope: 'conversation', conversationId: conv.id }, active),
    search: (q, before) => searchConversationMessages(conv.id, q, before),
    canModerate: conv.ownerId === user.id || conv.adminIds?.includes(user.id),
    send: (text, options) => sendConversationMessage(conv.id, text, options),
    markRead: conv.kind === 'saved' ? undefined : (messageId) => markConversationRead(conv.id, messageId),
    readers: conv.kind === 'group' ? getMessageReaders : undefined,
    react: conv.kind === 'saved' ? undefined : setMessageReaction,
    conversationId: conv.id,
    peerLastReadMessageId: conv.peerLastReadMessageId,
    edit: (id, text) => editConversationMessage(conv.id, id, text),
    remove: (ids, mode) => bulkDeleteConversationMessages(conv.id, ids, mode),
    clear: (mode) => clearConversation(conv.id, mode),
    deleteChat: async (mode) => {
      await deleteConversation(conv.id, mode);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      setActive({ type: 'general' });
      goBack();
    },
    title: conv.kind === 'saved' ? t('saved.title') : conv.kind === 'group' ? conv.title : conv.peer?.displayName ?? t('chat.deletedUser'),
    subtitle: conv.kind === 'saved' ? t('saved.subtitle') : conv.kind === 'group' ? t('groups.memberCount', { count: conv.memberCount }) : conv.peer?.username ? `@${conv.peer.username}` : null,
    presenceUserId: conv.peer?.id,
    presence: conv.peer?.presence,
    lastSeenAt: conv.peer?.lastSeenAt,
    avatar: conv.kind === 'group' ? { name: conv.title, seed: conv.id } : { name: conv.peer?.displayName, seed: conv.peer?.id, src: conv.peer?.avatarUrl },
    onHeaderClick: conv.kind === 'group' ? () => setModal({ mode: 'group', groupId: conv.id }) : conv.peer ? () => setModal({ mode: 'other', profile: conv.peer }) : undefined,
  });

  // Открывает (или создаёт) личный диалог с человеком из профиля
  const openDirect = async (peer) => {
    const conv = await openConversation(peer.id);
    openConversationData(conv);
  };

  const openSaved = async () => {
    const existing = queryClient.getQueryData(CONVERSATIONS_KEY)?.find((conv) => conv.kind === 'saved');
    if (existing) { setActive({ type: 'direct', conv: existing }); openChat(); return; }
    if (savedRequestRef.current) return;
    setOpeningSaved(true);
    const request = openSavedConversation(); savedRequestRef.current = request;
    try { openConversationData(await request); }
    catch (error) { setNotice(t('chat.loadFailed')); }
    finally { savedRequestRef.current = null; setOpeningSaved(false); }
  };

  const saveToFavorites = async (messageId) => {
    const result = await saveMessage(messageId);
    queryClient.setQueryData(CONVERSATIONS_KEY, (list = []) => [result.conversation, ...list.filter((conv) => conv.id !== result.conversation.id)]);
    queryClient.setQueryData(dmKey(result.conversation.id), (data) => data ? applyPagedNew(data, result.message) : data);
    return result;
  };

  const activeConversation = active.type === 'direct' ? conversationsQuery.data?.find((conv) => conv.id === active.conv.id) ?? active.conv : null;
  const chat = activeConversation ? directChat(activeConversation) : active.type === 'general' ? generalChat : null;
  const activeKey = active.type === 'direct' ? active.conv.id : active.type === 'general' ? 'general' : null;
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
        <div className="sidebar__tools">
          <button type="button" className="btn-ghost sidebar__saved-action" disabled={openingSaved} onClick={openSaved}><BookmarkIcon width={17} height={17} />{openingSaved ? t('common.loading') : t('saved.title')}</button>
          <button type="button" className="btn-ghost" onClick={() => setModal({ mode: 'createGroup' })}><span aria-hidden="true">＋</span> {t('groups.create')}</button>
        </div>
        {notice && <div className="sidebar__notice" role="status">{notice}<button className="icon-btn" onClick={() => setNotice(null)} aria-label={t('profile.close')}>×</button></div>}
        <ChatList
          conversations={conversationsQuery.data ?? []}
          loading={conversationsQuery.isPending}
          error={conversationsQuery.error}
          onRetry={() => conversationsQuery.refetch()}
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
          <button type="button" className="sidebar__settings" onClick={() => setModal({ mode: 'settings' })}><SettingsIcon /><span>{t('settings.title')}</span></button>
          <ThemeToggle />
        </footer>
      </aside>
      <main className="main" ref={mainRef}>
        {chat ? <ChatWindow
          key={chat.key}
          chat={chat}
          currentUser={user}
          visible={!isMobile || chatOpen}
          onBack={goBack}
          onOpenProfile={(message) => setModal({ mode: 'other', profile: profileFromMessage(message) })}
          onSaveMessage={saveToFavorites}
        /> : <ChatEmptyState choose />}
      </main>
      {modal?.mode === 'own' && <ProfileModal onClose={closeModal} />}
      {modal?.mode === 'settings' && <SettingsModal onClose={closeModal} />}
      {modal?.mode === 'createGroup' && <CreateGroupModal onClose={closeModal} onCreated={openConversationData} />}
      {modal?.mode === 'group' && <GroupInfoModal groupId={modal.groupId} onClose={closeModal} onUpdated={(conv) => setActive({ type: 'direct', conv })} onRemoved={() => { setModal(null); setActive({ type: 'general' }); queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }); }} />}
      {searchParams.get('join') && <JoinGroupModal token={searchParams.get('join')} onClose={closeJoin} onJoined={(conv) => { closeJoin(); openConversationData(conv); }} />}
      {modal?.mode === 'other' && (
        <ProfileModal profile={modal.profile} readOnly onMessage={openDirect} onClose={closeModal} />
      )}
    </div>
  );
}
