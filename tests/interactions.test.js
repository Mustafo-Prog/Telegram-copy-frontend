import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipboardImage } from '../src/utils/clipboardImage.js';
import { messagePayload, MAX_ATTACHMENT_BYTES } from '../src/utils/messageContent.js';
import { applyReactionEvent, applyPagedUpdate } from '../src/realtime/events.js';
import { hasReaction } from '../src/utils/reactions.js';
import { mergeMessage } from '../src/utils/messageState.js';
import { reactDemoMessage, createDemoStore, loadDemoMessages } from '../src/demo/demoStore.js';
import * as locales from '../src/i18n/locales/interactions.js';

test('pasting a screenshot produces an image-only multipart message, without intercepting ordinary text', () => {
  const image = new File([new Uint8Array([137, 80, 78, 71])], 'clipboard', { type: 'image/png' });
  const { file } = clipboardImage({ items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }] });
  assert.equal(file.type, 'image/png'); assert.match(file.name, /\.png$/);
  const payload = messagePayload('', { file, replyToId: 'original' });
  assert.equal(payload.get('text'), ''); assert.equal(payload.get('attachment').type, 'image/png');
  assert.equal(payload.get('replyToId'), 'original');
  assert.equal(clipboardImage({ items: [{ kind: 'string', type: 'text/plain' }] }), null);
});

test('clipboard fallback supports JPEG/WebP files and rejects oversized, empty and unsupported images', () => {
  for (const type of ['image/jpeg', 'image/webp']) {
    assert.equal(clipboardImage({ files: [new File(['x'], 'image', { type })] }).file.type, type);
  }
  for (const file of [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }), new File([], 'x.png', { type: 'image/png' })]) {
    assert.equal(clipboardImage({ files: [file] }).error, 'attachment_invalid');
  }
  assert.equal(clipboardImage({ files: [new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'x.png', { type: 'image/png' })] }).error, 'attachment_too_large');
  assert.equal(clipboardImage(null), null);
});

test('out-of-order socket events, duplicate responses and stale edits cannot roll back reactions or change message text', () => {
  const message = { id: 'm', senderId: 'a', text: 'original', reactionsVersion: 0, reactions: [] };
  const data = { pages: [{ messages: [message], hasMore: false }], pageParams: [undefined] };
  const latest = { messageId: 'm', reactions: [{ emoji: '❤️', count: 1, userIds: ['b'] }], reactionsVersion: 3 };
  const updated = applyReactionEvent(data, latest);
  const older = applyReactionEvent(updated, { ...latest, reactions: [], reactionsVersion: 2 });
  assert.equal(older.pages[0].messages[0].text, 'original');
  assert.equal(hasReaction(older.pages[0].messages[0], '❤️', 'b'), true);
  const edited = applyPagedUpdate(older, { ...message, text: 'edited' }).pages[0].messages[0];
  assert.equal(edited.text, 'edited'); assert.deepEqual(edited.reactions, latest.reactions);
  assert.deepEqual(data.pages[0].messages[0].reactions, []);
  assert.deepEqual(mergeMessage(undefined, message), message);
});

test('demo reactions stay in the local store, persist through reloads of history and support removal', () => {
  const store = createDemoStore([{ id: 'demo', messages: [{ id: 'm', senderId: 'other', text: 'hello' }] }]);
  reactDemoMessage(store, 'demo', 'm', 'me', '👍', true);
  reactDemoMessage(store, 'demo', 'm', 'me', '👍', true);
  let message = loadDemoMessages(store, 'demo', (entry) => entry).messages[0];
  assert.equal(message.reactions[0].count, 1); assert.equal(hasReaction(message, '👍', 'me'), true);
  reactDemoMessage(store, 'demo', 'm', 'me', '👍', false);
  message = loadDemoMessages(store, 'demo', (entry) => entry).messages[0];
  assert.deepEqual(message.reactions, []);
});

test('new controls and errors have matching translations in all three languages', () => {
  assert.deepEqual(Object.keys(locales.ru).sort(), Object.keys(locales.en).sort());
  assert.deepEqual(Object.keys(locales.ru).sort(), Object.keys(locales.uz).sort());
});
