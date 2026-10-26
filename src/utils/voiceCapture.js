import { MAX_ATTACHMENT_BYTES } from './messageContent.js';
export const MAX_VOICE_DURATION_MS = 180000;
const FORMATS = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];

export function voiceFilename(type, timestamp = Date.now()) {
  return `voice-${timestamp}.${type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm'}`;
}

// Dependencies are injectable so recording, cancellation and track cleanup can be tested without a microphone.
export function createVoiceCapture({ getUserMedia, Recorder, now = () => performance.now(), onStarted, onTick, onFinished, onError }) {
  let stream; let recorder; let timer; let startedAt;
  let discarded = false; let disposed = false; let chunks = []; let size = 0;
  const clearTimer = () => { clearInterval(timer); timer = null; };
  const release = () => { stream?.getTracks().forEach((track) => track.stop()); stream = null; };
  const stop = () => { clearTimer(); if (recorder && recorder.state !== 'inactive') recorder.stop(); };
  const cancel = () => { discarded = true; stop(); release(); };

  return {
    async start() {
      if (!getUserMedia || !Recorder) throw Object.assign(new Error('Recording unsupported'), { code: 'voice_unsupported' });
      try {
        stream = await getUserMedia({ audio: true });
        if (discarded || disposed) { release(); return false; }
        const mimeType = FORMATS.find((type) => Recorder.isTypeSupported?.(type));
        recorder = new Recorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
        recorder.ondataavailable = (event) => {
          if (!event.data?.size || discarded) return;
          chunks.push(event.data); size += event.data.size;
          if (size > MAX_ATTACHMENT_BYTES) {
            cancel(); if (!disposed) onError?.(Object.assign(new Error('File too large'), { code: 'attachment_too_large' }));
          }
        };
        recorder.onerror = (event) => { cancel(); if (!disposed) onError?.(event.error ?? new Error('Recording failed')); };
        recorder.onstop = () => {
          clearTimer(); release();
          if (discarded || disposed) { chunks = []; return; }
          const type = recorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type }); chunks = [];
          if (!blob.size) { onError?.(Object.assign(new Error('Empty recording'), { code: 'voice_empty' })); return; }
          const duration = Math.max(1, Math.min(MAX_VOICE_DURATION_MS, Math.round(now() - startedAt)));
          onFinished?.(new File([blob], voiceFilename(type), { type }), duration);
        };
        startedAt = now(); recorder.start(250); onStarted?.();
        timer = setInterval(() => {
          const elapsed = Math.max(0, now() - startedAt); onTick?.(Math.min(elapsed, MAX_VOICE_DURATION_MS));
          if (elapsed >= MAX_VOICE_DURATION_MS) stop();
        }, 200);
        return true;
      } catch (error) { clearTimer(); release(); throw error; }
    },
    stop,
    cancel,
    dispose() { disposed = true; cancel(); },
  };
}

export function voiceTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
