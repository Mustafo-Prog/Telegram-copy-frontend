import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getMessages } from '../api/messagesApi.js';
import { listConversations } from '../api/conversationsApi.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { setPresenceMany } from '../realtime/presence.js';
import { unwatchPresence, watchPresence, subscribeRealtimeStatus, getRealtimeStatus } from '../realtime/socket.js';
import { usePresence } from '../realtime/presence.js';
import Avatar from './Avatar.jsx';

// Точка онлайн рядом с аватаром собеседника (только если статус видимый и онлайн)
function PeerAvatar({ peer }) {
  const status = usePresence(peer?.id) ?? peer?.presence;
  return (
    <span className="chat-list__avatar">
      <Avatar name={peer?.displayName} seed={peer?.id} size={48} src={peer?.avatarUrl} />
      {status === 'online' && <span className="presence-dot presence-dot--list" aria-hidden="true" />}
    </span>
  );
}

// Список без опроса: обновления приходят событиями; статусы собеседников — подпиской
export default function ChatList({ activeKey, onSelectGeneral, onSelectConversation }) {
  const { t, formatTime } = useI18n();
  const realtimeStatus = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus);
  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: getMessages,
    staleTime: 60 * 1000,
    refetchInterval: realtimeStatus === 'connected' ? false : 5000,
  });
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
    staleTime: 15 * 1000,
    refetchInterval: realtimeStatus === 'connected' ? false : 5000,
  });

  const peerIds = useMemo(
    () => conversations.map((c) => c.peer?.id).filter(Boolean),
    [conversations]
  );
  useEffect(() => {
    if (!peerIds.length) return undefined;
    watchPresence(peerIds, setPresenceMany);
    return () => unwatchPresence(peerIds);
  }, [peerIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = messages[messages.length - 1];
  const groupName = t('chat.groupName');
  const generalPreview = last
    ? `${last.senderName ?? t('chat.deletedUser')}: ${last.text || last.attachment?.name || ''}`
    : t('chat.noMessages');

  return (
    <ul className="chat-list">
      <li>
        <button
          type="button"
          className={`chat-list__item${activeKey === 'general' ? ' chat-list__item--active' : ''}`}
          aria-current={activeKey === 'general' ? 'true' : undefined}
          onClick={onSelectGeneral}
        >
          <Avatar name={groupName} seed="group" size={48} />
          <div className="chat-list__body">
            <div className="chat-list__top">
              <span className="chat-list__name">{groupName}</span>
              {last && <span className="chat-list__time">{formatTime(last.createdAt)}</span>}
            </div>
            <div className="chat-list__preview">{generalPreview}</div>
          </div>
        </button>
      </li>

      {conversations.map((conv) => {
        const peer = conv.peer;
        const active = activeKey === conv.id;
        return (
          <li key={conv.id}>
            <button
              type="button"
              className={`chat-list__item${active ? ' chat-list__item--active' : ''}`}
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelectConversation(conv)}
            >
              <PeerAvatar peer={peer} />
              <div className="chat-list__body">
                <div className="chat-list__top">
                  <span className="chat-list__name">{peer?.displayName ?? t('chat.deletedUser')}</span>
                  <span className="chat-list__time">{formatTime(conv.lastMessageAt)}</span>
                </div>
                <div className="chat-list__bottom">
                  <div className="chat-list__preview">{conv.lastMessageText || t('chat.noMessages')}</div>
                  {conv.unreadCount > 0 && <span className="chat-list__unread" aria-label={t('chat.unread', { count: conv.unreadCount })}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
