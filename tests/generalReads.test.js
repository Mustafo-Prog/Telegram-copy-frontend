import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGeneralReadCursors, mergeGeneralReadCursors } from '../src/utils/generalReads.js';
import { applyGeneralReadReceipt, applyPagedNew, applyPagedUpdate } from '../src/realtime/events.js';

const message = (id, senderId, extra = {}) => ({ id, senderId, text: 'hello', createdAt: `2026-10-26T10:00:0${Number(id)}Z`, ...extra });
const page = (messages) => ({ pages: [{ messages, hasMore: false }], pageParams: [undefined] });

test('general receipts exclude the reader’s own, newer and pending messages', () => {
  const original = [message('001', 'alice'), message('002', 'bob'), message('003', 'alice'), message('000', 'alice', { pending: true })];
  const updated = applyGeneralReadCursors(original, [{ userId: 'bob', messageId: '002' }]);
  assert.equal(updated[0].readByOther, true);
  assert.equal(updated[1].readByOther, undefined);
  assert.equal(updated[2].readByOther, undefined);
  assert.equal(updated[3].readByOther, undefined);
  assert.equal(original[0].readByOther, undefined, 'the original query data stays immutable');
});

test('a general read event updates all already loaded pages', () => {
  const data = { pages: [{ messages: [message('003', 'alice')] }, { messages: [message('001', 'alice')] }] };
  const updated = applyGeneralReadReceipt(data, { userId: 'bob', messageId: '003' });
  assert.ok(updated.pages.every((p) => p.messages[0].readByOther));
});

test('the two furthest distinct readers are sufficient to exclude an author correctly', () => {
  let cursors = [];
  for (const receipt of [{ userId: 'carol', messageId: '003' }, { userId: 'bob', messageId: '004' }, { userId: 'alice', messageId: '005' }]) {
    cursors = mergeGeneralReadCursors(cursors, receipt);
  }
  assert.equal(cursors.length, 2);
  const messages = applyGeneralReadCursors([message('005', 'alice'), message('004', 'alice'), message('005', 'bob')], cursors);
  assert.equal(messages[0].readByOther, undefined);
  assert.equal(messages[1].readByOther, true);
  assert.equal(messages[2].readByOther, true);
});

test('repeated or out-of-order receipts never move a reader backwards', () => {
  const cursors = [{ userId: 'bob', messageId: '005' }];
  assert.equal(mergeGeneralReadCursors(cursors, { userId: 'bob', messageId: '001' })[0].messageId, '005');
  assert.equal(mergeGeneralReadCursors(cursors, { userId: 'bob', messageId: '006' })[0].messageId, '006');
  assert.equal(mergeGeneralReadCursors(cursors, cursors[0]).length, 1);
});

test('a receipt arriving while a page is loading is applied after the page arrives', () => {
  assert.equal(applyGeneralReadReceipt(undefined, { userId: 'bob', messageId: '003' }), undefined);
  const cursors = mergeGeneralReadCursors([], { userId: 'bob', messageId: '003' });
  const loaded = applyGeneralReadCursors([message('001', 'alice', { readByOther: false })], cursors);
  assert.equal(loaded[0].readByOther, true);
});

test('late send responses and edits do not undo an acknowledged read receipt', () => {
  const data = page([message('001', 'alice', { readByOther: true })]);
  const stale = message('001', 'alice', { readByOther: false, text: 'edited' });
  for (const update of [applyPagedNew, applyPagedUpdate]) {
    const result = update(data, stale).pages[0].messages;
    assert.equal(result.length, 1);
    assert.equal(result[0].readByOther, true);
    assert.equal(result[0].text, 'edited');
  }
});
