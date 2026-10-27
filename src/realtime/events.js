// Обновление кэша по событиям сервера. Чистые функции: без React и сети, поэтому их проверяют тесты.
import { mapPages, upsertNewest, removeMessages, mergeMessage } from '../utils/messageState.js';
import { applyGeneralReadCursors } from '../utils/generalReads.js';
import { sortChats } from '../utils/chatList.js';

// Сообщение общего чата или личного диалога в страничном кэше
export function applyPagedNew(data, message) {
  return upsertNewest(data, message);
}

export function applyPagedUpdate(data, message) {
  return mapPages(data, (list) => list.map((m) => {
    if (m.id === message.id) return mergeMessage(m, message);
    if (m.replyTo?.id === message.id && !m.replyTo.unavailable) return { ...m, replyTo: { ...m.replyTo, text: message.text, attachmentName: message.attachment?.name } };
    return m;
  }));
}

export function applyGeneralReadReceipt(data, receipt) {
  return mapPages(data, (messages) => applyGeneralReadCursors(messages, [receipt]));
}

export function applyReadReceipt(data, messageId) {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page,
    peerLastReadMessageId: [page.peerLastReadMessageId, messageId].filter(Boolean).sort().at(-1),
  })) };
}

export function applyPagedDelete(data, ids) {
  return removeMessages(data, ids);
}

// Плоский список (превью общего чата): без дублей, по времени
export function applyFlatNew(list = [], message) {
  if (list.some((m) => m.id === message.id)) return list;
  return [...list, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function applyFlatUpdate(list = [], message) {
  return list.map((m) => (m.id === message.id ? mergeMessage(m, message) : m));
}

export function applyFlatDelete(list = [], ids) {
  const drop = new Set(ids);
  return list.filter((m) => !drop.has(m.id));
}

// Превью диалога в списке: обновляем текст и время, если диалог уже в списке
export function applyConversationPreview(list, conversationId, message, currentUserId) {
  if (!Array.isArray(list)) return list;
  const conversation = list.find((c) => c.id === conversationId);
  if (!conversation) return null; // нет в списке — нужно перезагрузить список
  // Сокет и ответ HTTP доставляют одно сообщение независимо. Запоздавший ответ
  // не должен откатывать превью или повторно увеличивать непрочитанные.
  if (conversation.lastMessageId === message.id) return list;
  const previousAt = new Date(conversation.lastMessageAt ?? 0).getTime();
  const incomingAt = new Date(message.createdAt).getTime();
  if (incomingAt < previousAt || (conversation.lastMessageId &&
      incomingAt === previousAt && message.id < conversation.lastMessageId)) return list;
  const unread = currentUserId && message.senderId && message.senderId !== currentUserId && conversation.kind !== 'saved';
  return sortChats(list.map((c) => c.id === conversationId ? {
    ...c,
    lastMessageId: message.id,
    lastMessageText: message.text || message.attachment?.name || '',
    lastMessageType: message.text ? 'text' : message.attachment?.kind ?? 'file',
    lastMessageAt: message.createdAt,
    unreadCount: (c.unreadCount ?? 0) + (unread ? 1 : 0),
  } : c));
}

// Квитанция меняет счётчик и курсор прямо в кэше, без перезагрузки всех чатов.
export function applyConversationRead(list, conversationId, { userId, currentUserId, messageId }) {
  if (!Array.isArray(list) || !messageId) return list;
  return list.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    if (userId === currentUserId) {
      // Старый запрос чтения мог завершиться уже после прихода нового сообщения.
      if (!conversation.lastMessageId || messageId < conversation.lastMessageId || !conversation.unreadCount) return conversation;
      return { ...conversation, unreadCount: 0 };
    }
    if (conversation.peerLastReadMessageId && conversation.peerLastReadMessageId >= messageId) return conversation;
    return { ...conversation, peerLastReadMessageId: messageId };
  });
}
