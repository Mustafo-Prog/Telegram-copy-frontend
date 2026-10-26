export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function messagePayload(text, { file = null, replyToId = null } = {}) {
  if (!file) return { text, ...(replyToId ? { replyToId } : {}) };
  const form = new FormData();
  form.append('text', text);
  if (replyToId) form.append('replyToId', replyToId);
  form.append('attachment', file);
  return form;
}

export function fileSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isReadByPeer(message, readThroughId) {
  return !message.pending && Boolean(message.readByPeer || (readThroughId && message.id <= readThroughId));
}
