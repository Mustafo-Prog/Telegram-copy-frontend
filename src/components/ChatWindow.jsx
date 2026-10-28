import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { isReadByPeer } from '../utils/messageContent.js';
import { applyConversationPreview, applyConversationRead, applyFlatNew } from '../realtime/events.js';
import ChatEmptyState from './ChatEmptyState.jsx';
import MessageSearchPanel from './MessageSearchPanel.jsx';
import TypingLabel from './TypingLabel.jsx';
import { ImageIcon, SearchIcon } from './icons.jsx';
import SavedAvatar from './SavedAvatar.jsx';
import ChatBackgroundModal from './ChatBackgroundModal.jsx';
import useChatBackground from '../theme/useChatBackground.js';
import { backgroundStyle } from '../utils/chatBackground.js';
import RealtimeBanner from './RealtimeBanner.jsx';
import MessageReadersModal from './MessageReadersModal.jsx';
import { applyReactionEvent } from '../realtime/events.js';

const GROUP_GAP_MS = 5 * 60 * 1000;
const newClientMessageId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
export default function ChatWindow({ chat, currentUser, onOpenProfile, onBack, onSaveMessage, visible = true }) {
  const { t, tError, formatDay } = useI18n();
  const queryClient = useQueryClient();
  const isDirect = chat.scope !== 'general';
  const isGroup = chat.scope === 'group';
  const isSaved = chat.scope === 'saved';
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
  const messages = useMemo(() => {
    const confirmed = flattenPages(data?.pages);
    const acknowledged = new Set(confirmed.filter((message) => message.senderId === currentUser.id).map((message) => message.clientMessageId).filter(Boolean));
    return [...confirmed, ...pending.filter((message) => !acknowledged.has(message.clientMessageId))];
  }, [data, pending, currentUser.id]);
  const items = useMemo(() => buildItems(messages), [messages]);
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  const [editing, setEditing] = useState(null); // { id, text }
  const [replying, setReplying] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [readersMessageId, setReadersMessageId] = useState(null);
  const [reactingIds, setReactingIds] = useState(() => new Set());
  const reactionsInFlight = useRef(new Set());
  const background = useChatBackground(currentUser.id, chat.backgroundKey ?? chat.key);
  const [atBottom, setAtBottom] = useState(true);
  const [newMessageIds, setNewMessageIds] = useState(() => new Set());
  const [focused, setFocused] = useState(() => document.visibilityState === 'visible' && document.hasFocus());
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [menu, setMenu] = useState(null); // { message, x, y }
  const [dialog, setDialog] = useState(null); // { kind, ids? }
  const [headerMenu, setHeaderMenu] = useState(false);
  const [notice, setNotice] = useState(null);

  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const atBottomRef = useRef(true);
  const previousLastRef = useRef(null);
  const scrollRequestedRef = useRef(false);
  const prependRef = useRef(null);
  const readAckRef = useRef(null);
  const readsInFlight = useRef(new Set());
  const markReadRef = useRef(chat.markRead);
  markReadRef.current = chat.markRead;
  const mountedRef = useRef(true);
  const jumpingRef = useRef(false);
  const hasScrolledRef = useRef(false);
  const readThroughId = [chat.peerLastReadMessageId, ...(data?.pages ?? []).map((page) => page.peerLastReadMessageId)].filter(Boolean).sort().at(-1);
  const lastServerId = messages.filter((m) => !m.pending).at(-1)?.id;

  useEffect(() => {
    mountedRef.current = true;
    const onFocus = () => setFocused(document.visibilityState === 'visible' && document.hasFocus());
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  // Only the foreground chat at its latest messages can acknowledge a read.
  useEffect(() => {
    if (!markReadRef.current || !visible || !focused || !atBottom || !lastServerId || readsInFlight.current.has(lastServerId) || (readAckRef.current && readAckRef.current >= lastServerId)) return;
    readsInFlight.current.add(lastServerId);
    (async () => {
      try {
        await markReadRef.current(lastServerId);
        if (!readAckRef.current || lastServerId > readAckRef.current) readAckRef.current = lastServerId;
        if (chat.conversationId) queryClient.setQueryData(['conversations'], (list) => applyConversationRead(list, chat.conversationId, {
          userId: currentUser.id, currentUserId: currentUser.id, messageId: lastServerId,
        }));
      } catch { /* Retry on refetch, focus or the next message; do not claim a read locally. */ }
      finally { readsInFlight.current.delete(lastServerId); }
    })();
  }, [lastServerId, visible, focused, atBottom, data, chat.conversationId, currentUser.id, queryClient]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Отправка: сообщение видно сразу, затем заменяется настоящим
  const send = useMutation({
    mutationFn: ({ text, file, replyTo, voiceDurationMs, clientMessageId }) => chat.send(text, { file, replyToId: replyTo?.id, voiceDurationMs, clientMessageId }),
    onMutate: ({ text, file, replyTo, voiceDurationMs, clientMessageId }) => {
      scrollRequestedRef.current = true;
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
          clientMessageId,
          replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.senderName, text: replyTo.text, attachmentName: replyTo.attachment?.name } : null,
          attachment: file ? { name: file.name, contentType: file.type, size: file.size, blob: file, kind: voiceDurationMs ? 'voice' : 'file', durationMs: voiceDurationMs ?? null } : null,
          file,
          voiceDurationMs,
        },
      ]);
      return { tempId };
    },
    onSuccess: (message, _text, context) => {
      setPending((list) => list.filter((m) => m.id !== context.tempId));
      queryClient.setQueryData(messagesKey, (old) => upsertNewest(old, message, [context.tempId]));
      if (chat.conversationId) {
        const list = queryClient.getQueryData(['conversations']);
        const next = applyConversationPreview(list, chat.conversationId, message, currentUser.id);
        if (next === null || !list) queryClient.invalidateQueries({ queryKey: ['conversations'] });
        else queryClient.setQueryData(['conversations'], next);
      } else queryClient.setQueryData(['messages'], (list) => list ? applyFlatNew(list, message) : list);
    },
    onError: (error, _text, context) => {
      const delivered = flattenPages(queryClient.getQueryData(messagesKey)?.pages).some((message) => message.senderId === currentUser.id && message.clientMessageId === _text.clientMessageId);
      if (delivered) { setPending((list) => list.filter((message) => message.id !== context?.tempId)); return; }
      // Не отправилось: остается на экране с кнопками «Повторить» и «Отменить»
      setPending((list) => list.map((m) => (m.id === context?.tempId ? { ...m, failed: true } : m)));
      setNotice(tError(error));
    },
  });

  const retrySend = (message) => {
    setPending((list) => list.filter((m) => m.id !== message.id));
    send.mutate({ text: message.text, file: message.file, replyTo: message.replyTo, voiceDurationMs: message.voiceDurationMs, clientMessageId: newClientMessageId() });
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
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
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
      messages.filter((m) => canDeleteMessage(m, { isDirect, userId: currentUser.id, userStatus: currentUser.status })).map((m) => m.id)
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

  const updateScrollPosition = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
    if (bottom) setNewMessageIds((ids) => ids.size ? new Set() : ids);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    updateScrollPosition();
  };

  // Preserve the reader's place, including when older pages are prepended.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !visible || !messages.length) return;
    const snapshot = prependRef.current;
    if (snapshot && (data?.pages.length ?? 0) > snapshot.pages) {
      const anchor = [...el.querySelectorAll('[data-message-id]')].find((row) => row.dataset.messageId === snapshot.anchorId);
      if (anchor) el.scrollTop += anchor.getBoundingClientRect().top - snapshot.anchorTop;
      else el.scrollTop = snapshot.top + el.scrollHeight - snapshot.height;
      prependRef.current = null;
    } else if (!hasScrolledRef.current || atBottomRef.current || scrollRequestedRef.current) {
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
      setAtBottom(true);
      setNewMessageIds((ids) => ids.size ? new Set() : ids);
    } else if (previousLastRef.current && previousLastRef.current !== lastId) {
      const index = messages.findIndex((m) => m.id === previousLastRef.current);
      const added = index >= 0 ? messages.slice(index + 1).filter((m) => !m.pending && m.senderId !== currentUser.id).map((m) => m.id) : [];
      if (added.length) setNewMessageIds((ids) => new Set([...ids, ...added]));
    }
    scrollRequestedRef.current = false;
    hasScrolledRef.current = true;
    previousLastRef.current = lastId;
  }, [messages, visible]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (visible && atBottomRef.current && !prependRef.current) jumpToLatest();
    });
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [visible]);

  const loadOlder = async () => {
    const el = scrollRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top;
      const anchor = [...el.querySelectorAll('[data-message-id]')].find((row) => row.getBoundingClientRect().bottom > top);
      prependRef.current = { top: el.scrollTop, height: el.scrollHeight, pages: data?.pages.length ?? 0,
        anchorId: anchor?.dataset.messageId, anchorTop: anchor?.getBoundingClientRect().top };
    }
    try {
      const result = await fetchNextPage();
      if (result.isError) { prependRef.current = null; setNotice(tError(result.error)); }
      return result;
    }
    catch (error) { prependRef.current = null; setNotice(tError(error)); return null; }
  };

  const jumpToMessage = async (id) => {
    if (jumpingRef.current) return;
    jumpingRef.current = true;
    try {
      let loaded = data;
      while (mountedRef.current && loaded && !flattenPages(loaded.pages).some((m) => m.id === id) && loaded.pages.at(-1)?.hasMore) {
        const result = await loadOlder();
        if (!result || result.isError || result.data === loaded) break;
        loaded = result.data;
      }
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;
        const target = [...(scrollRef.current?.querySelectorAll('[data-message-id]') ?? [])].find((el) => el.dataset.messageId === id);
        if (!target) { setNotice(t('chat.originalUnavailable')); return; }
        target.scrollIntoView({ block: 'center', behavior: 'auto' });
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) target.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 600 });
        updateScrollPosition();
      });
    } finally { jumpingRef.current = false; }
  };

  // Выделение: повторный клик снимает выбор; пустой выбор закрывает режим; Escape выходит
  useEffect(() => {
    if (selecting && selected.size === 0) setSelecting(false);
  }, [selecting, selected]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.repeat || !visible) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      if (menu) setMenu(null);
      else if (headerMenu) setHeaderMenu(false);
      else if (searchOpen) setSearchOpen(false);
      else if (selecting) { setSelecting(false); setSelected(new Set()); }
      else if (editing) { if (!edit.isPending) setEditing(null); }
      else if (replying) setReplying(null);
      else onBack?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, menu, headerMenu, searchOpen, selecting, editing, replying, edit.isPending, onBack]);

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
  const canDelete = (m) => canDeleteMessage(m, { isDirect, userId: currentUser.id, userStatus: currentUser.status });
  const savingIds = useRef(new Set());
  const reactToMessage = async (message, emoji, active) => {
    if (!chat.react || reactionsInFlight.current.has(message.id)) return;
    reactionsInFlight.current.add(message.id);
    setReactingIds(new Set(reactionsInFlight.current));
    try {
      const payload = await chat.react(message.id, emoji, active);
      queryClient.setQueryData(messagesKey, (old) => applyReactionEvent(old, payload));
    } catch (error) { if (mountedRef.current) setNotice(tError(error)); }
    finally {
      reactionsInFlight.current.delete(message.id);
      if (mountedRef.current) setReactingIds(new Set(reactionsInFlight.current));
    }
  };
  const saveToFavorites = async (message) => {
    if (!onSaveMessage || savingIds.current.has(message.id)) return;
    savingIds.current.add(message.id);
    try { await onSaveMessage(message.id); setNotice(t('saved.done')); }
    catch (error) { setNotice(tError(error)); }
    finally { savingIds.current.delete(message.id); }
  };

  const menuItems = (m) => {
    const items = [{ key: 'reply', label: t('actions.reply') }];
    if (chat.readers && isOwn(m)) items.push({ key: 'readers', label: t('readers.title') });
    if (onSaveMessage && !isSaved) items.push({ key: 'save', label: t('saved.save') });
    if (m.text) items.push({ key: 'copy', label: t('actions.copy') });
    if (canEdit(m)) items.push({ key: 'edit', label: t('actions.edit') });
    items.push({ key: 'select', label: t('actions.select') });
    if (canDelete(m)) items.push({ key: 'delete', label: t('actions.delete'), danger: true });
    return items;
  };

  const onMenuSelect = (key) => {
    if (edit.isPending) return;
    const message = menu?.message;
    setMenu(null);
    if (!message) return;
    if (key === 'copy') {
      navigator.clipboard?.writeText(message.text);
      setNotice(t('actions.copied'));
    }
    if (key === 'edit') { setReplying(null); setEditing({ id: message.id, text: message.text, attachment: message.attachment }); }
    if (key === 'reply') { setEditing(null); setReplying(message); }
    if (key === 'save') void saveToFavorites(message);
    if (key === 'readers') setReadersMessageId(message.id);
    if (key === 'select') startSelect(message.id);
    if (key === 'delete') setDialog({ kind: 'delete', ids: [message.id] });
  };

  // Подтверждение: выполняем выбранное действие; ошибки показываем, а не глотаем
  const confirmDialog = async (mode) => {
    const current = dialog;
    setDialog(null);
    if (!current) return;

    if (current.kind === 'delete') {
      await removeMany(current.ids, isSaved || !isDirect ? 'everyone' : mode);
      exitSelect();
      return;
    }
    try {
      if (current.kind === 'clear') {
        await chat.clear(isSaved ? 'both' : mode);
        queryClient.resetQueries({ queryKey: messagesKey });
      }
      if (current.kind === 'deleteChat') {
        await chat.deleteChat(mode);
      }
    } catch (error) {
      setNotice(tError(error));
    }
  };

  const submitInput = async (text, file, voiceDurationMs) => {
    if (editing) {
      try {
        await edit.mutateAsync({ id: editing.id, text });
        setEditing(null);
        return true;
      } catch { return false; }
    } else {
      send.mutate({ text, file, replyTo: replying, voiceDurationMs, clientMessageId: newClientMessageId() });
      setReplying(null);
      return true;
    }
  };

  const dialogProps = (() => {
    if (!dialog) return null;
    if (dialog.kind === 'delete') {
      const title = t('actions.deleteTitle', { count: dialog.ids.length });
      if (!isDirect || isSaved) {
        return { title, text: isSaved ? undefined : t('actions.deleteGeneralText'), confirmLabel: t('actions.delete'), danger: true, options: [] };
      }
      return {
        title,
        confirmLabel: t('actions.delete'),
        danger: true,
        options: [
          { value: 'me', label: t('actions.deleteForMe') },
          ...(!isGroup || chat.canModerate || dialog.ids.every((id) => messages.some((m) => m.id === id && isOwn(m))) ? [{ value: 'everyone', label: t('actions.deleteForEveryone') }] : []),
        ],
      };
    }
    if (dialog.kind === 'clear') {
      return {
        title: t('actions.clearTitle'),
        text: t('actions.clearText'),
        confirmLabel: t('actions.clear'),
        danger: true,
        options: isSaved ? [] : [
          { value: 'me', label: t('actions.onlyForMe') },
          ...(!isSaved && (!isGroup || chat.canModerate) ? [{ value: 'both', label: t(isGroup ? 'actions.forAll' : 'actions.forBoth') }] : []),
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
      {isSaved ? <SavedAvatar size={42} /> : <Avatar name={chat.avatar.name} seed={chat.avatar.seed} size={42} src={chat.avatar.src} />}
      <div className="chat__headline">
        <div className="chat__name">{chat.title}</div>
        <div className="chat__status">
          <TypingLabel channel={chat.typingKey} userId={currentUser.id}>
          {chat.presenceUserId ? (
            <PresenceLabel userId={chat.presenceUserId} fallback={chat.presence} lastSeenAt={chat.lastSeenAt} />
          ) : (
            chat.subtitle ?? t('chat.messageCount', { count: messages.length })
          )}
          </TypingLabel>
        </div>
      </div>
    </>
  );

  return (
    <section className={`chat${background.config.type !== 'default' ? ' chat--custom-background' : ''}`} style={backgroundStyle(background.config, background.imageUrl)}>
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
          {chat.search && <button type="button" className="icon-btn chat__search-toggle" onClick={() => setSearchOpen((open) => !open)} aria-label={t('messageSearch.title')} aria-expanded={searchOpen}><SearchIcon /></button>}
          <button type="button" className="icon-btn chat__background-toggle" disabled={background.loading} onClick={() => setBackgroundOpen(true)} aria-label={t('background.title')} title={t('background.title')}><ImageIcon /></button>
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
                  {!isGroup && !isSaved && <button
                    type="button"
                    role="menuitem"
                    className="msg-menu__item msg-menu__item--danger"
                    onClick={() => {
                      setHeaderMenu(false);
                      setDialog({ kind: 'deleteChat' });
                    }}
                  >
                    <span>{t('actions.deleteChat')}</span>
                  </button>}
                  {isGroup && <button type="button" role="menuitem" className="msg-menu__item" onClick={() => { setHeaderMenu(false); chat.onHeaderClick?.(); }}>{t('groups.info')}</button>}
                </div>
              )}
            </div>
          )}
        </header>
      )}

      {!chat.demo && <RealtimeBanner />}
      {searchOpen && chat.search && <MessageSearchPanel chat={chat} onClose={() => setSearchOpen(false)} onJump={jumpToMessage} />}

      <div className="chat__messages" ref={scrollRef} onScroll={updateScrollPosition}>
        <div className="chat__content" ref={contentRef}>
        {hasNextPage && (
          <button
            type="button"
            className="btn-link chat__load-older"
            onClick={loadOlder}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? t('common.loading') : t('chat.loadOlder')}
          </button>
        )}
        {isLoading && <ChatSkeleton />}
        {isError && <div className="chat__hint chat__hint--error">{t('chat.loadFailed')}</div>}
        {!isLoading && !isError && messages.length === 0 && (
          <ChatEmptyState saved={isSaved} />
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
              read={isDirect ? isReadByPeer(item.message, readThroughId) : Boolean(item.message.readByOther)}
              onJumpToMessage={jumpToMessage}
              onSave={onSaveMessage && !isSaved ? () => saveToFavorites(item.message) : undefined}
              hideReceipt={isSaved}
              currentUserId={currentUser.id}
              onReact={chat.react ? (emoji, active) => reactToMessage(item.message, emoji, active) : undefined}
              reacting={reactingIds.has(item.message.id)}
              onShowReaders={chat.readers ? () => setReadersMessageId(item.message.id) : undefined}
            />
          )
        )}
        <div ref={bottomRef} />
        </div>
      </div>

      {!atBottom && <button type="button" className="chat__jump" onClick={jumpToLatest} aria-label={t('chat.jumpToLatest')}>
        <span aria-hidden="true">↓</span> {newMessageIds.size ? t('chat.newMessages', { count: newMessageIds.size }) : t('chat.jumpToLatest')}
      </button>}

      {notice && (
        <div className="chat__notice" role="status">
          {notice}
        </div>
      )}
      {!selecting && <MessageInput onSend={submitInput} onTyping={chat.onTyping} disabled={edit.isPending} editing={editing} onCancelEdit={() => setEditing(null)} replying={replying} onCancelReply={() => setReplying(null)} />}

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
      {backgroundOpen && <ChatBackgroundModal config={background.config} loadError={background.error} onSave={background.save} onClose={() => setBackgroundOpen(false)} />}
      {readersMessageId && chat.readers && <MessageReadersModal chat={chat} messageId={readersMessageId} onClose={() => setReadersMessageId(null)} />}
    </section>
  );
}
