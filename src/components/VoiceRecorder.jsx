import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { createVoiceCapture, voiceTime } from '../utils/voiceCapture.js';
import { MicIcon } from './icons.jsx';

export default function VoiceRecorder({ onReady, disabled, onRecordingChange }) {
  const { t, tError } = useI18n();
  const [state, setState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const capture = useRef(null);
  const callbacks = useRef({ onReady, onRecordingChange });
  callbacks.current = { onReady, onRecordingChange };
  useEffect(() => () => { capture.current?.dispose(); callbacks.current.onRecordingChange?.(false); }, []);

  const failed = (err) => {
    setState('idle'); callbacks.current.onRecordingChange?.(false);
    setError(err.name === 'NotAllowedError' ? t('voice.denied') : err.name === 'NotFoundError' ? t('voice.noMicrophone') : err.code ? tError(err) : t('voice.failed'));
  };
  const start = async () => {
    setError(null); setElapsed(0); setState('requesting'); callbacks.current.onRecordingChange?.(true);
    capture.current = createVoiceCapture({
      getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices), Recorder: window.MediaRecorder,
      onStarted: () => setState('recording'), onTick: setElapsed,
      onFinished: (file, duration) => { setState('idle'); callbacks.current.onRecordingChange?.(false); callbacks.current.onReady(file, duration); },
      onError: failed,
    });
    try { await capture.current.start(); } catch (err) { failed(err); }
  };
  return <div className={`voice-recorder${state !== 'idle' ? ' voice-recorder--active' : ''}`}>
    {state === 'idle' ? <button type="button" className="icon-btn input-bar__mic" disabled={disabled} onClick={start} aria-label={t('voice.record')} title={t('voice.limit')}><MicIcon /></button> : <>
      <span className="recording-dot" aria-hidden="true" /><span className="voice-recorder__time" role="status">{state === 'requesting' ? t('voice.requesting') : voiceTime(elapsed)}</span>
      <button type="button" className="btn-link" disabled={state !== 'recording'} onClick={() => { setState('processing'); capture.current.stop(); }}>{t('voice.stop')}</button>
      <button type="button" className="icon-btn" aria-label={t('actions.cancel')} onClick={() => { capture.current.cancel(); setState('idle'); callbacks.current.onRecordingChange?.(false); }}>×</button>
    </>}
    {error && <p className="voice-recorder__error" role="alert">{error}</p>}
  </div>;
}
