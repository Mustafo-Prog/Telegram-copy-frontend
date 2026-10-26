import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 760px)';

// Мобильный режим: один экран (список или чат). Совпадает с CSS-брейкпоинтом.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
