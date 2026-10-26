import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceCapture, MAX_VOICE_DURATION_MS, voiceFilename, voiceTime } from '../src/utils/voiceCapture.js';
import { shouldNotifyIncoming, notificationBody, validChatId } from '../src/utils/notifications.js';
import { sortChats } from '../src/utils/chatList.js';
import { setTypingEvent, getTyping, resetTyping } from '../src/realtime/typing.js';
import { messagePayload } from '../src/utils/messageContent.js';
import * as locales from '../src/i18n/locales/roadmap.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function recorderFixture({ empty = false } = {}) {
  let stops = 0;
  const stream = { getTracks: () => [{ stop() { stops++; } }] };
  class Recorder {
    static isTypeSupported(type) { return type.startsWith('audio/ogg'); }
    constructor(media, options) { this.stream = media; this.mimeType = options?.mimeType; this.state = 'inactive'; Recorder.latest = this; }
    start() { this.state = 'recording'; }
    stop() {
      if (this.state === 'inactive') throw new Error('Already stopped');
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(empty ? [] : ['recorded data'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  return { stream, Recorder, stopCount: () => stops };
}

test('voice capture chooses a supported format, creates a recording and always releases microphone tracks', async () => {
  const fixture = recorderFixture(); let now = 100; let result;
  const capture = createVoiceCapture({ getUserMedia: async () => fixture.stream, Recorder: fixture.Recorder, now: () => now, onFinished: (file, duration) => { result = { file, duration }; } });
  await capture.start(); now = 1700; capture.stop(); capture.dispose();
  assert.equal(result.file.type, 'audio/ogg;codecs=opus'); assert.ok(result.file.name.endsWith('.ogg'));
  assert.equal(result.duration, 1600); assert.ok(result.file.size > 0); assert.equal(fixture.stopCount(), 1);
});

test('cancelling a recording releases the microphone without producing a message', async () => {
  const fixture = recorderFixture(); let sent = false;
  const capture = createVoiceCapture({ getUserMedia: async () => fixture.stream, Recorder: fixture.Recorder, onFinished: () => { sent = true; } });
  await capture.start(); capture.cancel(); capture.dispose();
  assert.equal(sent, false); assert.equal(fixture.stopCount(), 1);
});

test('cancelling while microphone permission is pending still stops a late arriving stream', async () => {
  const fixture = recorderFixture(); let resolve; let sent = false;
  const capture = createVoiceCapture({ getUserMedia: () => new Promise((done) => { resolve = done; }), Recorder: fixture.Recorder, onFinished: () => { sent = true; } });
  const opening = capture.start(); capture.cancel(); resolve(fixture.stream);
  assert.equal(await opening, false); assert.equal(fixture.stopCount(), 1); assert.equal(sent, false);
});

test('recording errors and empty recordings do not produce an attachment', async () => {
  const fixture = recorderFixture({ empty: true }); let error; let sent = false;
  const capture = createVoiceCapture({ getUserMedia: async () => fixture.stream, Recorder: fixture.Recorder, onError: (value) => { error = value; }, onFinished: () => { sent = true; } });
  await capture.start(); capture.stop();
  assert.equal(error.code, 'voice_empty'); assert.equal(sent, false); assert.equal(fixture.stopCount(), 1);
  const other = recorderFixture(); let errors = 0;
  const failed = createVoiceCapture({ getUserMedia: async () => other.stream, Recorder: other.Recorder, onError: () => { errors++; }, onFinished: () => { sent = true; } });
  await failed.start(); other.Recorder.latest.onerror({ error: new Error('device disconnected') });
  assert.equal(errors, 1); assert.equal(sent, false); assert.equal(other.stopCount(), 1);
});

test('the recording limit automatically stops capture at three minutes', async () => {
  const fixture = recorderFixture(); let now = 0; let duration;
  const capture = createVoiceCapture({ getUserMedia: async () => fixture.stream, Recorder: fixture.Recorder, now: () => now, onFinished: (_, value) => { duration = value; } });
  await capture.start(); now = MAX_VOICE_DURATION_MS + 500;
  await pause(260); capture.dispose();
  assert.equal(duration, MAX_VOICE_DURATION_MS); assert.equal(fixture.stopCount(), 1);
});

test('unsupported recording is reported before requesting a microphone', async () => {
  const capture = createVoiceCapture({ getUserMedia: null, Recorder: null });
  await assert.rejects(capture.start(), { code: 'voice_unsupported' });
  assert.equal(voiceTime(61000), '1:01'); assert.ok(voiceFilename('audio/mp4', 1).endsWith('.m4a'));
});

test('voice payload includes validated duration without changing ordinary file payloads', () => {
  const file = new File(['voice'], 'voice.ogg', { type: 'audio/ogg' });
  const voice = messagePayload('', { file, voiceDurationMs: 1000, replyToId: 'reply' });
  assert.equal(voice.get('voiceDurationMs'), '1000'); assert.equal(voice.get('replyToId'), 'reply');
  assert.equal(messagePayload('', { file }).get('voiceDurationMs'), null);
});

test('notifications stay silent for own messages and the currently visible chat, but work for other or background chats', () => {
  const input = { message: { id: 'msg', senderId: 'other' }, userId: 'me', enabled: true, chatId: 'one', activeChatId: 'one', chatVisible: true, focused: true, visible: true };
  assert.equal(shouldNotifyIncoming(input), false);
  assert.equal(shouldNotifyIncoming({ ...input, activeChatId: 'two' }), true);
  assert.equal(shouldNotifyIncoming({ ...input, focused: false }), true);
  assert.equal(shouldNotifyIncoming({ ...input, visible: false }), true);
  assert.equal(shouldNotifyIncoming({ ...input, chatVisible: false }), true);
  assert.equal(shouldNotifyIncoming({ ...input, focused: false, message: { id: 'msg', senderId: 'me' } }), false);
  assert.equal(shouldNotifyIncoming({ ...input, focused: false, enabled: false }), false);
});

test('notification previews are opt-in, bounded and understand voice messages', () => {
  const labels = { newMessage: 'New message', voice: 'Voice message' };
  assert.equal(notificationBody({ text: 'private text' }, false, labels), 'New message');
  assert.equal(notificationBody({ text: 'x'.repeat(500) }, true, labels).length, 180);
  assert.equal(notificationBody({ attachment: { kind: 'voice' } }, true, labels), 'Voice message');
  assert.equal(validChatId('general'), true); assert.equal(validChatId('a'.repeat(24)), true);
  assert.equal(validChatId('https://attacker.example'), false); assert.equal(validChatId('../outside'), false);
});

test('pins sort before recent chats without mutating the original list', () => {
  const original = [
    { id: 'recent', lastMessageAt: '2026-10-26T12:00:00Z' },
    { id: 'pin1', pinnedAt: '2026-10-20T12:00:00Z', lastMessageAt: '2025-01-01T12:00:00Z' },
    { id: 'pin2', pinnedAt: '2026-10-21T12:00:00Z' },
  ];
  assert.deepEqual(sortChats(original).map((chat) => chat.id), ['pin2', 'pin1', 'recent']);
  assert.equal(original[0].id, 'recent');
});

test('typing is isolated per chat and expires even if the stop event was lost', async () => {
  resetTyping();
  setTypingEvent({ scope: 'general', userId: 'a', displayName: 'Alice', active: true, ttl: 15 });
  setTypingEvent({ scope: 'conversation', conversationId: 'private', userId: 'b', displayName: 'Bob', active: true, ttl: 1000 });
  assert.equal(getTyping('general')[0].displayName, 'Alice'); assert.equal(getTyping('private')[0].displayName, 'Bob');
  await pause(35); assert.equal(getTyping('general').length, 0); assert.equal(getTyping('private').length, 1);
  resetTyping(); assert.equal(getTyping('private').length, 0);
});

test('all new interface labels are translated in Russian, English and Uzbek', () => {
  const keys = Object.keys(locales.ru).sort();
  assert.deepEqual(Object.keys(locales.en).sort(), keys); assert.deepEqual(Object.keys(locales.uz).sort(), keys);
  for (const locale of Object.values(locales)) for (const value of Object.values(locale)) assert.ok(typeof value === 'string' ? value.length : value.other);
});
