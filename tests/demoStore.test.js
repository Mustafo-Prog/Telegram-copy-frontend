// Тесты демо-данных: права, очистка, удаление чата. Запуск: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_ME_ID,
  clearDemoChat,
  createDemoStore,
  deleteDemoChat,
  editDemoMessage,
  loadDemoMessages,
  removeDemoMessages,
  sendDemoMessage,
} from '../src/demo/demoStore.js';

const ME = { id: DEMO_ME_ID, displayName: 'You' };
const seed = () =>
  createDemoStore([
    {
      id: 'alex',
      titleKey: 'x',
      subtitleKey: 'y',
      messages: [
        { id: 'a1', senderId: 'demo-alex', senderName: 'Alex', text: 'hi', createdAt: '2026-01-01T10:00:00Z' },
        { id: 'a2', senderId: DEMO_ME_ID, senderName: 'You', text: 'mine', createdAt: '2026-01-01T10:01:00Z' },
      ],
    },
  ]);
const plain = (m) => m;

describe('демо: только локальные данные', () => {
  it('отправка добавляет сообщение от демо-пользователя', () => {
    const store = seed();
    const m = sendDemoMessage(store, 'alex', '  привет  ', ME);
    assert.equal(m.text, 'привет');
    assert.equal(m.senderId, DEMO_ME_ID);
    assert.equal(loadDemoMessages(store, 'alex', plain).messages.length, 3);
  });
  it('неизвестный диалог — ошибка с кодом, а не сетевой запрос', () => {
    assert.throws(() => loadDemoMessages(seed(), 'nope', plain), (e) => e.code === 'conversation_not_found');
  });
});

describe('демо: права', () => {
  it('редактировать можно только свое', () => {
    const store = seed();
    const edited = editDemoMessage(store, 'alex', 'a2', 'новое', DEMO_ME_ID);
    assert.equal(edited.text, 'новое');
    assert.ok(edited.editedAt);
    assert.throws(() => editDemoMessage(store, 'alex', 'a1', 'взлом', DEMO_ME_ID), (e) => e.code === 'forbidden');
    assert.equal(loadDemoMessages(store, 'alex', plain).messages.find((m) => m.id === 'a1').text, 'hi');
  });
  it('удалять чужие нельзя: они пропускаются со счетчиком', () => {
    const store = seed();
    const result = removeDemoMessages(store, 'alex', ['a1', 'a2'], DEMO_ME_ID);
    assert.deepEqual(result, { deleted: 1, skipped: 1 });
    const left = loadDemoMessages(store, 'alex', plain).messages.map((m) => m.id);
    assert.deepEqual(left, ['a1']);
  });
  it('удаление несуществующего id не ломает остальные', () => {
    const store = seed();
    assert.deepEqual(removeDemoMessages(store, 'alex', ['zzz'], DEMO_ME_ID), { deleted: 0, skipped: 0 });
    assert.equal(loadDemoMessages(store, 'alex', plain).messages.length, 2);
  });
});

describe('демо: очистка и удаление чата', () => {
  it('очистка убирает все сообщения только в демо', () => {
    const store = seed();
    clearDemoChat(store, 'alex');
    assert.equal(loadDemoMessages(store, 'alex', plain).messages.length, 0);
  });
  it('удаление чата убирает его из списка', () => {
    const store = seed();
    deleteDemoChat(store, 'alex');
    assert.equal(store.chats.length, 0);
    assert.throws(() => loadDemoMessages(store, 'alex', plain));
  });
  it('каждое создание хранилища — свежие данные (демо не сохраняется между визитами)', () => {
    const first = seed();
    sendDemoMessage(first, 'alex', 'temp', ME);
    const second = seed();
    assert.equal(loadDemoMessages(second, 'alex', plain).messages.length, 2);
  });
  it('в загрузке нет вызовов сети (проверка через подмену fetch)', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = () => { calls += 1; return Promise.reject(new Error('network')); };
    try {
      const store = seed();
      loadDemoMessages(store, 'alex', plain);
      sendDemoMessage(store, 'alex', 'x', ME);
      removeDemoMessages(store, 'alex', ['a2'], DEMO_ME_ID);
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = original;
    }
  });
});
