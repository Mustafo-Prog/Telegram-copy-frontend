import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyConversationPreview, applyConversationRead } from '../src/realtime/events.js';
import { messagePayload } from '../src/utils/messageContent.js';
import * as savedLocales from '../src/i18n/locales/saved.js';

const stamp = (minute) => `2026-10-27T10:${String(minute).padStart(2, '0')}:00.000Z`;
const chat = (overrides = {}) => ({ id: 'chat', lastMessageId: '001', lastMessageAt: stamp(1), lastMessageText: 'First', unreadCount: 2, ...overrides });
const message = (overrides = {}) => ({ id: '002', senderId: 'peer', text: 'New', createdAt: stamp(2), ...overrides });

describe('instant conversation cache updates', () => {
  it('socket and HTTP duplicates increment unread only once without changing pins', () => {
    const list = [chat({ id: 'pinned', pinnedAt: stamp(0) }), chat()];
    const once = applyConversationPreview(list, 'chat', message(), 'me');
    const twice = applyConversationPreview(once, 'chat', message(), 'me');
    assert.equal(twice, once);
    assert.equal(twice[0].id, 'pinned');
    assert.equal(twice[1].unreadCount, 3);
    assert.equal(list[1].unreadCount, 2);
  });

  it('keeps more recent previews when an old event arrives late', () => {
    const list = [chat({ lastMessageId: '003', lastMessageAt: stamp(3) })];
    assert.equal(applyConversationPreview(list, 'chat', message(), 'me'), list);
    assert.equal(applyConversationPreview(list, 'chat', message({ id: '002', createdAt: stamp(3) }), 'me'), list);
  });

  it('updates voice preview metadata without counting own or saved messages as unread', () => {
    const voice = message({ senderId: 'me', text: '', attachment: { name: 'voice.webm', kind: 'voice' } });
    const next = applyConversationPreview([chat()], 'chat', voice, 'me')[0];
    assert.equal(next.lastMessageId, voice.id);
    assert.equal(next.lastMessageType, 'voice');
    assert.equal(next.lastMessageText, 'voice.webm');
    assert.equal(next.unreadCount, 2);
    assert.equal(applyConversationPreview([chat({ kind: 'saved', unreadCount: 0 })], 'chat', message(), 'me')[0].unreadCount, 0);
  });

  it('preserves unread for legacy callers and reports uncached conversations', () => {
    assert.equal(applyConversationPreview([chat()], 'chat', message())[0].unreadCount, 2);
    assert.equal(applyConversationPreview([chat()], 'other', message(), 'me'), null);
    assert.equal(applyConversationPreview(undefined, 'chat', message(), 'me'), undefined);
  });

  it('clears own unread only when the read cursor covers the latest message', () => {
    const list = [chat({ lastMessageId: '003' })];
    const oldReceipt = applyConversationRead(list, 'chat', { userId: 'me', currentUserId: 'me', messageId: '002' });
    assert.equal(oldReceipt[0], list[0]);
    assert.equal(applyConversationRead(list, 'chat', { userId: 'me', currentUserId: 'me', messageId: '003' })[0].unreadCount, 0);
    assert.equal(list[0].unreadCount, 2);
  });

  it('advances peer receipts monotonically without clearing own unread', () => {
    const list = [chat({ peerLastReadMessageId: '003' }), chat({ id: 'other' })];
    const old = applyConversationRead(list, 'chat', { userId: 'peer', currentUserId: 'me', messageId: '002' });
    assert.equal(old[0], list[0]);
    const latest = applyConversationRead(list, 'chat', { userId: 'peer', currentUserId: 'me', messageId: '004' });
    assert.equal(latest[0].peerLastReadMessageId, '004');
    assert.equal(latest[0].unreadCount, 2);
    assert.equal(latest[1], list[1]);
  });
});

it('send correlation IDs survive text and file payloads for immediate socket acknowledgement', () => {
  assert.equal(messagePayload('note', { clientMessageId: 'local-1' }).clientMessageId, 'local-1');
  const payload = messagePayload('', { file: new File(['a'], 'note.txt'), clientMessageId: 'local-2' });
  assert.equal(payload.get('clientMessageId'), 'local-2');
  assert.equal(messagePayload('note').clientMessageId, undefined);
});

it('Saved Messages labels have matching translations in all supported languages', () => {
  const keys = Object.keys(savedLocales.ru).sort();
  assert.deepEqual(Object.keys(savedLocales.en).sort(), keys);
  assert.deepEqual(Object.keys(savedLocales.uz).sort(), keys);
});
