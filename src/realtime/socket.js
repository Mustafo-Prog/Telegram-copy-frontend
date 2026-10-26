// Одно Socket.IO-соединение на вкладку. Переподключение — встроенное, с нарастающей задержкой
// (до 15 с), поэтому нет быстрого цикла переподключений. Токен берётся при подключении.
import { io } from 'socket.io-client';
import { API_ORIGIN, TOKEN_KEY } from '../api/http.js';

const ACTIVITY_THROTTLE_MS = 30 * 1000;

let socket = null;
let status = 'idle'; // idle | connecting | connected | reconnecting | offline | unauthorized
let hadConnection = false;
let lastActivitySent = 0;
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

const EVENTS = ['message:new', 'message:updated', 'message:deleted', 'chat:changed', 'presence:update'];

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
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    randomizationFactor: 0.5,
  });

  socket.on('connect', () => {
    const wasDown = hadConnection;
    hadConnection = true;
    setStatus('connected');
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

  trackActivity();
}

// Подписка на статусы собеседников. Ответ сервера содержит только видимые статусы.
export function watchPresence(userIds, onStatuses) {
  if (!socket || !userIds.length) return;
  socket.emit('presence:watch', { userIds }, (reply) => onStatuses?.(reply?.statuses ?? {}));
}

export function unwatchPresence(userIds) {
  if (!socket || !userIds.length) return;
  socket.emit('presence:unwatch', { userIds });
}

export function disconnectRealtime() {
  if (socket) socket.disconnect();
  socket = null;
  hadConnection = false;
  setStatus('idle');
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') send();
  });
}
