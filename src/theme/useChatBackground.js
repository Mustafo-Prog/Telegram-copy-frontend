import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_BACKGROUND, backgroundStorageKey, loadBackground, saveBackground } from '../utils/chatBackground.js';

const cache = new Map();

export function useBackgroundImageUrl(blob) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!blob) { setImage(null); return; }
    const url = URL.createObjectURL(blob);
    setImage({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return image && image.blob === blob ? image.url : null;
}

export default function useChatBackground(userId, chatKey) {
  const key = backgroundStorageKey(userId, chatKey);
  const [state, setState] = useState(() => ({ key, config: cache.get(key) ?? DEFAULT_BACKGROUND, loading: true, error: null }));
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const config = await loadBackground(userId, chatKey);
        if (active) { cache.set(key, config); setState({ key, config, loading: false, error: null }); }
      } catch (error) {
        if (active) setState({ key, config: cache.get(key) ?? DEFAULT_BACKGROUND, loading: false, error });
      }
    };
    void refresh();
    const onChange = (event) => { if (event.detail === key) void refresh(); };
    window.addEventListener('tg:background-changed', onChange);
    return () => { active = false; window.removeEventListener('tg:background-changed', onChange); };
  }, [key, userId, chatKey]);
  const config = state.key === key ? state.config : cache.get(key) ?? DEFAULT_BACKGROUND;
  const imageUrl = useBackgroundImageUrl(config.imageBlob);
  const save = useCallback(async (value) => {
    const saved = await saveBackground(userId, chatKey, value);
    cache.set(key, saved);
    setState({ key, config: saved, loading: false, error: null });
    window.dispatchEvent(new CustomEvent('tg:background-changed', { detail: key }));
    return saved;
  }, [key, userId, chatKey]);
  return { config, imageUrl, save, loading: state.key !== key || state.loading, error: state.key === key ? state.error : null };
}
