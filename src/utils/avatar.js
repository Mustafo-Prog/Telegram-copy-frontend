import { API_ORIGIN } from '../api/http.js';

const AVATAR_SIZE = 256;

// Картинка → квадрат 256×256 (по центру), WEBP ~10–30 КБ. Сервер принимает и JPEG, и PNG
export async function resizeAvatar(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const err = new Error('Not an image');
    err.code = 'avatar_invalid';
    throw err;
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  canvas.getContext('2d').drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) {
    const err = new Error('Could not encode avatar');
    err.code = 'avatar_invalid';
    throw err;
  }
  return blob;
}

// Сервер отдаёт путь вида /api/users/:id/avatar?v=..., картинку берём с адреса backend
export function resolveAvatarUrl(src) {
  if (!src) return null;
  return src.startsWith('/') ? `${API_ORIGIN}${src}` : src;
}
