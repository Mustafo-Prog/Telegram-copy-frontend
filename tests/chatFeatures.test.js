import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastSeenDescription } from '../src/utils/lastSeen.js';
import { isReadByPeer, messagePayload } from '../src/utils/messageContent.js';
import { getLastSeen, setPresence, setPresenceMany, resetPresence } from '../src/realtime/presence.js';
import { applyReadReceipt, applyPagedDelete, applyPagedUpdate } from '../src/realtime/events.js';
import { createDemoStore, sendDemoMessage, removeDemoMessages, loadDemoMessages } from '../src/demo/demoStore.js';

test('last seen handles just now, plural minutes and future clock skew', () => {
  const now = new Date(2026, 9, 26, 12, 0);
  assert.equal(lastSeenDescription(new Date(now - 20_000), now).key, 'presence.justNow');
  assert.deepEqual(lastSeenDescription(new Date(now - 5 * 60_000), now), { key: 'presence.minutesAgo', count: 5 });
  assert.equal(lastSeenDescription(new Date(+now + 60_000), now).key, 'presence.justNow');
  assert.equal(lastSeenDescription('invalid', now), null);
  assert.equal(lastSeenDescription(null, now), null);
});

test('last seen uses calendar days for today, yesterday and older dates', () => {
  const now = new Date(2026, 9, 26, 12);
  assert.equal(lastSeenDescription(new Date(2026, 9, 26, 8), now).key, 'presence.today');
  assert.equal(lastSeenDescription(new Date(2026, 9, 25, 8), now).key, 'presence.yesterday');
  assert.equal(lastSeenDescription(new Date(2025, 9, 25, 8), now).key, 'presence.date');
});

test('turning privacy on clears the previously cached last seen timestamp', () => {
  resetPresence();
  setPresence('peer', 'offline', '2026-10-26T10:00:00Z');
  assert.ok(getLastSeen('peer'));
  setPresenceMany({ peer: 'hidden' }, { peer: '2026-10-26T10:00:00Z' });
  assert.equal(getLastSeen('peer'), null);
  setPresence('peer', 'online', '2026-10-26T10:00:00Z');
  assert.equal(getLastSeen('peer'), null);
});

test('sent or pending messages never display a read receipt without a peer acknowledgement', () => {
  assert.equal(isReadByPeer({ id: '003' }, null), false);
  assert.equal(isReadByPeer({ id: '003' }, '002'), false);
  assert.equal(isReadByPeer({ id: '003' }, '003'), true);
  assert.equal(isReadByPeer({ id: '002' }, '003'), true);
  assert.equal(isReadByPeer({ id: '001', pending: true }, '003'), false);
});

test('out of order read events cannot revert already read messages', () => {
  const page = { pages: [{ messages: [{ id: '002' }], peerLastReadMessageId: '003' }], pageParams: [undefined] };
  assert.equal(applyReadReceipt(page, '001').pages[0].peerLastReadMessageId, '003');
  assert.equal(applyReadReceipt(page, '004').pages[0].peerLastReadMessageId, '004');
});

test('deleting a source removes its text from quoted messages in every cached page', () => {
  const data = { pages: [{ messages: [{ id: '2', replyTo: { id: '1', text: 'private source' } }] }, { messages: [{ id: '1' }] }] };
  const updated = applyPagedDelete(data, ['1']);
  assert.deepEqual(updated.pages[0].messages[0].replyTo, { id: '1', unavailable: true });
  assert.equal(updated.pages[1].messages.length, 0);
  assert.equal(data.pages[0].messages[0].replyTo.text, 'private source', 'cache updates are immutable');
});

test('editing a source refreshes visible quotes but never reveals an unavailable quote', () => {
  const data = { pages: [{ messages: [
    { id: '2', replyTo: { id: '1', text: 'old' } },
    { id: '3', replyTo: { id: '1', unavailable: true } },
  ] }] };
  const updated = applyPagedUpdate(data, { id: '1', text: 'new' });
  assert.equal(updated.pages[0].messages[0].replyTo.text, 'new');
  assert.equal(updated.pages[0].messages[1].replyTo.text, undefined);
});

test('text and file payloads retain reply IDs without forcing a multipart content type', () => {
  assert.deepEqual(messagePayload('hi', { replyToId: '1' }), { text: 'hi', replyToId: '1' });
  const file = new File(['hello'], 'notes.txt');
  const payload = messagePayload('', { file, replyToId: '1' });
  assert.equal(payload.get('replyToId'), '1');
  assert.equal(payload.get('attachment').name, 'notes.txt');
});

test('demo replies and attachments stay local and deleted sources become unavailable', () => {
  const store = createDemoStore([{ id: 'a', messages: [] }]);
  const me = { id: 'me', displayName: 'Me' };
  const original = sendDemoMessage(store, 'a', 'source', me);
  const reply = sendDemoMessage(store, 'a', '', me, { replyToId: original.id, file: new File(['test'], 'notes.txt') });
  assert.equal(reply.replyTo.text, 'source');
  assert.equal(reply.attachment.blob.name, 'notes.txt');
  removeDemoMessages(store, 'a', [original.id], me.id);
  const loaded = loadDemoMessages(store, 'a', (message) => message);
  assert.deepEqual(loaded.messages[0].replyTo, { id: original.id, unavailable: true });
});
