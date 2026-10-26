import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nProvider.jsx';
import {
  BULK_LIMIT,
  canDeleteMessage,
  chunk,
  flattenPages,
  mapPages,
  removeMessages,
  toggleSelection,
  upsertNewest,
} from '../utils/messageState.js';
import Avatar from './Avatar.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import MessageBubble from './MessageBubble.jsx';
import MessageInput from './MessageInput.jsx';
import MessageMenu from './MessageMenu.jsx';
import PresenceLabel from './PresenceLabel.jsx';
import { isRealtimeConnected } from '../realtime/socket.js';

const GROUP_GAP_MS = 5 * 60 * 1000;

// Скелетон первой загрузки: вместо пустого экрана
function ChatSkeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      {[60, 40, 75, 30, 55].map((w, i) => (
        <div key={i} className={`skeleton__row${i % 2 ? ' skeleton__row--own' : ''}`}>
          <div className="skeleton__bubble" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}
const NOTICE_MS = 4000;

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
      !previous || previous.dayKey !== dayKey || previous.senderId !== message.senderId || date - previous.date > GROUP_GAP_MS;
    const endsGroup =
      !next || nextDate.toDateString() !== dayKey || next.senderId !== message.senderId || nextDate - date > GROUP_GAP_MS;

    items.push({ type: 'message', key: message.id, message, startsGroup, endsGroup });
    previous = { dayKey, date, senderId: message.senderId };
  });

  return items;
}

