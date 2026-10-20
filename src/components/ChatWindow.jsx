import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessages, sendMessage } from '../api/messagesApi.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import Avatar from './Avatar.jsx';
import MessageBubble from './MessageBubble.jsx';
import MessageInput from './MessageInput.jsx';

const EMPTY = [];
const GROUP_GAP_MS = 5 * 60 * 1000;

function buildItems(messages) {
  const items = [];
  let previous = null;

  messages.forEach((message, index) => {
    const date = new Date(message.createdAt);
    const dayKey = date.toDateString();
    const next = messages[index + 1];
    const nextDate = next ? new Date(next.createdAt) : null;

    if (!previous || previous.dayKey !== dayKey) {
      items.push({ type: 'day', key: `day-${dayKey}`, date });
    }

    const startsGroup =
      !previous ||
      previous.dayKey !== dayKey ||
      previous.senderId !== message.senderId ||
      date - previous.date > GROUP_GAP_MS;
    const endsGroup =
      !next ||
      nextDate.toDateString() !== dayKey ||
      next.senderId !== message.senderId ||
      nextDate - date > GROUP_GAP_MS;

    items.push({ type: 'message', key: message.id, message, startsGroup, endsGroup });
    previous = { dayKey, date, senderId: message.senderId };
  });

  return items;
}

export default function ChatWindow({ currentUser }) {
  const { t, tError, formatDay } = useI18n();
  const queryClient = useQueryClient();
  const bottomRef = useRef(null);
  const hasScrolledRef = useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['messages'],
    queryFn: getMessages,
    refetchInterval: 3000,
  });
  const messages = data ?? EMPTY;

  const send = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  });

  const items = useMemo(() => buildItems(messages), [messages]);

  useEffect(() => {
    if (!messages.length) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({
      behavior: hasScrolledRef.current && !reduceMotion ? 'smooth' : 'auto',
    });
    hasScrolledRef.current = true;
  }, [messages.length]);

  const groupName = t('chat.groupName');

  return (
    <section className="chat">
      <header className="chat__header">
        <Avatar name={groupName} seed="group" size={42} />
        <div>
          <div className="chat__name">{groupName}</div>
          <div className="chat__status">{t('chat.messageCount', { count: messages.length })}</div>
        </div>
      </header>

      <div className="chat__messages">
        {isLoading && <div className="chat__hint">{t('common.loading')}</div>}
        {isError && <div className="chat__hint chat__hint--error">{t('chat.loadFailed')}</div>}
        {!isLoading && !isError && messages.length === 0 && (
          <div className="chat__empty">
            <div className="chat__empty-title">{t('chat.emptyTitle')}</div>
            <div>{t('chat.emptyHint')}</div>
          </div>
        )}
        {items.map((item) =>
          item.type === 'day' ? (
            <div key={item.key} className="day-divider">
              {formatDay(item.date)}
            </div>
          ) : (
            <MessageBubble
              key={item.key}
              message={item.message}
              isOwn={item.message.senderId === currentUser.id}
              startsGroup={item.startsGroup}
              endsGroup={item.endsGroup}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {send.isError && (
        <div className="chat__notice" role="alert">
          {t('chat.sendFailed', { reason: tError(send.error) })}
        </div>
      )}
      <MessageInput onSend={(text) => send.mutate(text)} disabled={send.isPending} />
    </section>
  );
}
