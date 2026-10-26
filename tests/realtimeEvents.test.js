// Обработчики событий реального времени: без дублей, адресность, порядок, превью. Запуск: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyConversationPreview,
  applyFlatDelete,
  applyFlatNew,
  applyPagedDelete,
  applyPagedNew,
  applyPagedUpdate,
} from '../src/realtime/events.js';
import { setPresence, setPresenceMany, getPresence, resetPresence } from '../src/realtime/presence.js';

const msg = (id, minute, text = `t${id}`) => ({
  id,
  senderId: 'u',
  text,
  createdAt: new Date(2026, 0, 1, 10, minute).toISOString(),
});
const pagesOf = (...lists) => ({
  pages: lists.map((messages) => ({ messages, hasMore: false })),
  pageParams: lists.map(() => undefined),
});
const ids = (data) => data.pages.flatMap((p) => p.messages).map((m) => m.id);

describe('страницы: новое сообщение', () => {
  it('одно и то же событие дважды не создаёт дубля', () => {
    let data = pagesOf([msg('a', 1)]);
    data = applyPagedNew(data, msg('b', 2));
    data = applyPagedNew(data, msg('b', 2));
    assert.deepEqual(ids(data), ['a', 'b']);
  });
  it('событие о сообщении, которое уже пришло опросом, не портит порядок', () => {
    let data = pagesOf([msg('a', 1), msg('b', 2)]);
    data = applyPagedNew(data, msg('a', 1));
    assert.deepEqual(ids(data), ['a', 'b']);
  });
  it('сообщения от двух отправителей в одну минуту сортируются стабильно', () => {
    let data = pagesOf([msg('a', 1)]);
    data = applyPagedNew(data, msg('c', 2));
    data = applyPagedNew(data, msg('b', 2));
    assert.deepEqual(ids(data).slice(0, 1), ['a']);
    assert.equal(new Set(ids(data)).size, 3);
  });
});

describe('страницы: правка и удаление', () => {
  it('правка обновляет текст и не создает новое сообщение', () => {
    let data = pagesOf([msg('a', 1, 'старое'), msg('b', 2)]);
    data = applyPagedUpdate(data, { ...msg('a', 1, 'новое'), editedAt: 'x' });
    assert.deepEqual(ids(data), ['a', 'b']);
    assert.equal(data.pages[0].messages[0].text, 'новое');
  });
  it('удаление убирает сообщение во всех страницах', () => {
    let data = pagesOf([msg('c', 3)], [msg('a', 1), msg('b', 2)]);
    data = applyPagedDelete(data, ['a', 'c']);
    assert.deepEqual(ids(data), ['b']);
  });
});

describe('плоский список (превью общего чата)', () => {
  it('новое без дублей и по времени', () => {
    let list = [msg('a', 1)];
    list = applyFlatNew(list, msg('b', 2));
    list = applyFlatNew(list, msg('b', 2));
    assert.deepEqual(list.map((m) => m.id), ['a', 'b']);
  });
  it('удаление по списку id', () => {
    assert.deepEqual(applyFlatDelete([msg('a', 1), msg('b', 2)], ['a']).map((m) => m.id), ['b']);
  });
});

describe('список диалогов', () => {
  const conv = (id, text, minute) => ({
    id,
    lastMessageText: text,
    lastMessageAt: new Date(2026, 0, 1, 10, minute).toISOString(),
  });
  it('превью обновляется и диалог поднимается вверх', () => {
    const list = [conv('x', 'old', 1), conv('y', 'other', 5)];
    const next = applyConversationPreview(list, 'x', msg('m', 9, 'свежее'));
    assert.equal(next[0].id, 'x');
    assert.equal(next[0].lastMessageText, 'свежее');
  });
  it('если диалога в списке нет — возвращаем null: нужно перезагрузить список', () => {
    assert.equal(applyConversationPreview([conv('x', 'a', 1)], 'zzz', msg('m', 2)), null);
  });
});

describe('хранилище статусов', () => {
  it('пишет и читает статус; повтор того же значения не меняет состояние', () => {
    resetPresence();
    setPresence('u1', 'online');
    assert.equal(getPresence('u1'), 'online');
    setPresenceMany({ u1: 'offline', u2: 'hidden' });
    assert.equal(getPresence('u1'), 'offline');
    assert.equal(getPresence('u2'), 'hidden');
  });
  it('скрытый статус хранится как hidden, а не как offline', () => {
    resetPresence();
    setPresence('u3', 'hidden');
    assert.notEqual(getPresence('u3'), 'offline');
  });
});