// chat — переписка: общий чат или личный диалог (см. ChatPage).
// Компонент пересоздаётся через key при смене чата, поэтому выделение и состояние не смешиваются.
export default function ChatWindow({ chat, currentUser, onOpenProfile, onBack, visible = true }) {
  const { t, tError, formatDay } = useI18n();
  const queryClient = useQueryClient();
  const isDirect = chat.scope === 'direct';
  const messagesKey = ['chat', chat.key, 'messages'];

  // Вся история — одним бесконечным запросом: страницы обновляются вместе при каждом опросе,
  // поэтому удаление и правки видны и в старых сообщениях, без дубликатов
  const query = useInfiniteQuery({
    queryKey: messagesKey,
    queryFn: ({ pageParam }) => chat.load(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.messages.length ? lastPage.messages[0].id : undefined,
    // Пока соединение работает — опроса нет; при обрыве — запасной опрос раз в 5 секунд
    refetchInterval: () => (isRealtimeConnected() ? false : 5000),
  });
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Отправляемые сообщения живут отдельно, чтобы их не стёр опрос
  const [pending, setPending] = useState([]);
  const messages = useMemo(() => [...flattenPages(data?.pages), ...pending], [data, pending]);
  const items = useMemo(() => buildItems(messages), [messages]);
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  const [editing, setEditing] = useState(null); // { id, text }
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [menu, setMenu] = useState(null); // { message, x, y }
  const [dialog, setDialog] = useState(null); // { kind, ids? }
  const [headerMenu, setHeaderMenu] = useState(false);
  const [notice, setNotice] = useState(null);

  const bottomRef = useRef(null);
  const hasScrolledRef = useRef(false);
  const prevVisibleRef = useRef(visible);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Отправка: сообщение видно сразу, затем заменяется настоящим
  const send = useMutation({
    mutationFn: (text) => chat.send(text),
    onMutate: (text) => {
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setPending((list) => [
        ...list,
        {
          id: tempId,
          senderId: currentUser.id,
          senderName: currentUser.displayName,
          senderUsername: currentUser.username,
          senderAvatarUrl: currentUser.avatarUrl,
          text,
          createdAt: new Date().toISOString(),
          pending: true,
        },
      ]);
      return { tempId };
    },
    onSuccess: (message, _text, context) => {
      setPending((list) => list.filter((m) => m.id !== context.tempId));
      queryClient.setQueryData(messagesKey, (old) => upsertNewest(old, message, [context.tempId]));
    },
    onError: (error, _text, context) => {
      // Не отправилось: остается на экране с кнопками «Повторить» и «Отменить»
      setPending((list) => list.map((m) => (m.id === context?.tempId ? { ...m, failed: true } : m)));
      setNotice(tError(error));
    },
  });

  const retrySend = (message) => {
    setPending((list) => list.filter((m) => m.id !== message.id));
    send.mutate(message.text);
  };
  const discardSend = (message) => setPending((list) => list.filter((m) => m.id !== message.id));

  // Редактирование: текст меняется сразу; при ошибке возвращается прежний
  const edit = useMutation({
    mutationFn: ({ id, text }) => chat.edit(id, text),
    onMutate: async ({ id, text }) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const snapshot = queryClient.getQueryData(messagesKey);
      queryClient.setQueryData(messagesKey, (old) =>
        mapPages(old, (list) => list.map((m) => (m.id === id ? { ...m, text, editedAt: new Date().toISOString() } : m)))
      );
      return { snapshot };
    },
    onSuccess: (message) => {
      queryClient.setQueryData(messagesKey, (old) =>
        mapPages(old, (list) => list.map((m) => (m.id === message.id ? message : m)))
      );
    },
    onError: (error, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(messagesKey, context.snapshot);
      setNotice(tError(error));
    },
  });

  // Удаление: сначала убираем на экране только то, что пользователь вправе удалить.
  // Остальное решает сервер; пакеты по 100 id.
  const removeMany = async (ids, mode) => {
    const deletable = new Set(
      messages.filter((m) => canDeleteMessage(m, { isDirect, userId: currentUser.id })).map((m) => m.id)
    );
    const shownNow = ids.filter((id) => deletable.has(id));

    await queryClient.cancelQueries({ queryKey: messagesKey });
    const snapshot = queryClient.getQueryData(messagesKey);
    if (shownNow.length) queryClient.setQueryData(messagesKey, (old) => removeMessages(old, shownNow));

    let skipped = 0;
    try {
      for (const part of chunk(ids)) {
        const result = await chat.remove(part, mode);
        skipped += result?.skipped ?? 0;
      }
      if (skipped > 0) setNotice(t('actions.skipped', { count: skipped }));
    } catch (error) {
      queryClient.setQueryData(messagesKey, snapshot);
      setNotice(tError(error));
    } finally {
      queryClient.invalidateQueries({ queryKey: messagesKey });
    }
  };

  // Прокрутка вниз: при новых сообщениях и при открытии чата; не при подгрузке старых
  useEffect(() => {
    const justShown = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (!visible || !lastId) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smooth = hasScrolledRef.current && !justShown && !reduceMotion;
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    hasScrolledRef.current = true;
  }, [lastId, visible]);

  // Выделение: повторный клик снимает выбор; пустой выбор закрывает режим; Escape выходит
  useEffect(() => {
    if (selecting && selected.size === 0) setSelecting(false);
  }, [selecting, selected]);

  useEffect(() => {
    if (!selecting) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') exitSelect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting]);

  const startSelect = (id) => {
    setSelecting(true);
    setSelected(new Set([id]));
  };

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const toggleSelect = (id) => {
    if (!selected.has(id) && selected.size >= BULK_LIMIT) {
      setNotice(t('actions.selectLimit', { count: BULK_LIMIT }));
      return;
    }
    setSelected((prev) => toggleSelection(prev, id));
  };

  const isOwn = (m) => m.senderId === currentUser.id;
  const canEdit = (m) => isOwn(m) && !m.pending;
  const canDelete = (m) => canDeleteMessage(m, { isDirect, userId: currentUser.id });

  const menuItems = (m) => {
    const items = [{ key: 'copy', label: t('actions.copy') }];
    if (canEdit(m)) items.push({ key: 'edit', label: t('actions.edit') });
    items.push({ key: 'select', label: t('actions.select') });
    if (canDelete(m)) items.push({ key: 'delete', label: t('actions.delete'), danger: true });
    return items;
  };

  const onMenuSelect = (key) => {
    const message = menu?.message;
    setMenu(null);
    if (!message) return;
    if (key === 'copy') {
      navigator.clipboard?.writeText(message.text);
      setNotice(t('actions.copied'));
    }
    if (key === 'edit') setEditing({ id: message.id, text: message.text });
    if (key === 'select') startSelect(message.id);
    if (key === 'delete') setDialog({ kind: 'delete', ids: [message.id] });
  };

  // Подтверждение: выполняем выбранное действие; ошибки показываем, а не глотаем
  const confirmDialog = async (mode) => {
    const current = dialog;
    setDialog(null);
    if (!current) return;

    if (current.kind === 'delete') {
      await removeMany(current.ids, isDirect ? mode : 'everyone');
      exitSelect();
      return;
    }
    try {
      if (current.kind === 'clear') {
        await chat.clear(mode);
        queryClient.resetQueries({ queryKey: messagesKey });
      }
      if (current.kind === 'deleteChat') {
        await chat.deleteChat(mode);
      }
    } catch (error) {
      setNotice(tError(error));
    }
  };

  const submitInput = (text) => {
    if (editing) {
      edit.mutate({ id: editing.id, text });
      setEditing(null);
    } else {
      send.mutate(text);
    }
  };

  const dialogProps = (() => {
    if (!dialog) return null;
    if (dialog.kind === 'delete') {
      const title = t('actions.deleteTitle', { count: dialog.ids.length });
      if (!isDirect) {
        return { title, text: t('actions.deleteGeneralText'), confirmLabel: t('actions.delete'), danger: true, options: [] };
      }
      return {
        title,
        confirmLabel: t('actions.delete'),
        danger: true,
        options: [
          { value: 'me', label: t('actions.deleteForMe') },
          { value: 'everyone', label: t('actions.deleteForEveryone') },
        ],
      };
    }
    if (dialog.kind === 'clear') {
      return {
        title: t('actions.clearTitle'),
        text: t('actions.clearText'),
        confirmLabel: t('actions.clear'),
        danger: true,
        options: [
          { value: 'me', label: t('actions.onlyForMe') },
          { value: 'both', label: t('actions.forBoth') },
        ],
      };
    }
    return {
      title: t('actions.deleteChatTitle'),
      text: t('actions.deleteChatText'),
      confirmLabel: t('actions.deleteChat'),
      danger: true,
      options: [
        { value: 'me', label: t('actions.onlyForMe') },
        { value: 'both', label: t('actions.forBoth') },
      ],
    };
  })();

  const headerBody = (
    <>
      <Avatar name={chat.avatar.name} seed={chat.avatar.seed} size={42} src={chat.avatar.src} />
      <div className="chat__headline">
        <div className="chat__name">{chat.title}</div>
        <div className="chat__status">
          {chat.presenceUserId ? (
            <PresenceLabel userId={chat.presenceUserId} />
          ) : (
            chat.subtitle ?? t('chat.messageCount', { count: messages.length })
          )}
        </div>
      </div>
    </>
  );

  return (
    <section className="chat">
      {selecting ? (
        <header className="chat__header chat__header--select">
          <button type="button" className="icon-btn" onClick={exitSelect} aria-label={t('actions.cancel')}>
            ×
          </button>
          <div className="chat__headline">
            <div className="chat__name">{t('actions.selected', { count: selected.size })}</div>
          </div>
          <button
            type="button"
            className="btn-danger btn-danger--small"
            disabled={selected.size === 0}
            onClick={() => setDialog({ kind: 'delete', ids: [...selected] })}
          >
            {t('actions.delete')}
          </button>
        </header>
      ) : (
        <header className="chat__header">
          {onBack && (
            <button type="button" className="chat__back" onClick={onBack} aria-label={t('chat.back')}>
              <BackIcon />
            </button>
          )}
          {chat.onHeaderClick ? (
            <button type="button" className="chat__header-btn" onClick={chat.onHeaderClick}>
              {headerBody}
            </button>
          ) : (
            headerBody
          )}
          {isDirect && (
            <div className="chat__more">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setHeaderMenu((open) => !open)}
                aria-label={t('actions.more')}
                aria-expanded={headerMenu}
              >
                ⋮
              </button>
              {headerMenu && (
                <div className="chat__more-menu" role="menu" onMouseLeave={() => setHeaderMenu(false)}>
                  <button
                    type="button"
                    role="menuitem"
                    className="msg-menu__item"
                    onClick={() => {
                      setHeaderMenu(false);
                      setDialog({ kind: 'clear' });
                    }}
                  >
                    <span>{t('actions.clearHistory')}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="msg-menu__item msg-menu__item--danger"
                    onClick={() => {
                      setHeaderMenu(false);
                      setDialog({ kind: 'deleteChat' });
                    }}
                  >
                    <span>{t('actions.deleteChat')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </header>
      )}

      <div className="chat__messages">
        {hasNextPage && (
          <button
            type="button"
            className="btn-link chat__load-older"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? t('common.loading') : t('chat.loadOlder')}
          </button>
        )}
        {isLoading && <ChatSkeleton />}
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
              isOwn={isOwn(item.message)}
              startsGroup={item.startsGroup}
              endsGroup={item.endsGroup}
              onOpenProfile={onOpenProfile}
              selecting={selecting}
              selected={selected.has(item.message.id)}
              onToggleSelect={toggleSelect}
              onOpenMenu={(x, y) => setMenu({ message: item.message, x, y })}
              onRetry={() => retrySend(item.message)}
              onDiscard={() => discardSend(item.message)}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {notice && (
        <div className="chat__notice" role="status">
          {notice}
        </div>
      )}
      {!selecting && <MessageInput onSend={submitInput} editing={editing} onCancelEdit={() => setEditing(null)} />}

      {menu && (
        <MessageMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.message)}
          onSelect={onMenuSelect}
          onClose={() => setMenu(null)}
        />
      )}

      {dialog && dialogProps && (
        <ConfirmDialog {...dialogProps} onConfirm={confirmDialog} onCancel={() => setDialog(null)} />
      )}
    </section>
  );
}
