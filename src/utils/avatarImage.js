export const MAX_AVATAR_SIDE = 1024;
// Match the existing API upload limit without sacrificing full-screen photo quality.
export const MAX_AVATAR_BYTES = 300 * 1024;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

function invalidAvatar() {
  const error = new Error('Could not prepare avatar');
  error.code = 'avatar_invalid';
  return error;
}

export async function resizeAvatar(file) {
  if (!file || file.size > MAX_INPUT_BYTES) throw invalidAvatar();
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw invalidAvatar(); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_PIXELS) throw invalidAvatar();
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    for (let size = Math.min(MAX_AVATAR_SIDE, side); size >= 128; size = Math.floor(size * 0.75)) {
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw invalidAvatar();
      context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
      for (const quality of [0.86, 0.72, 0.56]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob) throw invalidAvatar();
        if (blob.size <= MAX_AVATAR_BYTES) return blob;
      }
    }
    // Small source photos remain at their original resolution rather than being enlarged.
    if (side < 128) {
      canvas.width = side;
      canvas.height = side;
      const context = canvas.getContext('2d');
      if (!context) throw invalidAvatar();
      context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, side, side);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
      if (blob && blob.size <= MAX_AVATAR_BYTES) return blob;
    }
    throw invalidAvatar();
  } finally { bitmap.close?.(); }
}
