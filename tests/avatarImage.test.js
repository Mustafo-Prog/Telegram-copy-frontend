import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resizeAvatar, MAX_AVATAR_BYTES } from '../src/utils/avatarImage.js';

function imageFixture(t, { width = 1600, height = 1200, encode } = {}) {
  const previousBitmap = globalThis.createImageBitmap;
  const previousDocument = globalThis.document;
  const calls = []; let closed = 0;
  const bitmap = { width, height, close: () => { closed++; } };
  globalThis.createImageBitmap = async () => bitmap;
  globalThis.document = { createElement: () => {
    const canvas = { width: 0, height: 0,
      getContext: () => ({ drawImage: (...args) => calls.push({ width: canvas.width, height: canvas.height, args }) }),
      toBlob: (callback, type, quality) => callback(encode ? encode(canvas.width, quality) : new Blob(['image'], { type })),
    };
    return canvas;
  } };
  t.after(() => {
    if (previousBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = previousBitmap;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  });
  return { bitmap, calls, closed: () => closed };
}

test('profile photos preserve a centered high-resolution crop within the existing upload limit', async (t) => {
  const fixture = imageFixture(t);
  const blob = await resizeAvatar(new File(['photo'], 'profile.jpg', { type: 'image/jpeg' }));
  assert.equal(fixture.calls[0].width, 1024);
  assert.deepEqual(fixture.calls[0].args.slice(1), [200, 0, 1200, 1200, 0, 0, 1024, 1024]);
  assert.ok(blob.size <= MAX_AVATAR_BYTES);
  assert.equal(fixture.closed(), 1);
});

test('detailed photos are compressed or resized so the backend never receives an oversized avatar', async (t) => {
  const fixture = imageFixture(t, { encode: (width, quality) => new Blob([new Uint8Array(width >= 1024 || quality > 0.72 ? MAX_AVATAR_BYTES + 1 : 120_000)]) });
  const blob = await resizeAvatar(new File(['photo'], 'profile.png', { type: 'image/png' }));
  assert.equal(blob.size, 120_000);
  assert.equal(fixture.calls.at(-1).width, 768);
  assert.equal(fixture.closed(), 1);
});

test('small existing photos are not enlarged', async (t) => {
  const fixture = imageFixture(t, { width: 64, height: 100 });
  await resizeAvatar(new File(['photo'], 'profile.png', { type: 'image/png' }));
  assert.equal(fixture.calls[0].width, 64);
  assert.equal(fixture.closed(), 1);
});

test('invalid or oversized decoded images release bitmap memory', async (t) => {
  const fixture = imageFixture(t, { width: 10000, height: 10000 });
  await assert.rejects(resizeAvatar(new File(['photo'], 'profile.jpg')), { code: 'avatar_invalid' });
  assert.equal(fixture.closed(), 1);
  assert.equal(fixture.calls.length, 0);
});
