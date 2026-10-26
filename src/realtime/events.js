// Обновление кэша по событиям сервера. Чистые функции: без React и сети, поэтому их проверяют тесты.
import { mapPages, upsertNewest, removeMessages } from '../utils/messageState.js';

// Сообщение общего чата или личного диалога в страничном кэше
export function applyPagedNew(data, message) {
  return upsertNewest(data, message);
}

export function applyPagedUpdate(data, message) {
  return mapPages(data, (list) => list.map((m) => (m.id === message.id ? message : m)));
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
  return list.map((m) => (m.id === message.id ? message : m));
}

export function applyFlatDelete(list = [], ids) {
  const drop = new Set(ids);
  return list.filter((m) => !drop.has(m.id));
}

// Превью диалога в списке: обновляем текст и время, если диалог уже в списке
export function applyConversationPreview(list, conversationId, message) {
  if (!Array.isArray(list)) return list;
  if (!list.some((c) => c.id === conversationId)) return null; // нет в списке — нужно перезагрузить список
  return list
    .map((c) =>
      c.id === conversationId ? { ...c, lastMessageText: message.text, lastMessageAt: message.createdAt } : c
    )
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}
