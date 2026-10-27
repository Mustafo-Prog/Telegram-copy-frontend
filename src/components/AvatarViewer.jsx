import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { resolveAvatarUrl } from '../utils/avatar.js';
import '../styles/avatarViewer.css';

export default function AvatarViewer({ src, name, onClose }) {
  const { t } = useI18n();
  const closeRef = useRef(null);
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [failedUrl, setFailedUrl] = useState(null);
  const imageUrl = resolveAvatarUrl(src);
  const imageState = failedUrl === imageUrl ? 'failed' : loadedUrl === imageUrl ? 'ready' : 'loading';

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    // Capture Escape before the profile or chat handlers: close only this layer.
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, [onClose]);

  const closeBackdrop = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div className="avatar-viewer" role="dialog" aria-modal="true" aria-label={t('avatarViewer.title', { name })} onMouseDown={closeBackdrop}>
      <header className="avatar-viewer__header">
        <div><strong>{name}</strong><span>{t('avatarViewer.photo')}</span></div>
        <button ref={closeRef} type="button" className="avatar-viewer__close" onClick={onClose} aria-label={t('avatarViewer.close')}>×</button>
      </header>
      <div className="avatar-viewer__stage" onMouseDown={closeBackdrop}>
        {imageState === 'loading' && <span className="avatar-viewer__status" role="status">{t('avatarViewer.loading')}</span>}
        {imageState === 'failed' ? <p className="avatar-viewer__status" role="alert">{t('avatarViewer.failed')}</p> :
          <img key={imageUrl} className={`avatar-viewer__image${imageState === 'loading' ? ' avatar-viewer__image--loading' : ''}`} src={imageUrl} alt={name} onLoad={() => setLoadedUrl(imageUrl)} onError={() => setFailedUrl(imageUrl)} />}
      </div>
    </div>,
    document.body
  );
}
