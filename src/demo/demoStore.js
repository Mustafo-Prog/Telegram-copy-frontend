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
  return { messages: chat.messages.map((m) => resolve(m)), hasMore: false };
}

export function sendDemoMessage(store, chatId, text, me) {
  const chat = findChat(store, chatId);
  const message = {
    id: `demo-m-${store.nextId++}`,
    senderId: me.id,
    senderName: me.displayName,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  chat.messages.push(message);
  return { ...message };
}

// Редактировать можно только свои сообщения
export function editDemoMessage(store, chatId, messageId, text, meId) {
  const chat = findChat(store, chatId);
  const message = findMessage(chat, messageId);
  if (message.senderId !== meId) throw new DemoError('forbidden');
  message.text = text.trim();
  delete message.textKey;
  message.editedAt = new Date().toISOString();
  return { ...message };
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
