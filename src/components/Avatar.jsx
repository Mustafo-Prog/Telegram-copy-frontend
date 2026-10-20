import { hueFromSeed } from '../utils/hue.js';

export default function Avatar({ name, seed = name, size = 40 }) {
  const initial = Array.from((name || '?').trim())[0]?.toUpperCase() ?? '?';
  return (
    <div
      className="avatar"
      style={{ '--hue': hueFromSeed(seed), width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
