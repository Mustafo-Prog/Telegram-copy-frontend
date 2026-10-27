// Одно Socket.IO-соединение на вкладку. Переподключение — встроенное, с нарастающей задержкой
// (до 15 с), поэтому нет быстрого цикла переподключений. Токен берётся при подключении.
import { io } from 'socket.io-client';
import { API_ORIGIN, TOKEN_KEY } from '../api/http.js';
import { resetPresence } from './presence.js';
import { resetTyping } from './typing.js';

const ACTIVITY_THROTTLE_MS = 30 * 1000;

let socket = null;
let status = 'idle'; // idle | connecting | connected | reconnecting | offline | unauthorized
let hadConnection = false;
let lastActivitySent = 0;
let stopActivityTracking = null;
const watchedUsers = new Map();
const typingSent = new Map();
const statusListeners = new Set();
const handlers = { onReconnect: null, onEvent: null };

function setStatus(next) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

export const getRealtimeStatus = () => status;
export const isRealtimeConnected = () => status === 'connected';

export function subscribeRealtimeStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

const EVENTS = ['message:new', 'message:updated', 'message:deleted', 'chat:changed', 'presence:update', 'conversation:read', 'general:read', 'typing:update', 'preferences:changed'];

// Подключение (однократно за сессию). Повторный вызов с тем же токеном ничего не делает.
export function connectRealtime({ onReconnect, onEvent }) {
  handlers.onReconnect = onReconnect;
  handlers.onEvent = onEvent;
  if (socket) return;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  setStatus('connecting');
  socket = io(API_ORIGIN, {
    auth: { token },
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    randomizationFactor: 0.5,
  });

  socket.on('connect', () => {
    const wasDown = hadConnection;
    hadConnection = true;
    setStatus('connected');
    for (const [id, entry] of watchedUsers) subscribeUser(id, entry);
    // После разрыва: догружаем пропущенное через обычные запросы (без дублей — по id)
    if (wasDown) handlers.onReconnect?.();
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      // Сервер отключил (например, токен отозван) — переподключаться сами не будем
      setStatus('unauthorized');
      return;
    }
    setStatus('reconnecting');
  });

  socket.on('connect_error', (err) => {
    if (err?.message === 'unauthorized') {
      setStatus('unauthorized');
      socket.disconnect();
      return;
    }
    setStatus(hadConnection ? 'reconnecting' : 'offline');
  });

  for (const event of EVENTS) {
    socket.on(event, (payload) => handlers.onEvent?.(event, payload));
  }

  stopActivityTracking = trackActivity();
}

// Подписка на статусы собеседников. Ответ сервера содержит только видимые статусы.
export function watchPresence(userIds, onStatuses) {
  for (const id of new Set(userIds.map(String))) {
    let entry = watchedUsers.get(id);
    if (!entry) { entry = { count: 0, callbacks: new Set() }; watchedUsers.set(id, entry); }
    entry.count += 1;
    if (onStatuses) entry.callbacks.add(onStatuses);
    if (socket?.connected) subscribeUser(id, entry);
  }
}

function subscribeUser(id, entry) {
  socket?.emit('presence:watch', { userIds: [id] }, (reply) => {
    for (const callback of entry.callbacks) callback(reply?.statuses ?? {}, reply?.lastSeen ?? {});
  });
}

export function unwatchPresence(userIds) {
  const removed = [];
  for (const id of new Set(userIds.map(String))) {
    const entry = watchedUsers.get(id);
    if (entry && --entry.count <= 0) { watchedUsers.delete(id); removed.push(id); }
  }
  if (removed.length) socket?.emit('presence:unwatch', { userIds: removed });
}

export function disconnectRealtime() {
  if (socket) socket.disconnect();
  socket = null;
  stopActivityTracking?.();
  stopActivityTracking = null;
  watchedUsers.clear();
  lastActivitySent = 0;
  resetPresence();
  resetTyping(); typingSent.clear();
  hadConnection = false;
  setStatus('idle');
}

export function sendTyping(context, active) {
  if (!socket?.connected) return;
  const key = context.conversationId ?? 'general';
  const now = Date.now();
  if (active && now - (typingSent.get(key) ?? 0) < 1800) return;
  if (active) typingSent.set(key, now); else typingSent.delete(key);
  socket.emit('typing:set', { ...context, active });
}

// Активность для онлайн-статуса: сообщаем серверу не чаще раза в 30 секунд
function trackActivity() {
  const send = () => {
    if (!socket?.connected) return;
    const now = Date.now();
    if (now - lastActivitySent < ACTIVITY_THROTTLE_MS) return;
    lastActivitySent = now;
    socket.emit('presence:activity');
  };
  ['pointerdown', 'keydown', 'focus'].forEach((type) => window.addEventListener(type, send, { passive: true }));
  const onVisibility = () => {
    if (document.visibilityState === 'visible') send();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    ['pointerdown', 'keydown', 'focus'].forEach((type) => window.removeEventListener(type, send));
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
