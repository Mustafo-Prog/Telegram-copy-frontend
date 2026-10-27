import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { DEFAULT_BACKGROUND, PRESETS, backgroundStyle, prepareBackgroundImage } from '../utils/chatBackground.js';
import { useBackgroundImageUrl } from '../theme/useChatBackground.js';
import ModalFrame from './ModalFrame.jsx';
import { CheckIcon, ImageIcon } from './icons.jsx';
import '../styles/chatBackground.css';

export default function ChatBackgroundModal({ config, onSave, onClose, loadError }) {
  const { t, tError } = useI18n();
  const [draft, setDraft] = useState(config);
  const [color, setColor] = useState(config.color ?? '#dcece2');
  const [photo, setPhoto] = useState(config.imageBlob ?? null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(loadError ? tError(loadError) : null);
  const fileRef = useRef(null);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const imageUrl = useBackgroundImageUrl(draft.type === 'image' ? draft.imageBlob : null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestId.current++; }; }, []);
  const close = useCallback(() => { if (!saving) onClose(); }, [saving, onClose]);
  const choose = (value) => { requestId.current++; setProcessing(false); setError(null); setDraft(value); };
  const upload = async (file) => {
    if (!file) return;
    const id = ++requestId.current;
    setProcessing(true); setError(null);
    try {
      const imageBlob = await prepareBackgroundImage(file);
      if (mounted.current && requestId.current === id) {
        setPhoto(imageBlob); setDraft((current) => ({ type: 'image', imageBlob, dim: current.dim }));
      }
    } catch (err) { if (mounted.current && requestId.current === id) setError(tError(err)); }
    finally { if (mounted.current && requestId.current === id) setProcessing(false); }
  };
  return <ModalFrame title={t('background.title')} onClose={close} wide>
    <p className="field__hint background-hint">{t('background.hint')}</p>
    <div className={`background-preview${draft.type === 'default' ? ' background-preview--default' : ''}`} style={backgroundStyle(draft, imageUrl)} role="img" aria-label={t('background.preview')}>
      <span className="background-preview__bubble">{t('background.previewIncoming')}</span>
      <span className="background-preview__bubble background-preview__bubble--own">{t('background.previewOutgoing')}</span>
    </div>
    <div className="background-presets" role="group" aria-label={t('background.title')}>
      {[{ id: 'default' }, ...PRESETS].map((preset) => {
        const selected = preset.id === 'default' ? draft.type === 'default' : draft.type === 'preset' && draft.preset === preset.id;
        return <button type="button" key={preset.id} className={`background-choice${selected ? ' background-choice--selected' : ''}`} aria-pressed={selected} disabled={saving} onClick={() => choose(preset.id === 'default' ? DEFAULT_BACKGROUND : { type: 'preset', preset: preset.id, dim: draft.dim })}>
          <span className={`background-choice__sample${preset.id === 'default' ? ' background-choice__sample--default' : ''}`} style={preset.id === 'default' ? undefined : backgroundStyle({ type: 'preset', preset: preset.id })}>{selected && <CheckIcon />}</span>
          <span>{t(`background.${preset.id}`)}</span>
        </button>;
      })}
    </div>
    <div className="background-custom">
      <label className={`background-color${draft.type === 'color' ? ' background-color--selected' : ''}`} onClick={() => { if (!saving) choose({ type: 'color', color, dim: draft.dim }); }}>
        <input type="color" value={color} disabled={saving} aria-label={t('background.color')} onInput={(event) => { setColor(event.currentTarget.value); choose({ type: 'color', color: event.currentTarget.value, dim: draft.dim }); }} onChange={(event) => { setColor(event.target.value); choose({ type: 'color', color: event.target.value, dim: draft.dim }); }} />
        <span>{t('background.color')}</span>
      </label>
      <button type="button" className="btn-ghost background-upload" disabled={saving || processing} onClick={() => fileRef.current?.click()}><ImageIcon width={18} height={18} />{processing ? t('common.loading') : t('background.upload')}</button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
      {photo && <button type="button" className="btn-link background-photo" aria-pressed={draft.type === 'image'} disabled={saving} onClick={() => choose({ type: 'image', imageBlob: photo, dim: draft.dim })}>{t('background.photo')}</button>}
    </div>
    <p className="field__hint background-file-hint">{t('background.fileHint')}</p>
    {draft.type !== 'default' && <label className="background-dim"><span>{t('background.dim')}<output>{draft.dim}%</output></span><input type="range" min="0" max="70" step="5" value={draft.dim} disabled={saving} onChange={(event) => setDraft((value) => ({ ...value, dim: Number(event.target.value) }))} /></label>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="background-actions"><button type="button" className="btn-ghost" disabled={saving} onClick={close}>{t('actions.cancel')}</button><button type="button" className="btn-primary" disabled={saving || processing} onClick={async () => {
      setSaving(true); setError(null);
      try { await onSave(draft); onClose(); }
      catch (err) { if (mounted.current) setError(tError(err)); }
      finally { if (mounted.current) setSaving(false); }
    }}>{saving ? t('common.loading') : t('background.apply')}</button></div>
  </ModalFrame>;
}
