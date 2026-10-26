import { useEffect, useRef } from 'react';
import { attachSwipeBack } from './swipeCore.js';

export function useSwipeBack(ref, onBack, enabled) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    return attachSwipeBack(el, () => onBackRef.current());
  }, [ref, enabled]);
}
