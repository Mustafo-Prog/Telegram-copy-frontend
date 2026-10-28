// Чистые функции для списка сообщений: выделение, пакеты, страницы.
// Без React и без DOM — поэтому их можно проверять тестами (npm test).

export const BULK_LIMIT = 100;

// Повторный выбор отменяет выделение; возвращает новый Set (состояние не мутируется)
export function toggleSelection(selected, id) {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// Пакеты по BULK_LIMIT: сервер принимает не больше 100 id за запрос
export function chunk(ids, size = BULK_LIMIT) {
  const parts = [];
  for (let i = 0; i < ids.length; i += size) parts.push(ids.slice(i, i + size));
  return parts;
}

// Личное: удалять можно любое видимое сообщение; общее: только своё
export function canDeleteMessage(message, { isDirect, userId }) {
  if (message.pending) return false;
  return isDirect || message.senderId === userId;
}

export function canEditMessage(message, userId) {
  return !message.pending && message.senderId === userId;
}

// data.pages: pages[0] — самая новая страница, последняя — самая старая.
// Возвращает сообщения по возрастанию времени, без дублей.
export function flattenPages(pages = []) {
  const seen = new Set();
  const out = [];
  for (const page of [...pages].reverse()) {
    for (const message of page.messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      out.push(message);
    }
  }
  return out.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function mapPages(data, fn) {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, messages: fn(page.messages) })) };
}

// A late HTTP response or edit event must not undo an already received read receipt.
export function mergeMessage(previous, incoming) {
  const message = { ...previous, ...incoming };
  if (previous?.readByOther) message.readByOther = true;
  if ((previous?.reactionsVersion ?? 0) > (incoming.reactionsVersion ?? 0)) {
    message.reactions = previous.reactions;
    message.reactionsVersion = previous.reactionsVersion;
  }
  return message;
}

export function removeMessages(data, ids) {
  const drop = new Set(ids);
  return mapPages(data, (list) => list.filter((m) => !drop.has(m.id)).map((m) =>
    drop.has(m.replyTo?.id) ? { ...m, replyTo: { id: m.replyTo.id, unavailable: true } } : m
  ));
}

// Добавляет сообщение в самую новую страницу; заменяет временный и уже существующий с тем же id
export function upsertNewest(data, message, replaceIds = []) {
  const drop = new Set([...replaceIds, message.id]);
  if (!data || !data.pages?.length) {
    return { pages: [{ messages: [message], hasMore: false }], pageParams: [undefined] };
  }
  const previous = data.pages.flatMap((page) => page.messages).find((m) => m.id === message.id);
  const merged = mergeMessage(previous, message);
  const cleaned = mapPages(data, (list) => list.filter((m) => !drop.has(m.id)));
  const [newest, ...older] = cleaned.pages;
  const messages = [...newest.messages, merged].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return { ...cleaned, pages: [{ ...newest, messages }, ...older] };
}
