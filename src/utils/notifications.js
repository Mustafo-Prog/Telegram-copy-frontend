export function shouldNotifyIncoming({ message, userId, enabled, chatId, activeChatId, chatVisible, focused, visible }) {
  return Boolean(enabled && message?.id && message.senderId !== userId && !(visible && focused && chatVisible && chatId === activeChatId));
}

export function notificationBody(message, preview, labels) {
  if (!preview) return labels.newMessage;
  return (message.text || (message.attachment?.kind === 'voice' ? labels.voice : message.attachment?.name) || labels.newMessage).slice(0, 180);
}

export function validChatId(value) { return value === 'general' || (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)); }
