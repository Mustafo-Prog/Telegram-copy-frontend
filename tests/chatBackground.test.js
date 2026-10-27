import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useChatBackground from '../src/theme/useChatBackground.js';
import {
  DEFAULT_BACKGROUND, PRESETS, MAX_BACKGROUND_BYTES,
  normalizeBackground, backgroundStyle, backgroundStorageKey,
  loadBackground, saveBackground, validateBackgroundFile, backgroundImageSize,
} from '../src/utils/chatBackground.js';

test('wallpaper settings reject arbitrary CSS and unknown presets, and bound dimming', () => {
  assert.deepEqual(normalizeBackground(null), DEFAULT_BACKGROUND);
  assert.deepEqual(normalizeBackground({ type: 'preset', preset: 'unknown' }), DEFAULT_BACKGROUND);
  assert.deepEqual(normalizeBackground({ type: 'color', color: 'red; background:url(https://example.test)' }), DEFAULT_BACKGROUND);
  assert.deepEqual(normalizeBackground({ type: 'color', color: '#AABBCC', dim: 150 }), { type: 'color', color: '#aabbcc', dim: 70 });
  assert.equal(normalizeBackground({ type: 'preset', preset: 'mint', dim: -20 }).dim, 0);
});

test('wallpapers render preset, color and local photo layers without accepting remote image URLs', () => {
  assert.deepEqual(backgroundStyle(DEFAULT_BACKGROUND), {});
  for (const preset of PRESETS) assert.equal(backgroundStyle({ type: 'preset', preset: preset.id }).backgroundImage, preset.backgroundImage);
  assert.equal(backgroundStyle({ type: 'color', color: '#112233' }).backgroundColor, '#112233');
  assert.match(backgroundStyle({ type: 'color', color: '#112233', dim: 30 }).backgroundImage, /0\.3/);
  assert.match(backgroundStyle({ type: 'image', dim: 10 }, 'blob:https://example.test/uuid').backgroundImage, /url\("blob:/);
  assert.deepEqual(backgroundStyle({ type: 'image' }, 'https://example.test/tracker.jpg'), {});
  assert.deepEqual(backgroundStyle({ type: 'image' }, 'blob:invalid")'), {});
});

test('background keys isolate accounts and chats even when names contain separators', () => {
  const keys = [['a:b', 'c'], ['a', 'b:c'], ['other', 'c'], ['a:b', 'different']].map(([user, chat]) => backgroundStorageKey(user, chat));
  assert.equal(new Set(keys).size, keys.length);
});

test('uploaded wallpaper blobs are retained only for valid image settings', () => {
  const imageBlob = new Blob(['image'], { type: 'image/jpeg' });
  assert.equal(normalizeBackground({ type: 'image', imageBlob }).imageBlob, imageBlob);
  assert.equal(normalizeBackground({ type: 'color', color: '#112233', imageBlob }).imageBlob, undefined);
  assert.equal(normalizeBackground({ type: 'image', imageBlob: new Blob(['svg'], { type: 'image/svg+xml' }) }).imageBlob, undefined);
});

test('unsupported, oversized and empty wallpaper files fail before decoding', () => {
  assert.throws(() => validateBackgroundFile({ type: 'image/svg+xml', size: 100 }), { code: 'background_image_type' });
  assert.throws(() => validateBackgroundFile({ type: 'image/jpeg', size: MAX_BACKGROUND_BYTES + 1 }), { code: 'background_image_size' });
  assert.throws(() => validateBackgroundFile({ type: 'image/png', size: 0 }), { code: 'background_image_invalid' });
  assert.doesNotThrow(() => validateBackgroundFile({ type: 'image/webp', size: MAX_BACKGROUND_BYTES }));
});

test('wallpaper resizing preserves proportions, avoids upscaling, and rejects excessive pixel counts', () => {
  assert.deepEqual(backgroundImageSize(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(backgroundImageSize(1000, 2000), { width: 800, height: 1600 });
  assert.deepEqual(backgroundImageSize(320, 200), { width: 320, height: 200 });
  assert.throws(() => backgroundImageSize(10000, 10000), { code: 'background_image_dimensions' });
  assert.throws(() => backgroundImageSize(0, 100), { code: 'background_image_dimensions' });
});

test('unavailable storage and missing photo data are reported instead of claiming persistence', async () => {
  await assert.rejects(loadBackground('me', 'general', null), { code: 'background_storage' });
  await assert.rejects(saveBackground('me', 'general', { type: 'color', color: '#123456' }, null), { code: 'background_storage' });
  await assert.rejects(saveBackground('me', 'general', { type: 'image' }, null), { code: 'background_image_invalid' });
});
test('a chat renders with the default wallpaper before local image storage has loaded', () => {
  function Preview() {
    const background = useChatBackground('first-user', 'general');
    return React.createElement('div', null, `${background.config.type}:${background.imageUrl}`);
  }
  assert.equal(renderToStaticMarkup(React.createElement(Preview)), '<div>default:null</div>');
});
