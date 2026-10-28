import { MAX_ATTACHMENT_BYTES } from './messageContent.js';

const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Read only the user-initiated paste event; ordinary text keeps native paste behaviour.
export function clipboardImage(clipboardData) {
  const items = Array.from(clipboardData?.items ?? []);
  let file = items.find((item) => item.kind === 'file' && item.type?.startsWith('image/'))?.getAsFile();
  file ??= Array.from(clipboardData?.files ?? []).find((entry) => entry.type?.startsWith('image/'));
  if (!file) return null;
  if (!IMAGE_TYPES[file.type] || !file.size) return { error: 'attachment_invalid' };
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: 'attachment_too_large' };
  return { file: new File([file], `image-${Date.now()}.${IMAGE_TYPES[file.type]}`, { type: file.type }) };
}
