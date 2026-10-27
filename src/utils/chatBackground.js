// Wallpapers stay on this device, scoped to both the signed-in user and the chat.
export const DEFAULT_BACKGROUND = Object.freeze({ type: 'default', dim: 0 });
export const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;
export const MAX_BACKGROUND_PIXELS = 40 * 1000 * 1000;
export const MAX_BACKGROUND_SIDE = 1600;
const MAX_STORED_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DATABASE = 'tg-chat-backgrounds';
const STORE = 'backgrounds';

export const PRESETS = Object.freeze([
  { id: 'mint', backgroundColor: '#dcece2', backgroundImage: 'radial-gradient(at 12% 20%, #f2f6da 0, transparent 55%), radial-gradient(at 86% 80%, #a4d6cc 0, transparent 60%), linear-gradient(135deg, #dcece2, #c4e5dc)' },
  { id: 'ocean', backgroundColor: '#d7e9f3', backgroundImage: 'radial-gradient(at 10% 15%, #e4f6f4 0, transparent 60%), radial-gradient(at 90% 85%, #a7c7ed 0, transparent 60%), linear-gradient(135deg, #d7e9f3, #bdd9eb)' },
  { id: 'lavender', backgroundColor: '#e8e2f4', backgroundImage: 'radial-gradient(at 16% 20%, #f6e7ed 0, transparent 60%), radial-gradient(at 85% 85%, #c0b5df 0, transparent 60%), linear-gradient(135deg, #e8e2f4, #d8ccef)' },
  { id: 'sunset', backgroundColor: '#f1dfd1', backgroundImage: 'radial-gradient(at 10% 20%, #f9edc5 0, transparent 60%), radial-gradient(at 90% 85%, #e9b5ba 0, transparent 65%), linear-gradient(135deg, #f1dfd1, #ecc5b7)' },
  { id: 'midnight', backgroundColor: '#1c3046', backgroundImage: 'radial-gradient(at 10% 15%, #324b63 0, transparent 60%), radial-gradient(at 85% 85%, #26385f 0, transparent 65%), linear-gradient(135deg, #1c3046, #172635)' },
]);

function backgroundError(code, cause) {
  const error = new Error(code);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

export function normalizeBackground(value) {
  if (!value || typeof value !== 'object') return { ...DEFAULT_BACKGROUND };
  const dim = Number.isFinite(Number(value.dim)) ? Math.min(70, Math.max(0, Math.round(Number(value.dim)))) : 0;
  if (value.type === 'preset' && PRESETS.some((preset) => preset.id === value.preset)) return { type: 'preset', preset: value.preset, dim };
  if (value.type === 'color' && /^#[0-9a-f]{6}$/i.test(value.color ?? '')) return { type: 'color', color: value.color.toLowerCase(), dim };
  if (value.type === 'image') {
    const imageBlob = typeof Blob !== 'undefined' && value.imageBlob instanceof Blob && value.imageBlob.size > 0 &&
      value.imageBlob.size <= MAX_STORED_IMAGE_BYTES && IMAGE_TYPES.has(value.imageBlob.type) ? value.imageBlob : null;
    return { type: 'image', dim, ...(imageBlob ? { imageBlob } : {}) };
  }
  return { ...DEFAULT_BACKGROUND };
}

export function backgroundStyle(value, imageUrl) {
  const config = normalizeBackground(value);
  if (config.type === 'default') return {};
  let image = 'none';
  let color;
  if (config.type === 'preset') {
    const preset = PRESETS.find((entry) => entry.id === config.preset);
    image = preset.backgroundImage;
    color = preset.backgroundColor;
  } else if (config.type === 'color') color = config.color;
  else {
    // Only URLs created from the local image Blob are accepted; no remote fetches.
    if (typeof imageUrl !== 'string' || !/^blob:[^\s"'()]+$/.test(imageUrl)) return {};
    image = `url("${imageUrl}")`;
    color = '#182532';
  }
  if (config.dim > 0) {
    const shade = `linear-gradient(rgba(0, 0, 0, ${config.dim / 100}), rgba(0, 0, 0, ${config.dim / 100}))`;
    image = image === 'none' ? shade : `${shade}, ${image}`;
  }
  return { backgroundColor: color, backgroundImage: image };
}

export function backgroundStorageKey(userId, chatKey) {
  return JSON.stringify([String(userId), String(chatKey)]);
}

function useStore(mode, run, factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory?.open) { reject(backgroundError('background_storage')); return; }
    let opening;
    let stopped = false;
    const fail = (cause) => { stopped = true; reject(backgroundError('background_storage', cause)); };
    try { opening = factory.open(DATABASE, 1); }
    catch (error) { fail(error); return; }
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    opening.onerror = () => fail(opening.error);
    opening.onblocked = () => fail(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      if (stopped) { db.close(); return; }
      db.onversionchange = () => db.close();
      let transaction;
      let request;
      let result;
      try {
        transaction = db.transaction(STORE, mode);
        request = run(transaction.objectStore(STORE));
      } catch (error) { db.close(); fail(error); return; }
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = transaction.onabort = () => { db.close(); fail(transaction.error ?? request.error); };
    };
  });
}

export async function loadBackground(userId, chatKey, factory) {
  const saved = await useStore('readonly', (store) => store.get(backgroundStorageKey(userId, chatKey)), factory);
  const config = normalizeBackground(saved);
  return config.type === 'image' && !config.imageBlob ? { ...DEFAULT_BACKGROUND } : config;
}

export async function saveBackground(userId, chatKey, value, factory) {
  const config = normalizeBackground(value);
  if (config.type === 'image' && !config.imageBlob) throw backgroundError('background_image_invalid');
  const key = backgroundStorageKey(userId, chatKey);
  await useStore('readwrite', (store) => config.type === 'default' ? store.delete(key) : store.put(config, key), factory);
  return config;
}

export function validateBackgroundFile(file) {
  if (!file || !IMAGE_TYPES.has(file.type)) throw backgroundError('background_image_type');
  if (file.size > MAX_BACKGROUND_BYTES) throw backgroundError('background_image_size');
  if (!file.size) throw backgroundError('background_image_invalid');
}

export function backgroundImageSize(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > MAX_BACKGROUND_PIXELS) {
    throw backgroundError('background_image_dimensions');
  }
  const scale = Math.min(1, MAX_BACKGROUND_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decodeImage(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    const bitmap = await globalThis.createImageBitmap(file);
    return { image: bitmap, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    return { image, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

export async function prepareBackgroundImage(file) {
  validateBackgroundFile(file);
  let decoded;
  try {
    decoded = await decodeImage(file);
    const { image } = decoded;
    const size = backgroundImageSize(image.naturalWidth ?? image.width, image.naturalHeight ?? image.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw backgroundError('background_image_invalid');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    for (const quality of [0.85, 0.68, 0.5]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob?.size && blob.size <= MAX_STORED_IMAGE_BYTES) return blob;
    }
    throw backgroundError('background_image_size');
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('background_')) throw error;
    throw backgroundError('background_image_invalid', error);
  } finally { decoded?.close(); }
}
