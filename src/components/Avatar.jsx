import { useState } from 'react';
import { hueFromSeed } from '../utils/hue.js';
import { resolveAvatarUrl } from '../utils/avatar.js';

// Фото, если оно есть и загрузилось; иначе первая буква имени на цветном фоне
export default function Avatar({ name, seed = name, size = 40, src }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const initial = Array.from((name || '?').trim())[0]?.toUpperCase() ?? '?';
  const imageUrl = resolveAvatarUrl(src);
  const showImage = Boolean(imageUrl) && imageUrl !== failedSrc;

  return (
    <div
      className="avatar"
      style={{ '--hue': hueFromSeed(seed), width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={imageUrl} alt="" loading="lazy" onError={() => setFailedSrc(imageUrl)} />
      ) : (
        initial
      )}
    </div>
  );
}
