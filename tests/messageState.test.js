// Тесты чистой логики сообщений: выделение, пакеты, страницы. Запуск: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BULK_LIMIT,
  canDeleteMessage,
  canEditMessage,
  chunk,
  flattenPages,
  removeMessages,
  toggleSelection,
  upsertNewest,
} from '../src/utils/messageState.js';

const msg = (id, minute, extra = {}) => ({
  id,
  senderId: 'me',
  text: `t${id}`,
  createdAt: new Date(2026, 0, 1, 10, minute).toISOString(),
  ...extra,
});

describe('выделение', () => {
  it('выбирает несколько сообщений одновременно', () => {
    let s = new Set();
    for (const id of ['a', 'b', 'c', 'd', 'e']) s = toggleSelection(s, id);
    assert.deepEqual([...s], ['a', 'b', 'c', 'd', 'e']);
  });
  it('повторный выбор отменяет только это сообщение', () => {
    let s = new Set(['1', '2', '3']);
    s = toggleSelection(s, '2');
    assert.deepEqual([...s].sort(), ['1', '3']);
  });
  it('не мутирует исходный Set (важно для React)', () => {
    const before = new Set(['1']);
    const after = toggleSelection(before, '2');
    assert.deepEqual([...before], ['1']);
    assert.deepEqual([...after].sort(), ['1', '2']);
  });
  it('нельзя выделить одно сообщение дважды', () => {
    let s = new Set();
    s = toggleSelection(s, 'x');
    s = toggleSelection(s, 'x');
    assert.equal(s.size, 0);
  });
});

describe('пакеты', () => {
  it('лимит сервера — 100', () => assert.equal(BULK_LIMIT, 100));
  it('250 id делятся на 100, 100, 50', () => {
    const ids = Array.from({ length: 250 }, (_, i) => String(i));
    assert.deepEqual(chunk(ids).map((p) => p.length), [100, 100, 50]);
  });
  it('100 id — один пакет, ничего не теряется', () => {
    const ids = Array.from({ length: 100 }, (_, i) => String(i));
    const parts = chunk(ids);
    assert.equal(parts.length, 1);
    assert.deepEqual(parts[0], ids);
  });
  it('пустой список — без пакетов', () => assert.deepEqual(chunk([]), []));
});

describe('права на экране', () => {
  it('в общем чате чужое удалять нельзя, даже в оптимистичном списке', () => {
    assert.equal(canDeleteMessage({ senderId: 'other' }, { isDirect: false, userId: 'me' }), false);
    assert.equal(canDeleteMessage({ senderId: 'me' }, { isDirect: false, userId: 'me' }), true);
  });
  it('в личном чате удалять можно любое видимое', () => {
    assert.equal(canDeleteMessage({ senderId: 'other' }, { isDirect: true, userId: 'me' }), true);
  });
  it('временные сообщения нельзя ни удалять, ни редактировать', () => {
    assert.equal(canDeleteMessage({ senderId: 'me', pending: true }, { isDirect: true, userId: 'me' }), false);
    assert.equal(canEditMessage({ senderId: 'me', pending: true }, 'me'), false);
  });
  it('редактировать — только свои', () => {
    assert.equal(canEditMessage({ senderId: 'other' }, 'me'), false);
    assert.equal(canEditMessage({ senderId: 'me' }, 'me'), true);
  });
});

describe('страницы и порядок', () => {
  // pages[0] — самая новая; pages[1] — старее
  const newest = { messages: [msg('c', 3), msg('d', 4)], hasMore: true };
  const older = { messages: [msg('a', 1), msg('b', 2)], hasMore: false };

  it('склеивает страницы по возрастанию времени', () => {
    assert.deepEqual(flattenPages([newest, older]).map((m) => m.id), ['a', 'b', 'c', 'd']);
  });
  it('дубликаты между страницами убираются', () => {
    const overlap = { messages: [msg('b', 2), msg('c', 3)], hasMore: false };
    assert.deepEqual(flattenPages([newest, overlap]).map((m) => m.id), ['b', 'c', 'd']);
  });
  it('пустые данные дают пустой список', () => {
    assert.deepEqual(flattenPages(undefined), []);
    assert.deepEqual(flattenPages([]), []);
  });
  it('удаление убирает сообщение из любой страницы', () => {
    const data = { pages: [newest, older], pageParams: [undefined, 'x'] };
    const next = removeMessages(data, ['a', 'd']);
    assert.deepEqual(flattenPages(next.pages).map((m) => m.id), ['b', 'c']);
  });
  it('новое сообщение попадает в конец и заменяет временное без дублей', () => {
    const data = { pages: [newest, older], pageParams: [undefined, 'x'] };
    const sent = msg('z', 5);
    const withTemp = upsertNewest(data, { ...msg('tmp', 5), pending: true });
    const done = upsertNewest(withTemp, sent, ['tmp']);
    const ids = flattenPages(done.pages).map((m) => m.id);
    assert.deepEqual(ids, ['a', 'b', 'c', 'd', 'z']);
    assert.equal(new Set(ids).size, ids.length);
  });
  it('повторный приход того же сообщения не создаёт дубль', () => {
    const data = { pages: [newest, older], pageParams: [undefined, 'x'] };
    const once = upsertNewest(data, msg('c', 3));
    assert.equal(flattenPages(once.pages).filter((m) => m.id === 'c').length, 1);
  });
  it('если данных ещё нет, сообщение создаёт первую страницу', () => {
    const data = upsertNewest(undefined, msg('first', 1));
    assert.deepEqual(flattenPages(data.pages).map((m) => m.id), ['first']);
  });
});
