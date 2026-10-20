const MESSAGES_KEY = 'tg_messages';

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function seedMessages() {
  return [
    {
      id: crypto.randomUUID(),
      senderId: 'system',
      senderName: 'Система',
      text: 'Добро пожаловать в общий чат!',
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function getMessages() {
  await delay();
  const stored = read(MESSAGES_KEY, null);
  if (stored) return stored;
  const seeded = seedMessages();
  write(MESSAGES_KEY, seeded);
  return seeded;
}

export async function sendMessage(text, sender) {
  await delay(100);
  const message = {
    id: crypto.randomUUID(),
    senderId: sender.id,
    senderName: sender.displayName,
    text,
    createdAt: new Date().toISOString(),
  };
  const messages = read(MESSAGES_KEY, null) ?? seedMessages();
  write(MESSAGES_KEY, [...messages, message]);
  return message;
}
