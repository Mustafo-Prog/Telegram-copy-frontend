// Демонстрационные данные: только в памяти браузера. Ни один вызов отсюда не уходит на сервер,
// поэтому реальные переписки, почты и аккаунты в демо-режиме недоступны.

export const DEMO_ME_ID = 'demo-you';

export class DemoError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

export function createDemoStore(seedChats) {
  return {
    nextId: 1,
    chats: seedChats.map((chat) => ({
      id: chat.id,
      titleKey: chat.titleKey,
      subtitleKey: chat.subtitleKey,
      presence: chat.presence,
      lastSeenAt: chat.lastSeenAt,
      messages: chat.messages.map((m) => ({ ...m })),
    })),
  };
}

function findChat(store, chatId) {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) throw new DemoError('conversation_not_found');
  return chat;
}

function findMessage(chat, messageId) {
  const message = chat.messages.find((m) => m.id === messageId);
  if (!message) throw new DemoError('message_not_found');
  return message;
}

// resolve переводит текст и подставляет подписи; сами данные не меняет
export function loadDemoMessages(store, chatId, resolve) {
  const chat = findChat(store, chatId);
  return { messages: chat.messages.map((m) => resolve(withReply(chat, m))), hasMore: false };
}

function withReply(chat, message) {
  if (!message.replyToId) return { ...message };
  const original = chat.messages.find((m) => m.id === message.replyToId);
  return { ...message, replyTo: original ? {
    id: original.id, senderName: original.senderName, senderId: original.senderId,
    text: original.text, textKey: original.textKey, attachmentName: original.attachment?.name,
  } : { id: message.replyToId, unavailable: true } };
}

export function sendDemoMessage(store, chatId, text, me, { file = null, replyToId = null } = {}) {
  const chat = findChat(store, chatId);
  if (!text.trim() && !file) throw new DemoError('message_empty');
  if (replyToId && !chat.messages.some((m) => m.id === replyToId)) throw new DemoError('reply_not_found');
  const message = {
    id: `demo-m-${store.nextId++}`,
    senderId: me.id,
    senderName: me.displayName,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    replyToId,
    attachment: file ? { name: file.name, contentType: file.type, size: file.size, blob: file } : null,
  };
  chat.messages.push(message);
  return withReply(chat, message);
}

// Редактировать можно только свои сообщения
export function editDemoMessage(store, chatId, messageId, text, meId) {
  const chat = findChat(store, chatId);
  const message = findMessage(chat, messageId);
  if (message.senderId !== meId) throw new DemoError('forbidden');
  if (!text.trim() && !message.attachment) throw new DemoError('message_empty');
  message.text = text.trim();
  delete message.textKey;
  message.editedAt = new Date().toISOString();
  return withReply(chat, message);
}

// Удаляются только свои сообщения; чужие пропускаются со счётчиком (как на сервере)
export function removeDemoMessages(store, chatId, messageIds, meId) {
  const chat = findChat(store, chatId);
  const drop = new Set(messageIds);
  let deleted = 0;
  let skipped = 0;
  chat.messages = chat.messages.filter((m) => {
    if (!drop.has(m.id)) return true;
    if (m.senderId !== meId) {
      skipped += 1;
      return true;
    }
    deleted += 1;
    return false;
  });
  return { deleted, skipped };
}

export function clearDemoChat(store, chatId) {
  findChat(store, chatId).messages = [];
}

export function deleteDemoChat(store, chatId) {
  store.chats = store.chats.filter((c) => c.id !== chatId);
}
