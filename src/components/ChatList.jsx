import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessages } from '../api/messagesApi.js';
import { pinConversation } from '../api/conversationsApi.js';
import { pinGeneralChat } from '../api/usersApi.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { setPresenceMany, usePresence } from '../realtime/presence.js';
import { unwatchPresence, watchPresence, subscribeRealtimeStatus, getRealtimeStatus } from '../realtime/socket.js';
import { sortChats } from '../utils/chatList.js';
import Avatar from './Avatar.jsx';
import { PinIcon } from './icons.jsx';
import SavedAvatar from './SavedAvatar.jsx';
import AccountStatusBadge from './AccountStatusBadge.jsx';

function PeerAvatar({ peer }) {
  const status = usePresence(peer?.id) ?? peer?.presence;
  return <span className="chat-list__avatar"><Avatar name={peer?.displayName} seed={peer?.id} size={48} src={peer?.avatarUrl} />
    {status === 'online' && <span className="presence-dot presence-dot--list" aria-hidden="true" />}
  </span>;
}

export default function ChatList({ activeKey, onSelectGeneral, onSelectConversation, conversations = [], loading, error: loadError, onRetry }) {
  const { t, tError, formatTime } = useI18n();
  const { user, updateUser } = useAuth();
  const client = useQueryClient();
  const status = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus);
  const { data: messages = [] } = useQuery({ queryKey: ['messages'], queryFn: getMessages, staleTime: 60000, refetchInterval: status === 'connected' ? false : 5000 });
  const pendingPins = useRef(new Map());
  const [pinOverrides, setPinOverrides] = useState({});
  const [error, setError] = useState(null);
  const peers = useMemo(() => conversations.map((conversation) => conversation.peer?.id).filter(Boolean), [conversations]);
  useEffect(() => {
    if (!peers.length) return undefined;
    watchPresence(peers, setPresenceMany); return () => unwatchPresence(peers);
  }, [peers.join(',')]);

  const last = messages.at(-1);
  const content = last?.text || (last?.attachment?.kind === 'voice' ? t('voice.message') : last?.attachment?.name) || '';
  const general = { id: 'general', kind: 'general', title: t('chat.groupName'), pinnedAt: user.generalPinnedAt,
    lastMessageAt: last?.createdAt, lastMessageText: last ? `${last.senderName ?? t('chat.deletedUser')}: ${content}` : t('chat.noMessages') };
  const entries = sortChats([general, ...conversations].map((conversation) => Object.hasOwn(pinOverrides, conversation.id)
    ? { ...conversation, pinnedAt: pinOverrides[conversation.id] } : conversation));
  const pin = async (conversation) => {
    const id = conversation.id;
    if (pendingPins.current.has(id)) return;
    const previous = conversation.pinnedAt ?? null;
    const pinnedAt = previous ? null : new Date().toISOString();
    pendingPins.current.set(id, true);
    setPinOverrides((current) => ({ ...current, [id]: pinnedAt }));
    setError(null);
    const patch = (value) => {
      if (id === 'general') updateUser((current) => current?.id === user.id ? { ...current, generalPinnedAt: value } : current);
      else client.setQueryData(['conversations'], (current) => current?.map((entry) => entry.id === id ? { ...entry, pinnedAt: value } : entry));
    };
    // Cancel an old list response before applying the local change; no refetch round trip.
    if (id !== 'general') void client.cancelQueries({ queryKey: ['conversations'] });
    patch(pinnedAt);
    try {
      const result = id === 'general' ? await pinGeneralChat(Boolean(pinnedAt)) : await pinConversation(id, Boolean(pinnedAt));
      patch(id === 'general' ? result.generalPinnedAt : result.pinnedAt);
    } catch (err) { patch(previous); setError(tError(err)); }
    finally {
      pendingPins.current.delete(id);
      setPinOverrides((current) => { const next = { ...current }; delete next[id]; return next; });
    }
  };

  return <ul className="chat-list">
    {loading && <li className="chat-list__hint">{t('common.loading')}</li>}
    {(error || loadError) && <li className="chat-list__hint auth-error" role="alert">{error || tError(loadError)}{loadError && <button className="btn-link" onClick={onRetry}>{t('chat.retry')}</button>}</li>}
    {entries.map((conversation) => {
      const generalChat = conversation.kind === 'general';
      const group = conversation.kind === 'group';
      const saved = conversation.kind === 'saved';
      const title = saved ? t('saved.title') : generalChat || group ? conversation.title : conversation.peer?.displayName ?? t('chat.deletedUser');
      const selected = activeKey === conversation.id;
      const preview = conversation.lastMessageType === 'voice' ? t('voice.message') : conversation.lastMessageText || t('chat.noMessages');
      return <li key={conversation.id} className={`chat-list__row${selected ? ' chat-list__row--active' : ''}`}>
        <button type="button" className={`chat-list__item${selected ? ' chat-list__item--active' : ''}`} aria-current={selected ? 'true' : undefined} onClick={() => generalChat ? onSelectGeneral() : onSelectConversation(conversation)}>
          {saved ? <SavedAvatar size={48} /> : generalChat || group ? <Avatar name={title} seed={conversation.id} size={48} /> : <PeerAvatar peer={conversation.peer} />}
          <div className="chat-list__body"><div className="chat-list__top"><span className="chat-list__name">{title}</span>{!generalChat && !group && !saved && <AccountStatusBadge status={conversation.peer?.status} premiumExpiresAt={conversation.peer?.premiumExpiresAt} compact />}{conversation.pinnedAt && <PinIcon className="chat-list__pinned-mark" width={12} height={12} />}{conversation.lastMessageAt && <span className="chat-list__time">{formatTime(conversation.lastMessageAt)}</span>}</div>
            <div className="chat-list__bottom"><div className="chat-list__preview">{preview}</div>{conversation.unreadCount > 0 && <span className="chat-list__unread" aria-label={t('chat.unread', { count: conversation.unreadCount })}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}</div>
          </div>
        </button>
        <button type="button" className={`chat-list__pin icon-btn${conversation.pinnedAt ? ' chat-list__pin--on' : ''}`} disabled={Object.hasOwn(pinOverrides, conversation.id)} onClick={() => pin(conversation)} aria-label={t(conversation.pinnedAt ? 'chats.unpin' : 'chats.pin', { title })} title={t(conversation.pinnedAt ? 'chats.unpin' : 'chats.pin', { title })}><PinIcon width={16} height={16} /></button>
      </li>;
    })}
  </ul>;
}
